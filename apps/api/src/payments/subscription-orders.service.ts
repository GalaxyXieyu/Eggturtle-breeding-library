import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCode,
  resolveSubscriptionPriceCents,
  type CancelSubscriptionOrderResponse,
  type CreateSubscriptionOrderRequest,
  type CreateSubscriptionOrderResponse,
  type GetSubscriptionOrderResponse,
  type PayableTenantSubscriptionPlan,
  type SubscriptionDurationDays,
  type SubscriptionOrder,
} from '@eggturtle/shared';
import {
  Prisma,
  SubscriptionOrderFulfillmentMode,
  SubscriptionOrderPaymentChannel,
  SubscriptionOrderPaymentProvider,
  SubscriptionOrderStatus,
  TenantSubscriptionPlan,
} from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import { WechatPaymentNotification, WechatPayService } from './wechat-pay.service';

type CreateOrderInput = {
  tenantId: string;
  userId: string;
  payload: CreateSubscriptionOrderRequest;
};

type PurchaseResolution = {
  fulfillmentMode: SubscriptionOrderFulfillmentMode;
  effectiveStartsAt: Date;
};

type SubscriptionOrderRecord = Prisma.SubscriptionOrderGetPayload<{
  select: {
    id: true;
    orderNo: true;
    tenantId: true;
    userId: true;
    plan: true;
    durationDays: true;
    totalAmountCents: true;
    currency: true;
    paymentProvider: true;
    paymentChannel: true;
    paymentId: true;
    paymentPrepayId: true;
    status: true;
    statusReason: true;
    fulfillmentMode: true;
    effectiveStartsAt: true;
    createdAt: true;
    paidAt: true;
    cancelledAt: true;
    expiresAt: true;
    appliedAt: true;
  };
}>;

const PENDING_ORDER_TTL_MINUTES = 30;

