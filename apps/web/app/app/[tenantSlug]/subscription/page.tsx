'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  meSubscriptionResponseSchema,
  redeemTenantSubscriptionActivationCodeRequestSchema,
  redeemTenantSubscriptionActivationCodeResponseSchema,
  type TenantSubscription
} from '@eggturtle/shared';
import { Wallet } from 'lucide-react';

import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { ApiError, apiRequest, getAccessToken } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';

type PlanTier = 'FREE' | 'BASIC' | 'PRO';

type PlanPackage = {
  tier: PlanTier;
  name: string;
  price: string;
  productLimit: string;
  aiQuota: string;
  perks: string[];
};

const PLAN_LIMITS: Record<PlanTier, number> = {
  FREE: 10,
  BASIC: 30,
  PRO: 200
};

const PLAN_PACKAGES: PlanPackage[] = [
  {
    tier: 'FREE',
    name: '免费版',
    price: '¥0 / 月',
    productLimit: '10 只',
    aiQuota: '自动记录体验额度 10 次/月',
    perks: ['基础档案管理', '交配/产蛋记录', '基础分享能力']
  },
  {
    tier: 'BASIC',
    name: '基础版',
    price: '¥28 / 月',
    productLimit: '30 只',
    aiQuota: '自动记录 + 问数（按月限次）',
    perks: ['完整血统溯源', '图册展示 + 二维码', '小团队稳定运营']
  },
  {
    tier: 'PRO',
    name: '专业版',
    price: '¥49 / 月',
    productLimit: '200 只',
    aiQuota: '更高 AI 月额度 + 支持叠加充值包',
    perks: ['证书能力', '图片水印能力', '品牌化展示与成交支持']
  }
];

