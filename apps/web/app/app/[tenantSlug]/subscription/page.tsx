'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  meSubscriptionResponseSchema,
  redeemTenantSubscriptionActivationCodeRequestSchema,
  redeemTenantSubscriptionActivationCodeResponseSchema,
  type TenantSubscription
} from '@eggturtle/shared';
import { Gift, Sparkles, Wallet } from 'lucide-react';

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

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <Card className="tenant-card-lift relative overflow-hidden rounded-3xl border-neutral-200/90 bg-white p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#FFD400]/20 blur-3xl" />
        <CardHeader className="relative z-10 p-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">套餐订阅中心</Badge>
            <Badge variant={subscription?.status === 'ACTIVE' ? 'success' : 'warning'}>{formatStatusLabel(subscription?.status)}</Badge>
          </div>
          <CardTitle className="mt-3 text-3xl text-neutral-900 sm:text-4xl">{formatPlanLabel(currentPlan)}</CardTitle>
          <CardDescription className="mt-2 text-neutral-600">
            这里集中展示当前套餐、配额状态、不同版本差异，以及升级可获得的能力。
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">正在加载套餐信息...</p>
        </Card>
      ) : null}

      {!loading ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="可管理种龟上限" value={`${effectiveProductLimit}`} hint="当前生效额度（优先读取租户自定义值）" />
          <StatCard title="图片上限" value={toDisplayValue(subscription?.maxImages)} hint="图片数量配额" />
          <StatCard title="存储上限" value={toDisplayBytes(subscription?.maxStorageBytes)} hint="图片存储配额" />
          <StatCard title="到期时间" value={formatSubscriptionDate(subscription?.expiresAt ?? null)} hint="未设置到期则长期有效" />
        </section>
      ) : null}

      {!loading ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Wallet size={18} />
              版本与额度对比
            </CardTitle>
            <CardDescription>依据当前文档口径整理，价格与能力一页看清。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
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
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
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

function StatCard(props: { title: string; value: string; hint: string }) {
  return (
    <Card className="rounded-2xl border-neutral-200/90 bg-white p-4">
      <CardHeader className="p-0">
        <p className="text-xs text-neutral-500">{props.title}</p>
      </CardHeader>
      <CardContent className="mt-2 p-0">
        <p className="text-2xl font-black text-neutral-900">{props.value}</p>
        <p className="mt-1 text-xs text-neutral-500">{props.hint}</p>
      </CardContent>
    </Card>
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
