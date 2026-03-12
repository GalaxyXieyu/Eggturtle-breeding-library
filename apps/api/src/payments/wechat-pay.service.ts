import {
  createDecipheriv,
  createPrivateKey,
  createSign,
  createVerify,
  KeyObject,
  randomBytes,
  X509Certificate,
} from 'node:crypto';
import { accessSync, constants, readFileSync } from 'node:fs';
import * as path from 'node:path';

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode, type SubscriptionOrderWechatJsapiParams } from '@eggturtle/shared';

type ProviderReadiness = {
  enabled: boolean;
  requiredFields: string[];
  optionalFields: string[];
  providedFields: string[];
  missingFields: string[];
  ready: boolean;
};

type RequestConfig = {
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
};

type CreateJsapiOrderInput = {
  orderNo: string;
  description: string;
  totalAmountCents: number;
  openId: string;
  expiresAt: Date;
};

type WechatNotificationEnvelope = {
  id: string;
  create_time: string;
  event_type: string;
  resource_type: string;
  summary: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    associated_data?: string;
    nonce: string;
    original_type: string;
  };
};

export type WechatPaymentNotification = {
  appid: string;
  mchid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_state: string;
  trade_state_desc?: string;
  success_time?: string;
  amount: {
    total: number;
    currency: string;
    payer_total?: number;
    payer_currency?: string;
  };
  payer?: {
    openid?: string;
  };
};

const REQUIRED_FIELDS = [
  'PAYMENT_WECHAT_MCH_ID',
  'PAYMENT_WECHAT_APP_ID',
  'WECHAT_MP_APP_SECRET',
  'PAYMENT_WECHAT_API_V3_KEY',
  'PAYMENT_WECHAT_MCH_SERIAL_NO',
  'PAYMENT_WECHAT_PRIVATE_KEY_PATH',
  'PAYMENT_WECHAT_PLATFORM_SERIAL_NO',
  'PAYMENT_WECHAT_PLATFORM_CERT_PATH',
  'PAYMENT_WECHAT_NOTIFY_URL',
] as const;

const OPTIONAL_FIELDS = [] as const;

@Injectable()
export class WechatPayService {
  private merchantPrivateKey: KeyObject | null = null;
  private platformCertificate: X509Certificate | null = null;

  getReadiness(): ProviderReadiness {
    const providedFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].filter((name) =>
      this.isFieldProvided(name),
    );
    const missingFields = REQUIRED_FIELDS.filter((name) => !this.isFieldProvided(name));