export default function SubscriptionPage() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeModalPlan, setUpgradeModalPlan] = useState<PlanPackage | null>(null);

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
          responseSchema: meSubscriptionResponseSchema
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

  const currentPlan = normalizePlan(subscription?.plan);
  const effectiveProductLimit = resolveEffectiveProductLimit(subscription);
  const featuredPlan = useMemo(() => getHighestUpgradePlan(currentPlan), [currentPlan]);
  const featuredPlanDelta = useMemo(() => {
    if (!featuredPlan) {
      return 0;
    }

    return Math.max(PLAN_LIMITS[featuredPlan.tier] - effectiveProductLimit, 0);
  }, [featuredPlan, effectiveProductLimit]);

  useEffect(() => {
    if (!upgradeModalPlan) {
      return;
    }

    function handleEscClose(event: KeyboardEvent) {
      if (event.key === 'Escape' && !redeeming) {
        setUpgradeModalPlan(null);
      }
    }

    window.addEventListener('keydown', handleEscClose);
    return () => {
      window.removeEventListener('keydown', handleEscClose);
    };
  }, [upgradeModalPlan, redeeming]);

  async function handleRedeemActivationCode() {
    if (!activationCode.trim()) {
      setError('请输入升级码。');
      return;
    }

    setRedeeming(true);
    setMessage(null);
    setError(null);

    try {
      const payload = redeemTenantSubscriptionActivationCodeRequestSchema.parse({
        code: activationCode.trim()
      });
      const response = await apiRequest('/subscriptions/activation-codes/redeem', {
        method: 'POST',
        body: payload,
        requestSchema: redeemTenantSubscriptionActivationCodeRequestSchema,
        responseSchema: redeemTenantSubscriptionActivationCodeResponseSchema
      });

      setSubscription(response.subscription);
      setMessage(`套餐已更新为${formatPlanLabel(response.subscription.plan)}。`);
      setActivationCode('');
      setUpgradeModalPlan(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setRedeeming(false);
    }
  }

  function openUpgradeModal(plan: PlanPackage) {
    setActivationCode('');
    setMessage(null);
    setError(null);
    setUpgradeModalPlan(plan);
  }

  function focusUpgradeSection() {
    const target = document.getElementById('quick-upgrade');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      {loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">正在加载套餐信息...</p>
        </Card>
      ) : null}

      {!loading ? (
        <Card
          className={`rounded-2xl border p-4 ${
            currentPlan === 'FREE'
              ? 'border-[#FFD400]/70 bg-gradient-to-b from-[#FFF7D5] via-white to-white'
              : 'border-neutral-200/90 bg-white'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">套餐订阅中心</Badge>
                <Badge variant={subscription?.status === 'ACTIVE' ? 'success' : 'warning'}>{formatStatusLabel(subscription?.status)}</Badge>
                {currentPlan === 'FREE' ? <Badge variant="warning">建议升级</Badge> : null}
              </div>
              <p className="mt-2 text-2xl font-black text-neutral-900">{formatPlanLabel(currentPlan)}</p>
              <p className="mt-1 text-sm text-neutral-700">{buildPlanUrgencyCopy(currentPlan, effectiveProductLimit)}</p>
            </div>
            <div className="w-full rounded-2xl border border-neutral-900/10 bg-neutral-900 p-2.5 text-white sm:w-auto sm:min-w-[220px]">
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-[#FFD400] text-sm font-semibold text-neutral-900 shadow-[0_10px_22px_rgba(0,0,0,0.34)] hover:bg-[#f0c800]"
                onClick={focusUpgradeSection}
              >
                立刻升级
              </Button>
              <p className="mt-2 text-center text-xs text-neutral-200/90">点击后直达立即升级区，输入激活码即可生效</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-white/90 px-3 py-2">
              <p className="text-[11px] text-neutral-500">可管理种龟</p>
              <p className="mt-1 text-lg font-black text-neutral-900">{effectiveProductLimit}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white/90 px-3 py-2">
              <p className="text-[11px] text-neutral-500">图片上限</p>
              <p className="mt-1 text-lg font-black text-neutral-900">{toDisplayValue(subscription?.maxImages)}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white/90 px-3 py-2">
              <p className="text-[11px] text-neutral-500">存储上限</p>
              <p className="mt-1 text-lg font-black text-neutral-900">{toDisplayBytes(subscription?.maxStorageBytes)}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white/90 px-3 py-2">
              <p className="text-[11px] text-neutral-500">到期时间</p>
              <p className="mt-1 text-lg font-black text-neutral-900">{formatSubscriptionDate(subscription?.expiresAt ?? null)}</p>
            </div>
          </div>

          {featuredPlan ? (
            <div className="mt-3 rounded-2xl border border-neutral-900/10 bg-neutral-900 px-3 py-3 text-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#FFD400]">高阶福利预览</p>
                  <p className="mt-1 text-sm font-semibold">
                    {featuredPlan.name} · {featuredPlan.price}
                  </p>
                  <p className="mt-1 text-xs text-neutral-200">
                    {featuredPlanDelta > 0 ? `种龟管理容量最高可提升 +${featuredPlanDelta}` : '解锁更多高级能力'}
                    ，并开启{featuredPlan.perks[0]}。
                  </p>
                </div>
                <p className="shrink-0 rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white">
                  默认展示最高档
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">
              当前已是专业版，建议继续用证书与水印能力放大品牌成交效率。
            </div>
          )}
        </Card>
      ) : null}

      {!loading ? (
        <Card id="quick-upgrade" className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Wallet size={18} />
              立即升级
            </CardTitle>
            <CardDescription>已移除多卡片升级区，统一在这里一步完成升级。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {featuredPlan ? (
              <section className="relative overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-900 p-4 text-white">
                <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-[#FFD400]/30 blur-2xl" />
                <div className="relative z-10">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#FFD400]">推荐路径</p>
                  <p className="mt-1 text-xl font-black">
                    升级到{featuredPlan.name} · {featuredPlan.price}
                  </p>
                  <p className="mt-1 text-sm text-neutral-200">输入激活码后立即生效，套餐状态自动刷新。</p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                      <p className="text-[11px] text-neutral-200">种龟容量</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {effectiveProductLimit} → {PLAN_LIMITS[featuredPlan.tier]}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                      <p className="text-[11px] text-neutral-200">AI 额度</p>
                      <p className="mt-1 text-xs font-semibold text-white">{featuredPlan.aiQuota}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    {featuredPlan.perks.slice(0, 3).map((perk) => (
                      <p key={`quick-upgrade-perk-${perk}`} className="text-sm text-neutral-100">
                        • {perk}
                      </p>
                    ))}
                  </div>

                  <Button
                    type="button"
                    className="mt-4 h-11 w-full rounded-xl bg-[#FFD400] text-sm font-semibold text-neutral-900 shadow-[0_10px_22px_rgba(0,0,0,0.34)] hover:bg-[#f0c800]"
                    onClick={() => openUpgradeModal(featuredPlan)}
                  >
                    立即升级到{featuredPlan.name}
                  </Button>
                </div>
              </section>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                当前已是专业版，无需升级。可继续通过证书与水印能力提升品牌成交效率。
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!loading && upgradeModalPlan ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onClick={() => {
            if (!redeeming) {
              setUpgradeModalPlan(null);
            }
          }}
        >
          <section
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_22px_60px_rgba(15,23,42,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-neutral-900">输入激活码升级套餐</p>
                <p className="mt-1 text-sm text-neutral-600">
                  目标版本：{upgradeModalPlan.name}（后续这里可切换为支付弹窗）
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-8 rounded-lg px-2 text-xs"
                disabled={redeeming}
                onClick={() => {
                  setUpgradeModalPlan(null);
                }}
              >
                关闭
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="subscription-activation-code-modal">激活码</Label>
              <Input
                id="subscription-activation-code-modal"
                type="text"
                value={activationCode}
                placeholder="例如 ETM-ABCD-1234-EFGH"
                onChange={(event) => setActivationCode(event.target.value)}
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={redeeming}
                onClick={() => {
                  setUpgradeModalPlan(null);
                }}
              >
                取消
              </Button>
              <Button type="button" disabled={redeeming} onClick={() => void handleRedeemActivationCode()}>
                {redeeming ? '升级中...' : '确认升级'}
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
    </main>
  );
}

function resolveEffectiveProductLimit(subscription: TenantSubscription | null): number {
  if (!subscription) {
    return PLAN_LIMITS.FREE;
  }

  if (subscription.maxShares !== null) {
    return subscription.maxShares;
  }

  return PLAN_LIMITS[normalizePlan(subscription.plan)];
}

function getHighestUpgradePlan(plan: PlanTier): PlanPackage | null {
  if (plan === 'PRO') {
    return null;
  }

  return PLAN_PACKAGES.find((item) => item.tier === 'PRO') ?? null;
}

function buildPlanUrgencyCopy(plan: PlanTier, effectiveProductLimit: number) {
  if (plan === 'FREE') {
    return `免费版最多可管理 ${effectiveProductLimit} 只，达到上限后需升级才能继续扩容。`;
  }

  if (plan === 'BASIC') {
    return `基础版当前可管理 ${effectiveProductLimit} 只，适合稳定运营；增长阶段建议升级专业版。`;
  }

  return `专业版当前可管理 ${effectiveProductLimit} 只，适合高频上新与品牌化经营。`;
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

function formatPlanLabel(plan: TenantSubscription['plan'] | PlanTier | null | undefined) {
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

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
