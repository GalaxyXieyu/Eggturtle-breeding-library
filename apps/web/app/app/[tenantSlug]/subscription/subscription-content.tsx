'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import {
  SUBSCRIPTION_PLAN_PRODUCT_LIMITS,
  SUBSCRIPTION_PRICE_BOOK,
  createSubscriptionOrderRequestSchema,
  createSubscriptionOrderResponseSchema,
  createWechatAuthorizeUrlRequestSchema,
  createWechatAuthorizeUrlResponseSchema,
  getSubscriptionOrderResponseSchema,
  meSubscriptionResponseSchema,
  redeemTenantSubscriptionActivationCodeRequestSchema,
  redeemTenantSubscriptionActivationCodeResponseSchema,
  trackSubscriptionOrderBehaviorRequestSchema,
  trackSubscriptionOrderBehaviorResponseSchema,
  type PayableTenantSubscriptionPlan,
  cancelSubscriptionOrderResponseSchema,
  type SubscriptionDurationDays,
  type SubscriptionOrder,
  type TenantSubscription,
} from '@eggturtle/shared';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildInteractivePillClass } from '@/components/ui/pill';
import { ApiError, apiRequest, getAccessToken } from '@/lib/api-client';
import { copyTextWithFallback } from '@/lib/browser-share';
import { switchTenantBySlug } from '@/lib/tenant-session';
import { cn } from '@/lib/utils';

type PlanTier = 'FREE' | PayableTenantSubscriptionPlan;

type SubscriptionPageContentProps = {
  embedded?: boolean;
};

type PurchaseIntent = {
  plan: PayableTenantSubscriptionPlan;
  durationDays: SubscriptionDurationDays;
};

type PurchaseEntryPoint = 'catalog' | 'recommendation' | 'plan_detail' | 'oauth_resume';

type PurchaseDialogSession = {
  openedAt: number;
  entryPoint: PurchaseEntryPoint;
  payClicked: boolean;
};

type WechatPayInvokeResult = {
  err_msg?: string;
};

type WeixinJsBridge = {
  invoke: (
    name: 'getBrandWCPayRequest',
    params: Record<string, string>,
    callback: (result: WechatPayInvokeResult) => void,
  ) => void;
};

declare global {
  interface Window {
    WeixinJSBridge?: WeixinJsBridge;
  }
}

const DURATION_OPTIONS: SubscriptionDurationDays[] = [30, 90, 365];
const PENDING_PURCHASE_STORAGE_KEY = 'eggturtle.subscription.pending-purchase.v1';
const ORDER_POLL_INTERVAL_MS = 2_000;
const ORDER_POLL_TIMEOUT_MS = 60_000;

const PLAN_META: Record<
  PlanTier,
  { name: string; summary: string; perks: string[]; badge: string }
> = {
  FREE: {
    name: '免费版',
    summary: '适合刚开始建档的个人或小规模龟场。',
    badge: '体验',
    perks: ['基础档案管理', '交配 / 产蛋记录', '基础分享能力'],
  },
  BASIC: {
    name: '基础版',
    summary: '适合稳定经营、需要完整溯源和对外展示的团队。',
    badge: '常用',
    perks: ['完整血统溯源', '图册展示 + 二维码', '更高图片与分享额度'],
  },
  PRO: {
    name: '专业版',
    summary: '适合高频上新、品牌化展示和更高配额的运营场景。',
    badge: '推荐',
    perks: ['证书能力', '图片水印能力', '高配额与品牌化展示'],
  },
};

const PLAN_DISPLAY_ORDER: PlanTier[] = ['PRO', 'BASIC', 'FREE'];

