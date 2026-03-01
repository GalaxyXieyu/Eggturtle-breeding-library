import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type AiAssistantQuotaStatusResponse,
  type AiAutoRecordIntent,
  type AiAutoRecordIntentRequest,
  type AiAutoRecordIntentResponse,
  type AiCreateTopUpOrderRequest,
  type AiCreateTopUpOrderResponse,
  type AiListTopUpPacksResponse,
  type AiQueryRequest,
  type AiQueryResponse,
  type AiTopUpPack,
  type TenantSubscriptionPlan
} from '@eggturtle/shared';

import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

type QuotaPreset = {
  autoRecord: number;
  queryOnly: number;
};

const PLAN_QUOTA_PRESETS: Record<TenantSubscriptionPlan, QuotaPreset> = {
  FREE: {
    autoRecord: 10,
    queryOnly: 10
  },
  BASIC: {
    autoRecord: 120,
    queryOnly: 300
  },
  PRO: {
    autoRecord: 600,
    queryOnly: 2000
  }
};

const TOP_UP_PACKS: AiTopUpPack[] = [
  {
    id: 'ai_auto_record_100',
    name: '自动记录 100 次',
    capability: 'auto_record',
    credits: 100,
    priceCents: 1990,
    currency: 'CNY'
  },
  {
    id: 'ai_auto_record_300',
    name: '自动记录 300 次',
    capability: 'auto_record',
    credits: 300,
    priceCents: 4990,
    currency: 'CNY'
  },
  {
    id: 'ai_query_300',
    name: '问数 300 次',
    capability: 'query_only',
    credits: 300,
    priceCents: 990,
    currency: 'CNY'
  },
  {
    id: 'ai_query_1000',
    name: '问数 1000 次',
    capability: 'query_only',
    credits: 1000,
    priceCents: 2990,
    currency: 'CNY'
  }
];

@Injectable()
export class AiAssistantService {
  constructor(private readonly tenantSubscriptionsService: TenantSubscriptionsService) {}

  async getQuotaStatus(tenantId: string): Promise<AiAssistantQuotaStatusResponse> {
    const subscription = await this.tenantSubscriptionsService.getSubscriptionForTenant(tenantId);
    const now = new Date();
    const resetAt = this.getNextMonthlyResetAt(now);
    const preset = PLAN_QUOTA_PRESETS[subscription.plan];

    const autoRecord = {
      capability: 'auto_record' as const,
      period: 'monthly' as const,
      unit: 'action_count' as const,
      baseLimit: preset.autoRecord,
      topUpBalance: 0,
      consumed: 0,
      remaining: preset.autoRecord,
      resetAt
    };

    const queryOnly = {
      capability: 'query_only' as const,
      period: 'monthly' as const,
      unit: 'query_count' as const,
      baseLimit: preset.queryOnly,
      topUpBalance: 0,
      consumed: 0,
      remaining: preset.queryOnly,
      resetAt
    };

    return {
      tenantId,
      plan: subscription.plan,
      allowMultipleTopUps: true,
      highlights: {
        autoRecord: {
          capability: autoRecord.capability,
          baseLimit: autoRecord.baseLimit,
          topUpBalance: autoRecord.topUpBalance,
          remaining: autoRecord.remaining,
          consumed: autoRecord.consumed
        },
        queryOnly: {
          capability: queryOnly.capability,
          baseLimit: queryOnly.baseLimit,
          topUpBalance: queryOnly.topUpBalance,
          remaining: queryOnly.remaining,
          consumed: queryOnly.consumed
        }
      },
      items: [autoRecord, queryOnly],
      checkedAt: now.toISOString()
    };
  }

  listTopUpPacks(): AiListTopUpPacksResponse {
    return {
      allowMultipleTopUps: true,
      packs: TOP_UP_PACKS.map((pack) => ({ ...pack }))
    };
  }

