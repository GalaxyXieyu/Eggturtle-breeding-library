import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_PLATFORM_BRANDING,
  DEFAULT_TENANT_BRANDING_OVERRIDE,
  ErrorCode,
  SuperAdminAuditAction,
  platformBrandingConfigSchema,
  tenantBrandingOverrideSchema,
  type PlatformBrandingConfig,
  type ResolvedTenantBranding,
  type TenantBrandingOverride,
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { SuperAdminAuditLogsService } from '../admin/super-admin-audit-logs.service';

const PLATFORM_BRANDING_SINGLETON_ID = 'default';

type TenantSummary = {
  id: string;
  slug: string;
  name: string;
};

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly superAdminAuditLogsService: SuperAdminAuditLogsService,
  ) {}

  async getPlatformBranding(actorUserId?: string): Promise<PlatformBrandingConfig> {
    const branding = await this.readPlatformBranding();

    if (actorUserId) {
      await this.superAdminAuditLogsService.createLog({
        actorUserId,
        action: SuperAdminAuditAction.GetPlatformBranding,
        metadata: {
          surface: 'admin.branding.platform',
        },
      });
    }

    return branding;
  }

  async updatePlatformBranding(actorUserId: string, branding: PlatformBrandingConfig) {
    const parsed = platformBrandingConfigSchema.parse(branding);
    const saved = await this.prisma.platformBrandingConfig.upsert({
      where: {
        id: PLATFORM_BRANDING_SINGLETON_ID,
      },
      create: {
        id: PLATFORM_BRANDING_SINGLETON_ID,
        ...this.toPlatformWriteInput(parsed),
      },
      update: this.toPlatformWriteInput(parsed),
    });

    const resolved = this.toPlatformBranding(saved);
    const auditLogId = await this.superAdminAuditLogsService.createLog({
      actorUserId,
      action: SuperAdminAuditAction.UpdatePlatformBranding,
      metadata: {
        branding: resolved,
      },
    });

    return {
      branding: resolved,
      auditLogId,
    };
  }

  async getAdminTenantBranding(actorUserId: string, tenantId: string) {
    const [platform, tenant, branding] = await Promise.all([
      this.readPlatformBranding(),
      this.requireTenantById(tenantId),
      this.readTenantBrandingOverride(tenantId),
    ]);

    const response = this.buildTenantBrandingResponse(platform, tenant, branding);

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: tenant.id,
      action: SuperAdminAuditAction.GetTenantBranding,
      metadata: {
        tenantSlug: tenant.slug,
        resolved: response.resolved,
      },
    });

    return response;
  }

  async updateAdminTenantBranding(actorUserId: string, tenantId: string, branding: TenantBrandingOverride) {
    const tenant = await this.requireTenantById(tenantId);
    const parsed = tenantBrandingOverrideSchema.parse(branding);

    await this.prisma.tenantBrandingOverride.upsert({
      where: {
        tenantId,
      },
      create: {
        tenantId,
        ...this.toTenantWriteInput(parsed),
      },
      update: this.toTenantWriteInput(parsed),
    });

    const platform = await this.readPlatformBranding();
    const response = this.buildTenantBrandingResponse(platform, tenant, parsed);
    const auditLogId = await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: tenant.id,
      action: SuperAdminAuditAction.UpdateTenantBranding,
      metadata: {
        tenantSlug: tenant.slug,
        branding: response.branding,
        resolved: response.resolved,
      },
    });

    return {
      ...response,
      auditLogId,
    };
  }

  async getResolvedTenantBrandingBySlug(tenantSlug: string): Promise<ResolvedTenantBranding> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        slug: tenantSlug,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound,
      });
    }

    const [platform, branding] = await Promise.all([
      this.readPlatformBranding(),
      this.readTenantBrandingOverride(tenant.id),
    ]);

    return this.buildResolvedTenantBranding(platform, tenant, branding);
  }

  async resolveTenantPublicCopy(input: { tenantId: string; tenantName: string }) {
    const [platform, branding] = await Promise.all([
      this.readPlatformBranding(),
      this.readTenantBrandingOverride(input.tenantId),
    ]);

    return this.buildResolvedTenantBranding(
      platform,
      {
        id: input.tenantId,
        slug: input.tenantId,
        name: input.tenantName,
      },
      branding,
    ).resolved;
  }

  buildCertificateBranding(platform: PlatformBrandingConfig) {
    return {
      titleZh: platform.appName.zh,
      titleEn: platform.appName.en,
      eyebrowZh: platform.appEyebrow.zh,
      eyebrowEn: platform.appEyebrow.en,
      verificationStatementZh: `本证书内容由${platform.appName.zh}生成，扫码可查验档案真实性。`,
    };
  }

  private async readPlatformBranding(): Promise<PlatformBrandingConfig> {
    const record = await this.prisma.platformBrandingConfig.findUnique({
      where: {
        id: PLATFORM_BRANDING_SINGLETON_ID,
      },
    });

    if (!record) {
      return DEFAULT_PLATFORM_BRANDING;
    }

    return this.toPlatformBranding(record);
  }

  private async readTenantBrandingOverride(tenantId: string): Promise<TenantBrandingOverride> {
    const record = await this.prisma.tenantBrandingOverride.findUnique({
      where: {
        tenantId,
      },
    });

    if (!record) {
      return DEFAULT_TENANT_BRANDING_OVERRIDE;
    }

    return tenantBrandingOverrideSchema.parse({
      displayName: this.normalizeNullableText(record.displayName),
      publicTitle: this.normalizeNullableText(record.publicTitle),
      publicSubtitle: this.normalizeNullableText(record.publicSubtitle),
    });
  }

  private async requireTenantById(tenantId: string): Promise<TenantSummary> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound,
      });
    }

    return tenant;
  }

  private buildTenantBrandingResponse(
    platform: PlatformBrandingConfig,
    tenant: TenantSummary,
    branding: TenantBrandingOverride,
  ) {
    const resolved = this.buildResolvedTenantBranding(platform, tenant, branding);

    return {
      tenant: resolved.tenant,
      branding: resolved.branding,
      resolved: resolved.resolved,
    };
  }

  private buildResolvedTenantBranding(
    platform: PlatformBrandingConfig,
    tenant: TenantSummary,
    branding: TenantBrandingOverride,
  ): ResolvedTenantBranding {
    const parsedBranding = tenantBrandingOverrideSchema.parse(branding);
    const displayName =
      this.normalizeNullableText(parsedBranding.displayName) ??
      this.normalizeNullableText(tenant.name) ??
      platform.defaultTenantName.zh;
    const publicTitle =
      this.normalizeNullableText(parsedBranding.publicTitle) ??
      `${displayName} · ${platform.publicCatalogTitleSuffix.zh}`;
    const publicSubtitle =
      this.normalizeNullableText(parsedBranding.publicSubtitle) ??
      `${displayName} ${platform.publicCatalogSubtitleSuffix.zh}`;

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
      platform,
      branding: parsedBranding,
      resolved: {
        displayName,
        publicTitle,
        publicSubtitle,
      },
    };
  }

  private toPlatformBranding(record: {
    appNameZh: string;
    appNameEn: string;
    appEyebrowZh: string;
    appEyebrowEn: string;
    appDescriptionZh: string;
    appDescriptionEn: string;
    adminTitleZh: string;
    adminTitleEn: string;
    adminSubtitleZh: string;
    adminSubtitleEn: string;
    defaultTenantNameZh: string;
    defaultTenantNameEn: string;
    publicCatalogTitleSuffixZh: string;
    publicCatalogTitleSuffixEn: string;
    publicCatalogSubtitleSuffixZh: string;
    publicCatalogSubtitleSuffixEn: string;
  }): PlatformBrandingConfig {
    return platformBrandingConfigSchema.parse({
      appName: {
        zh: record.appNameZh,
        en: record.appNameEn,
      },
      appEyebrow: {
        zh: record.appEyebrowZh,
        en: record.appEyebrowEn,
      },
      appDescription: {
        zh: record.appDescriptionZh,
        en: record.appDescriptionEn,
      },
      adminTitle: {
        zh: record.adminTitleZh,
        en: record.adminTitleEn,
      },
      adminSubtitle: {
        zh: record.adminSubtitleZh,
        en: record.adminSubtitleEn,
      },
      defaultTenantName: {
        zh: record.defaultTenantNameZh,
        en: record.defaultTenantNameEn,
      },
      publicCatalogTitleSuffix: {
        zh: record.publicCatalogTitleSuffixZh,
        en: record.publicCatalogTitleSuffixEn,
      },
      publicCatalogSubtitleSuffix: {
        zh: record.publicCatalogSubtitleSuffixZh,
        en: record.publicCatalogSubtitleSuffixEn,
      },
    });
  }

  private toPlatformWriteInput(branding: PlatformBrandingConfig): Prisma.PlatformBrandingConfigUncheckedCreateInput {
    return {
      appNameZh: branding.appName.zh,
      appNameEn: branding.appName.en,
      appEyebrowZh: branding.appEyebrow.zh,
      appEyebrowEn: branding.appEyebrow.en,
      appDescriptionZh: branding.appDescription.zh,
      appDescriptionEn: branding.appDescription.en,
      adminTitleZh: branding.adminTitle.zh,
      adminTitleEn: branding.adminTitle.en,
      adminSubtitleZh: branding.adminSubtitle.zh,
      adminSubtitleEn: branding.adminSubtitle.en,
      defaultTenantNameZh: branding.defaultTenantName.zh,
      defaultTenantNameEn: branding.defaultTenantName.en,
      publicCatalogTitleSuffixZh: branding.publicCatalogTitleSuffix.zh,
      publicCatalogTitleSuffixEn: branding.publicCatalogTitleSuffix.en,
      publicCatalogSubtitleSuffixZh: branding.publicCatalogSubtitleSuffix.zh,
      publicCatalogSubtitleSuffixEn: branding.publicCatalogSubtitleSuffix.en,
    };
  }

  private toTenantWriteInput(
    branding: TenantBrandingOverride,
  ): Omit<Prisma.TenantBrandingOverrideUncheckedCreateInput, 'tenantId'> {
    return {
      displayName: this.normalizeNullableText(branding.displayName),
      publicTitle: this.normalizeNullableText(branding.publicTitle),
      publicSubtitle: this.normalizeNullableText(branding.publicSubtitle),
    };
  }

  private normalizeNullableText(value: string | null | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
