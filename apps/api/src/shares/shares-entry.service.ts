import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  type CreateShareRequest
} from '@eggturtle/shared';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';
import { TenantSharePresentationService } from '../tenant-share-presentation/tenant-share-presentation.service';

import { SharesCoreService } from './shares-core.service';
import type { ShareAccessMeta } from './shares.types';

@Injectable()
export class SharesEntryService {
  private readonly entryRequests = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
    private readonly tenantSharePresentationService: TenantSharePresentationService,
    private readonly sharesCoreService: SharesCoreService
  ) {}

  async createShare(
    tenantId: string,
    actorUserId: string,
    payload: CreateShareRequest,
    requestOrigin?: string | null
  ) {
    if (payload.resourceType !== 'tenant_feed') {
      throw new BadRequestException({
        message: `Unsupported resourceType: ${payload.resourceType}`,
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    if (payload.resourceId !== tenantId) {
      throw new BadRequestException({
        message: 'tenant_feed resourceId must match current tenant.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const resourceId = tenantId;
    const presentationOverride =
      this.tenantSharePresentationService.toSharePresentationOverrideJson(payload.presentationOverride);

    await this.tenantSubscriptionsService.assertTenantWritable(tenantId);

    const existingShare = await this.sharesCoreService.findShareByResource(tenantId, payload.resourceType, resourceId);

    let share =
      existingShare ??
      (await this.sharesCoreService.getOrCreateShare(
        tenantId,
        payload.resourceType,
        resourceId,
        null,
        actorUserId,
        presentationOverride
      ));

    if (existingShare && typeof presentationOverride !== 'undefined') {
      share = await this.prisma.publicShare.update({
        where: {
          id: existingShare.id
        },
        data: {
          presentationOverride
        }
      });
    }

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ShareCreate,
      resourceType: 'public_share',
      resourceId: share.id,
      metadata: {
        shareToken: share.shareToken,
        resourceType: share.resourceType,
        resourceId: share.resourceId,
        productId: share.productId
      }
    });

    return {
      id: share.id,
      tenantId: share.tenantId,
      resourceType: share.resourceType,
      resourceId: share.resourceId,
      shareToken: share.shareToken,
      entryUrl: this.sharesCoreService.buildShareEntryUrl(share.shareToken, requestOrigin),
      createdAt: share.createdAt.toISOString(),
      updatedAt: share.updatedAt.toISOString()
    };
  }

  async resolveShareEntry(shareToken: string, meta: ShareAccessMeta, requestOrigin?: string | null) {
    this.assertEntryRateLimit(shareToken, meta.ip);

    const share = await this.prisma.publicShare.findUnique({
      where: {
        shareToken
      },
      select: {
        id: true,
        tenantId: true,
        resourceType: true,
        resourceId: true,
        productId: true,
        createdByUserId: true,
        shareToken: true,
        tenant: {
          select: {
            slug: true
          }
        }
      }
    });

    if (!share) {
      throw new NotFoundException({
        message: 'Share link not found.',
        errorCode: ErrorCode.ShareNotFound
      });
    }

    const resourceType = this.sharesCoreService.parseShareResourceType(share.resourceType);

    const { redirectUrl, expiresAt } = this.sharesCoreService.buildRedirectUrl(
      {
        id: share.id,
        tenantId: share.tenantId,
        tenantSlug: share.tenant.slug,
        shareToken: share.shareToken,
        resourceType,
        resourceId: share.resourceId
      },
      requestOrigin
    );

    await this.sharesCoreService.writeShareAccessAuditLog(
      {
        id: share.id,
        tenantId: share.tenantId,
        resourceType,
        resourceId: share.resourceId,
        productId: share.productId,
        createdByUserId: share.createdByUserId,
        shareToken: share.shareToken
      },
      expiresAt,
      'entry',
      meta
    );

    return {
      statusCode: 302,
      redirectUrl
    };
  }

  private assertEntryRateLimit(shareToken: string, ip: string | null): void {
    const now = Date.now();
    const windowMs = this.sharesCoreService.getRateLimitWindowMs();
    const maxRequests = this.sharesCoreService.getRateLimitMaxRequests();
    const key = `${shareToken}:${ip ?? 'unknown'}`;

    const recent = (this.entryRequests.get(key) ?? []).filter((timestamp) => now - timestamp <= windowMs);

    if (recent.length >= maxRequests) {
      this.sharesCoreService.throwEntryRateLimited();
    }

    recent.push(now);
    this.entryRequests.set(key, recent);

    if (this.entryRequests.size > 2000) {
      const cutoff = now - windowMs;
      for (const [storedKey, timestamps] of this.entryRequests.entries()) {
        const filtered = timestamps.filter((timestamp) => timestamp >= cutoff);
        if (filtered.length === 0) {
          this.entryRequests.delete(storedKey);
        } else {
          this.entryRequests.set(storedKey, filtered);
        }
      }
    }
  }
}
