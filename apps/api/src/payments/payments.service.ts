import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ErrorCode,
  type SettleReferralPaidEventRequest,
  type SettleReferralPaidEventResponse,
  settleReferralPaidEventRequestSchema,
} from '@eggturtle/shared';

import { ReferralsService } from '../referrals/referrals.service';

type PaymentProvider = 'alipay' | 'wechat';

type ProviderReadiness = {
  enabled: boolean;
  requiredFields: string[];
  optionalFields: string[];
  providedFields: string[];
  missingFields: string[];
  ready: boolean;
};

type PaymentReadiness = {
  featureEnabled: boolean;
  ready: boolean;
  checkedAt: string;
  providers: Record<PaymentProvider, ProviderReadiness>;
};

type WebhookHandleResult = {
  accepted: boolean;
  provider: PaymentProvider;
  message: string;
  settlement?: SettleReferralPaidEventResponse | null;
};

const PROVIDER_CONFIG: Record<
  PaymentProvider,
  {
    enabledEnv: string;
    required: string[];
    optional: string[];
  }
> = {
  alipay: {
    enabledEnv: 'PAYMENT_ALIPAY_ENABLED',
    required: [
      'PAYMENT_ALIPAY_APP_ID',
      'PAYMENT_ALIPAY_PRIVATE_KEY',
      'PAYMENT_ALIPAY_PUBLIC_KEY',
      'PAYMENT_ALIPAY_NOTIFY_URL'
    ],
    optional: ['PAYMENT_ALIPAY_GATEWAY']
  },
  wechat: {
    enabledEnv: 'PAYMENT_WECHAT_ENABLED',
    required: [
      'PAYMENT_WECHAT_MCH_ID',
      'PAYMENT_WECHAT_API_V3_KEY',
      'PAYMENT_WECHAT_PRIVATE_KEY_PATH',
      'PAYMENT_WECHAT_PLATFORM_SERIAL_NO',
      'PAYMENT_WECHAT_NOTIFY_URL'
    ],
    optional: ['PAYMENT_WECHAT_APP_ID', 'PAYMENT_WECHAT_MCH_SERIAL_NO']
  }
};

@Injectable()
export class PaymentsService {
  constructor(private readonly referralsService: ReferralsService) {}

  getReadiness(): PaymentReadiness {
    const featureEnabled = this.isTrue('PAYMENT_FEATURE_ENABLED');
    const providers = {
      alipay: this.getProviderReadiness('alipay'),
      wechat: this.getProviderReadiness('wechat')
    };

    return {
      featureEnabled,
      ready:
        featureEnabled &&
        Object.values(providers).some((provider) => provider.enabled && provider.ready),
      checkedAt: new Date().toISOString(),
      providers
    };
  }

  async handleWechatWebhook(body: unknown): Promise<WebhookHandleResult> {
    this.ensureProviderEnabled('wechat');
    return this.handleReferralWebhook('wechat', body);
  }

  async handleAlipayWebhook(body: unknown): Promise<WebhookHandleResult> {
    this.ensureProviderEnabled('alipay');
    return this.handleReferralWebhook('alipay', body);
  }

  async settleReferralPaidEvent(
    payload: SettleReferralPaidEventRequest,
    actorUserId?: string | null,
  ): Promise<SettleReferralPaidEventResponse> {
    return this.referralsService.awardReferralForPaidOrder({
      actorUserId,
      userId: payload.userId,
      tenantId: payload.tenantId,
      provider: payload.provider,
      orderId: payload.orderId,
      paymentId: payload.paymentId ?? null,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
    });
  }

  private getProviderReadiness(provider: PaymentProvider): ProviderReadiness {
    const config = PROVIDER_CONFIG[provider];
    const providerEnabled = this.isTrue(config.enabledEnv);
    const requiredFields = [...config.required];
    const optionalFields = [...config.optional];
    const allFields = [...requiredFields, ...optionalFields];
    const providedFields = allFields.filter((name) => this.getEnv(name).length > 0);
    const missingFields = requiredFields.filter((name) => this.getEnv(name).length === 0);

    return {
      enabled: providerEnabled,
      requiredFields,
      optionalFields,
      providedFields,
      missingFields,
      ready: providerEnabled && missingFields.length === 0
    };
  }

  private ensureProviderEnabled(provider: PaymentProvider): void {
    if (!this.isTrue('PAYMENT_FEATURE_ENABLED')) {
      throw new ServiceUnavailableException({
        message: 'Payment feature is disabled by environment.',
        errorCode: ErrorCode.ApiUnavailable
      });
    }

    const readiness = this.getProviderReadiness(provider);
    if (!readiness.enabled) {
      throw new ServiceUnavailableException({
        message: `Payment provider '${provider}' is disabled by environment.`,
        errorCode: ErrorCode.ApiUnavailable
      });
    }

    if (!readiness.ready) {
      throw new ServiceUnavailableException({
        message: `Payment provider '${provider}' is not ready. Missing required configuration.`,
        errorCode: ErrorCode.ApiUnavailable,
        data: {
          missingFields: readiness.missingFields
        }
      });
    }
  }

  private async handleReferralWebhook(
    provider: PaymentProvider,
    body: unknown
  ): Promise<WebhookHandleResult> {
    const parsed = settleReferralPaidEventRequestSchema.parse({
      ...(typeof body === 'object' && body ? body : {}),
      provider,
    });

    const settlement = await this.referralsService.awardReferralForPaidOrder({
      userId: parsed.userId,
      tenantId: parsed.tenantId,
      provider: parsed.provider,
      orderId: parsed.orderId,
      paymentId: parsed.paymentId ?? null,
      paidAt: parsed.paidAt ? new Date(parsed.paidAt) : undefined,
    });

    return {
      accepted: true,
      provider,
      message: `Accepted ${provider} webhook for referral settlement.`,
      settlement,
    };
  }

  private isTrue(name: string): boolean {
    return this.getEnv(name).toLowerCase() === 'true';
  }

  private getEnv(name: string): string {
    return process.env[name]?.trim() ?? '';
  }
}