export default function SubscriptionPageContent({ embedded = false }: SubscriptionPageContentProps = {}) {
  const params = useParams<{ tenantSlug: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const wechatAuthStatus = searchParams.get('wechatAuth');

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [externalWechatNotice, setExternalWechatNotice] = useState<string | null>(null);
  const [purchasePlan, setPurchasePlan] = useState<PayableTenantSubscriptionPlan | null>(null);
  const [planDetail, setPlanDetail] = useState<PlanTier | null>(null);
  const [purchaseDuration, setPurchaseDuration] = useState<SubscriptionDurationDays>(30);
  const [paying, setPaying] = useState(false);
  const [lastOrderNo, setLastOrderNo] = useState<string | null>(null);

  const oauthResumeHandledRef = useRef(false);
  const quickActionHandledRef = useRef<string | null>(null);
  const plansSectionRef = useRef<HTMLElement | null>(null);
  const activationSectionRef = useRef<HTMLElement | null>(null);
  const embeddedPlanCardRefs = useRef<Partial<Record<PlanTier, HTMLButtonElement | null>>>({});
  const pendingPurchaseEntryPointRef = useRef<PurchaseEntryPoint>('catalog');
  const purchaseDialogSessionRef = useRef<PurchaseDialogSession | null>(null);
  const planDetailTitleId = useId();
  const purchaseDialogTitleId = useId();
  const [isWechat, setIsWechat] = useState<boolean | null>(null);
  const currentPlan = normalizePlan(subscription?.plan);
  const [embeddedPlansOpen, setEmbeddedPlansOpen] = useState(true);
  const [embeddedActivationOpen, setEmbeddedActivationOpen] = useState(false);
  const [wechatQrOpen, setWechatQrOpen] = useState(false);
  const [selectedEmbeddedPlan, setSelectedEmbeddedPlan] = useState<PlanTier>(currentPlan);
  const selectedEmbeddedPlanIndex = Math.max(PLAN_DISPLAY_ORDER.indexOf(selectedEmbeddedPlan), 0);
  const currentMeta = PLAN_META[currentPlan];
  const recommendedPlan = resolveRecommendedPlan(currentPlan);
  const planDetailMeta = planDetail ? PLAN_META[planDetail] : null;
  const payableDetailPlan = planDetail === 'BASIC' || planDetail === 'PRO' ? planDetail : null;
  const planDetailMonthlyPrice = payableDetailPlan
    ? SUBSCRIPTION_PRICE_BOOK[payableDetailPlan][30]
    : 0;
  const planDetailIsCurrent = planDetail === currentPlan;
  const focusTarget = searchParams.get('focus');
  const quickPurchase = searchParams.get('purchase');
  const wechatEnvironment =
    isWechat === true
      ? { badgeVariant: 'success' as const, badgeLabel: '微信内可支付' }
      : isWechat === false
        ? { badgeVariant: 'warning' as const, badgeLabel: '需在微信中支付' }
        : { badgeVariant: 'default' as const, badgeLabel: '检测支付环境中…' };
  const returnPath = useMemo(() => {
    const query = searchParams.toString();
    if (pathname) {
      return query ? `${pathname}?${query}` : pathname;
    }
    return `/app/${tenantSlug}/subscription`;
  }, [pathname, searchParams, tenantSlug]);
  const sourcePath = pathname ?? `/app/${tenantSlug}/subscription`;

  useEffect(() => {
    setSelectedEmbeddedPlan(currentPlan);
  }, [currentPlan]);

  useEffect(() => {
    if (!embedded || !embeddedPlansOpen) {
      return;
    }

    const currentCard = embeddedPlanCardRefs.current[selectedEmbeddedPlan];
    if (!currentCard) {
      return;
    }

    currentCard.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [embedded, embeddedPlansOpen, selectedEmbeddedPlan]);

  const handleSelectEmbeddedPlan = useCallback((plan: PlanTier) => {
    setSelectedEmbeddedPlan(plan);
  }, []);

  const handleStepEmbeddedPlan = useCallback(
    (direction: 'prev' | 'next') => {
      const step = direction === 'next' ? 1 : -1;
      const nextIndex = Math.min(
        Math.max(selectedEmbeddedPlanIndex + step, 0),
        PLAN_DISPLAY_ORDER.length - 1,
      );
      handleSelectEmbeddedPlan(PLAN_DISPLAY_ORDER[nextIndex]);
    },
    [handleSelectEmbeddedPlan, selectedEmbeddedPlanIndex],
  );

  const trackSubscriptionBehavior = useCallback(
    async (payload: {
      event:
        | 'DIALOG_OPEN'
        | 'PAY_CLICK'
        | 'PAY_CANCEL'
        | 'PAY_SUCCESS'
        | 'PAY_FAILURE'
        | 'PAY_HESITATE';
      plan?: PayableTenantSubscriptionPlan;
      durationDays?: SubscriptionDurationDays;
      orderNo?: string;
      entryPoint?: PurchaseEntryPoint;
      stayDurationMs?: number;
      reason?: string;
      result?: string;
    }) => {
      if (!getAccessToken()) {
        return;
      }

      try {
        await apiRequest('/subscriptions/orders/track', {
          method: 'POST',
          body: {
            sourcePath,
            ...payload,
          },
          requestSchema: trackSubscriptionOrderBehaviorRequestSchema,
          responseSchema: trackSubscriptionOrderBehaviorResponseSchema,
        });
      } catch {
        // ignore tracking failures
      }
    },
    [sourcePath],
  );

  const openPurchaseDialog = useCallback(
    (plan: PayableTenantSubscriptionPlan, entryPoint: PurchaseEntryPoint) => {
      pendingPurchaseEntryPointRef.current = entryPoint;
      setPurchasePlan(plan);
      setPurchaseDuration(30);
      setExternalWechatNotice(null);
      setError(null);
      setMessage(null);
    },
    [],
  );

  const copyCurrentPageLinkForWechat = useCallback(async () => {
    const currentUrl = resolveCurrentPageUrlForWechatOpen();
    if (!currentUrl) {
      return;
    }

    const copied = await copyTextWithFallback(currentUrl);
    if (copied) {
      setExternalWechatNotice('链接已复制，回到微信粘贴发送后重新打开即可继续支付。');
      setError(null);
      return;
    }

    setExternalWechatNotice(null);
    setError('复制失败，请手动复制当前页面链接后到微信打开。');
  }, []);

  const closePurchaseDialog = useCallback(
    (reason: string) => {
      const session = purchaseDialogSessionRef.current;
      if (purchasePlan && !paying && session && !session.payClicked) {
        void trackSubscriptionBehavior({
          event: 'PAY_HESITATE',
          plan: purchasePlan,
          durationDays: purchaseDuration,
          entryPoint: session.entryPoint,
          stayDurationMs: Math.max(0, Date.now() - session.openedAt),
          reason,
        });
      }

      purchaseDialogSessionRef.current = null;
      setPurchasePlan(null);
    },
    [paying, purchaseDuration, purchasePlan, trackSubscriptionBehavior],
  );

  const refreshSubscription = useCallback(async () => {
    if (!tenantSlug) {
      return null;
    }

    await switchTenantBySlug(tenantSlug);
    const response = await apiRequest('/me/subscription', {
      responseSchema: meSubscriptionResponseSchema,
    });
    setSubscription(response.subscription);
    return response.subscription;
  }, [tenantSlug]);

  useEffect(() => {
    setIsWechat(isWechatBrowser());
  }, []);

  useEffect(() => {
    if (!externalWechatNotice || typeof window === 'undefined') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setExternalWechatNotice(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [externalWechatNotice]);

  useEffect(() => {
    if (!purchasePlan) {
      purchaseDialogSessionRef.current = null;
      return;
    }

    if (purchaseDialogSessionRef.current) {
      return;
    }

    const session: PurchaseDialogSession = {
      openedAt: Date.now(),
      entryPoint: pendingPurchaseEntryPointRef.current,
      payClicked: false,
    };
    purchaseDialogSessionRef.current = session;

    void trackSubscriptionBehavior({
      event: 'DIALOG_OPEN',
      plan: purchasePlan,
      durationDays: purchaseDuration,
      entryPoint: session.entryPoint,
      stayDurationMs: 0,
    });
  }, [purchaseDuration, purchasePlan, trackSubscriptionBehavior]);

  useEffect(() => {
    if (!tenantSlug) {
      setLoading(false);
      setError('缺少 tenantSlug。');
      return;
    }

    if (!getAccessToken()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        const response = await apiRequest('/me/subscription', {
          responseSchema: meSubscriptionResponseSchema,
        });

        if (cancelled) {
          return;
        }

        setSubscription(response.subscription);
      } catch (requestError) {
        if (!cancelled) {
          setError(formatError(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const redirectToWechatAuthorize = useCallback(
    async (intent: PurchaseIntent) => {
      persistPendingPurchaseIntent(intent);
      await switchTenantBySlug(tenantSlug);
      const response = await apiRequest('/auth/wechat/authorize-url', {
        method: 'POST',
        body: {
          returnPath,
        },
        requestSchema: createWechatAuthorizeUrlRequestSchema,
        responseSchema: createWechatAuthorizeUrlResponseSchema,
      });

      window.location.assign(response.authorizeUrl);
    },
    [returnPath, tenantSlug],
  );

  const pollOrderStatus = useCallback(
    async (orderNo: string) => {
      const startedAt = Date.now();

      while (Date.now() - startedAt <= ORDER_POLL_TIMEOUT_MS) {
        const response = await apiRequest(`/subscriptions/orders/${encodeURIComponent(orderNo)}`, {
          responseSchema: cancelSubscriptionOrderResponseSchema,
        });
        const order = response.order;

        if (order.status === 'PAID') {
          clearPendingPurchaseIntent();
          await refreshSubscription().catch(() => null);
          setMessage(buildPaidOrderMessage(order));
          purchaseDialogSessionRef.current = null;
          setPurchasePlan(null);
          setLastOrderNo(order.orderNo);
          return order;
        }

        if (order.status === 'CANCELLED') {
          throw new Error('订单已取消，请重新发起支付。');
        }

        if (order.status === 'EXPIRED') {
          throw new Error('订单已过期，请重新发起支付。');
        }

        if (order.status === 'REFUNDED') {
          throw new Error('订单已退款，请联系管理员确认订阅状态。');
        }

        await sleep(ORDER_POLL_INTERVAL_MS);
      }

      setMessage('支付结果确认中，请稍后刷新页面查看最新订阅状态。');
      return null;
    },
    [refreshSubscription],
  );

  const startWechatPayment = useCallback(
    async (intent: PurchaseIntent) => {
      if (!tenantSlug) {
        return;
      }

      if (isWechat !== true) {
        setError(
          '微信支付仅支持微信内 JSAPI。请先复制当前页面链接，回到微信打开后再继续；激活码入口仍可继续使用。',
        );
        return;
      }

      const session = purchaseDialogSessionRef.current;
      if (session) {
        session.payClicked = true;
        void trackSubscriptionBehavior({
          event: 'PAY_CLICK',
          plan: intent.plan,
          durationDays: intent.durationDays,
          entryPoint: session.entryPoint,
          stayDurationMs: Math.max(0, Date.now() - session.openedAt),
        });
      }

      let createdOrderNo: string | undefined;

      persistPendingPurchaseIntent(intent);
      setPaying(true);
      setError(null);
      setMessage(null);
      setLastOrderNo(null);

      try {
        await switchTenantBySlug(tenantSlug);

        const created = await apiRequest('/subscriptions/orders', {
          method: 'POST',
          body: {
            plan: intent.plan,
            durationDays: intent.durationDays,
            paymentChannel: 'JSAPI',
          },
          requestSchema: createSubscriptionOrderRequestSchema,
          responseSchema: createSubscriptionOrderResponseSchema,
        });

        createdOrderNo = created.order.orderNo;
        setLastOrderNo(created.order.orderNo);
        const bridge = await waitForWeixinJsBridge();
        const invokeResult = await invokeWechatPay(created.jsapiParams, bridge);
        const normalizedResult = (invokeResult.err_msg ?? '').toLowerCase();

        if (normalizedResult.endsWith(':ok')) {
          setMessage('支付已提交，正在确认订单状态…');
          await pollOrderStatus(created.order.orderNo);
          return;
        }

        if (normalizedResult.endsWith(':cancel')) {
          void trackSubscriptionBehavior({
            event: 'PAY_CANCEL',
            plan: intent.plan,
            durationDays: intent.durationDays,
            orderNo: created.order.orderNo,
            entryPoint: session?.entryPoint,
            stayDurationMs: session ? Math.max(0, Date.now() - session.openedAt) : undefined,
            reason: 'wechat_bridge_cancel',
            result: invokeResult.err_msg,
          });
          purchaseDialogSessionRef.current = null;
          setPurchasePlan(null);
          setMessage('你已取消支付，本次订单已停止。');
          await cancelOrderBestEffort(created.order.orderNo);
          return;
        }

        void trackSubscriptionBehavior({
          event: 'PAY_FAILURE',
          plan: intent.plan,
          durationDays: intent.durationDays,
          orderNo: created.order.orderNo,
          entryPoint: session?.entryPoint,
          stayDurationMs: session ? Math.max(0, Date.now() - session.openedAt) : undefined,
          reason: 'wechat_bridge_failure',
          result: invokeResult.err_msg,
        });
        setError(
          normalizedResult
            ? `微信支付未完成：${invokeResult.err_msg}`
            : '微信支付未完成，请稍后重试。',
        );
      } catch (requestError) {
        if (
          requestError instanceof ApiError &&
          requestError.errorCode === 'WECHAT_OAUTH_REQUIRED'
        ) {
          try {
            setMessage('正在跳转微信授权，完成后会自动回到当前订阅页继续支付。');
            await redirectToWechatAuthorize(intent);
            return;
          } catch (oauthError) {
            void trackSubscriptionBehavior({
              event: 'PAY_FAILURE',
              plan: intent.plan,
              durationDays: intent.durationDays,
              orderNo: createdOrderNo,
              entryPoint: session?.entryPoint,
              stayDurationMs: session ? Math.max(0, Date.now() - session.openedAt) : undefined,
              reason: 'wechat_oauth_redirect_failed',
              result: formatError(oauthError).slice(0, 255),
            });
            setError(formatError(oauthError));
            return;
          }
        }

        void trackSubscriptionBehavior({
          event: 'PAY_FAILURE',
          plan: intent.plan,
          durationDays: intent.durationDays,
          orderNo: createdOrderNo,
          entryPoint: session?.entryPoint,
          stayDurationMs: session ? Math.max(0, Date.now() - session.openedAt) : undefined,
          reason:
            requestError instanceof ApiError
              ? (requestError.errorCode ?? 'payment_request_failed')
              : 'payment_request_failed',
          result: formatError(requestError).slice(0, 255),
        });
        setError(formatError(requestError));
      } finally {
        setPaying(false);
      }
    },
    [isWechat, pollOrderStatus, redirectToWechatAuthorize, tenantSlug, trackSubscriptionBehavior],
  );

  useEffect(() => {
    if (loading) {
      return;
    }

    if (embedded) {
      if (quickPurchase === 'wechat' || focusTarget === 'plans') {
        setEmbeddedPlansOpen(true);
      }

      if (focusTarget === 'activation') {
        setEmbeddedActivationOpen(true);
      }

      return;
    }

    if (quickPurchase === 'wechat') {
      if (isWechat === null) {
        return;
      }

      const key = `${focusTarget ?? ''}:${quickPurchase}:${String(isWechat)}:${recommendedPlan}`;
      if (quickActionHandledRef.current === key) {
        return;
      }

      quickActionHandledRef.current = key;
      plansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (isWechat === true) {
        openPurchaseDialog(recommendedPlan, 'recommendation');
      }
      return;
    }

    if (focusTarget === 'activation' || focusTarget === 'plans') {
      const key = `${focusTarget}:${quickPurchase ?? ''}`;
      if (quickActionHandledRef.current === key) {
        return;
      }

      quickActionHandledRef.current = key;
      const target = focusTarget === 'activation' ? activationSectionRef.current : plansSectionRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [embedded, focusTarget, isWechat, loading, openPurchaseDialog, quickPurchase, recommendedPlan]);

  useEffect(() => {
    if (!wechatAuthStatus || loading || oauthResumeHandledRef.current || isWechat === null) {
      return;
    }

    oauthResumeHandledRef.current = true;
    clearWechatAuthQuery();

    if (wechatAuthStatus !== 'success') {
      clearPendingPurchaseIntent();
      setError(resolveWechatAuthMessage(wechatAuthStatus));
      return;
    }

    const pendingIntent = loadPendingPurchaseIntent();
    if (!pendingIntent) {
      setMessage('微信授权已完成，你可以继续选择套餐并发起支付。');
      return;
    }

    pendingPurchaseEntryPointRef.current = 'oauth_resume';
    setPurchasePlan(pendingIntent.plan);
    setPurchaseDuration(pendingIntent.durationDays);
    setMessage('微信授权已完成，正在恢复支付流程…');
    void startWechatPayment(pendingIntent);
  }, [isWechat, loading, startWechatPayment, wechatAuthStatus]);

  async function handleRedeemActivationCode() {
    if (!tenantSlug) {
      return;
    }

    const code = activationCode.trim();
    if (!code) {
      setError('请输入激活码。');
      return;
    }

    setRedeeming(true);
    setError(null);
    setMessage(null);

    try {
      await switchTenantBySlug(tenantSlug);
      const response = await apiRequest('/subscriptions/activation-codes/redeem', {
        method: 'POST',
        body: { code },
        requestSchema: redeemTenantSubscriptionActivationCodeRequestSchema,
        responseSchema: redeemTenantSubscriptionActivationCodeResponseSchema,
      });

      setSubscription(response.subscription);
      setActivationCode('');
      purchaseDialogSessionRef.current = null;
      setPurchasePlan(null);
      clearPendingPurchaseIntent();
      setMessage(`套餐已更新为${formatPlanLabel(response.subscription.plan)}。`);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setRedeeming(false);
    }
  }

  const paymentPreviewPrice = purchasePlan
    ? SUBSCRIPTION_PRICE_BOOK[purchasePlan][purchaseDuration]
    : 0;

  return (
    <div
      className={embedded ? 'flex w-full flex-col gap-4' : 'mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6'}
    >
      {!embedded ? (
        <section className="grid gap-4">
        <Card className="rounded-3xl border-neutral-200 bg-white/95 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={subscription?.status === 'ACTIVE' ? 'success' : 'warning'}>
                {formatStatusLabel(subscription?.status)}
              </Badge>
              <Badge variant="accent">当前套餐</Badge>
              <Badge variant={wechatEnvironment.badgeVariant}>{wechatEnvironment.badgeLabel}</Badge>
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900">
                {currentMeta.name}
              </CardTitle>
              <CardDescription className="mt-2 text-sm text-neutral-600">
                {currentMeta.summary}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:hidden">
            <div className="flex flex-wrap gap-2 text-xs text-neutral-700">
              {currentMeta.perks.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="产品容量"
                value={`${SUBSCRIPTION_PLAN_PRODUCT_LIMITS[currentPlan]} 只`}
              />
              <MetricCard label="图片额度" value={toDisplayValue(subscription?.maxImages)} />
              <MetricCard label="分享额度" value={toDisplayValue(subscription?.maxShares)} />
              <MetricCard label="存储额度" value={toDisplayBytes(subscription?.maxStorageBytes)} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
              <span>到期时间：{formatSubscriptionDate(subscription?.expiresAt ?? null)}</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setPlanDetail(currentPlan)}
              >
                查看详情
              </Button>
            </div>
          </CardContent>
          <CardContent className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="产品容量"
              value={`${SUBSCRIPTION_PLAN_PRODUCT_LIMITS[currentPlan]} 只`}
            />
            <MetricCard label="图片额度" value={toDisplayValue(subscription?.maxImages)} />
            <MetricCard label="分享额度" value={toDisplayValue(subscription?.maxShares)} />
            <MetricCard label="存储额度" value={toDisplayBytes(subscription?.maxStorageBytes)} />
            <MetricCard
              label="生效时间"
              value={formatSubscriptionDate(subscription?.startsAt ?? null)}
            />
            <MetricCard
              label="到期时间"
              value={formatSubscriptionDate(subscription?.expiresAt ?? null)}
            />
            <MetricCard label="当前状态" value={formatStatusLabel(subscription?.status)} />
            <MetricCard label="最近订单" value={lastOrderNo ?? '暂无'} />
          </CardContent>
        </Card>
      </section>
      ) : null}

      {embedded ? (
        <>
          <section ref={plansSectionRef} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {PLAN_DISPLAY_ORDER.map((plan) => {
                    const selected = selectedEmbeddedPlan === plan;
                    return (
                      <button
                        key={`${plan}-switch`}
                        type="button"
                        className={cn(
                          'shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all',
                          selected
                            ? 'border-[#E6A11C] bg-[linear-gradient(180deg,#FFE072,#FFD400)] text-neutral-900 shadow-[0_8px_18px_rgba(255,212,0,0.20)]'
                            : 'border-[#F0D58A] bg-[#FFF9E8] text-neutral-700 hover:border-[#E6A11C] hover:text-neutral-900',
                        )}
                        onClick={() => handleSelectEmbeddedPlan(plan)}
                      >
                        {`${PLAN_META[plan].name}`}
                      </button>
                    );
                  })}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label="查看上一个套餐"
                    className="flex size-9 items-center justify-center rounded-full border border-[#F0D58A] bg-[#FFF9E8] text-neutral-700 transition hover:border-[#E6A11C] hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={selectedEmbeddedPlanIndex === 0}
                    onClick={() => handleStepEmbeddedPlan('prev')}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="查看下一个套餐"
                    className="flex size-9 items-center justify-center rounded-full border border-[#F0D58A] bg-[#FFF9E8] text-neutral-700 transition hover:border-[#E6A11C] hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={selectedEmbeddedPlanIndex === PLAN_DISPLAY_ORDER.length - 1}
                    onClick={() => handleStepEmbeddedPlan('next')}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#FFF8E2] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#FFF8E2] to-transparent" />
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {PLAN_DISPLAY_ORDER.map((plan) => {
                    const selected = selectedEmbeddedPlan === plan;
                    const meta = PLAN_META[plan];
                    const isCurrent = currentPlan === plan;
                    const isRecommended = plan === recommendedPlan;
                    const monthlyPrice = plan === 'FREE' ? 0 : SUBSCRIPTION_PRICE_BOOK[plan][30];
                    const badgeLabel = isCurrent ? '当前' : isRecommended ? '推荐' : meta.badge;
                    const badgeVariant = isCurrent ? 'success' : isRecommended ? 'accent' : 'default';

                    return (
                      <button
                        key={plan}
                        type="button"
                        ref={(node) => {
                          embeddedPlanCardRefs.current[plan] = node;
                        }}
                        className={selected
                          ? 'subscription-plan-card relative min-h-[360px] w-[74vw] max-w-[320px] shrink-0 snap-center overflow-hidden rounded-[28px] border border-[#E6A11C] bg-[linear-gradient(180deg,rgba(255,246,214,0.98),rgba(255,255,255,0.99))] p-4 text-left shadow-[0_18px_38px_rgba(255,212,0,0.16),inset_0_1px_0_rgba(255,255,255,0.7)] transition-all'
                          : 'subscription-plan-card relative min-h-[340px] w-[68vw] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-[26px] border border-[#F3E4B2] bg-[linear-gradient(180deg,rgba(255,252,241,0.98),rgba(255,255,255,0.98))] p-4 text-left opacity-100 shadow-[0_8px_22px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.7)] transition-all'}
                        onClick={() => handleSelectEmbeddedPlan(plan)}
                      >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(255,212,0,0.18),transparent_58%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.7),transparent_52%)]" />
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-bold text-neutral-900">{`${meta.name}会员`}</p>
                              <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                            </div>
                            <p className="text-sm text-neutral-600">
                              {plan === 'FREE' ? '永久免费体验' : `${formatCurrency(monthlyPrice)} / 30 天`}
                            </p>
                          </div>
                        </div>

                        <div className="relative mt-4 grid grid-cols-2 gap-2">
                          <MetricCard label="产品" value={`${SUBSCRIPTION_PLAN_PRODUCT_LIMITS[plan]} 只`} />
                          <MetricCard label="图片" value={resolveEmbeddedQuotaValue(plan, currentPlan, toDisplayValue(subscription?.maxImages))} />
                          <MetricCard label="分享" value={resolveEmbeddedQuotaValue(plan, currentPlan, toDisplayValue(subscription?.maxShares))} />
                          <MetricCard label="存储" value={resolveEmbeddedQuotaValue(plan, currentPlan, toDisplayBytes(subscription?.maxStorageBytes))} />
                        </div>

                        <p className="mt-4 line-clamp-2 text-sm leading-6 text-neutral-500">
                          {meta.perks.join(' · ')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
          </section>

          {embeddedActivationOpen ? (
            <section ref={activationSectionRef}>
              <Card className="rounded-[24px] border-neutral-200 bg-white/94 shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="subscription-activation-code">激活码</Label>
                    <Input
                      id="subscription-activation-code"
                      type="text"
                      value={activationCode}
                      placeholder="例如 ETM-ABCD-1234-EFGH"
                      onChange={(event) => setActivationCode(event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={redeeming}
                    onClick={() => void handleRedeemActivationCode()}
                  >
                    {redeeming ? '兑换中…' : '兑换并升级'}
                  </Button>
                </CardContent>
              </Card>
            </section>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full rounded-2xl border border-neutral-700 bg-neutral-900 text-base font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.18)] hover:bg-neutral-800"
            onClick={() => {
              setEmbeddedActivationOpen((current) => !current);
              requestAnimationFrame(() => {
                activationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              });
            }}
          >
            激活码
          </Button>

          {selectedEmbeddedPlan !== 'FREE' ? (
            <Button
              type="button"
              variant="primary"
              className="h-12 w-full rounded-2xl text-base font-semibold"
              disabled={paying || isWechat === null}
              onClick={() => {
                const payablePlan = selectedEmbeddedPlan as Exclude<PlanTier, 'FREE'>;
                if (isWechat === false) {
                  setWechatQrOpen(true);
                  return;
                }
                openPurchaseDialog(payablePlan, 'catalog');
              }}
            >
              {isWechat === null
                ? '检测支付环境中…'
                : buildPurchaseButtonLabel(currentPlan, selectedEmbeddedPlan as Exclude<PlanTier, 'FREE'>)}
            </Button>
          ) : null}
        </>
      ) : null}

      {wechatQrOpen ? (
        <WechatQrModal onClose={() => setWechatQrOpen(false)} />
      ) : null}

      {planDetail ? (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={planDetailTitleId}
          onClick={() => setPlanDetail(null)}
        >
          <section
            className="w-full max-w-xl rounded-t-[28px] border border-neutral-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl sm:rounded-[28px] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  套餐详情
                </p>
                <p id={planDetailTitleId} className="text-xl font-black text-neutral-900">
                  {planDetailMeta?.name}
                </p>
                <p className="text-sm text-neutral-600">{planDetailMeta?.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {planDetailIsCurrent ? <Badge variant="success">当前套餐</Badge> : null}
                  {planDetail === recommendedPlan ? <Badge variant="accent">推荐</Badge> : null}
                </div>
              </div>
              <button
                type="button"
                className={modalCloseButtonClass}
                aria-label="关闭"
                onClick={() => setPlanDetail(null)}
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                产品容量：
                <span className="font-semibold text-neutral-900">
                  {SUBSCRIPTION_PLAN_PRODUCT_LIMITS[planDetail ?? currentPlan]} 只
                </span>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700">
                {planDetailMeta?.perks.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#FFD400]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {planDetailIsCurrent ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <MetricCard label="图片额度" value={toDisplayValue(subscription?.maxImages)} />
                <MetricCard label="分享额度" value={toDisplayValue(subscription?.maxShares)} />
                <MetricCard
                  label="存储额度"
                  value={toDisplayBytes(subscription?.maxStorageBytes)}
                />
                <MetricCard
                  label="到期时间"
                  value={formatSubscriptionDate(subscription?.expiresAt ?? null)}
                />
              </div>
            ) : null}

            {payableDetailPlan ? (
              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  价目表
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-neutral-700">
                  {DURATION_OPTIONS.map((days) => (
                    <div
                      key={days}
                      className="rounded-2xl bg-white px-3 py-2 text-center ring-1 ring-neutral-200"
                    >
                      <p className="font-semibold text-neutral-900">{days} 天</p>
                      <p>{formatCurrency(SUBSCRIPTION_PRICE_BOOK[payableDetailPlan][days])}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-neutral-500">价格为参考展示，最终以支付页为准。</p>
              </div>
            ) : null}

            {payableDetailPlan ? (
              <div className="mt-5 rounded-2xl border border-[#FFD400]/40 bg-[#FFFBE6] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  30 天参考价
                </p>
                <p className="mt-2 text-2xl font-black text-neutral-900">
                  {formatCurrency(planDetailMonthlyPrice)}
                </p>
              </div>
            ) : null}

            {payableDetailPlan && isWechat === false ? (
              <div className="mt-4">
                <ExternalWechatHint
                  notice={externalWechatNotice}
                  onCopyLink={() => void copyCurrentPageLinkForWechat()}
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setPlanDetail(null)}>
                关闭
              </Button>
              {payableDetailPlan ? (
                <Button
                  type="button"
                  variant={payableDetailPlan === 'PRO' ? 'primary' : 'default'}
                  disabled={paying || isWechat === null}
                  onClick={() => {
                    if (!payableDetailPlan) {
                      return;
                    }

                    if (isWechat === false) {
                      void copyCurrentPageLinkForWechat();
                      return;
                    }

                    setPlanDetail(null);
                    openPurchaseDialog(payableDetailPlan, 'plan_detail');
                  }}
                >
                  {buildWechatActionLabel(
                    isWechat,
                    buildPurchaseButtonLabel(currentPlan, payableDetailPlan),
                  )}
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {purchasePlan ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={purchaseDialogTitleId}
          onClick={() => {
            if (!paying) {
              closePurchaseDialog('mask_close');
            }
          }}
        >
          <section
            className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.26)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id={purchaseDialogTitleId} className="text-xl font-black text-neutral-900">
                  微信支付购买 {formatPlanLabel(purchasePlan)}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {buildFulfillmentHint(currentPlan, purchasePlan, subscription)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={paying}
                onClick={() => closePurchaseDialog('dialog_close_button')}
              >
                关闭
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold text-neutral-900">选择购买时长</p>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={buildInteractivePillClass(purchaseDuration === days)}
                    disabled={paying}
                    onClick={() => setPurchaseDuration(days)}
                  >
                    {days} 天 · {formatCurrency(SUBSCRIPTION_PRICE_BOOK[purchasePlan][days])}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#FFD400]/40 bg-[#FFFBE6] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                支付预览
              </p>
              <p className="mt-2 text-3xl font-black text-neutral-900">
                {formatCurrency(paymentPreviewPrice)}
              </p>
              <p className="mt-1 text-sm text-neutral-700">
                {purchaseDuration} 天 · {formatPlanLabel(purchasePlan)} · 微信 JSAPI
              </p>
            </div>

            {isWechat === false ? (
              <div className="mt-4">
                <ExternalWechatHint
                  notice={externalWechatNotice}
                  onCopyLink={() => void copyCurrentPageLinkForWechat()}
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={paying}
                onClick={() => closePurchaseDialog('dialog_cancel_button')}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={paying || isWechat === null}
                onClick={() => {
                  if (isWechat === false) {
                    void copyCurrentPageLinkForWechat();
                    return;
                  }

                  void startWechatPayment({ plan: purchasePlan, durationDays: purchaseDuration });
                }}
              >
                {paying ? '处理中…' : buildWechatActionLabel(isWechat, '立即微信支付')}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {message ? (
        <Card
          className="rounded-2xl border-emerald-200 bg-emerald-50 p-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-emerald-700">{message}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <Card className="rounded-2xl border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">正在加载订阅信息…</p>
        </Card>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function ExternalWechatHint({
  notice,
  onCopyLink,
}: {
  notice: string | null;
  onCopyLink: () => void;
}) {
  return (
    <div className="public-warm-note rounded-2xl border px-4 py-3 text-sm">
      <p className="public-warm-note-title font-semibold">当前在外部浏览器打开</p>
      <p className="public-warm-note-body mt-1 leading-6">
        微信支付仅支持在微信内完成。先复制当前页面链接，再回到微信聊天里粘贴打开，就能继续支付。
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="border-amber-300 bg-white/92 text-neutral-900 hover:bg-white dark:border-white/12 dark:bg-white/[0.06] dark:text-neutral-100 dark:hover:bg-white/[0.1]"
          onClick={onCopyLink}
        >
          复制链接，回微信打开
        </Button>
        <p className="public-warm-note-body text-xs">也可以先发给自己，再从微信里重新点开。</p>
      </div>
      {notice ? (
        <p className="mt-2 text-xs font-medium text-emerald-700" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function normalizePlan(plan: TenantSubscription['plan'] | null | undefined): PlanTier {
  if (plan === 'BASIC') {
    return 'BASIC';
  }

  if (plan === 'PRO') {
    return 'PRO';
  }

  return 'FREE';
}

function formatPlanLabel(plan: PlanTier | null | undefined) {
  if (plan === 'BASIC') {
    return '基础版';
  }

  if (plan === 'PRO') {
    return '专业版';
  }

  return '免费版';
}

function formatStatusLabel(status: TenantSubscription['status'] | null | undefined) {
  if (status === 'ACTIVE') {
    return '生效中';
  }

  if (status === 'EXPIRED') {
    return '已过期';
  }

  if (status === 'DISABLED') {
    return '已禁用';
  }

  return '未配置';
}

function resolveRecommendedPlan(currentPlan: PlanTier): PayableTenantSubscriptionPlan {
  if (currentPlan === 'PRO') {
    return 'PRO';
  }

  if (currentPlan === 'BASIC') {
    return 'PRO';
  }

  return 'BASIC';
}

function buildPurchaseButtonLabel(
  currentPlan: PlanTier,
  targetPlan: PayableTenantSubscriptionPlan,
) {
  if (currentPlan === 'FREE') {
    return `购买${formatPlanLabel(targetPlan)}`;
  }

  if (currentPlan === targetPlan) {
    return `续费${formatPlanLabel(targetPlan)}`;
  }

  if (currentPlan === 'PRO' && targetPlan === 'BASIC') {
    return '预约降级到基础版';
  }

  return `升级到${formatPlanLabel(targetPlan)}`;
}

function buildWechatActionLabel(isWechat: boolean | null, enabledLabel: string) {
  if (isWechat === true) {
    return enabledLabel;
  }

  if (isWechat === false) {
    return '复制链接，回微信打开';
  }

  return '检测支付环境中…';
}

function buildFulfillmentHint(
  currentPlan: PlanTier,
  targetPlan: PayableTenantSubscriptionPlan,
  subscription: TenantSubscription | null,
) {
  if (currentPlan === 'FREE') {
    return `支付成功后将立即开通${formatPlanLabel(targetPlan)}。`;
  }

  if (currentPlan === targetPlan) {
    return `支付成功后将从当前到期时间起顺延 ${formatPlanLabel(targetPlan)} 时长。`;
  }

  if (currentPlan === 'BASIC' && targetPlan === 'PRO') {
    return '支付成功后将立即升级为专业版，并从当前有效期终点继续顺延购买时长。';
  }

  if (currentPlan === 'PRO' && targetPlan === 'BASIC') {
    const expiresAt = subscription?.expiresAt
      ? formatSubscriptionDate(subscription.expiresAt)
      : '当前 PRO 到期时';
    return `该订单为延后生效降级，支付成功后会在 ${expiresAt} 自动切换为基础版。`;
  }

  return '支付成功后系统会自动应用订阅权益。';
}

function buildPaidOrderMessage(order: SubscriptionOrder) {
  if (order.fulfillmentMode === 'DEFERRED') {
    return `支付成功，${formatPlanLabel(order.plan)} 已购买成功，将在当前专业版到期后自动生效。`;
  }

  return `支付成功，${formatPlanLabel(order.plan)} 已开通或续费成功。`;
}

function formatSubscriptionDate(value: string | null) {
  if (!value) {
    return '长期有效';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN')}`;
}

function toDisplayValue(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '不限';
  }

  return `${value}`;
}

function toDisplayBytes(value: string | null | undefined) {
  if (!value) {
    return '不限';
  }

  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return value;
  }

  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

function resolveEmbeddedQuotaValue(
  plan: PlanTier,
  currentPlan: PlanTier,
  currentValue: string,
) {
  if (plan === currentPlan) {
    return currentValue;
  }

  if (plan === 'PRO') {
    return '高配额';
  }

  if (plan === 'BASIC') {
    return '见套餐';
  }

  return '基础';
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}

function resolveWechatAuthMessage(status: string) {
  if (status === 'conflict') {
    return '该微信账号已绑定到其他平台账号，请切换微信或联系客服处理。';
  }

  return '微信授权未完成，请重新发起支付。';
}

function isWechatBrowser() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /micromessenger/i.test(navigator.userAgent);
}

function persistPendingPurchaseIntent(intent: PurchaseIntent) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(PENDING_PURCHASE_STORAGE_KEY, JSON.stringify(intent));
}

function loadPendingPurchaseIntent(): PurchaseIntent | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(PENDING_PURCHASE_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PurchaseIntent> | null;
    if (!parsed || (parsed.plan !== 'BASIC' && parsed.plan !== 'PRO')) {
      return null;
    }

    if (parsed.durationDays !== 30 && parsed.durationDays !== 90 && parsed.durationDays !== 365) {
      return null;
    }

    return {
      plan: parsed.plan,
      durationDays: parsed.durationDays,
    };
  } catch {
    return null;
  }
}

function clearPendingPurchaseIntent() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(PENDING_PURCHASE_STORAGE_KEY);
}

function clearWechatAuthQuery() {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has('wechatAuth')) {
    return;
  }

  url.searchParams.delete('wechatAuth');
  const nextQuery = url.searchParams.toString();
  window.history.replaceState(
    {},
    '',
    `${url.pathname}${nextQuery ? `?${nextQuery}` : ''}${url.hash}`,
  );
}

function resolveCurrentPageUrlForWechatOpen() {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('wechatAuth');
  return url.toString();
}

async function waitForWeixinJsBridge() {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持微信支付。');
  }

  if (window.WeixinJSBridge) {
    return window.WeixinJSBridge;
  }

  return new Promise<WeixinJsBridge>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('未检测到 WeixinJSBridge，请确认当前页面运行在微信内。'));
    }, 5000);

    const handleReady = () => {
      if (!window.WeixinJSBridge) {
        return;
      }

      cleanup();
      resolve(window.WeixinJSBridge);
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('WeixinJSBridgeReady', handleReady as EventListener);
    };

    document.addEventListener('WeixinJSBridgeReady', handleReady as EventListener, { once: true });
  });
}

async function invokeWechatPay(params: Record<string, string>, bridge: WeixinJsBridge) {
  return new Promise<WechatPayInvokeResult>((resolve) => {
    bridge.invoke('getBrandWCPayRequest', params, (result) => {
      resolve(result ?? {});
    });
  });
}

async function cancelOrderBestEffort(orderNo: string) {
  try {
    await apiRequest(`/subscriptions/orders/${encodeURIComponent(orderNo)}/cancel`, {
      method: 'POST',
      responseSchema: getSubscriptionOrderResponseSchema,
    });
  } catch {
    // ignore best-effort cancel failure
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function WechatQrModal({ onClose }: { onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const url = resolveCurrentPageUrlForWechatOpen();
    if (!url) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        if (!cancelled && mountedRef.current) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="微信扫码支付"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-[28px] bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-neutral-900">用微信扫码支付</p>
          <button
            type="button"
            aria-label="关闭"
            className="flex size-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center rounded-2xl bg-neutral-50 p-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="微信扫码" className="size-[200px]" />
          ) : (
            <div className="flex size-[200px] items-center justify-center text-sm text-neutral-400">
              生成中…
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-sm leading-5 text-neutral-500">
          打开微信 → 扫一扫，在微信内完成支付
        </p>
      </div>
    </div>
  );
}
