import { createHash, randomBytes } from 'node:crypto';

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  type CreateTenantSubscriptionActivationCodeRequest,
  type CreateTenantSubscriptionActivationCodeResponse,
  type RedeemTenantSubscriptionActivationCodeResponse,
  type TenantSubscription,
  type TenantSubscriptionActivationCode,
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

  async createSubscriptionActivationCode(
    actorUserId: string,
    payload: CreateTenantSubscriptionActivationCodeRequest,
    db?: Prisma.TransactionClient
  ): Promise<CreateTenantSubscriptionActivationCodeResponse['activationCode']> {
    const client = db ?? this.prisma;
    const maxStorageBytes =
      payload.maxStorageBytes === undefined || payload.maxStorageBytes === null
        ? null
        : BigInt(payload.maxStorageBytes);
    const expiresAtInput = this.parseDateInput(payload.expiresAt);
    const expiresAt = expiresAtInput === undefined ? null : expiresAtInput;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        message: 'Activation code expiresAt must be in the future.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateActivationCode();
      const normalizedCode = this.normalizeActivationCode(code);

      try {
        const created = await client.subscriptionActivationCode.create({
          data: {
            codeDigest: this.hashActivationCode(normalizedCode),
            codeLabel: this.toCodeLabel(normalizedCode),
            targetTenantId: payload.targetTenantId ?? null,
            plan: payload.plan,
            durationDays: payload.durationDays ?? null,
            maxImages: payload.maxImages ?? null,
            maxStorageBytes,
            maxShares: payload.maxShares ?? null,
            redeemLimit: payload.redeemLimit ?? 1,
            redeemedCount: 0,
            expiresAt,
            disabledAt: null,
            createdByUserId: actorUserId
          }
        });

        return this.toApiActivationCode(created, code);
      } catch (error) {
        if (!this.isActivationCodeDigestConflict(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestException({
      message: 'Failed to generate a unique activation code.',
      errorCode: ErrorCode.InvalidRequestPayload
    });
  }

  async redeemSubscriptionActivationCode(
    tenantId: string,
    actorUserId: string,
    rawCode: string
  ): Promise<RedeemTenantSubscriptionActivationCodeResponse> {
    const normalizedCode = this.normalizeActivationCode(rawCode);
    if (normalizedCode.length < 8) {
      throw new BadRequestException({
        message: 'Activation code format is invalid.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const codeDigest = this.hashActivationCode(normalizedCode);

    return this.prisma.$transaction(async (tx) => {
      const activationCode = await tx.subscriptionActivationCode.findUnique({
        where: {
          codeDigest
        }
      });
      if (!activationCode) {
        throw new ForbiddenException({
          message: 'Activation code is invalid.',
          errorCode: ErrorCode.SubscriptionActivationCodeInvalid
        });
      }

      if (activationCode.targetTenantId && activationCode.targetTenantId !== tenantId) {
        throw new ForbiddenException({
          message: 'Activation code is invalid for current tenant.',
          errorCode: ErrorCode.SubscriptionActivationCodeInvalid
        });
      }

      const now = new Date();
      if (activationCode.disabledAt) {
        throw new ForbiddenException({
          message: 'Activation code is disabled.',
          errorCode: ErrorCode.SubscriptionActivationCodeDisabled
        });
      }

      if (activationCode.expiresAt && activationCode.expiresAt.getTime() <= now.getTime()) {
        throw new ForbiddenException({
          message: 'Activation code is expired.',
          errorCode: ErrorCode.SubscriptionActivationCodeExpired
        });
      }

      const consumed = await tx.subscriptionActivationCode.updateMany({
        where: {
          id: activationCode.id,
          redeemedCount: {
            lt: activationCode.redeemLimit
          }
        },
        data: {
          redeemedCount: {
            increment: 1
          }
        }
      });
      if (consumed.count === 0) {
        throw new ForbiddenException({
          message: 'Activation code redeem limit reached.',
          errorCode: ErrorCode.SubscriptionActivationCodeRedeemLimitReached
        });
      }

      const existingSubscription = await tx.tenantSubscription.findUnique({
        where: {
          tenantId
        },
        select: {
          expiresAt: true
        }
      });
      const nextSubscriptionExpiresAt = this.resolveRedeemExpiresAt(
        now,
        existingSubscription?.expiresAt ?? null,
        activationCode.durationDays
      );
      const subscription = await this.upsertSubscription(
        tenantId,
        {
          plan: activationCode.plan,
          startsAt: now.toISOString(),
          expiresAt: nextSubscriptionExpiresAt ? nextSubscriptionExpiresAt.toISOString() : null,
          disabledAt: null,
          disabledReason: null,
          maxImages: activationCode.maxImages,
          maxStorageBytes: activationCode.maxStorageBytes?.toString() ?? null,
          maxShares: activationCode.maxShares
        },
        tx
      );

      const refreshedCode = await tx.subscriptionActivationCode.findUnique({
        where: {
          id: activationCode.id
        }
      });
      if (!refreshedCode) {
        throw new ForbiddenException({
          message: 'Activation code is invalid.',
          errorCode: ErrorCode.SubscriptionActivationCodeInvalid
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: AuditAction.SubscriptionActivationRedeem,
          resourceType: 'tenant_subscription',
          resourceId: tenantId,
          metadata: {
            activationCodeId: refreshedCode.id,
            codeLabel: refreshedCode.codeLabel,
            plan: refreshedCode.plan,
            durationDays: refreshedCode.durationDays,
            redeemLimit: refreshedCode.redeemLimit,
            redeemedCount: refreshedCode.redeemedCount
          }
        }
      });

      return {
        subscription,
        activationCode: {
          id: refreshedCode.id,
          codeLabel: refreshedCode.codeLabel,
          redeemLimit: refreshedCode.redeemLimit,
          redeemedCount: refreshedCode.redeemedCount
        },
        redeemedAt: now.toISOString()
      };
    });
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

  private resolveRedeemExpiresAt(
    now: Date,
    currentExpiresAt: Date | null,
    durationDays: number | null
  ): Date | null {
    if (durationDays === null) {
      return currentExpiresAt;
    }

    const base = currentExpiresAt && currentExpiresAt.getTime() > now.getTime() ? currentExpiresAt : now;
    return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  private hasPlanAtLeast(current: TenantSubscriptionPlan, required: TenantSubscriptionPlan): boolean {
    return PLAN_RANK[current] >= PLAN_RANK[required];
  }

  private toApiActivationCode(
    activationCode: {
      id: string;
      codeLabel: string;
      targetTenantId: string | null;
      plan: TenantSubscriptionPlan;
      durationDays: number | null;
      maxImages: number | null;
      maxStorageBytes: bigint | null;
      maxShares: number | null;
      redeemLimit: number;
      redeemedCount: number;
      expiresAt: Date | null;
      disabledAt: Date | null;
      createdAt: Date;
    },
    code: string
  ): CreateTenantSubscriptionActivationCodeResponse['activationCode'] {
    const base: TenantSubscriptionActivationCode = {
      id: activationCode.id,
      codeLabel: activationCode.codeLabel,
      targetTenantId: activationCode.targetTenantId,
      plan: activationCode.plan,
      durationDays: activationCode.durationDays,
      maxImages: activationCode.maxImages,
      maxStorageBytes: activationCode.maxStorageBytes?.toString() ?? null,
      maxShares: activationCode.maxShares,
      redeemLimit: activationCode.redeemLimit,
      redeemedCount: activationCode.redeemedCount,
      expiresAt: activationCode.expiresAt?.toISOString() ?? null,
      disabledAt: activationCode.disabledAt?.toISOString() ?? null,
      createdAt: activationCode.createdAt.toISOString()
    };

    return {
      ...base,
      code
    };
  }

  private generateActivationCode(): string {
    return `ETM-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2)
      .toString('hex')
      .toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private normalizeActivationCode(code: string): string {
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private hashActivationCode(normalizedCode: string): string {
    const pepper = process.env.SUBSCRIPTION_ACTIVATION_CODE_PEPPER ?? process.env.AUTH_CODE_PEPPER ?? '';
    return createHash('sha256').update(`${normalizedCode}:${pepper}`).digest('hex');
  }

  private toCodeLabel(normalizedCode: string): string {
    if (normalizedCode.length <= 8) {
      return normalizedCode;
    }

    return `${normalizedCode.slice(0, 4)}***${normalizedCode.slice(-4)}`;
  }

  private isActivationCodeDigestConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('code_digest');
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