  createTopUpOrder(payload: AiCreateTopUpOrderRequest): AiCreateTopUpOrderResponse {
    const pack = TOP_UP_PACKS.find((item) => item.id === payload.packId);

    if (!pack) {
      throw new BadRequestException({
        message: 'Invalid AI top-up pack id.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    return {
      status: 'reserved',
      message: 'AI 充值下单接口已预留，支付回调与额度入账尚未接通。',
      order: {
        orderId: `ai_topup_${randomUUID()}`,
        packId: pack.id,
        capability: pack.capability,
        quantity: payload.quantity,
        totalCredits: pack.credits * payload.quantity,
        totalPriceCents: pack.priceCents * payload.quantity,
        currency: pack.currency,
        paymentChannel: payload.paymentChannel,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      },
      todo: [
        {
          code: 'PAYMENT_NOT_CONNECTED',
          detail: '接入支付下单、支付回调与签名验签。'
        },
        {
          code: 'NO_DB_PERSISTENCE',
          detail: '落库订单与额度流水后，再启用真实扣增逻辑。'
        }
      ]
    };
  }

  parseAutoRecordIntent(payload: AiAutoRecordIntentRequest): AiAutoRecordIntentResponse {
    const intent = this.buildAutoRecordIntent(payload.input, payload.referenceDate);

    return {
      requestId: randomUUID(),
      status: 'reserved',
      capability: 'auto_record',
      message: '已返回意图预览；自动写入记录仍需后续接入管理员智能体。',
      preview: {
        intents: intent ? [intent] : [],
        requiresManualConfirm: true
      },
      todo: [
        {
          code: 'AUTO_EXECUTION_NOT_ENABLED',
          detail: '需接入管理员智能体与字段校验流程后，才允许自动入库。'
        },
        {
          code: 'NO_DB_PERSISTENCE',
          detail: '当前接口不执行任何数据库写入。'
        }
      ]
    };
  }

  query(payload: AiQueryRequest): AiQueryResponse {
    return {
      requestId: randomUUID(),
      status: 'reserved',
      capability: 'query_only',
      message: '智能问数接口已预留，当前仅返回建议指标，不执行真实数据查询。',
      suggestedMetrics: this.suggestMetrics(payload.question),
      todo: [
        {
          code: 'QUERY_ENGINE_NOT_ENABLED',
          detail: '后续需要接入查询规划、SQL 安全层与结果渲染器。'
        }
      ]
    };
  }

  private buildAutoRecordIntent(input: string, referenceDate?: string): AiAutoRecordIntent | null {
    const text = input.trim();
    if (!text) {
      return null;
    }

    const productCodeMatch = text.match(/\b([a-z]{1,6}-?\d{1,6})\b/i);
    const productCode = productCodeMatch?.[1]?.toUpperCase() ?? null;
    const eventDate = this.extractEventDate(text, referenceDate);
    const eventType = this.detectEventType(text);

    let confidence = 0.55;
    if (productCode) {
      confidence += 0.2;
    }
    if (eventDate) {
      confidence += 0.15;
    }
    if (eventType !== 'note') {
      confidence += 0.1;
    }

    return {
      action: 'append_event',
      productCode,
      eventType,
      eventDate,
      note: text,
      confidence: Math.min(0.95, Number(confidence.toFixed(2)))
    };
  }

  private detectEventType(input: string): AiAutoRecordIntent['eventType'] {
    if (/交配|配对|mating/i.test(input)) {
      return 'mating';
    }

    if (/产蛋|下蛋|egg/i.test(input)) {
      return 'egg_laid';
    }

    if (/出壳|孵化|hatch/i.test(input)) {
      return 'hatch';
    }

    return 'note';
  }

  private extractEventDate(input: string, referenceDate?: string): string | null {
    const match = input.match(/(\d{1,2})[./-](\d{1,2})/);
    if (!match) {
      return null;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const reference = referenceDate ? new Date(`${referenceDate}T00:00:00.000Z`) : new Date();
    const year = Number.isNaN(reference.getTime()) ? new Date().getUTCFullYear() : reference.getUTCFullYear();
    const candidate = new Date(Date.UTC(year, month - 1, day));

    if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
      return null;
    }

    const isoMonth = String(month).padStart(2, '0');
    const isoDay = String(day).padStart(2, '0');
    return `${year}-${isoMonth}-${isoDay}`;
  }

  private suggestMetrics(question: string): string[] {
    const text = question.toLowerCase();
    const metrics = new Set<string>();

    if (text.includes('交配') || text.includes('mating')) {
      metrics.add('mating_event_count');
    }

    if (text.includes('产蛋') || text.includes('下蛋') || text.includes('egg')) {
      metrics.add('egg_laid_event_count');
    }

    if (text.includes('出壳') || text.includes('孵化') || text.includes('hatch')) {
      metrics.add('hatch_event_count');
    }

    if (text.includes('库存') || text.includes('in stock')) {
      metrics.add('in_stock_product_count');
    }

    if (text.includes('销量') || text.includes('售价') || text.includes('销售')) {
      metrics.add('offspring_price_summary');
    }

    if (metrics.size === 0) {
      metrics.add('product_count');
      metrics.add('event_count');
    }

    return Array.from(metrics).slice(0, 8);
  }

  private getNextMonthlyResetAt(now: Date): string {
    const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    return resetAt.toISOString();
  }
}
