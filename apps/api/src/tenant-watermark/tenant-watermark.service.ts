import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  ErrorCode,
  TENANT_WATERMARK_MAX_TEXT_LENGTH,
  tenantWatermarkConfigSchema,
  tenantWatermarkStateSchema,
  type TenantWatermarkConfig,
  type TenantWatermarkState,
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma.service';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

type WatermarkTarget = 'sharePoster' | 'couplePhoto' | 'certificate';

type TenantWatermarkRow = {
  id: string;
  tenantId: string;
  enabled: boolean;
  textMode: string;
  customText: string | null;
  applyToSharePoster: boolean;
  applyToCouplePhoto: boolean;
  applyToCertificate: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AppliedTenantWatermark = {
  enabled: boolean;
  watermarkText: string | null;
  textMode: 'AUTO_TENANT_NAME' | 'CUSTOM';
  snapshot: Prisma.JsonObject | null;
};

const DEFAULT_WATERMARK_CONFIG: TenantWatermarkConfig = {
  enabled: true,
  textMode: 'AUTO_TENANT_NAME',
  customText: null,
  applyToSharePoster: true,
  applyToCouplePhoto: true,
  applyToCertificate: true,
};
const DEFAULT_WATERMARK_SUFFIX = ' · 珍藏证书';
const TENANT_WATERMARK_TABLE_NAME = 'tenant_watermark_configs';

@Injectable()
export class TenantWatermarkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
  ) {}

  async getTenantWatermarkState(tenantId: string, tenantName?: string): Promise<TenantWatermarkState> {
    const [subscription, config, resolvedTenantName] = await Promise.all([
      this.tenantSubscriptionsService.getSubscriptionForTenant(tenantId),
      this.getTenantWatermarkConfig(tenantId),
      tenantName ? Promise.resolve(tenantName) : this.getTenantName(tenantId),
    ]);

    const canUse = this.canUseMerchantWatermark(subscription.plan, subscription.status);
    const watermarkText = this.resolveWatermarkText(config, resolvedTenantName);
    const effectiveEnabled = canUse && config.enabled && Boolean(watermarkText);

    return tenantWatermarkStateSchema.parse({
      entitlement: {
        plan: subscription.plan,
        status: subscription.status,
        canEdit: canUse,
        reason: canUse ? null : this.buildEntitlementReason(subscription.plan, subscription.status),
      },
      config,
      effective: {
        enabled: effectiveEnabled,
        watermarkText: effectiveEnabled ? watermarkText : null,
        applyToSharePoster: effectiveEnabled && config.applyToSharePoster,
        applyToCouplePhoto: effectiveEnabled && config.applyToCouplePhoto,
        applyToCertificate: effectiveEnabled && config.applyToCertificate,
      },
    });
  }

  async updateTenantWatermarkConfig(
    tenantId: string,
    payload: TenantWatermarkConfig,
    tenantName?: string,
  ): Promise<TenantWatermarkState> {
    const subscription = await this.tenantSubscriptionsService.getSubscriptionForTenant(tenantId);
    if (!this.canUseMerchantWatermark(subscription.plan, subscription.status)) {
      throw new ForbiddenException({
        message: this.buildEntitlementReason(subscription.plan, subscription.status),
        errorCode: ErrorCode.TenantSubscriptionPlanInsufficient,
        data: {
          feature: 'merchant_watermark',
          requiredPlan: 'PRO',
          currentPlan: subscription.plan,
          status: subscription.status,
        },
      });
    }

    const config = tenantWatermarkConfigSchema.parse(payload);
    let row: TenantWatermarkRow | undefined;
    try {
      [row] = await this.prisma.$queryRaw<TenantWatermarkRow[]>(Prisma.sql`
        INSERT INTO tenant_watermark_configs (
          id,
          tenant_id,
          enabled,
          text_mode,
          custom_text,
          apply_to_share_poster,
          apply_to_couple_photo,
          apply_to_certificate,
          created_at,
          updated_at
        )
        VALUES (
          ${randomUUID()},
          ${tenantId},
          ${config.enabled},
          ${config.textMode},
          ${config.customText},
          ${config.applyToSharePoster},
          ${config.applyToCouplePhoto},
          ${config.applyToCertificate},
          NOW(),
          NOW()
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          text_mode = EXCLUDED.text_mode,
          custom_text = EXCLUDED.custom_text,
          apply_to_share_poster = EXCLUDED.apply_to_share_poster,
          apply_to_couple_photo = EXCLUDED.apply_to_couple_photo,
          apply_to_certificate = EXCLUDED.apply_to_certificate,
          updated_at = NOW()
        RETURNING
          id,
          tenant_id AS "tenantId",
          enabled,
          text_mode AS "textMode",
          custom_text AS "customText",
          apply_to_share_poster AS "applyToSharePoster",
          apply_to_couple_photo AS "applyToCouplePhoto",
          apply_to_certificate AS "applyToCertificate",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `);
    } catch (error) {
      if (this.isTenantWatermarkTableMissing(error)) {
        throw new ServiceUnavailableException({
          message: '商家水印配置表尚未初始化，请先执行最新数据库迁移。',
          errorCode: ErrorCode.ApiUnavailable,
        });
      }

      throw error;
    }

    if (!row) {
      throw new ServiceUnavailableException({
        message: 'Failed to persist tenant watermark configuration.',
        errorCode: ErrorCode.ApiUnavailable,
      });
    }

    return this.getTenantWatermarkState(tenantId, tenantName);
  }

  async resolveAppliedWatermark(input: {
    tenantId: string;
    tenantName: string;
    target: WatermarkTarget;
  }): Promise<AppliedTenantWatermark> {
    const state = await this.getTenantWatermarkState(input.tenantId, input.tenantName);
    const targetEnabled =
      input.target === 'sharePoster'
        ? state.effective.applyToSharePoster
        : input.target === 'couplePhoto'
          ? state.effective.applyToCouplePhoto
          : state.effective.applyToCertificate;

    if (!state.effective.enabled || !targetEnabled || !state.effective.watermarkText) {
      return {
        enabled: false,
        watermarkText: null,
        textMode: state.config.textMode,
        snapshot: null,
      };
    }

    return {
      enabled: true,
      watermarkText: state.effective.watermarkText,
      textMode: state.config.textMode,
      snapshot: {
        platformTemplate: 'merchant.only',
        tenantName: input.tenantName,
        watermarkText: state.effective.watermarkText,
        enabled: true,
        textMode: state.config.textMode,
      },
    };
  }

  buildDefaultWatermarkText(tenantName: string): string {
    const normalized = tenantName.trim() || '商家';
    const maxTenantNameLength = Math.max(
      1,
      TENANT_WATERMARK_MAX_TEXT_LENGTH - DEFAULT_WATERMARK_SUFFIX.length,
    );

    return `${normalized.slice(0, maxTenantNameLength)}${DEFAULT_WATERMARK_SUFFIX}`;
  }

  private async getTenantName(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    return tenant?.name?.trim() || '商家';
  }

  private async getTenantWatermarkConfig(tenantId: string): Promise<TenantWatermarkConfig> {
    let row: TenantWatermarkRow | undefined;
    try {
      [row] = await this.prisma.$queryRaw<TenantWatermarkRow[]>(Prisma.sql`
        SELECT
          id,
          tenant_id AS "tenantId",
          enabled,
          text_mode AS "textMode",
          custom_text AS "customText",
          apply_to_share_poster AS "applyToSharePoster",
          apply_to_couple_photo AS "applyToCouplePhoto",
          apply_to_certificate AS "applyToCertificate",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM tenant_watermark_configs
        WHERE tenant_id = ${tenantId}
        LIMIT 1
      `);
    } catch (error) {
      if (this.isTenantWatermarkTableMissing(error)) {
        return DEFAULT_WATERMARK_CONFIG;
      }

      throw error;
    }

    if (!row) {
      return DEFAULT_WATERMARK_CONFIG;
    }

    return tenantWatermarkConfigSchema.parse({
      enabled: row.enabled,
      textMode: row.textMode,
      customText: row.customText,
      applyToSharePoster: row.applyToSharePoster,
      applyToCouplePhoto: row.applyToCouplePhoto,
      applyToCertificate: row.applyToCertificate,
    });
  }

  private resolveWatermarkText(config: TenantWatermarkConfig, tenantName: string): string | null {
    if (config.textMode === 'CUSTOM') {
      const customText = config.customText?.trim() ?? '';
      return customText || null;
    }

    return this.buildDefaultWatermarkText(tenantName);
  }

  private canUseMerchantWatermark(plan: string, status: string): boolean {
    return plan === 'PRO' && status === 'ACTIVE';
  }

  private buildEntitlementReason(plan: string, status: string): string {
    if (plan !== 'PRO') {
      return '商家水印仅对专业版开放，请先升级到 PRO。';
    }

    if (status !== 'ACTIVE') {
      return '当前订阅未生效，暂不可使用商家水印。';
    }

    return '当前订阅暂不可使用商家水印。';
  }

  private isTenantWatermarkTableMissing(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const databaseCode = typeof error.meta?.code === 'string' ? error.meta.code : null;
      if (error.code === 'P2010' && databaseCode === '42P01') {
        return true;
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes(TENANT_WATERMARK_TABLE_NAME) &&
      (message.includes('42P01') ||
        message.toLowerCase().includes('does not exist') ||
        message.toLowerCase().includes('no such table'))
    );
  }
}
