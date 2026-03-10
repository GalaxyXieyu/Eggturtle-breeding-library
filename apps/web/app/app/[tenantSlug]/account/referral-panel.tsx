'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MyReferralOverviewResponse } from '@eggturtle/shared';
import { Copy, Gift, Users } from 'lucide-react';

import { copyTextWithFallback } from '@/lib/browser-share';
import { formatApiError } from '@/lib/error-utils';
import {
  bindReferralCode,
  fetchMyReferralOverview,
  resolveReferralShareUrl,
} from '@/lib/referral-client';
import { Card } from '@/components/ui/card';

export default function ReferralPanel({ tenantSlug }: { tenantSlug: string }) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<MyReferralOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bindCode, setBindCode] = useState('');
  const [binding, setBinding] = useState(false);

  const shareLink = useMemo(() => resolveReferralShareUrl(overview), [overview]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        const data = await fetchMyReferralOverview(controller.signal);
        if (!cancelled) {
          setOverview(data);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatApiError(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantSlug]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  async function refreshOverview() {
    const data = await fetchMyReferralOverview();
    setOverview(data);
  }

  async function handleCopy() {
    if (!shareLink) {
      return;
    }

    const copied = await copyTextWithFallback(shareLink);
    if (copied) {
      setNotice('邀请链接已复制。邀请好友首付，双方各得 7 天。');
      return;
    }

    setError('复制失败，请稍后再试。');
  }

  async function handleBind() {
    try {
      setBinding(true);
      await bindReferralCode(bindCode, 'manual_fallback');
      await refreshOverview();
      setBindCode('');
      setError(null);
      setNotice('邀请关系已绑定。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setBinding(false);
    }
  }

  return (
    <section className="space-y-4">
      <Card className="rounded-3xl border-[#FFD400]/45 bg-[#FFF8D9]/92 p-6 shadow-[0_18px_40px_rgba(255,212,0,0.12)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              <Gift size={12} />
              Invite Rewards
            </p>
            <h2 className="mt-3 text-lg font-semibold text-neutral-900 sm:text-xl">邀请好友首付，双方各得 7 天</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              好友后续每次续费，你再得 30 天；每人每月最多 {overview?.rules.monthlyCapDays ?? 60} 天。奖励直接延长 PRO 到期时间。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-sm font-semibold text-white">
            <Users size={14} />
            已邀请 {overview?.invitedCount ?? 0} 人
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <MetricCard
            label="本月已获"
            value={overview ? `${overview.monthAwardedDays}/${overview.rules.monthlyCapDays} 天` : loading ? '加载中…' : '-'}
          />
          <MetricCard
            label="本月剩余"
            value={overview ? `${overview.monthRemainingDays} 天` : loading ? '加载中…' : '-'}
          />
          <MetricCard
            label="累计奖励"
            value={overview ? `${overview.totalAwardedDays} 天` : loading ? '加载中…' : '-'}
          />
          <MetricCard
            label="已激活邀请"
            value={overview ? `${overview.activatedInviteeCount} 人` : loading ? '加载中…' : '-'}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-black/10 bg-white/90 p-4">
          <p className="text-xs text-neutral-500">我的邀请链接</p>
          <p className="mt-2 break-all text-sm font-semibold text-neutral-900">{shareLink || '加载中…'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!shareLink}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              <Copy size={14} />
              复制链接
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-black/10 bg-white/90 p-4">
          <p className="text-xs text-neutral-500">绑定邀请人</p>
          <p className="mt-2 text-sm font-semibold text-neutral-900">
            {overview?.binding
              ? `已绑定邀请码 ${overview.binding.referralCode}`
              : `新注册 ${overview?.rules.bindWindowHours ?? 24} 小时内可手动补绑一次`}
          </p>
          {!overview?.binding ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="w-[220px] rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder="填写好友邀请码"
                value={bindCode}
                onChange={(event) => setBindCode(event.target.value)}
              />
              <button
                type="button"
                className="rounded-full border border-neutral-900 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
                disabled={!bindCode.trim() || binding}
                onClick={() => void handleBind()}
              >
                {binding ? '绑定中…' : '确认绑定'}
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
        <h3 className="text-base font-semibold text-neutral-900">奖励记录</h3>
        <p className="mt-1 text-sm text-neutral-500">绑定早、发奖晚：注册即锁定邀请关系，奖励只在首付/续费成功后到账。</p>

        {loading ? <p className="mt-4 text-sm text-neutral-600">正在加载…</p> : null}

        {!loading && overview?.rewards.length ? (
          <div className="mt-4 space-y-3">
            {overview.rewards.map((reward) => (
              <div key={reward.id} className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span className="rounded-full bg-white px-2 py-1 font-semibold text-neutral-700">
                    {reward.triggerType === 'first_payment' ? '首付奖励' : '续费奖励'}
                  </span>
                  <span>{reward.status}</span>
                  <span>{new Date(reward.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  邀请人 +{reward.rewardDaysReferrer} 天，被邀请者 +{reward.rewardDaysInvitee} 天
                </p>
                {reward.statusReason ? (
                  <p className="mt-1 text-xs text-amber-700">{reward.statusReason === 'monthly_cap_clipped' ? '本次奖励受月上限裁剪。' : '本月奖励已达上限。'}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !overview?.rewards.length ? (
          <p className="mt-4 text-sm text-neutral-600">还没有奖励记录。先复制你的邀请链接，邀请好友首付后就会开始累计。</p>
        ) : null}
      </Card>

      {notice ? (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-700" aria-live="polite">{notice}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/90 px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
