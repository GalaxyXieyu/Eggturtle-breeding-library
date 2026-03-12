'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  type PayableTenantSubscriptionPlan,
  cancelSubscriptionOrderResponseSchema,
  type SubscriptionDurationDays,
  type SubscriptionOrder,
  type TenantSubscription,
} from '@eggturtle/shared';
import { CheckCircle2, Clock3, ShieldCheck, Wallet } from 'lucide-react';

import ReferralPromoCard from '@/components/referral-promo-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildInteractivePillClass } from '@/components/ui/pill';
import { ApiError, apiRequest, getAccessToken } from '@/lib/api-client';
import { switchTenantBySlug } from '@/lib/tenant-session';

type PlanTier = 'FREE' | PayableTenantSubscriptionPlan;

type PurchaseIntent = {
  plan: PayableTenantSubscriptionPlan;
  durationDays: SubscriptionDurationDays;
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

const PLAN_META: Record<PlanTier, { name: string; summary: string; perks: string[]; badge: string }> = {
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

export default function SubscriptionPage() {
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
  const [purchasePlan, setPurchasePlan] = useState<PayableTenantSubscriptionPlan | null>(null);
  const [purchaseDuration, setPurchaseDuration] = useState<SubscriptionDurationDays>(30);
  const [paying, setPaying] = useState(false);
  const [lastOrderNo, setLastOrderNo] = useState<string | null>(null);

  const oauthResumeHandledRef = useRef(false);
  const [isWechat, setIsWechat] = useState<boolean | null>(null);
  const currentPlan = normalizePlan(subscription?.plan);
  const currentMeta = PLAN_META[currentPlan];

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

  const redirectToWechatAuthorize = useCallback(async (intent: PurchaseIntent) => {
    persistPendingPurchaseIntent(intent);
    await switchTenantBySlug(tenantSlug);
    const response = await apiRequest('/auth/wechat/authorize-url', {
      method: 'POST',
      body: {
        returnPath: pathname || `/app/${tenantSlug}/subscription`,
      },
      requestSchema: createWechatAuthorizeUrlRequestSchema,
      responseSchema: createWechatAuthorizeUrlResponseSchema,
    });

    window.location.assign(response.authorizeUrl);
  }, [pathname, tenantSlug]);

  const pollOrderStatus = useCallback(async (orderNo: string) => {
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
  }, [refreshSubscription]);

  const startWechatPayment = useCallback(async (intent: PurchaseIntent) => {
    if (!tenantSlug) {
      return;
    }

    if (isWechat !== true) {
      setError('微信支付一期仅支持微信内 JSAPI，请在微信内打开本页；激活码入口仍可继续使用。');
      return;
    }

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
        setMessage('你已取消支付，本次订单已停止。');
        await cancelOrderBestEffort(created.order.orderNo);
        return;
      }

      setError(normalizedResult ? `微信支付未完成：${invokeResult.err_msg}` : '微信支付未完成，请稍后重试。');
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.errorCode === 'WECHAT_OAUTH_REQUIRED') {
        try {
          setMessage('正在跳转微信授权，完成后会自动回到当前订阅页继续支付。');
          await redirectToWechatAuthorize(intent);
          return;
        } catch (oauthError) {
          setError(formatError(oauthError));
          return;
        }
      }

      setError(formatError(requestError));
    } finally {
      setPaying(false);
    }
  }, [isWechat, pollOrderStatus, redirectToWechatAuthorize, tenantSlug]);

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
      setPurchasePlan(null);
      clearPendingPurchaseIntent();
      setMessage(`套餐已更新为${formatPlanLabel(response.subscription.plan)}。`);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setRedeeming(false);
    }
  }

  const paymentPreviewPrice = purchasePlan ? SUBSCRIPTION_PRICE_BOOK[purchasePlan][purchaseDuration] : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-3xl border-neutral-200 bg-white/95 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={subscription?.status === 'ACTIVE' ? 'success' : 'warning'}>
                {formatStatusLabel(subscription?.status)}
              </Badge>
              <Badge variant="accent">当前套餐</Badge>
              {isWechat === true ? <Badge variant="success">微信内可支付</Badge> : <Badge variant="warning">请在微信内打开</Badge>}
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900">{currentMeta.name}</CardTitle>
              <CardDescription className="mt-2 text-sm text-neutral-600">{currentMeta.summary}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="产品容量" value={`${SUBSCRIPTION_PLAN_PRODUCT_LIMITS[currentPlan]} 只`} />
            <MetricCard label="图片额度" value={toDisplayValue(subscription?.maxImages)} />
            <MetricCard label="分享额度" value={toDisplayValue(subscription?.maxShares)} />
            <MetricCard label="存储额度" value={toDisplayBytes(subscription?.maxStorageBytes)} />
            <MetricCard label="生效时间" value={formatSubscriptionDate(subscription?.startsAt ?? null)} />
            <MetricCard label="到期时间" value={formatSubscriptionDate(subscription?.expiresAt ?? null)} />
            <MetricCard label="当前状态" value={formatStatusLabel(subscription?.status)} />
            <MetricCard label="最近订单" value={lastOrderNo ?? '暂无'} />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-neutral-200 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black text-neutral-900">
              <Wallet className="h-5 w-5 text-[#B8860B]" />
              支付说明
            </CardTitle>
            <CardDescription>
              一期仅支持微信内 JSAPI 支付；非微信环境保留激活码升级入口。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-neutral-700">
            <InfoRow icon={<ShieldCheck className="h-4 w-4" />} text="支付成功后立即或延后履约，具体取决于当前套餐与目标套餐。" />
            <InfoRow icon={<Clock3 className="h-4 w-4" />} text="订单 30 分钟未支付会自动过期；支付成功后会自动轮询确认状态。" />
            <InfoRow icon={<CheckCircle2 className="h-4 w-4" />} text="激活码链路继续保留，可与微信支付并行使用。" />
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              {isWechat === true
                ? '当前检测到微信环境，可以直接发起微信支付。'
                : '当前不是微信环境，微信支付按钮会禁用。请复制链接到微信内打开，或使用激活码升级。'}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {(['FREE', 'BASIC', 'PRO'] as const).map((plan) => {
          const meta = PLAN_META[plan];
          const isCurrent = currentPlan === plan;
          const isPayable = plan !== 'FREE';
          const monthlyPrice = plan === 'FREE' ? 0 : SUBSCRIPTION_PRICE_BOOK[plan][30];

          return (
            <Card
              key={plan}
              className={[
                'rounded-3xl border bg-white shadow-sm transition',
                plan === 'PRO' ? 'border-[#FFD400]/70 shadow-[0_12px_40px_rgba(255,212,0,0.14)]' : 'border-neutral-200',
              ].join(' ')}
            >
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-black text-neutral-900">{meta.name}</CardTitle>
                    <CardDescription className="mt-1 text-sm text-neutral-600">{meta.summary}</CardDescription>
                  </div>
                  <Badge variant={plan === 'PRO' ? 'accent' : isCurrent ? 'success' : 'default'}>{isCurrent ? '当前' : meta.badge}</Badge>
                </div>
                <div>
                  <p className="text-3xl font-black text-neutral-900">{plan === 'FREE' ? '¥0' : formatCurrency(monthlyPrice)}</p>
                  <p className="mt-1 text-sm text-neutral-500">{plan === 'FREE' ? '永久免费体验' : '30 天参考价，支持 30 / 90 / 365 天购买'}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                  产品容量：<span className="font-semibold text-neutral-900">{SUBSCRIPTION_PLAN_PRODUCT_LIMITS[plan]} 只</span>
                </div>
                <ul className="space-y-2 text-sm text-neutral-700">
                  {meta.perks.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#FFD400]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {isPayable ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">价目表</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-neutral-700">
                      {DURATION_OPTIONS.map((days) => (
                        <div key={days} className="rounded-2xl bg-white px-3 py-2 text-center ring-1 ring-neutral-200">
                          <p className="font-semibold text-neutral-900">{days} 天</p>
                          <p>{formatCurrency(SUBSCRIPTION_PRICE_BOOK[plan][days])}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {isPayable ? (
                  <Button
                    type="button"
                    variant={plan === 'PRO' ? 'primary' : 'default'}
                    className="w-full"
                    disabled={paying || isWechat !== true}
                    onClick={() => {
                      setPurchasePlan(plan);
                      setPurchaseDuration(30);
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    {isWechat !== true ? '请在微信内打开' : buildPurchaseButtonLabel(currentPlan, plan)}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="w-full" disabled>
                    当前默认可用
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card className="rounded-3xl border-neutral-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-black text-neutral-900">激活码升级</CardTitle>
            <CardDescription>继续保留原有激活码入口，适合线下发码、运营赠送或补偿升级。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <Button type="button" className="w-full sm:w-auto" disabled={redeeming} onClick={() => void handleRedeemActivationCode()}>
              {redeeming ? '兑换中…' : '兑换并升级'}
            </Button>
          </CardContent>
        </Card>

        <ReferralPromoCard tenantSlug={tenantSlug} />
      </section>

      {purchasePlan ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={() => {
            if (!paying) {
              setPurchasePlan(null);
            }
          }}
        >
          <section
            className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.26)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-black text-neutral-900">微信支付购买 {formatPlanLabel(purchasePlan)}</p>
                <p className="mt-1 text-sm text-neutral-600">{buildFulfillmentHint(currentPlan, purchasePlan, subscription)}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={paying}
                onClick={() => setPurchasePlan(null)}
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">支付预览</p>
              <p className="mt-2 text-3xl font-black text-neutral-900">{formatCurrency(paymentPreviewPrice)}</p>
              <p className="mt-1 text-sm text-neutral-700">{purchaseDuration} 天 · {formatPlanLabel(purchasePlan)} · 微信 JSAPI</p>
            </div>

            {isWechat !== true ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                当前不是微信浏览器，无法调起 JSAPI 支付。请在微信内打开后再继续。
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" disabled={paying} onClick={() => setPurchasePlan(null)}>
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={paying || isWechat !== true}
                onClick={() => void startWechatPayment({ plan: purchasePlan, durationDays: purchaseDuration })}
              >
                {paying ? '处理中…' : '立即微信支付'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {message ? (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-700">{message}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <Card className="rounded-2xl border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600">正在加载订阅信息…</p>
        </Card>
      ) : null}
    </main>
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

function InfoRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="mt-0.5 text-neutral-700">{icon}</span>
      <span>{text}</span>
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

function buildPurchaseButtonLabel(currentPlan: PlanTier, targetPlan: PayableTenantSubscriptionPlan) {
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
    const expiresAt = subscription?.expiresAt ? formatSubscriptionDate(subscription.expiresAt) : '当前 PRO 到期时';
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
  window.history.replaceState({}, '', `${url.pathname}${nextQuery ? `?${nextQuery}` : ''}${url.hash}`);
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
