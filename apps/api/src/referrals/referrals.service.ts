import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCode,
  type BindReferralResponse,
  type MyReferralOverviewResponse,
  type PublicReferralLandingResponse,
  type ReferralBindingSource,
  type SettleReferralPaidEventResponse,
} from '@eggturtle/shared';
import {
  Prisma,
  ReferralRewardStatus,
  ReferralRewardTriggerType,
} from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_BIND_WINDOW_HOURS = 24;
const FIRST_PAYMENT_REFERRER_DAYS = 7;
const FIRST_PAYMENT_INVITEE_DAYS = 7;
const RENEWAL_REFERRER_DAYS = 30;
const MONTHLY_CAP_DAYS = 60;
const RECENT_REWARDS_LIMIT = 20;
const FALLBACK_INVITER_NAME = 'Eggturtle 用户';

type ReferralRewardRecord = Prisma.ReferralRewardGetPayload<{
  select: {
    id: true;
    status: true;
    triggerType: true;
    statusReason: true;
    referrerUserId: true;
    inviteeUserId: true;
    paymentProvider: true;
    paymentId: true;
    orderId: true;
    rewardDaysReferrer: true;
    rewardDaysInvitee: true;
    awardedAt: true;
    createdAt: true;
  };
}>;

type PaidOrderInput = {
  actorUserId?: string | null;
  userId: string;
  tenantId: string;
  provider: string;
  orderId: string;
  paymentId?: string | null;
  paidAt?: Date;
};

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
  ) {}

  async getMyReferralOverview(userId: string): Promise<MyReferralOverviewResponse> {
    const referralCode = await this.ensureReferralCode(userId);
    const [binding, invitedCount, activatedInviteeCount, totalAwardedDays, monthAwardedDays, rewards] =
      await Promise.all([
        this.prisma.referralBinding.findUnique({
          where: {
            inviteeUserId: userId,
          },
          select: {
            id: true,
            referrerUserId: true,
            inviteeUserId: true,
            referralCode: true,
            source: true,
            boundAt: true,
          },
        }),
        this.prisma.referralBinding.count({
          where: {
            referrerUserId: userId,
          },
        }),
        this.getActivatedInviteeCount(userId),
        this.getAwardedDaysTotal(userId),
        this.getMonthAwardedDays(userId, new Date()),
        this.prisma.referralReward.findMany({
          where: {
            OR: [{ referrerUserId: userId }, { inviteeUserId: userId }],
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: RECENT_REWARDS_LIMIT,
          select: {
            id: true,
            status: true,
            triggerType: true,
            statusReason: true,
            referrerUserId: true,
            inviteeUserId: true,
            paymentProvider: true,
            paymentId: true,
            orderId: true,
            rewardDaysReferrer: true,
            rewardDaysInvitee: true,
            awardedAt: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      referralCode,
      sharePath: this.buildSharePath(referralCode),
      shareUrl: this.buildShareUrl(referralCode),
      rules: this.getProgramRules(),
      binding: binding ? this.toApiBinding(binding) : null,
      invitedCount,
      activatedInviteeCount,
      totalAwardedDays,
      monthAwardedDays,
      monthRemainingDays: Math.max(MONTHLY_CAP_DAYS - monthAwardedDays, 0),
      rewards: rewards.map((reward) => this.toApiReward(reward)),
    };
  }

  async getPublicReferralLanding(referralCodeInput: string): Promise<PublicReferralLandingResponse> {
    const referralCode = this.normalizeReferralCode(referralCodeInput);
    const referrer = await this.prisma.user.findUnique({
      where: {
        referralCode,
      },
      select: {
        id: true,
        name: true,
        account: true,
        email: true,
        tenantMembers: {
          select: {
            tenant: {
              select: {
                name: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!referrer) {
      throw new NotFoundException({
        message: 'Referral code is invalid.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    const tenantName = referrer.tenantMembers[0]?.tenant.name ?? null;
    const displayName =
      referrer.name?.trim() ||
      referrer.account?.trim() ||
      tenantName ||
      this.extractEmailDisplayName(referrer.email) ||
      FALLBACK_INVITER_NAME;

    return {
      referralCode,
      inviter: {
        userId: referrer.id,
        displayName,
        tenantName,
      },
      sharePath: this.buildSharePath(referralCode),
      shareUrl: this.buildShareUrl(referralCode),
      rules: this.getProgramRules(),
    };
  }

  async bindReferral(
    inviteeUserId: string,
    referralCodeInput: string,
    source: ReferralBindingSource,
  ): Promise<BindReferralResponse> {
    const referralCode = this.normalizeReferralCode(referralCodeInput);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const invitee = await tx.user.findUnique({
        where: {
          id: inviteeUserId,
        },
        select: {
          id: true,
          createdAt: true,
          referralCode: true,
          phoneBinding: {
            select: {
              phoneNumber: true,
            },
          },
        },
      });

      if (!invitee) {
        throw new NotFoundException({
          message: 'User not found.',
          errorCode: ErrorCode.Unauthorized,
        });
      }

      const existingBinding = await tx.referralBinding.findUnique({
        where: {
          inviteeUserId,
        },
        select: {
          id: true,
          referrerUserId: true,
          inviteeUserId: true,
          referralCode: true,
          source: true,
          boundAt: true,
        },
      });
      if (existingBinding) {
        if (existingBinding.referralCode === referralCode) {
          return {
            binding: this.toApiBinding(existingBinding),
          };
        }

        throw new ForbiddenException({
          message: 'Referral binding already exists and cannot be changed.',
          errorCode: ErrorCode.Forbidden,
        });
      }

      const inviteeMembership = await tx.tenantMember.findUnique({
        where: {
          userId: inviteeUserId,
        },
        select: {
          tenantId: true,
        },
      });
      if (inviteeMembership) {
        const inviteeSubscription = await tx.tenantSubscription.findUnique({
          where: {
            tenantId: inviteeMembership.tenantId,
          },
          select: {
            plan: true,
            expiresAt: true,
          },
        });

        const hasActivatedSubscription = Boolean(
          inviteeSubscription &&
            (inviteeSubscription.plan !== 'FREE' || inviteeSubscription.expiresAt),
        );
        if (hasActivatedSubscription) {
          throw new ForbiddenException({
            message: 'Referral binding is not available after subscription activation.',
            errorCode: ErrorCode.Forbidden,
          });
        }
      }

      const bindWindowStartedAt = new Date(
        now.getTime() - REFERRAL_BIND_WINDOW_HOURS * 60 * 60 * 1000,
      );
      if (invitee.createdAt.getTime() < bindWindowStartedAt.getTime()) {
        throw new ForbiddenException({
          message: `Referral binding is only available within ${REFERRAL_BIND_WINDOW_HOURS} hours of registration.`,
          errorCode: ErrorCode.Forbidden,
        });
      }

      const referrer = await tx.user.findUnique({
        where: {
          referralCode,
        },
        select: {
          id: true,
          referralCode: true,
          phoneBinding: {
            select: {
              phoneNumber: true,
            },
          },
        },
      });

      if (!referrer) {
        throw new BadRequestException({
          message: 'Referral code is invalid.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      if (referrer.id === invitee.id || invitee.referralCode === referralCode) {
        throw new ForbiddenException({
          message: 'Self-invite is not allowed.',
          errorCode: ErrorCode.Forbidden,
        });
      }

      if (
        referrer.phoneBinding?.phoneNumber &&
        invitee.phoneBinding?.phoneNumber &&
        referrer.phoneBinding.phoneNumber === invitee.phoneBinding.phoneNumber
      ) {
        throw new ForbiddenException({
          message: 'Referral binding is not allowed for the same phone number.',
          errorCode: ErrorCode.Forbidden,
        });
      }

      const created = await tx.referralBinding.create({
        data: {
          referrerUserId: referrer.id,
          inviteeUserId: invitee.id,
          referralCode,
          source,
          boundAt: now,
        },
        select: {
          id: true,
          referrerUserId: true,
          inviteeUserId: true,
          referralCode: true,
          source: true,
          boundAt: true,
        },
      });

      return {
        binding: this.toApiBinding(created),
      };
    });
  }

  async awardReferralForPaidOrder(
    input: PaidOrderInput,
    db?: Prisma.TransactionClient,
  ): Promise<SettleReferralPaidEventResponse> {
    const paidAt = input.paidAt ?? new Date();
    const normalizedProvider = input.provider.trim().toLowerCase();
    const normalizedOrderId = input.orderId.trim();
    const normalizedPaymentId = input.paymentId?.trim() || null;

    const run = async (tx: Prisma.TransactionClient) => {
      const existingReward = await tx.referralReward.findFirst({
        where: this.buildRewardDedupWhere(normalizedOrderId, normalizedPaymentId),
        select: {
          id: true,
          status: true,
          triggerType: true,
          statusReason: true,
          referrerUserId: true,
          inviteeUserId: true,
          paymentProvider: true,
          paymentId: true,
          orderId: true,
          rewardDaysReferrer: true,
          rewardDaysInvitee: true,
          awardedAt: true,
          createdAt: true,
        },
      });
      if (existingReward) {
        return {
          settled: true,
          triggerType: this.toApiTriggerType(existingReward.triggerType),
          reward: this.toApiReward(existingReward),
        };
      }

      const binding = await tx.referralBinding.findUnique({
        where: {
          inviteeUserId: input.userId,
        },
        select: {
          id: true,
          referrerUserId: true,
          inviteeUserId: true,
          referralCode: true,
          source: true,
          boundAt: true,
        },
      });
      if (!binding || binding.boundAt.getTime() > paidAt.getTime()) {
        return {
          settled: false,
          triggerType: null,
          reward: null,
        };
      }

      const [inviteeMembership, referrerMembership, priorRewardCount] = await Promise.all([
        tx.tenantMember.findUnique({
          where: {
            userId: input.userId,
          },
          select: {
            tenantId: true,
          },
        }),
        tx.tenantMember.findUnique({
          where: {
            userId: binding.referrerUserId,
          },
          select: {
            tenantId: true,
          },
        }),
        tx.referralReward.count({
          where: {
            inviteeUserId: input.userId,
          },
        }),
      ]);

      if (!inviteeMembership || !referrerMembership) {
        throw new BadRequestException({
          message: 'Referral reward settlement requires active tenant membership.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      if (inviteeMembership.tenantId !== input.tenantId) {
        throw new BadRequestException({
          message: 'Paid order tenant does not match current invitee tenant.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      const triggerType =
        priorRewardCount === 0
          ? ReferralRewardTriggerType.FIRST_PAYMENT
          : ReferralRewardTriggerType.RENEWAL;
      const requestedReferrerDays =
        triggerType === ReferralRewardTriggerType.FIRST_PAYMENT
          ? FIRST_PAYMENT_REFERRER_DAYS
          : RENEWAL_REFERRER_DAYS;
      const requestedInviteeDays =
        triggerType === ReferralRewardTriggerType.FIRST_PAYMENT ? FIRST_PAYMENT_INVITEE_DAYS : 0;

      const [referrerAwardedThisMonth, inviteeAwardedThisMonth] = await Promise.all([
        this.getMonthAwardedDays(binding.referrerUserId, paidAt, tx),
        requestedInviteeDays > 0 ? this.getMonthAwardedDays(input.userId, paidAt, tx) : Promise.resolve(0),
      ]);

      const rewardDaysReferrer = this.capRewardDays(requestedReferrerDays, referrerAwardedThisMonth);
      const rewardDaysInvitee = this.capRewardDays(requestedInviteeDays, inviteeAwardedThisMonth);
      const statusReason = this.resolveStatusReason({
        requestedReferrerDays,
        rewardDaysReferrer,
        requestedInviteeDays,
        rewardDaysInvitee,
      });
      const status =
        rewardDaysReferrer === 0 && rewardDaysInvitee === 0
          ? ReferralRewardStatus.SKIPPED
          : ReferralRewardStatus.AWARDED;

      if (rewardDaysReferrer > 0) {
        await this.tenantSubscriptionsService.grantProRewardDays(
          referrerMembership.tenantId,
          rewardDaysReferrer,
          tx,
        );
      }
      if (rewardDaysInvitee > 0) {
        await this.tenantSubscriptionsService.grantProRewardDays(
          inviteeMembership.tenantId,
          rewardDaysInvitee,
          tx,
        );
      }

      const reward = await tx.referralReward.create({
        data: {
          status,
          triggerType,
          statusReason,
          referrerUserId: binding.referrerUserId,
          inviteeUserId: input.userId,
          paymentProvider: normalizedProvider,
          paymentId: normalizedPaymentId,
          orderId: normalizedOrderId,
          rewardDaysReferrer,
          rewardDaysInvitee,
          awardedAt: status === ReferralRewardStatus.AWARDED ? paidAt : null,
          createdByUserId: input.actorUserId ?? null,
        },
        select: {
          id: true,
          status: true,
          triggerType: true,
          statusReason: true,
          referrerUserId: true,
          inviteeUserId: true,
          paymentProvider: true,
          paymentId: true,
          orderId: true,
          rewardDaysReferrer: true,
          rewardDaysInvitee: true,
          awardedAt: true,
          createdAt: true,
        },
      });

      return {
        settled: true,
        triggerType: this.toApiTriggerType(reward.triggerType),
        reward: this.toApiReward(reward),
      };
    };

    if (db) {
      return run(db);
    }

    return this.prisma.$transaction(async (tx) => run(tx));
  }

  async ensureReferralCode(userId: string, db?: Prisma.TransactionClient): Promise<string> {
    const client = db ?? this.prisma;
    const user = await client.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        referralCode: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found.',
        errorCode: ErrorCode.Unauthorized,
      });
    }

    if (user.referralCode) {
      return user.referralCode;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const referralCode = this.generateReferralCode();
      try {
        const updated = await client.user.update({
          where: {
            id: userId,
          },
          data: {
            referralCode,
          },
          select: {
            referralCode: true,
          },
        });
        return updated.referralCode ?? referralCode;
      } catch (error) {
        if (!this.isReferralCodeConflict(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestException({
      message: 'Failed to generate a unique referral code.',
      errorCode: ErrorCode.InvalidRequestPayload,
    });
  }

  private getProgramRules(): MyReferralOverviewResponse['rules'] {
    return {
      firstPaymentReferrerDays: FIRST_PAYMENT_REFERRER_DAYS,
      firstPaymentInviteeDays: FIRST_PAYMENT_INVITEE_DAYS,
      renewalReferrerDays: RENEWAL_REFERRER_DAYS,
      monthlyCapDays: MONTHLY_CAP_DAYS,
      bindWindowHours: REFERRAL_BIND_WINDOW_HOURS,
    };
  }

  private buildSharePath(referralCode: string): string {
    return `/invite?ref=${encodeURIComponent(referralCode)}`;
  }

  private buildShareUrl(referralCode: string): string {
    const sharePath = this.buildSharePath(referralCode);
    const origin = (process.env.NEXT_PUBLIC_PUBLIC_APP_ORIGIN ?? '').trim().replace(/\/+$/, '');
    return origin ? `${origin}${sharePath}` : sharePath;
  }

  private normalizeReferralCode(rawValue: string): string {
    return rawValue.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private generateReferralCode(): string {
    const bytes = randomBytes(REFERRAL_CODE_LENGTH);
    let value = '';
    for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
      value += REFERRAL_CODE_ALPHABET[bytes[index] % REFERRAL_CODE_ALPHABET.length];
    }
    return value;
  }

  private isReferralCodeConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('referralCode') || target.includes('referral_code');
  }

  private async getActivatedInviteeCount(referrerUserId: string): Promise<number> {
    const bindings = await this.prisma.referralBinding.findMany({
      where: {
        referrerUserId,
      },
      select: {
        inviteeUserId: true,
      },
    });
    if (bindings.length === 0) {
      return 0;
    }

    const memberships = await this.prisma.tenantMember.findMany({
      where: {
        userId: {
          in: bindings.map((binding) => binding.inviteeUserId),
        },
      },
      select: {
        userId: true,
        tenantId: true,
      },
    });
    if (memberships.length === 0) {
      return 0;
    }

    const productCounts = await this.prisma.product.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: {
          in: memberships.map((membership) => membership.tenantId),
        },
      },
      _count: {
        _all: true,
      },
    });

    const activeTenantIds = new Set(
      productCounts
        .filter((item) => item._count._all > 0)
        .map((item) => item.tenantId),
    );

    return memberships.reduce((count, membership) => {
      return count + (activeTenantIds.has(membership.tenantId) ? 1 : 0);
    }, 0);
  }

  private async getAwardedDaysTotal(
    userId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const [asReferrer, asInvitee] = await Promise.all([
      db.referralReward.aggregate({
        where: {
          status: ReferralRewardStatus.AWARDED,
          referrerUserId: userId,
        },
        _sum: {
          rewardDaysReferrer: true,
        },
      }),
      db.referralReward.aggregate({
        where: {
          status: ReferralRewardStatus.AWARDED,
          inviteeUserId: userId,
        },
        _sum: {
          rewardDaysInvitee: true,
        },
      }),
    ]);

    return (asReferrer._sum.rewardDaysReferrer ?? 0) + (asInvitee._sum.rewardDaysInvitee ?? 0);
  }

  private async getMonthAwardedDays(
    userId: string,
    targetDate: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const range = this.getMonthRange(targetDate);
    const [asReferrer, asInvitee] = await Promise.all([
      db.referralReward.aggregate({
        where: {
          status: ReferralRewardStatus.AWARDED,
          awardedAt: {
            gte: range.start,
            lt: range.endExclusive,
          },
          referrerUserId: userId,
        },
        _sum: {
          rewardDaysReferrer: true,
        },
      }),
      db.referralReward.aggregate({
        where: {
          status: ReferralRewardStatus.AWARDED,
          awardedAt: {
            gte: range.start,
            lt: range.endExclusive,
          },
          inviteeUserId: userId,
        },
        _sum: {
          rewardDaysInvitee: true,
        },
      }),
    ]);

    return (asReferrer._sum.rewardDaysReferrer ?? 0) + (asInvitee._sum.rewardDaysInvitee ?? 0);
  }

  private capRewardDays(requestedDays: number, awardedThisMonth: number): number {
    if (requestedDays <= 0) {
      return 0;
    }

    return Math.max(Math.min(requestedDays, MONTHLY_CAP_DAYS - awardedThisMonth), 0);
  }

  private resolveStatusReason(input: {
    requestedReferrerDays: number;
    rewardDaysReferrer: number;
    requestedInviteeDays: number;
    rewardDaysInvitee: number;
  }): string | null {
    const fullySkipped = input.rewardDaysReferrer === 0 && input.rewardDaysInvitee === 0;
    if (fullySkipped) {
      return 'monthly_cap_reached';
    }

    const clipped =
      input.rewardDaysReferrer < input.requestedReferrerDays ||
      input.rewardDaysInvitee < input.requestedInviteeDays;
    return clipped ? 'monthly_cap_clipped' : null;
  }

  private getMonthRange(targetDate: Date): { start: Date; endExclusive: Date } {
    const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endExclusive = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
    return { start, endExclusive };
  }

  private buildRewardDedupWhere(orderId: string, paymentId: string | null): Prisma.ReferralRewardWhereInput {
    const conditions: Prisma.ReferralRewardWhereInput[] = [{ orderId }];
    if (paymentId) {
      conditions.push({ paymentId });
    }

    return {
      OR: conditions,
    };
  }

  private toApiBinding(binding: {
    id: string;
    referrerUserId: string;
    inviteeUserId: string;
    referralCode: string;
    source: string;
    boundAt: Date;
  }): BindReferralResponse['binding'] {
    return {
      id: binding.id,
      referrerUserId: binding.referrerUserId,
      inviteeUserId: binding.inviteeUserId,
      referralCode: binding.referralCode,
      source: binding.source as ReferralBindingSource,
      boundAt: binding.boundAt.toISOString(),
    };
  }

  private toApiTriggerType(triggerType: ReferralRewardTriggerType): 'first_payment' | 'renewal' {
    return triggerType === ReferralRewardTriggerType.FIRST_PAYMENT ? 'first_payment' : 'renewal';
  }

  private toApiReward(reward: ReferralRewardRecord): MyReferralOverviewResponse['rewards'][number] {
    return {
      id: reward.id,
      status: reward.status,
      triggerType: this.toApiTriggerType(reward.triggerType),
      statusReason: reward.statusReason,
      referrerUserId: reward.referrerUserId,
      inviteeUserId: reward.inviteeUserId,
      paymentProvider: reward.paymentProvider,
      paymentId: reward.paymentId,
      orderId: reward.orderId,
      rewardDaysReferrer: reward.rewardDaysReferrer,
      rewardDaysInvitee: reward.rewardDaysInvitee,
      awardedAt: reward.awardedAt?.toISOString() ?? null,
      createdAt: reward.createdAt.toISOString(),
    };
  }

  private extractEmailDisplayName(email: string): string | null {
    const normalized = email.trim();
    if (!normalized.includes('@')) {
      return normalized || null;
    }

    return normalized.split('@')[0]?.trim() || null;
  }
}
