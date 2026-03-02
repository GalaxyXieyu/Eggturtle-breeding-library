'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  meSubscriptionResponseSchema,
  redeemTenantSubscriptionActivationCodeRequestSchema,
  redeemTenantSubscriptionActivationCodeResponseSchema,
  type TenantSubscription
} from '@eggturtle/shared';
import { ArrowRight, Gift, Sparkles, Wallet } from 'lucide-react';

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

type UpgradeTrack = {
  title: string;
  summary: string;
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
  const [activeMobilePlanIndex, setActiveMobilePlanIndex] = useState(0);
  const mobilePlansRef = useRef<HTMLDivElement | null>(null);

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
      setActivationCode('');
      setMessage(`套餐已更新为${formatPlanLabel(response.subscription.plan)}。`);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setRedeeming(false);
    }
  }

  const currentPlan = normalizePlan(subscription?.plan);
  const effectiveProductLimit = resolveEffectiveProductLimit(subscription);
  const upgradeTracks = buildUpgradeTracks(currentPlan);
  const recommendedTier = useMemo(() => getRecommendedTier(currentPlan), [currentPlan]);
  const recommendedPlan = useMemo(
    () => (recommendedTier ? PLAN_PACKAGES.find((item) => item.tier === recommendedTier) ?? null : null),
    [recommendedTier]
  );
  const currentPlanIndex = useMemo(() => {
    const index = PLAN_PACKAGES.findIndex((item) => item.tier === currentPlan);
    return index >= 0 ? index : 0;
  }, [currentPlan]);
  const recommendedPlanIndex = useMemo(() => {
    if (!recommendedPlan) {
      return -1;
    }

    return PLAN_PACKAGES.findIndex((item) => item.tier === recommendedPlan.tier);
  }, [recommendedPlan]);
  const recommendedPlanDelta = useMemo(() => {
    if (!recommendedPlan) {
      return 0;
    }

    return Math.max(PLAN_LIMITS[recommendedPlan.tier] - effectiveProductLimit, 0);
  }, [recommendedPlan, effectiveProductLimit]);

  useEffect(() => {
    setActiveMobilePlanIndex(currentPlanIndex);
  }, [currentPlanIndex]);

  function focusUpgradeSection() {
    const target = document.getElementById('upgrade-now');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function focusPlanSection(index?: number) {
    const target = document.getElementById('plan-packages');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (typeof index !== 'number' || index < 0) {
      return;
    }

    window.setTimeout(() => {
      scrollToMobilePlan(index);
    }, 220);
  }

  function scrollToMobilePlan(index: number) {
    const container = mobilePlansRef.current;
    if (!container) {
      return;
    }

    const target = container.children.item(index) as HTMLElement | null;
    if (!target) {
      return;
    }

    container.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
    setActiveMobilePlanIndex(index);
  }

  function handleMobilePlanScroll() {
    const container = mobilePlansRef.current;
    if (!container) {
      return;
    }

    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) {
      return;
    }

    let nextIndex = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < children.length; index += 1) {
      const distance = Math.abs(children[index].offsetLeft - container.scrollLeft);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        nextIndex = index;
      }
    }

    if (nextIndex !== activeMobilePlanIndex) {
      setActiveMobilePlanIndex(nextIndex);
    }
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
              <p className="mt-2 text-center text-xs text-neutral-200/90">输入激活码后，套餐立即生效</p>
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

          {recommendedPlan ? (
            <div className="mt-3 rounded-2xl border border-neutral-900/10 bg-neutral-900 px-3 py-3 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#FFD400]">推荐升级</p>
                  <p className="mt-1 text-sm font-semibold">
                    {recommendedPlan.name} · {recommendedPlan.price}
                  </p>
                  <p className="mt-1 text-xs text-neutral-200">
                    {recommendedPlanDelta > 0 ? `种龟管理容量立即 +${recommendedPlanDelta}` : '解锁更多高级能力'}
                    ，并开启{recommendedPlan.perks[0]}。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 shrink-0 rounded-lg border-white/30 bg-white/10 px-2.5 text-xs text-white hover:bg-white/20"
                  onClick={() => focusPlanSection(recommendedPlanIndex)}
                >
                  查看套餐
                  <ArrowRight size={13} />
                </Button>
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
        <Card id="plan-packages" className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Wallet size={18} />
              版本差异与升级收益
            </CardTitle>
            <CardDescription>先看套餐卡片，再选择升级路径；免费版建议优先升到基础版。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3 md:hidden">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {PLAN_PACKAGES.map((item, index) => (
                  <button
                    key={`mobile-plan-tab-${item.tier}`}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                      activeMobilePlanIndex === index
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                    onClick={() => scrollToMobilePlan(index)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <div
                ref={mobilePlansRef}
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onScroll={handleMobilePlanScroll}
              >
                {PLAN_PACKAGES.map((item, index) => {
                  const isCurrent = item.tier === currentPlan;
                  const isRecommended = recommendedTier === item.tier;
                  return (
                    <section
                      key={`mobile-${item.tier}`}
                      className={`relative min-w-[86%] snap-center overflow-hidden rounded-2xl border p-4 shadow-[0_8px_20px_rgba(15,23,42,0.08)] ${
                        isCurrent
                          ? 'border-[#FFD400]/70 bg-gradient-to-b from-[#FFF6CF] to-white'
                          : isRecommended
                            ? 'border-neutral-900 bg-gradient-to-b from-neutral-50 to-white'
                            : 'border-neutral-200 bg-white'
                      }`}
                    >
                      <div className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-[#FFD400]/30 blur-2xl" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold text-neutral-900">{item.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isCurrent ? 'bg-neutral-900 text-white' : isRecommended ? 'bg-[#FFD400]/25 text-neutral-900' : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {isCurrent ? '当前' : isRecommended ? '推荐' : '可升级'}
                          </span>
                        </div>
                        <p className="mt-2 text-2xl font-black text-neutral-900">{item.price}</p>
                        {isRecommended ? (
                          <p className="mt-1 rounded-lg bg-[#FFD400]/16 px-2 py-1 text-[11px] font-semibold text-neutral-700">
                            从{formatPlanLabel(currentPlan)}升级更划算，优先解锁主流程能力。
                          </p>
                        ) : null}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-1.5">
                            <p className="text-[11px] text-neutral-500">种龟上限</p>
                            <p className="text-sm font-semibold text-neutral-900">{item.productLimit}</p>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-1.5">
                            <p className="text-[11px] text-neutral-500">AI 额度</p>
                            <p className="text-xs font-semibold text-neutral-900">{item.aiQuota}</p>
                          </div>
                        </div>
                        <details className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-neutral-700">展开核心福利</summary>
                          <div className="mt-2 space-y-1">
                            {item.perks.map((perk) => (
                              <p key={`mobile-perk-${item.tier}-${perk}`} className="text-sm text-neutral-800">
                                • {perk}
                              </p>
                            ))}
                          </div>
                        </details>
                        {!isCurrent ? (
                          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={focusUpgradeSection}>
                            立刻升级到{item.name}
                          </Button>
                        ) : null}
                        <p className="mt-2 text-center text-[11px] text-neutral-500">
                          {index + 1} / {PLAN_PACKAGES.length}
                        </p>
                      </div>
                    </section>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-1.5">
                {PLAN_PACKAGES.map((item, index) => (
                  <span
                    key={`mobile-dot-${item.tier}`}
                    className={`h-1.5 rounded-full transition-all ${
                      activeMobilePlanIndex === index ? 'w-4 bg-neutral-900' : 'w-1.5 bg-neutral-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 md:block">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">版本</th>
                    <th className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">价格</th>
                    <th className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">种龟上限</th>
                    <th className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">AI 额度</th>
                    <th className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">核心福利</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_PACKAGES.map((item) => (
                    <tr key={item.tier} className={item.tier === currentPlan ? 'bg-[#FFD400]/10' : ''}>
                      <td className="border-b border-neutral-200 px-4 py-3 align-top">
                        <p className="text-sm font-semibold text-neutral-900">{item.name}</p>
                        {item.tier === currentPlan ? <p className="text-xs text-neutral-600">当前套餐</p> : null}
                      </td>
                      <td className="border-b border-neutral-200 px-4 py-3 align-top text-sm text-neutral-800">{item.price}</td>
                      <td className="border-b border-neutral-200 px-4 py-3 align-top text-sm text-neutral-800">{item.productLimit}</td>
                      <td className="border-b border-neutral-200 px-4 py-3 align-top text-sm text-neutral-800">{item.aiQuota}</td>
                      <td className="border-b border-neutral-200 px-4 py-3 align-top">
                        <div className="space-y-1">
                          {item.perks.map((perk) => (
                            <p key={`${item.tier}-${perk}`} className="text-sm text-neutral-800">
                              • {perk}
                            </p>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-500">
              说明：分享链接当前不按创建次数做限额，业务主控点是“写状态 + 可管理种龟数量”。
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!loading ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Gift size={18} />
              切换套餐可获得的福利
            </CardTitle>
            <CardDescription>按你当前套餐，给出最直接的升级收益。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {upgradeTracks.map((item) => (
              <section key={item.title} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-1 text-sm text-neutral-600">{item.summary}</p>
                <div className="mt-2 space-y-1">
                  {item.perks.map((perk) => (
                    <p key={`${item.title}-${perk}`} className="text-sm text-neutral-800">
                      • {perk}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!loading ? (
        <Card id="upgrade-now" className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Sparkles size={18} />
              升级套餐
            </CardTitle>
            <CardDescription>输入激活码后立即生效，套餐状态会自动刷新。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="subscription-activation-code">激活码</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="subscription-activation-code"
                type="text"
                value={activationCode}
                placeholder="例如 ETM-ABCD-1234-EFGH"
                onChange={(event) => setActivationCode(event.target.value)}
              />
              <Button type="button" disabled={redeeming} onClick={() => void handleRedeemActivationCode()}>
                {redeeming ? '升级中...' : '立即升级'}
              </Button>
            </div>
          </CardContent>
        </Card>
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

function getRecommendedTier(plan: PlanTier): PlanTier | null {
  if (plan === 'FREE') {
    return 'BASIC';
  }

  if (plan === 'BASIC') {
    return 'PRO';
  }

  return null;
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

function buildUpgradeTracks(plan: PlanTier): UpgradeTrack[] {
  if (plan === 'FREE') {
    return [
      {
        title: '升级到基础版',
        summary: '适合已经进入稳定繁育阶段，想要提高可管理容量与展示效率。',
        perks: ['种龟上限从 10 提升到 30', '可用图册与二维码展示能力', '适合小团队持续运营']
      },
      {
        title: '升级到专业版',
        summary: '适合品牌化经营和持续增长阶段。',
        perks: ['种龟上限提升到 200', '证书能力 + 图片水印能力', '更高 AI 月额度与展示能力']
      }
    ];
  }

  if (plan === 'BASIC') {
    return [
      {
        title: '升级到专业版',
        summary: '在基础版之上，强化品牌展示和交易转化链路。',
        perks: ['种龟管理容量进一步提升到 200', '增加证书与防盗图能力', '获得更高 AI 月度额度']
      },
      {
        title: '保持基础版',
        summary: '如果当前团队规模稳定，基础版已覆盖常规运营。',
        perks: ['维持 30 只管理上限', '继续使用图册与二维码', '可按需加购 AI 额度包']
      }
    ];
  }

  return [
    {
      title: '当前已是专业版',
      summary: '你已在最高标准套餐，可继续通过运营能力放大收益。',
      perks: ['保持 200 只管理上限', '持续使用证书与水印能力', '支持 AI 额度包多次叠加']
    },
    {
      title: '优化建议',
      summary: '专业版建议搭配标准化分享页和证书模板，提升成交效率。',
      perks: ['统一品牌展示页素材', '按批次维护证书与来源信息', '定期复盘 AI 自动记录使用率']
    }
  ];
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
