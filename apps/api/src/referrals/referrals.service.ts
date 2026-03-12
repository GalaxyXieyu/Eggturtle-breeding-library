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
  type BindReferralFromAttributionRequest,
  type BindReferralFromAttributionResponse,
  type MyReferralOverviewResponse,
  type PublicReferralLandingResponse,
  type ReferralAttributionPageType,
  type ReferralBindingSource,
  type SettleReferralPaidEventResponse,
} from '@eggturtle/shared';
import {
  Prisma,
  TenantMemberRole,
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
const FIRST_PRODUCT_REFERRER_DAYS = 7;
const FIRST_PRODUCT_INVITEE_DAYS = 7;
const RENEWAL_REFERRER_DAYS = 30;
const MONTHLY_CAP_DAYS = 60;
const RECENT_REWARDS_LIMIT = 20;
const RECENT_INVITES_LIMIT = 20;
const DEFAULT_REFERRAL_ATTRIBUTION_TTL_DAYS = 30;
const FALLBACK_INVITER_NAME = 'Eggturtle 用户';

type ReferralRewardMode = 'FIRST_PRODUCT_CREATE' | 'PAID_ORDER';

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

type FirstProductRewardInput = {
  actorUserId?: string | null;
  userId: string;
  tenantId: string;
  productId: string;
  productCode: string;
  createdAt?: Date;
};

type ResolvedInviter = {
  userId: string;
  referralCode: string;
  displayName: string;
  tenantId: string;
  tenantName: string | null;
};

type NormalizedAttributionInput = {
  fromUrl: string;
  pageType: ReferralAttributionPageType;
  shareToken: string | null;
  tenantSlug: string | null;
  productId: string | null;
  verifyId: string | null;
  entrySource: string | null;
  capturedAt: string;
};

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
  ) {}

  async getMyReferralOverview(userId: string): Promise<MyReferralOverviewResponse> {
    const referralCode = await this.ensureReferralCode(userId);
    const monthlyCapDays = this.getMonthlyCapDays();
    const [binding, invitedCount, activatedInviteeCount, totalAwardedDays, monthAwardedDays, invites, rewards] =
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
        this.getRecentInviteProgress(userId),
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
      monthRemainingDays: Math.max(monthlyCapDays - monthAwardedDays, 0),
      invites,
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
    sourceMeta?: Prisma.InputJsonValue | null,
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
          sourceMeta: sourceMeta ?? undefined,
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

  async bindReferralFromAttribution(
    inviteeUserId: string,
    input: BindReferralFromAttributionRequest,
  ): Promise<BindReferralFromAttributionResponse> {
    if (!this.isPublicAutoBindEnabled()) {
      return {
        consumed: false,
        binding: null,
        inviter: null,
        reason: 'feature_disabled',
      };
    }

    const normalized = this.normalizeAttributionInput(input);
    const inviter = await this.resolveInviterFromAttribution(normalized);
    if (!inviter) {
      return {
        consumed: true,
        binding: null,
        inviter: null,
        reason: 'inviter_not_found',
      };
    }

    try {
      const response = await this.bindReferral(
        inviteeUserId,
        inviter.referralCode,
        'public_page_auto',
        {
          fromUrl: normalized.fromUrl,
          pageType: normalized.pageType,
          shareToken: normalized.shareToken,
          tenantSlug: normalized.tenantSlug,
          productId: normalized.productId,
          verifyId: normalized.verifyId,
          entrySource: normalized.entrySource,
          capturedAt: normalized.capturedAt,
          resolvedInviterUserId: inviter.userId,
          resolvedInviterTenantId: inviter.tenantId,
        },
      );

      return {
        consumed: true,
        binding: response.binding,
        inviter: {
          userId: inviter.userId,
          displayName: inviter.displayName,
          tenantName: inviter.tenantName,
        },
        reason: 'bound',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        return {
          consumed: true,
          binding: null,
          inviter: {
            userId: inviter.userId,
            displayName: inviter.displayName,
            tenantName: inviter.tenantName,
          },
          reason: this.mapAutoBindErrorReason(error),
        };
      }

      throw error;
    }
  }

  async awardReferralForFirstProductCreate(
    input: FirstProductRewardInput,
    db?: Prisma.TransactionClient,
  ): Promise<MyReferralOverviewResponse['rewards'][number] | null> {
    if (this.getRewardMode() !== 'FIRST_PRODUCT_CREATE') {
      return null;
    }

    const createdAt = input.createdAt ?? new Date();
    const triggerKey = `first_product_create:${input.userId}`;

    const run = async (tx: Prisma.TransactionClient | PrismaService) => {
      const existingReward = await tx.referralReward.findUnique({
        where: {
          triggerKey,
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
      if (existingReward) {
        return this.toApiReward(existingReward);
      }

      const [binding, inviteeMembership, productCount, priorEntryReward] =
        await Promise.all([
          tx.referralBinding.findUnique({
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
          }),
          tx.tenantMember.findUnique({
            where: {
              userId: input.userId,
            },
            select: {
              tenantId: true,
            },
          }),
          tx.product.count({
            where: {
              tenantId: input.tenantId,
            },
          }),
          tx.referralReward.findFirst({
            where: {
              inviteeUserId: input.userId,
              triggerType: {
                in: [
                  ReferralRewardTriggerType.FIRST_PAYMENT,
                  ReferralRewardTriggerType.FIRST_PRODUCT_CREATE,
                ],
              },
            },
            select: {
              id: true,
            },
          }),
        ]);

      const resolvedReferrerMembership = binding
        ? await tx.tenantMember.findUnique({
            where: {
              userId: binding.referrerUserId,
            },
            select: {
              tenantId: true,
            },
          })
        : null;

      if (!binding || binding.boundAt.getTime() > createdAt.getTime()) {
        return null;
      }

      if (!inviteeMembership || !resolvedReferrerMembership) {
        throw new BadRequestException({
          message: 'Referral reward settlement requires active tenant membership.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      if (inviteeMembership.tenantId !== input.tenantId || productCount !== 1 || priorEntryReward) {
        return null;
      }

      const requestedReferrerDays = this.getFirstProductReferrerDays();
      const requestedInviteeDays = this.getFirstProductInviteeDays();
      const [referrerAwardedThisMonth, inviteeAwardedThisMonth] = await Promise.all([
        this.getMonthAwardedDays(binding.referrerUserId, createdAt, tx),
        requestedInviteeDays > 0 ? this.getMonthAwardedDays(input.userId, createdAt, tx) : Promise.resolve(0),
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
          resolvedReferrerMembership.tenantId,
          rewardDaysReferrer,
          tx as Prisma.TransactionClient,
        );
      }
      if (rewardDaysInvitee > 0) {
        await this.tenantSubscriptionsService.grantProRewardDays(
          inviteeMembership.tenantId,
          rewardDaysInvitee,
          tx as Prisma.TransactionClient,
        );
      }

      try {
        const reward = await tx.referralReward.create({
          data: {
            status,
            triggerType: ReferralRewardTriggerType.FIRST_PRODUCT_CREATE,
            statusReason,
            referrerUserId: binding.referrerUserId,
            inviteeUserId: input.userId,
            triggerKey,
            triggerMeta: {
              tenantId: input.tenantId,
              productId: input.productId,
              productCode: input.productCode,
            },
            rewardDaysReferrer,
            rewardDaysInvitee,
            awardedAt: status === ReferralRewardStatus.AWARDED ? createdAt : null,
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

        return this.toApiReward(reward);
      } catch (error) {
        if (this.isTriggerKeyConflict(error)) {
          const currentReward = await tx.referralReward.findUnique({
            where: {
              triggerKey,
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
          return currentReward ? this.toApiReward(currentReward) : null;
        }

        throw error;
      }
    };

    if (db) {
      return run(db);
    }

    return this.prisma.$transaction((tx) => run(tx));
  }

  async awardReferralForPaidOrder(
    input: PaidOrderInput,
    db?: Prisma.TransactionClient,
  ): Promise<SettleReferralPaidEventResponse> {
    if (this.getRewardMode() !== 'PAID_ORDER') {
      return {
        settled: false,
        triggerType: null,
        reward: null,
      };
    }

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
      rewardMode: this.getRewardMode() === 'FIRST_PRODUCT_CREATE' ? 'first_product_create' : 'paid_order',
      firstPaymentReferrerDays: FIRST_PAYMENT_REFERRER_DAYS,
      firstPaymentInviteeDays: FIRST_PAYMENT_INVITEE_DAYS,
      firstProductReferrerDays: this.getFirstProductReferrerDays(),
      firstProductInviteeDays: this.getFirstProductInviteeDays(),
      renewalReferrerDays: RENEWAL_REFERRER_DAYS,
      monthlyCapDays: this.getMonthlyCapDays(),
      bindWindowHours: REFERRAL_BIND_WINDOW_HOURS,
      attributionTtlDays: this.getAttributionTtlDays(),
      autoBindPublicEnabled: this.isPublicAutoBindEnabled(),
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

  private isTriggerKeyConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('triggerKey') || target.includes('trigger_key');
  }

  private getRewardMode(): ReferralRewardMode {
    const rawValue = (process.env.REFERRAL_REWARD_MODE ?? '').trim().toUpperCase();
    return rawValue === 'PAID_ORDER' ? 'PAID_ORDER' : 'FIRST_PRODUCT_CREATE';
  }

  private getFirstProductReferrerDays(): number {
    return this.readPositiveIntEnv('REFERRAL_FIRST_PRODUCT_REFERRER_DAYS', FIRST_PRODUCT_REFERRER_DAYS);
  }

  private getFirstProductInviteeDays(): number {
    return this.readPositiveIntEnv('REFERRAL_FIRST_PRODUCT_INVITEE_DAYS', FIRST_PRODUCT_INVITEE_DAYS);
  }

  private getMonthlyCapDays(): number {
    return MONTHLY_CAP_DAYS;
  }

  private getAttributionTtlDays(): number {
    return this.readPositiveIntEnv('REFERRAL_ATTRIBUTION_TTL_DAYS', DEFAULT_REFERRAL_ATTRIBUTION_TTL_DAYS);
  }

  private isPublicAutoBindEnabled(): boolean {
    const rawValue = (process.env.REFERRAL_AUTO_BIND_PUBLIC_ENABLED ?? '').trim().toLowerCase();
    if (!rawValue) {
      return true;
    }

    return rawValue !== 'false' && rawValue !== '0' && rawValue !== 'off';
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const rawValue = process.env[name]?.trim();
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }

  private normalizeAttributionInput(input: BindReferralFromAttributionRequest): NormalizedAttributionInput {
    const fromUrl = input.fromUrl.trim();
    const parsedUrl = this.safeParseUrl(fromUrl);
    const pathSegments = parsedUrl?.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => this.safeDecodePathSegment(segment)) ?? [];

    let shareToken = this.trimToNull(input.shareToken);
    let tenantSlug = this.trimToNull(input.tenantSlug);
    let productId = this.trimToNull(input.productId);
    let verifyId = this.trimToNull(input.verifyId);

    if (pathSegments[0] === 'public' && pathSegments[1] === 's') {
      shareToken ??= this.trimToNull(pathSegments[2]);
      if (pathSegments[3] === 'products') {
        productId ??= this.trimToNull(pathSegments[4]);
      }
    }

    if (pathSegments[0] === 'public' && pathSegments[1] === 'certificates' && pathSegments[2] === 'verify') {
      verifyId ??= this.trimToNull(pathSegments[3]);
    }

    if (
      pathSegments[0] === 'public' &&
      pathSegments[1] &&
      pathSegments[1] !== 's' &&
      pathSegments[1] !== 'certificates' &&
      pathSegments[1] !== 'products' &&
      pathSegments[1] !== 'breeders'
    ) {
      tenantSlug ??= this.trimToNull(pathSegments[1]);
      if (pathSegments[2] === 'products') {
        productId ??= this.trimToNull(pathSegments[3]);
      }
    }

    const entrySource =
      this.trimToNull(input.entrySource) ??
      this.trimToNull(parsedUrl?.searchParams.get('src') ?? null) ??
      this.inferEntrySource(input.pageType);

    return {
      fromUrl,
      pageType: input.pageType,
      shareToken,
      tenantSlug,
      productId,
      verifyId,
      entrySource,
      capturedAt: input.capturedAt ?? new Date().toISOString(),
    };
  }

  private async resolveInviterFromAttribution(input: NormalizedAttributionInput) {
    if (input.pageType === 'share_feed' || input.pageType === 'share_product') {
      if (!input.shareToken) {
        return null;
      }

      const share = await this.prisma.publicShare.findUnique({
        where: {
          shareToken: input.shareToken,
        },
        select: {
          tenantId: true,
        },
      });
      if (!share) {
        return null;
      }

      return this.resolveOwnerInviterByTenantId(share.tenantId);
    }

    if (input.pageType === 'tenant_feed' || input.pageType === 'tenant_product') {
      if (!input.tenantSlug) {
        return null;
      }

      const tenant = await this.prisma.tenant.findUnique({
        where: {
          slug: input.tenantSlug,
        },
        select: {
          id: true,
        },
      });
      if (!tenant) {
        return null;
      }

      return this.resolveOwnerInviterByTenantId(tenant.id);
    }

    if (!input.verifyId) {
      return null;
    }

    const certificate = await this.prisma.productCertificate.findUnique({
      where: {
        verifyId: input.verifyId,
      },
      select: {
        tenantId: true,
      },
    });
    if (!certificate) {
      return null;
    }

    return this.resolveOwnerInviterByTenantId(certificate.tenantId);
  }

  private async resolveOwnerInviterByTenantId(tenantId: string): Promise<ResolvedInviter | null> {
    const ownerMembership = await this.prisma.tenantMember.findFirst({
      where: {
        tenantId,
        role: TenantMemberRole.OWNER,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        tenantId: true,
        tenant: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            referralCode: true,
            name: true,
            account: true,
            email: true,
          },
        },
      },
    });
    if (!ownerMembership) {
      return null;
    }

    const tenantName = ownerMembership.tenant.name ?? null;
    const referralCode = ownerMembership.user.referralCode ?? (await this.ensureReferralCode(ownerMembership.user.id));

    return {
      userId: ownerMembership.user.id,
      referralCode,
      displayName: this.resolveUserDisplayName(ownerMembership.user, tenantName),
      tenantId: ownerMembership.tenantId,
      tenantName,
    };
  }

  private async getRecentInviteProgress(
    referrerUserId: string,
  ): Promise<MyReferralOverviewResponse['invites']> {
    const bindings = await this.prisma.referralBinding.findMany({
      where: {
        referrerUserId,
      },
      orderBy: {
        boundAt: 'desc',
      },
      take: RECENT_INVITES_LIMIT,
      select: {
        inviteeUserId: true,
        referralCode: true,
        boundAt: true,
        inviteeUser: {
          select: {
            name: true,
            account: true,
            email: true,
          },
        },
      },
    });
    if (bindings.length === 0) {
      return [];
    }

    const inviteeIds = bindings.map((binding) => binding.inviteeUserId);
    const memberships = await this.prisma.tenantMember.findMany({
      where: {
        userId: {
          in: inviteeIds,
        },
      },
      select: {
        userId: true,
        tenantId: true,
      },
    });

    const tenantIdByInvitee = new Map(memberships.map((membership) => [membership.userId, membership.tenantId]));
    const tenantIds = memberships.map((membership) => membership.tenantId);
    const firstProducts = tenantIds.length
      ? await this.prisma.product.groupBy({
          by: ['tenantId'],
          where: {
            tenantId: {
              in: tenantIds,
            },
          },
          _min: {
            createdAt: true,
          },
        })
      : [];
    const firstProductByTenantId = new Map(
      firstProducts.map((item) => [item.tenantId, item._min.createdAt ?? null]),
    );

    const rewards = await this.prisma.referralReward.findMany({
      where: {
        inviteeUserId: {
          in: inviteeIds,
        },
        triggerType: {
          in: [
            ReferralRewardTriggerType.FIRST_PAYMENT,
            ReferralRewardTriggerType.FIRST_PRODUCT_CREATE,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        inviteeUserId: true,
        status: true,
        awardedAt: true,
      },
    });
    const rewardByInviteeUserId = new Map<string, { status: ReferralRewardStatus; awardedAt: Date | null }>();
    for (const reward of rewards) {
      if (!rewardByInviteeUserId.has(reward.inviteeUserId)) {
        rewardByInviteeUserId.set(reward.inviteeUserId, {
          status: reward.status,
          awardedAt: reward.awardedAt,
        });
      }
    }

    return bindings.map((binding) => {
      const tenantId = tenantIdByInvitee.get(binding.inviteeUserId) ?? null;
      const firstProductCreatedAt = tenantId ? firstProductByTenantId.get(tenantId) ?? null : null;
      const reward = rewardByInviteeUserId.get(binding.inviteeUserId) ?? null;
      const status = reward
        ? reward.status === ReferralRewardStatus.AWARDED
          ? 'reward_awarded'
          : 'reward_skipped'
        : firstProductCreatedAt
          ? 'first_product_uploaded'
          : 'bound';

      return {
        inviteeUserId: binding.inviteeUserId,
        inviteeDisplayName: this.resolveUserDisplayName(binding.inviteeUser, null, binding.inviteeUserId),
        referralCode: binding.referralCode,
        boundAt: binding.boundAt.toISOString(),
        firstProductCreatedAt: firstProductCreatedAt?.toISOString() ?? null,
        rewardStatus: reward?.status ?? null,
        rewardAwardedAt: reward?.awardedAt?.toISOString() ?? null,
        status,
      };
    });
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

    return Math.max(Math.min(requestedDays, this.getMonthlyCapDays() - awardedThisMonth), 0);
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

  private mapAutoBindErrorReason(error: BadRequestException | ForbiddenException | NotFoundException): string {
    const message = this.readExceptionMessage(error).toLowerCase();

    if (message.includes('already exists')) {
      return 'already_bound';
    }
    if (message.includes('invalid')) {
      return 'invalid_referral';
    }
    if (message.includes('self-invite')) {
      return 'self_invite';
    }
    if (message.includes('same phone')) {
      return 'same_phone';
    }
    if (message.includes('within')) {
      return 'bind_window_expired';
    }
    if (message.includes('subscription activation')) {
      return 'subscription_activated';
    }

    return 'not_bindable';
  }

  private readExceptionMessage(
    error: BadRequestException | ForbiddenException | NotFoundException,
  ): string {
    const response = error.getResponse();
    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object' && 'message' in response) {
      const message = response.message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return error.message;
  }

  private safeParseUrl(rawValue: string): URL | null {
    try {
      return new URL(rawValue, 'http://eggturtle.local');
    } catch {
      return null;
    }
  }

  private safeDecodePathSegment(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private trimToNull(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private inferEntrySource(pageType: ReferralAttributionPageType): string {
    if (pageType === 'certificate_verify') {
      return 'certificate';
    }

    if (pageType === 'share_product' || pageType === 'tenant_product') {
      return 'detail';
    }

    return 'share';
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

  private toApiTriggerType(
    triggerType: ReferralRewardTriggerType,
  ): 'first_payment' | 'renewal' | 'first_product_create' {
    if (triggerType === ReferralRewardTriggerType.FIRST_PAYMENT) {
      return 'first_payment';
    }

    if (triggerType === ReferralRewardTriggerType.RENEWAL) {
      return 'renewal';
    }

    return 'first_product_create';
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

  private resolveUserDisplayName(
    user: { name: string | null; account: string | null; email: string },
    tenantName: string | null,
    fallbackId?: string,
  ): string {
    return (
      user.name?.trim() ||
      user.account?.trim() ||
      tenantName ||
      this.extractEmailDisplayName(user.email) ||
      (fallbackId ? `Eggturtle 用户 ${fallbackId.slice(-4)}` : FALLBACK_INVITER_NAME)
    );
  }
}