@Injectable()
export class SubscriptionOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatPayService: WechatPayService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
    private readonly referralsService: ReferralsService,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<CreateSubscriptionOrderResponse> {
    if (input.payload.paymentChannel !== 'JSAPI') {
      throw new BadRequestException({
        message: 'Only WeChat JSAPI payment is supported in v1.',
        errorCode: ErrorCode.SubscriptionOrderInvalidPlanDuration,
      });
    }

    this.wechatPayService.assertReady();

    const subscription = await this.tenantSubscriptionsService.getSubscriptionForTenant(input.tenantId);
    const binding = await this.prisma.userWechatBinding.findUnique({
      where: {
        userId_appId: {
          userId: input.userId,
          appId: process.env.PAYMENT_WECHAT_APP_ID?.trim() ?? '',
        },
      },
      select: {
        openId: true,
      },
    });

    if (!binding?.openId) {
      throw new ForbiddenException({
        message: 'WeChat OAuth binding is required before creating a JSAPI order.',
        errorCode: ErrorCode.WechatOauthRequired,
      });
    }

    const purchase = await this.resolvePurchase(subscription, input.payload.plan);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PENDING_ORDER_TTL_MINUTES * 60 * 1000);
    const totalAmountCents = resolveSubscriptionPriceCents(input.payload.plan, input.payload.durationDays);
    const orderNo = this.generateOrderNo();

    const createdOrder = await this.prisma.subscriptionOrder.create({
      data: {
        orderNo,
        tenantId: input.tenantId,
        userId: input.userId,
        plan: input.payload.plan,
        durationDays: input.payload.durationDays,
        totalAmountCents,
        currency: 'CNY',
        paymentProvider: SubscriptionOrderPaymentProvider.WECHAT,
        paymentChannel: SubscriptionOrderPaymentChannel.JSAPI,
        status: SubscriptionOrderStatus.PENDING,
        fulfillmentMode: purchase.fulfillmentMode,
        effectiveStartsAt: purchase.effectiveStartsAt,
        expiresAt,
      },
      select: this.orderSelect,
    });

    try {
      const description = `${this.formatPlanLabel(input.payload.plan)} ${input.payload.durationDays}天`;
      const { prepayId } = await this.wechatPayService.createJsapiOrder({
        orderNo,
        description,
        totalAmountCents,
        openId: binding.openId,
        expiresAt,
      });

      const updatedOrder = await this.prisma.subscriptionOrder.update({
        where: {
          id: createdOrder.id,
        },
        data: {
          paymentPrepayId: prepayId,
        },
        select: this.orderSelect,
      });

      return {
        order: this.toApiOrder(updatedOrder),
        jsapiParams: this.wechatPayService.buildJsapiPayParams(prepayId),
      };
    } catch (error) {
      await this.prisma.subscriptionOrder.update({
        where: {
          id: createdOrder.id,
        },
        data: {
          statusReason: (error as Error)?.message?.slice(0, 255) ?? 'Failed to create WeChat order.',
        },
      });
      throw error;
    }
  }

  async getOrder(tenantId: string, orderNo: string): Promise<GetSubscriptionOrderResponse> {
    const order = await this.requireOrder(tenantId, orderNo);
    const refreshed = await this.refreshPendingOrderIfExpired(order);

    return {
      order: this.toApiOrder(refreshed),
    };
  }

  async cancelOrder(tenantId: string, orderNo: string): Promise<CancelSubscriptionOrderResponse> {
    const order = await this.requireOrder(tenantId, orderNo);
    const refreshed = await this.refreshPendingOrderIfExpired(order);

    if (refreshed.status !== SubscriptionOrderStatus.PENDING) {
      throw new BadRequestException({
        message: 'Only pending orders can be cancelled.',
        errorCode: ErrorCode.SubscriptionOrderInvalidState,
      });
    }

    await this.wechatPayService.closeOrder(refreshed.orderNo);

    const cancelledOrder = await this.prisma.subscriptionOrder.update({
      where: {
        id: refreshed.id,
      },
      data: {
        status: SubscriptionOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        statusReason: 'Cancelled by user.',
      },
      select: this.orderSelect,
    });

    return {
      order: this.toApiOrder(cancelledOrder),
    };
  }

  async handleWechatPaymentNotification(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<void> {
    const notification = this.wechatPayService.parseNotification(headers, rawBody);

    if (notification.trade_state !== 'SUCCESS') {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.subscriptionOrder.findUnique({
        where: {
          orderNo: notification.out_trade_no,
        },
        select: this.orderSelect,
      });

      if (!order) {
        throw new NotFoundException({
          message: 'Subscription order not found.',
          errorCode: ErrorCode.SubscriptionOrderNotFound,
        });
      }

      if (order.paymentProvider !== SubscriptionOrderPaymentProvider.WECHAT) {
        throw new BadRequestException({
          message: 'Subscription order payment provider mismatch.',
          errorCode: ErrorCode.SubscriptionOrderInvalidState,
        });
      }

      if (notification.appid !== process.env.PAYMENT_WECHAT_APP_ID?.trim()) {
        throw new BadRequestException({
          message: 'WeChat appid mismatch.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      if (notification.mchid !== process.env.PAYMENT_WECHAT_MCH_ID?.trim()) {
        throw new BadRequestException({
          message: 'WeChat mchid mismatch.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      if (notification.amount.total !== order.totalAmountCents) {
        throw new ForbiddenException({
          message: 'WeChat payment amount mismatch.',
          errorCode: ErrorCode.PaymentAmountMismatch,
        });
      }

      if (order.status === SubscriptionOrderStatus.PAID) {
        if (order.paymentId && order.paymentId !== notification.transaction_id) {
          throw new BadRequestException({
            message: 'Subscription order payment transaction mismatch.',
            errorCode: ErrorCode.SubscriptionOrderInvalidState,
          });
        }
        return;
      }

      if (
        order.status !== SubscriptionOrderStatus.PENDING &&
        order.status !== SubscriptionOrderStatus.EXPIRED
      ) {
        throw new BadRequestException({
          message: 'Subscription order is not payable anymore.',
          errorCode: ErrorCode.SubscriptionOrderInvalidState,
        });
      }

      const paidAt = notification.success_time ? new Date(notification.success_time) : new Date();
      const paidOrder = await tx.subscriptionOrder.update({
        where: {
          id: order.id,
        },
        data: {
          status: SubscriptionOrderStatus.PAID,
          paymentId: notification.transaction_id,
          paidAt,
          statusReason: null,
          providerPayload: notification as unknown as Prisma.InputJsonValue,
        },
        select: this.orderSelect,
      });

      if (paidOrder.fulfillmentMode === SubscriptionOrderFulfillmentMode.IMMEDIATE && !paidOrder.appliedAt) {
        await this.tenantSubscriptionsService.applyPaidSubscriptionOrder(
          {
            tenantId: paidOrder.tenantId,
            plan: paidOrder.plan,
            durationDays: paidOrder.durationDays,
            fulfillmentMode: paidOrder.fulfillmentMode,
            effectiveStartsAt: paidOrder.effectiveStartsAt,
            appliedAt: paidAt,
          },
          tx,
        );

        await tx.subscriptionOrder.update({
          where: {
            id: paidOrder.id,
          },
          data: {
            appliedAt: paidAt,
          },
        });
      }

      await this.referralsService.awardReferralForPaidOrder(
        {
          userId: paidOrder.userId,
          tenantId: paidOrder.tenantId,
          provider: 'wechat',
          orderId: paidOrder.orderNo,
          paymentId: notification.transaction_id,
          paidAt,
        },
        tx,
      );
    });
  }

  async applyDeferredOrders(now = new Date()): Promise<number> {
    const dueOrders = await this.prisma.subscriptionOrder.findMany({
      where: {
        status: SubscriptionOrderStatus.PAID,
        appliedAt: null,
        fulfillmentMode: SubscriptionOrderFulfillmentMode.DEFERRED,
        effectiveStartsAt: {
          lte: now,
        },
      },
      orderBy: {
        effectiveStartsAt: 'asc',
      },
      select: this.orderSelect,
    });

    let appliedCount = 0;
    for (const order of dueOrders) {
      await this.prisma.$transaction(async (tx) => {
        const lockedOrder = await tx.subscriptionOrder.findUnique({
          where: {
            id: order.id,
          },
          select: this.orderSelect,
        });

        if (!lockedOrder || lockedOrder.appliedAt || lockedOrder.status !== SubscriptionOrderStatus.PAID) {
          return;
        }

        const appliedAt = new Date();
        await this.tenantSubscriptionsService.applyPaidSubscriptionOrder(
          {
            tenantId: lockedOrder.tenantId,
            plan: lockedOrder.plan,
            durationDays: lockedOrder.durationDays,
            fulfillmentMode: lockedOrder.fulfillmentMode,
            effectiveStartsAt: lockedOrder.effectiveStartsAt,
            appliedAt,
          },
          tx,
        );
        await tx.subscriptionOrder.update({
          where: {
            id: lockedOrder.id,
          },
          data: {
            appliedAt,
          },
        });
        appliedCount += 1;
      });
    }

    return appliedCount;
  }

  private async resolvePurchase(
    subscription: Awaited<ReturnType<TenantSubscriptionsService['getSubscriptionForTenant']>>,
    targetPlan: PayableTenantSubscriptionPlan,
  ): Promise<PurchaseResolution> {
    const now = new Date();
    const currentExpiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const activeBase =
      currentExpiresAt && currentExpiresAt.getTime() > now.getTime() ? currentExpiresAt : now;

    if (subscription.plan === 'PRO' && targetPlan === 'BASIC') {
      if (subscription.status !== 'ACTIVE' || !currentExpiresAt || currentExpiresAt.getTime() <= now.getTime()) {
        throw new BadRequestException({
          message: 'Current PRO subscription cannot be downgraded after expiry or without expiresAt.',
          errorCode: ErrorCode.SubscriptionOrderInvalidState,
        });
      }

      const deferredOrder = await this.prisma.subscriptionOrder.findFirst({
        where: {
          tenantId: subscription.tenantId,
          status: SubscriptionOrderStatus.PAID,
          fulfillmentMode: SubscriptionOrderFulfillmentMode.DEFERRED,
          appliedAt: null,
        },
        select: {
          id: true,
        },
      });
      if (deferredOrder) {
        throw new BadRequestException({
          message: 'A deferred downgrade order already exists for this tenant.',
          errorCode: ErrorCode.SubscriptionOrderDeferredExists,
        });
      }

      return {
        fulfillmentMode: SubscriptionOrderFulfillmentMode.DEFERRED,
        effectiveStartsAt: currentExpiresAt,
      };
    }

    return {
      fulfillmentMode: SubscriptionOrderFulfillmentMode.IMMEDIATE,
      effectiveStartsAt: activeBase,
    };
  }

  private async requireOrder(tenantId: string, orderNo: string): Promise<SubscriptionOrderRecord> {
    const order = await this.prisma.subscriptionOrder.findFirst({
      where: {
        tenantId,
        orderNo,
      },
      select: this.orderSelect,
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Subscription order not found.',
        errorCode: ErrorCode.SubscriptionOrderNotFound,
      });
    }

    return order;
  }

  private async refreshPendingOrderIfExpired(order: SubscriptionOrderRecord): Promise<SubscriptionOrderRecord> {
    if (order.status !== SubscriptionOrderStatus.PENDING || order.expiresAt.getTime() > Date.now()) {
      return order;
    }

    return this.prisma.subscriptionOrder.update({
      where: {
        id: order.id,
      },
      data: {
        status: SubscriptionOrderStatus.EXPIRED,
        statusReason: 'Pending payment order expired.',
      },
      select: this.orderSelect,
    });
  }

  private toApiOrder(order: SubscriptionOrderRecord): SubscriptionOrder {
    return {
      orderId: order.id,
      orderNo: order.orderNo,
      tenantId: order.tenantId,
      userId: order.userId,
      plan: order.plan as PayableTenantSubscriptionPlan,
      durationDays: order.durationDays as SubscriptionDurationDays,
      totalAmountCents: order.totalAmountCents,
      currency: order.currency,
      paymentProvider: order.paymentProvider,
      paymentChannel: order.paymentChannel,
      paymentId: order.paymentId,
      paymentPrepayId: order.paymentPrepayId,
      status: order.status,
      statusReason: order.statusReason,
      fulfillmentMode: order.fulfillmentMode,
      effectiveStartsAt: order.effectiveStartsAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      expiresAt: order.expiresAt.toISOString(),
      appliedAt: order.appliedAt?.toISOString() ?? null,
    };
  }

  private formatPlanLabel(plan: PayableTenantSubscriptionPlan): string {
    return plan === 'PRO' ? '专业版' : '基础版';
  }

  private generateOrderNo(): string {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `SUB${timestamp}${suffix}`;
  }

  private get orderSelect() {
    return {
      id: true,
      orderNo: true,
      tenantId: true,
      userId: true,
      plan: true,
      durationDays: true,
      totalAmountCents: true,
      currency: true,
      paymentProvider: true,
      paymentChannel: true,
      paymentId: true,
      paymentPrepayId: true,
      status: true,
      statusReason: true,
      fulfillmentMode: true,
      effectiveStartsAt: true,
      createdAt: true,
      paidAt: true,
      cancelledAt: true,
      expiresAt: true,
      appliedAt: true,
    } satisfies Prisma.SubscriptionOrderSelect;
  }
}
