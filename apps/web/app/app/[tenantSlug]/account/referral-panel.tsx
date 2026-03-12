'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MyReferralOverviewResponse, ReferralInviteProgress, ReferralReward } from '@eggturtle/shared';
import { Copy, Gift, Users } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { useUiPreferences } from '@/components/ui-preferences';
import { copyTextWithFallback } from '@/lib/browser-share';
import { formatApiError } from '@/lib/error-utils';
import { ACCOUNT_REFERRAL_MESSAGES } from '@/lib/locales/account';
import {
  bindReferralCode,
  fetchMyReferralOverview,
  resolveReferralShareUrl,
} from '@/lib/referral-client';

export default function ReferralPanel({ tenantSlug }: { tenantSlug: string }) {
  const { locale } = useUiPreferences();
  const messages = ACCOUNT_REFERRAL_MESSAGES[locale];
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<MyReferralOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bindCode, setBindCode] = useState('');
  const [binding, setBinding] = useState(false);

  const shareLink = useMemo(() => resolveReferralShareUrl(overview), [overview]);
  const firstUploadDays = overview?.rules.firstProductInviteeDays ?? 7;

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
          setError(formatApiError(requestError, undefined, locale));
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
  }, [locale, tenantSlug]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
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
      setNotice(messages.copySuccess(firstUploadDays));
      return;
    }

    setError(messages.copyFailed);
  }

  async function handleBind() {
    try {
      setBinding(true);
      await bindReferralCode(bindCode, 'manual_fallback');
      await refreshOverview();
      setBindCode('');
      setError(null);
      setNotice(messages.bindConfirm);
    } catch (requestError) {
      setError(formatApiError(requestError, undefined, locale));
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
              {messages.badge}
            </p>
            <h2 className="mt-3 text-lg font-semibold text-neutral-900 sm:text-xl">
              {messages.heroTitle(firstUploadDays)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{messages.heroDesc}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-sm font-semibold text-white">
            <Users size={14} />
            {messages.invitedCount(overview?.invitedCount ?? 0)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <MetricCard
            label={messages.metrics.awarded}
            value={
              overview
                ? `${overview.monthAwardedDays}/${overview.rules.monthlyCapDays} ${messages.days}`
                : loading
                  ? messages.loading
                  : '-'
            }
          />
          <MetricCard
            label={messages.metrics.remaining}
            value={overview ? `${overview.monthRemainingDays} ${messages.days}` : loading ? messages.loading : '-'}
          />
          <MetricCard
            label={messages.metrics.total}
            value={overview ? `${overview.totalAwardedDays} ${messages.days}` : loading ? messages.loading : '-'}
          />
          <MetricCard
            label={messages.metrics.activated}
            value={overview ? `${overview.activatedInviteeCount} ${messages.people}` : loading ? messages.loading : '-'}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-black/10 bg-white/90 p-4">
          <p className="text-xs text-neutral-500">{messages.shareLinkLabel}</p>
          <p className="mt-2 break-all text-sm font-semibold text-neutral-900">{shareLink || messages.loading}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!shareLink}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              <Copy size={14} />
              {messages.copyLink}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-black/10 bg-white/90 p-4">
          <p className="text-xs text-neutral-500">{messages.bindTitle}</p>
          <p className="mt-2 text-sm font-semibold text-neutral-900">
            {overview?.binding
              ? messages.bindingCode(overview.binding.referralCode)
              : messages.bindWindow(overview?.rules.bindWindowHours ?? 24)}
          </p>
          {!overview?.binding ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="w-[220px] rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder={messages.bindPlaceholder}
                value={bindCode}
                onChange={(event) => setBindCode(event.target.value)}
              />
              <button
                type="button"
                className="rounded-full border border-neutral-900 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
                disabled={!bindCode.trim() || binding}
                onClick={() => void handleBind()}
              >
                {binding ? messages.binding : messages.bindConfirm}
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
        <h3 className="text-base font-semibold text-neutral-900">{messages.progressTitle}</h3>
        <p className="mt-1 text-sm text-neutral-500">{messages.progressDesc}</p>

        {loading ? <p className="mt-4 text-sm text-neutral-600">{messages.loading}</p> : null}

        {!loading && overview?.invites.length ? (
          <div className="mt-4 space-y-3">
            {overview.invites.map((invite) => (
              <InviteProgressCard key={invite.inviteeUserId} invite={invite} locale={locale} />
            ))}
          </div>
        ) : null}

        {!loading && !overview?.invites.length ? (
          <p className="mt-4 text-sm text-neutral-600">{messages.progressEmpty}</p>
        ) : null}
      </Card>

      <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
        <h3 className="text-base font-semibold text-neutral-900">{messages.rewardsTitle}</h3>
        <p className="mt-1 text-sm text-neutral-500">{messages.rewardsDesc}</p>

        {loading ? <p className="mt-4 text-sm text-neutral-600">{messages.loading}</p> : null}

        {!loading && overview?.rewards.length ? (
          <div className="mt-4 space-y-3">
            {overview.rewards.map((reward) => (
              <RewardCard key={reward.id} reward={reward} locale={locale} />
            ))}
          </div>
        ) : null}

        {!loading && !overview?.rewards.length ? (
          <p className="mt-4 text-sm text-neutral-600">{messages.rewardsEmpty}</p>
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

function InviteProgressCard({
  invite,
  locale,
}: {
  invite: ReferralInviteProgress;
  locale: 'zh' | 'en';
}) {
  const messages = ACCOUNT_REFERRAL_MESSAGES[locale];
  const status = getInviteStatusMeta(invite.status, locale);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span className="rounded-full bg-white px-2 py-1 font-semibold text-neutral-700">{invite.inviteeDisplayName}</span>
        <span className={`rounded-full px-2 py-1 font-semibold ${status.className}`}>{status.label}</span>
        <span>{formatReferralDate(invite.boundAt, locale)}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-900">{messages.inviteCode(invite.referralCode)}</p>
      <p className="mt-1 text-xs text-neutral-600">
        {invite.firstProductCreatedAt
          ? messages.firstUploadAt(formatReferralDate(invite.firstProductCreatedAt, locale))
          : messages.uploadPending}
      </p>
      {invite.rewardAwardedAt ? (
        <p className="mt-1 text-xs text-emerald-700">
          {messages.rewardAwardedAt(formatReferralDate(invite.rewardAwardedAt, locale))}
        </p>
      ) : null}
    </div>
  );
}

function RewardCard({
  reward,
  locale,
}: {
  reward: ReferralReward;
  locale: 'zh' | 'en';
}) {
  const messages = ACCOUNT_REFERRAL_MESSAGES[locale];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span className="rounded-full bg-white px-2 py-1 font-semibold text-neutral-700">
          {getRewardTriggerLabel(reward.triggerType, locale)}
        </span>
        <span>{reward.status}</span>
        <span>{formatReferralDate(reward.createdAt, locale)}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-900">
        {messages.rewardDelta(reward.rewardDaysReferrer, reward.rewardDaysInvitee)}
      </p>
      {reward.statusReason ? (
        <p className="mt-1 text-xs text-amber-700">
          {reward.statusReason === 'monthly_cap_clipped' ? messages.rewardClipped : messages.rewardCapped}
        </p>
      ) : null}
    </div>
  );
}

function getRewardTriggerLabel(triggerType: ReferralReward['triggerType'], locale: 'zh' | 'en'): string {
  const messages = ACCOUNT_REFERRAL_MESSAGES[locale];
  if (triggerType === 'first_product_create') {
    return messages.triggerFirstUpload;
  }

  if (triggerType === 'first_payment') {
    return messages.triggerFirstPayment;
  }

  return messages.triggerRenewal;
}

function getInviteStatusMeta(status: ReferralInviteProgress['status'], locale: 'zh' | 'en') {
  const messages = ACCOUNT_REFERRAL_MESSAGES[locale];

  switch (status) {
    case 'reward_awarded':
      return {
        label: messages.statusAwarded,
        className: 'bg-emerald-100 text-emerald-700',
      };
    case 'reward_skipped':
      return {
        label: messages.statusSkipped,
        className: 'bg-amber-100 text-amber-700',
      };
    case 'first_product_uploaded':
      return {
        label: messages.statusUploaded,
        className: 'bg-sky-100 text-sky-700',
      };
    default:
      return {
        label: messages.statusBound,
        className: 'bg-neutral-200 text-neutral-700',
      };
  }
}

function formatReferralDate(value: string, locale: 'zh' | 'en') {
  return new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
}
