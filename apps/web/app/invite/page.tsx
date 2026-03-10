'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Gift, Sparkles } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { formatApiError } from '@/lib/error-utils';
import {
  fetchPublicReferralLanding,
  normalizeReferralCode,
  stashPendingReferralCode,
} from '@/lib/referral-client';

export default function InvitePage() {
  return (
    <Suspense fallback={<InvitePageFallback />}>
      <InvitePageContent />
    </Suspense>
  );
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const referralCode = useMemo(() => normalizeReferralCode(searchParams.get('ref')), [searchParams]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [landing, setLanding] = useState<Awaited<ReturnType<typeof fetchPublicReferralLanding>> | null>(null);

  useEffect(() => {
    if (!referralCode) {
      setLoading(false);
      setError('缺少有效邀请码。');
      return;
    }

    stashPendingReferralCode(referralCode);

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        const response = await fetchPublicReferralLanding(referralCode, controller.signal);
        if (!cancelled) {
          setLanding(response);
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
  }, [referralCode]);

  const registerHref = referralCode ? `/login?view=register&ref=${encodeURIComponent(referralCode)}` : '/login?view=register';
  const loginHref = referralCode ? `/login?ref=${encodeURIComponent(referralCode)}` : '/login';

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-5xl items-center px-4 py-8 sm:px-6">
      <section className="grid w-full gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden rounded-[32px] border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,248,217,0.96))] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] sm:p-8">
          <p className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            <Sparkles size={12} />
            Invite Rewards
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            邀请好友首付，双方各得 7 天
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-700 sm:text-base">
            {landing
              ? `${landing.inviter.displayName} 邀请你开通 Eggturtle。首笔付费成功后，你和对方都可获得 7 天 PRO；之后你每次续费，对方再得 30 天。`
              : '通过好友邀请开通后，首笔付费成功时双方各得 7 天 PRO；后续续费还会继续带来邀请奖励。'}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InviteStat label="首付奖励" value="双方各 7 天" />
            <InviteStat label="续费奖励" value="邀请人得 30 天" />
            <InviteStat label="每月上限" value={landing ? `${landing.rules.monthlyCapDays} 天 / 人` : '60 天 / 人'} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={registerHref}
              onClick={() => stashPendingReferralCode(referralCode)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              注册并开始
              <ArrowRight size={14} />
            </Link>
            <Link
              href={loginHref}
              onClick={() => stashPendingReferralCode(referralCode)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-900 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
            >
              已有账号登录
            </Link>
          </div>

          {loading ? <p className="mt-4 text-sm text-neutral-500">正在加载邀请信息…</p> : null}
          {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
        </Card>

        <Card className="rounded-[32px] border-black/10 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Gift size={16} className="text-amber-600" />
            为什么这样设计？
          </div>
          <div className="mt-4 space-y-3 text-sm leading-7 text-neutral-600">
            <p>1. 先锁定邀请关系，避免注册后丢归因。</p>
            <p>2. 不按注册发奖，防止僵尸号刷奖励。</p>
            <p>3. 奖励直接延长 PRO，到期时间清晰可见。</p>
            <p>4. 邀请中心会区分“已邀请”和“已激活邀请”，上传第一只龟后才算激活。</p>
          </div>

          {landing ? (
            <div className="mt-6 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">来自好友邀请</p>
              <p className="mt-2 text-lg font-semibold text-neutral-900">{landing.inviter.displayName}</p>
              <p className="mt-1 text-sm text-neutral-600">{landing.inviter.tenantName ?? 'Eggturtle 用户空间'}</p>
              <p className="mt-2 break-all text-xs text-neutral-500">邀请码：{landing.referralCode}</p>
            </div>
          ) : null}
        </Card>
      </section>
    </main>
  );
}

function InvitePageFallback() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-5xl items-center px-4 py-8 sm:px-6">
      <Card className="w-full rounded-[32px] border-black/10 bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <p className="text-sm text-neutral-600">正在准备邀请页…</p>
      </Card>
    </main>
  );
}

function InviteStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/88 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
