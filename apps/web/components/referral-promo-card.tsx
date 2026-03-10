'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';

import { formatApiError } from '@/lib/error-utils';
import { fetchMyReferralOverview } from '@/lib/referral-client';

type ReferralPromoCardProps = {
  tenantSlug: string;
  currentExpiresAt?: string | null;
  variant?: 'subscription' | 'share';
};

export default function ReferralPromoCard({
  tenantSlug,
  currentExpiresAt,
  variant = 'subscription',
}: ReferralPromoCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchMyReferralOverview>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        const response = await fetchMyReferralOverview(controller.signal);
        if (!cancelled) {
          setOverview(response);
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
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  const projectedExpiry = useMemo(() => {
    if (!currentExpiresAt || !overview) {
      return null;
    }

    const now = Date.now();
    const current = new Date(currentExpiresAt).getTime();
    const base = Number.isNaN(current) ? now : Math.max(now, current);
    const projected = new Date(
      base + overview.rules.firstPaymentReferrerDays * 24 * 60 * 60 * 1000,
    );
    if (Number.isNaN(projected.getTime())) {
      return null;
    }

    return projected.toLocaleDateString();
  }, [currentExpiresAt, overview]);

  const compact = variant === 'share';

  return (
    <div
      className={`rounded-2xl border ${
        compact
          ? 'border-amber-200/80 bg-amber-50/85 p-2.5'
          : 'border-[#FFD400]/50 bg-[#FFF8D9]/92 p-4 sm:p-5'
      }`}
    >
      <div className={`flex items-start justify-between ${compact ? 'gap-2' : 'gap-3'}`}>
        <div className="min-w-0">
          <p
            className={`inline-flex items-center gap-1 rounded-full bg-white/80 font-semibold uppercase tracking-[0.18em] text-amber-700 ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
            }`}
          >
            <Sparkles size={12} />
            Invite Rewards
          </p>
          <h3 className={`font-semibold text-neutral-900 ${compact ? 'mt-1.5 text-sm' : 'mt-2 text-base sm:text-lg'}`}>
            邀请好友首付，双方各得 7 天
          </h3>
          <p
            className={`mt-1 text-neutral-700 ${
              compact ? 'line-clamp-2 text-[11px] leading-4' : 'text-sm leading-6'
            }`}
          >
            好友后续每次续费，你再得 30 天；每人每月最多 60 天。奖励直充 PRO，到期时间顺延。
          </p>
        </div>
        <Link
          href={`/app/${tenantSlug}/account?tab=referral`}
          className={`inline-flex shrink-0 items-center justify-center rounded-full border border-neutral-900 bg-white font-semibold text-neutral-900 transition hover:bg-neutral-50 ${
            compact ? 'min-h-7 px-2.5 py-1 text-[11px]' : 'min-h-8 px-3 py-1.5 text-xs'
          }`}
        >
          去邀请中心
        </Link>
      </div>

      <div className={`grid ${compact ? 'mt-1.5 gap-1.5' : 'mt-3 gap-2'} ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <div className={`rounded-2xl bg-white/80 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
          <p className="text-[11px] text-neutral-500">本月已获</p>
          <p className={`font-semibold text-neutral-900 ${compact ? 'mt-0.5 text-[13px]' : 'mt-1 text-sm'}`}>
            {overview
              ? `${overview.monthAwardedDays}/${overview.rules.monthlyCapDays} 天`
              : loading
                ? '加载中…'
                : '-'}
          </p>
        </div>
        <div className={`rounded-2xl bg-white/80 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
          <p className="text-[11px] text-neutral-500">已激活邀请</p>
          <p className={`font-semibold text-neutral-900 ${compact ? 'mt-0.5 text-[13px]' : 'mt-1 text-sm'}`}>
            {overview ? `${overview.activatedInviteeCount} 人` : loading ? '加载中…' : '-'}
          </p>
        </div>
        {!compact ? (
          <div className="rounded-2xl bg-white/80 px-3 py-2">
            <p className="text-[11px] text-neutral-500">奖励价值</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              {projectedExpiry
                ? `成功 1 单后预计到 ${projectedExpiry}`
                : '证书 / 水印 / 品牌化展示 / 200 只管理上限'}
            </p>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p className="mt-2 text-xs text-emerald-700" aria-live="polite">
          {notice}
        </p>
      ) : null}
      {!loading && error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
    </div>
  );
}
