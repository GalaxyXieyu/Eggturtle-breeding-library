import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type TenantSubscription,
  type TenantSubscriptionStatus,
  type UpdateTenantSubscriptionRequest
} from '@eggturtle/shared';
import { Prisma, TenantSubscriptionPlan } from '@prisma/client';

import { PrismaService } from '../prisma.service';

type ResolvedTenantSubscription = {
  tenantId: string;
  isConfigured: boolean;
  plan: TenantSubscriptionPlan;
  status: TenantSubscriptionStatus;
  startsAt: Date | null;
  expiresAt: Date | null;
  disabledAt: Date | null;
  disabledReason: string | null;
  maxImages: number | null;
  maxStorageBytes: bigint | null;
  maxShares: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const PLAN_RANK: Record<TenantSubscriptionPlan, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2
};

@Injectable()
export class TenantSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscriptionForTenant(tenantId: string): Promise<TenantSubscription> {
    const resolved = await this.getResolvedSubscription(tenantId);
    return this.toApiSubscription(resolved);
  }

  async upsertSubscription(
    tenantId: string,
    payload: UpdateTenantSubscriptionRequest,
    db?: Prisma.TransactionClient
  ): Promise<TenantSubscription> {
    const client = db ?? this.prisma;
    const existing = await client.tenantSubscription.findUnique({
      where: {
        tenantId
      }
    });

    const startsAtInput = this.parseDateInput(payload.startsAt);
    const expiresAtInput = this.parseDateInput(payload.expiresAt);
    const disabledAtInput = this.parseDateInput(payload.disabledAt);

    const startsAt = startsAtInput === undefined ? (existing?.startsAt ?? undefined) : startsAtInput;
    const expiresAt = expiresAtInput === undefined ? (existing?.expiresAt ?? undefined) : expiresAtInput;

    if (startsAt && expiresAt && expiresAt.getTime() < startsAt.getTime()) {
      throw new BadRequestException({
        message: 'expiresAt must be greater than or equal to startsAt.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const maxStorageBytes =
      payload.maxStorageBytes === undefined
        ? undefined
        : payload.maxStorageBytes === null
          ? null
          : BigInt(payload.maxStorageBytes);

    const next = await client.tenantSubscription.upsert({
      where: {
        tenantId
      },
      create: {
        tenantId,
        plan: payload.plan ?? TenantSubscriptionPlan.FREE,
        startsAt: startsAtInput ?? new Date(),
        expiresAt: expiresAtInput ?? null,
        disabledAt: disabledAtInput ?? null,
        disabledReason: payload.disabledReason ?? null,
        maxImages: payload.maxImages ?? null,
        maxStorageBytes,
        maxShares: payload.maxShares ?? null
      },
      update: {
        ...(payload.plan === undefined ? {} : { plan: payload.plan }),
        ...(startsAtInput === undefined ? {} : { startsAt: startsAtInput ?? new Date() }),
        ...(expiresAtInput === undefined ? {} : { expiresAt: expiresAtInput }),
        ...(disabledAtInput === undefined ? {} : { disabledAt: disabledAtInput }),
        ...(payload.disabledReason === undefined
          ? disabledAtInput === null
            ? { disabledReason: null }
            : {}
          : { disabledReason: payload.disabledReason }),
        ...(payload.maxImages === undefined ? {} : { maxImages: payload.maxImages }),
        ...(maxStorageBytes === undefined ? {} : { maxStorageBytes }),
        ...(payload.maxShares === undefined ? {} : { maxShares: payload.maxShares })
      }
    });

    const resolved = this.resolveFromRecord(next);
    return this.toApiSubscription(resolved);
  }

  async assertTenantWritable(tenantId: string): Promise<ResolvedTenantSubscription> {
    const subscription = await this.getResolvedSubscription(tenantId);

    if (subscription.status !== 'ACTIVE') {
      throw new ForbiddenException({
        message: `Tenant subscription is ${subscription.status.toLowerCase()}.`,
        errorCode: ErrorCode.TenantSubscriptionInactive
      });
    }

    return subscription;
  }

  async assertSharePlanAllowsCreate(tenantId: string): Promise<void> {
    const subscription = await this.assertTenantWritable(tenantId);
    if (!subscription.isConfigured) {
      return;
    }

    if (!this.hasPlanAtLeast(subscription.plan, TenantSubscriptionPlan.PRO)) {
      throw new ForbiddenException({
        message: 'Current subscription plan does not allow creating public shares.',
        errorCode: ErrorCode.TenantSubscriptionPlanInsufficient
      });
    }
  }

  async assertShareQuotaAllowsCreate(tenantId: string): Promise<void> {
    const subscription = await this.assertTenantWritable(tenantId);
    if (!subscription.isConfigured || subscription.maxShares === null) {
      return;
    }

    const shareCount = await this.prisma.publicShare.count({
      where: {
        tenantId
      }
    });

    if (shareCount >= subscription.maxShares) {
      throw new ForbiddenException({
        message: 'Share quota exceeded for tenant subscription.',
        errorCode: ErrorCode.TenantSubscriptionQuotaExceeded,
        data: {
          quota: 'maxShares',
          limit: subscription.maxShares,
          used: shareCount
        }
      });
    }
  }

  async assertImageUploadAllowed(tenantId: string, uploadBytes: number): Promise<void> {
    const subscription = await this.assertTenantWritable(tenantId);
    if (!subscription.isConfigured) {
      return;
    }

    const [imageCount, sizeAggregate] = await Promise.all([
      this.prisma.productImage.count({
        where: {
          tenantId
        }
      }),
      this.prisma.productImage.aggregate({
        where: {
          tenantId
        },
        _sum: {
          sizeBytes: true
        }
      })
    ]);

    if (subscription.maxImages !== null && imageCount >= subscription.maxImages) {
      throw new ForbiddenException({
        message: 'Image count quota exceeded for tenant subscription.',
        errorCode: ErrorCode.TenantSubscriptionQuotaExceeded,
        data: {
          quota: 'maxImages',
          limit: subscription.maxImages,
          used: imageCount
        }
      });
    }

    if (subscription.maxStorageBytes === null) {
      return;
    }

    const currentStorageBytes = sizeAggregate._sum.sizeBytes ?? BigInt(0);
    const nextStorageBytes = currentStorageBytes + BigInt(uploadBytes);

    if (nextStorageBytes > subscription.maxStorageBytes) {
      throw new ForbiddenException({
        message: 'Image storage quota exceeded for tenant subscription.',
        errorCode: ErrorCode.TenantSubscriptionQuotaExceeded,
        data: {
          quota: 'maxStorageBytes',
          limit: subscription.maxStorageBytes.toString(),
          used: currentStorageBytes.toString(),
          requested: uploadBytes
        }
      });
    }
  }

  private async getResolvedSubscription(tenantId: string): Promise<ResolvedTenantSubscription> {
    const record = await this.prisma.tenantSubscription.findUnique({
      where: {
        tenantId
      }
    });

    if (!record) {
      return {
        tenantId,
        isConfigured: false,
        plan: TenantSubscriptionPlan.FREE,
        status: 'ACTIVE',
        startsAt: null,
        expiresAt: null,
        disabledAt: null,
        disabledReason: null,
        maxImages: null,
        maxStorageBytes: null,
        maxShares: null,
        createdAt: null,
        updatedAt: null
      };
    }

    return this.resolveFromRecord(record);
  }

  private resolveFromRecord(record: {
    tenantId: string;
    plan: TenantSubscriptionPlan;
    startsAt: Date;
    expiresAt: Date | null;
    disabledAt: Date | null;
    disabledReason: string | null;
    maxImages: number | null;
    maxStorageBytes: bigint | null;
    maxShares: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): ResolvedTenantSubscription {
    return {
      tenantId: record.tenantId,
      isConfigured: true,
      plan: record.plan,
      status: this.computeStatus(record.expiresAt, record.disabledAt),
      startsAt: record.startsAt,
      expiresAt: record.expiresAt,
      disabledAt: record.disabledAt,
      disabledReason: record.disabledReason,
      maxImages: record.maxImages,
      maxStorageBytes: record.maxStorageBytes,
      maxShares: record.maxShares,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  private toApiSubscription(subscription: ResolvedTenantSubscription): TenantSubscription {
    return {
      tenantId: subscription.tenantId,
      isConfigured: subscription.isConfigured,
      plan: subscription.plan,
      status: subscription.status,
      startsAt: subscription.startsAt?.toISOString() ?? null,
      expiresAt: subscription.expiresAt?.toISOString() ?? null,
      disabledAt: subscription.disabledAt?.toISOString() ?? null,
      disabledReason: subscription.disabledReason,
      maxImages: subscription.maxImages,
      maxStorageBytes: subscription.maxStorageBytes?.toString() ?? null,
      maxShares: subscription.maxShares,
      createdAt: subscription.createdAt?.toISOString() ?? null,
      updatedAt: subscription.updatedAt?.toISOString() ?? null
    };
  }

  private computeStatus(
    expiresAt: Date | null,
    disabledAt: Date | null,
    now = new Date()
  ): TenantSubscriptionStatus {
    if (disabledAt) {
      return 'DISABLED';
    }

    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }

  private hasPlanAtLeast(current: TenantSubscriptionPlan, required: TenantSubscriptionPlan): boolean {
    return PLAN_RANK[current] >= PLAN_RANK[required];
  }

  private parseDateInput(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return new Date(value);
  }
}
