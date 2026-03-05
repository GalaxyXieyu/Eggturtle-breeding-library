import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import DypnsapiClient, { SendSmsVerifyCodeRequest } from '@alicloud/dypnsapi20170525/dist/client';
import * as OpenApi from '@alicloud/openapi-client/dist/client';

type SendRegisterSmsCodeInput = {
  phoneNumber: string;
  code: string;
  validTimeSeconds: number;
  outId: string;
};

@Injectable()
export class SmsVerificationService {
  private readonly logger = new Logger(SmsVerificationService.name);
  private client: DypnsapiClient | null = null;

  async sendRegisterSmsCode(input: SendRegisterSmsCodeInput): Promise<void> {
    const templateParam = this.buildTemplateParam(input.code, input.validTimeSeconds);
    const request = new SendSmsVerifyCodeRequest({
      countryCode: process.env.ALIYUN_SMS_COUNTRY_CODE?.trim() || '86',
      phoneNumber: input.phoneNumber,
      signName: this.readRequiredEnv('ALIYUN_SMS_SIGN_NAME'),
      templateCode: this.readRequiredEnv('ALIYUN_SMS_TEMPLATE_CODE'),
      templateParam,
      validTime: input.validTimeSeconds,
      duplicatePolicy: this.parseIntegerEnv('ALIYUN_SMS_DUPLICATE_POLICY', 1),
      interval: this.parseIntegerEnv('ALIYUN_SMS_INTERVAL_SECONDS', 60),
      autoRetry: this.parseIntegerEnv('ALIYUN_SMS_AUTO_RETRY', 1),
      returnVerifyCode: false,
      outId: input.outId,
      schemeName: process.env.ALIYUN_SMS_SCHEME_NAME?.trim() || undefined
    });

    try {
      const client = this.getClient();
      const response = await client.sendSmsVerifyCode(request);
      const body = response.body;

      if (body?.code !== 'OK' || body?.success !== true) {
        throw new ServiceUnavailableException({
          message: `SMS provider returned non-success status: ${body?.code ?? 'UNKNOWN'} ${body?.message ?? ''}`.trim(),
          errorCode: ErrorCode.ApiUnavailable
        });
      }

      this.logger.log(
        `sms code sent to ${this.maskPhoneNumber(input.phoneNumber)}, bizId=${body.model?.bizId ?? 'n/a'}, requestId=${body.requestId ?? 'n/a'}`
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const message = this.extractErrorMessage(error);
      this.logger.error(`failed to send sms code: ${message}`);
      throw new ServiceUnavailableException({
        message: 'SMS service is unavailable.',
        errorCode: ErrorCode.ApiUnavailable
      });
    }
  }

  private buildTemplateParam(code: string, validTimeSeconds: number): string {
    const codeKey = process.env.ALIYUN_SMS_TEMPLATE_PARAM_CODE_KEY?.trim() || 'code';
    const minutesKey = process.env.ALIYUN_SMS_TEMPLATE_PARAM_MIN_KEY?.trim() || 'min';
    const validMinutes = Math.max(1, Math.ceil(validTimeSeconds / 60));

    const payload: Record<string, string> = {
      [codeKey]: code
    };

    if (minutesKey) {
      payload[minutesKey] = String(validMinutes);
    }

    return JSON.stringify(payload);
  }

  private getClient(): DypnsapiClient {
    if (this.client) {
      return this.client;
    }

    const accessKeyId = this.readRequiredEnv('ALIYUN_SMS_ACCESS_KEY_ID');
    const accessKeySecret = this.readRequiredEnv('ALIYUN_SMS_ACCESS_KEY_SECRET');
    const endpoint = process.env.ALIYUN_SMS_ENDPOINT?.trim() || 'dypnsapi.aliyuncs.com';
    const regionId = process.env.ALIYUN_SMS_REGION_ID?.trim() || 'cn-hangzhou';

    this.client = new DypnsapiClient(
      new OpenApi.Config({
        accessKeyId,
        accessKeySecret,
        endpoint,
        regionId
      })
    );

    return this.client;
  }

  private readRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }

    throw new ServiceUnavailableException({
      message: `${name} is not configured.`,
      errorCode: ErrorCode.ApiUnavailable
    });
  }

  private parseIntegerEnv(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) {
      return fallback;
    }

    const value = Number.parseInt(raw, 10);
    if (Number.isFinite(value)) {
      return value;
    }

    return fallback;
  }

  private extractErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return String(error);
    }

    if ('message' in error && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    if ('data' in error && error.data && typeof error.data === 'object') {
      const data = error.data as Record<string, unknown>;
      const code = typeof data.Code === 'string' ? data.Code : 'UNKNOWN';
      const message = typeof data.Message === 'string' ? data.Message : 'Unknown provider error';
      return `${code}: ${message}`;
    }

    return 'Unknown error';
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 7) {
      return phoneNumber;
    }

    return `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`;
  }
}