    return {
      enabled: this.isEnabled(),
      requiredFields: [...REQUIRED_FIELDS],
      optionalFields: [...OPTIONAL_FIELDS],
      providedFields,
      missingFields,
      ready: this.isEnabled() && missingFields.length === 0,
    };
  }

  assertReady(): void {
    const readiness = this.getReadiness();
    if (!this.isFeatureEnabled()) {
      throw new ServiceUnavailableException({
        message: 'Payment feature is disabled by environment.',
        errorCode: ErrorCode.ApiUnavailable,
      });
    }

    if (!readiness.enabled) {
      throw new ServiceUnavailableException({
        message: 'WeChat payment is disabled by environment.',
        errorCode: ErrorCode.ApiUnavailable,
      });
    }

    if (!readiness.ready) {
      throw new ServiceUnavailableException({
        message: 'WeChat payment is not ready. Missing required configuration.',
        errorCode: ErrorCode.ApiUnavailable,
        data: {
          missingFields: readiness.missingFields,
        },
      });
    }
  }

  async createJsapiOrder(input: CreateJsapiOrderInput): Promise<{ prepayId: string }> {
    this.assertReady();

    const response = await this.requestJson<{ prepay_id?: string }>({
      method: 'POST',
      path: '/v3/pay/transactions/jsapi',
      body: {
        appid: this.getAppId(),
        mchid: this.getMchId(),
        description: input.description,
        out_trade_no: input.orderNo,
        time_expire: input.expiresAt.toISOString(),
        notify_url: this.getNotifyUrl(),
        amount: {
          total: input.totalAmountCents,
          currency: 'CNY',
        },
        payer: {
          openid: input.openId,
        },
      },
    });

    if (!response.prepay_id) {
      throw new ServiceUnavailableException({
        message: 'WeChat payment did not return prepay_id.',
        errorCode: ErrorCode.ApiUnavailable,
      });
    }

    return {
      prepayId: response.prepay_id,
    };
  }

  buildJsapiPayParams(prepayId: string): SubscriptionOrderWechatJsapiParams {
    this.assertReady();

    const timeStamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = randomBytes(16).toString('hex');
    const packageValue = `prepay_id=${prepayId}`;
    const message = `${this.getAppId()}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;

    return {
      appId: this.getAppId(),
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: 'RSA',
      paySign: this.signMessage(message),
    };
  }

  async closeOrder(orderNo: string): Promise<void> {
    this.assertReady();

    await this.requestJson({
      method: 'POST',
      path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}/close`,
      body: {
        mchid: this.getMchId(),
      },
    });
  }

  parseNotification(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): WechatPaymentNotification {
    this.assertReady();
    this.verifyNotificationSignature(headers, rawBody);

    const envelope = JSON.parse(rawBody) as WechatNotificationEnvelope;
    const decrypted = this.decryptNotificationResource(envelope.resource);
    return JSON.parse(decrypted) as WechatPaymentNotification;
  }

  private verifyNotificationSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): void {
    const signature = this.getHeader(headers, 'wechatpay-signature');
    const timestamp = this.getHeader(headers, 'wechatpay-timestamp');
    const nonce = this.getHeader(headers, 'wechatpay-nonce');
    const serial = this.getHeader(headers, 'wechatpay-serial');

    if (!signature || !timestamp || !nonce || !serial) {
      throw new UnauthorizedException({
        message: 'Missing WeChat payment signature headers.',
        errorCode: ErrorCode.PaymentSignatureInvalid,
      });
    }

    if (serial !== this.getPlatformSerialNo()) {
      throw new UnauthorizedException({
        message: 'Unexpected WeChat payment platform serial number.',
        errorCode: ErrorCode.PaymentSignatureInvalid,
      });
    }

    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(message);
    verifier.end();

    const verified = verifier.verify(this.getPlatformCertificate().publicKey, signature, 'base64');
    if (!verified) {
      throw new UnauthorizedException({
        message: 'Invalid WeChat payment signature.',
        errorCode: ErrorCode.PaymentSignatureInvalid,
      });
    }
  }

  private decryptNotificationResource(resource: WechatNotificationEnvelope['resource']): string {
    if (resource.algorithm !== 'AEAD_AES_256_GCM') {
      throw new BadRequestException({
        message: 'Unsupported WeChat payment notification algorithm.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    const decoded = Buffer.from(resource.ciphertext, 'base64');
    const ciphertext = decoded.subarray(0, decoded.length - 16);
    const authTag = decoded.subarray(decoded.length - 16);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.getApiV3Key(), 'utf8'),
      Buffer.from(resource.nonce, 'utf8'),
    );
    decipher.setAAD(Buffer.from(resource.associated_data ?? '', 'utf8'));
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  private async requestJson<T = Record<string, unknown>>(config: RequestConfig): Promise<T> {
    const bodyText = config.body ? JSON.stringify(config.body) : '';
    const authorization = this.buildAuthorization(config.method, config.path, bodyText);
    const response = await fetch(`https://api.mch.weixin.qq.com${config.path}`, {
      method: config.method,
      headers: {
        Accept: 'application/json',
        ...(config.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: authorization,
      },
      body: config.body ? bodyText : undefined,
      cache: 'no-store',
    });

    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    const payload = text ? ((JSON.parse(text) as unknown) as T & { message?: string }) : ({} as T);

    if (!response.ok) {
      throw new ServiceUnavailableException({
        message:
          (payload as { message?: string }).message ??
          `WeChat payment request failed with status ${response.status}.`,
        errorCode: ErrorCode.ApiUnavailable,
      });
    }

    return payload;
  }

  private buildAuthorization(method: string, canonicalPath: string, bodyText: string): string {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString('hex');
    const message = `${method}\n${canonicalPath}\n${timestamp}\n${nonce}\n${bodyText}\n`;
    const signature = this.signMessage(message);

    return `WECHATPAY2-SHA256-RSA2048 mchid=\"${this.getMchId()}\",nonce_str=\"${nonce}\",timestamp=\"${timestamp}\",serial_no=\"${this.getMerchantSerialNo()}\",signature=\"${signature}\"`;
  }

  private signMessage(message: string): string {
    const signer = createSign('RSA-SHA256');
    signer.update(message);
    signer.end();
    return signer.sign(this.getMerchantPrivateKey(), 'base64');
  }

  private getMerchantPrivateKey(): KeyObject {
    if (!this.merchantPrivateKey) {
      this.merchantPrivateKey = createPrivateKey(readFileSync(this.resolveReadablePath('PAYMENT_WECHAT_PRIVATE_KEY_PATH'), 'utf8'));
    }

    return this.merchantPrivateKey;
  }

  private getPlatformCertificate(): X509Certificate {
    if (!this.platformCertificate) {
      this.platformCertificate = new X509Certificate(
        readFileSync(this.resolveReadablePath('PAYMENT_WECHAT_PLATFORM_CERT_PATH'), 'utf8'),
      );
    }

    return this.platformCertificate;
  }

  private resolveReadablePath(name: 'PAYMENT_WECHAT_PRIVATE_KEY_PATH' | 'PAYMENT_WECHAT_PLATFORM_CERT_PATH'): string {
    const configuredPath = this.getEnv(name);
    const resolvedPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
    accessSync(resolvedPath, constants.R_OK);
    return resolvedPath;
  }

  private isFieldProvided(name: string): boolean {
    const value = this.getEnv(name);
    if (!value) {
      return false;
    }

    if (name.endsWith('_PATH')) {
      try {
        this.resolveReadablePath(name as 'PAYMENT_WECHAT_PRIVATE_KEY_PATH' | 'PAYMENT_WECHAT_PLATFORM_CERT_PATH');
        return true;
      } catch {
        return false;
      }
    }

    return true;
  }

  private getHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
    const value = headers[name];
    if (typeof value === 'string') {
      return value.trim();
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0].trim();
    }
    return '';
  }

  private isFeatureEnabled(): boolean {
    return this.getEnv('PAYMENT_FEATURE_ENABLED').toLowerCase() === 'true';
  }

  private isEnabled(): boolean {
    return this.getEnv('PAYMENT_WECHAT_ENABLED').toLowerCase() === 'true';
  }

  private getAppId(): string {
    return this.getEnv('PAYMENT_WECHAT_APP_ID');
  }

  private getMchId(): string {
    return this.getEnv('PAYMENT_WECHAT_MCH_ID');
  }

  private getApiV3Key(): string {
    return this.getEnv('PAYMENT_WECHAT_API_V3_KEY');
  }

  private getMerchantSerialNo(): string {
    return this.getEnv('PAYMENT_WECHAT_MCH_SERIAL_NO');
  }

  private getPlatformSerialNo(): string {
    return this.getEnv('PAYMENT_WECHAT_PLATFORM_SERIAL_NO');
  }

  private getNotifyUrl(): string {
    return this.getEnv('PAYMENT_WECHAT_NOTIFY_URL');
  }

  private getEnv(name: string): string {
    return process.env[name]?.trim() ?? '';
  }
}
