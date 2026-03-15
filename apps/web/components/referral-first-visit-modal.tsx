'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';

import { formatApiError } from '@/lib/error-utils';
import {
  fetchMyReferralOverview,
  isReferralPromoDismissed,
  isReferralPromoSeenInSession,
  markReferralPromoDismissed,
  markReferralPromoSeenInSession,
} from '@/lib/referral-client';

const OPEN_DELAY_MS = 800;

export default function ReferralFirstVisitModal({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchMyReferralOverview>> | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);

    return () => setPortalRoot(null);
  }, []);

  useEffect(() => {
    if (
      !tenantSlug ||
      isReferralPromoDismissed(tenantSlug) ||
      isReferralPromoSeenInSession(tenantSlug)
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      markReferralPromoSeenInSession(tenantSlug);
      setOpen(true);
    }, OPEN_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [tenantSlug]);

  useEffect(() => {
    if (!open || overview) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetchMyReferralOverview(controller.signal);
        if (!cancelled) {
          setOverview(response);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatApiError(requestError));
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, overview]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const firstUploadDays = useMemo(() => overview?.rules.firstProductInviteeDays ?? 7, [overview]);
  const monthAwardedText = useMemo(
    () => (overview ? `${overview.monthAwardedDays}/${overview.rules.monthlyCapDays}` : '0/60'),
    [overview],
  );

  function handleClose() {
    setOpen(false);
  }

  function handleDismissForever() {
    markReferralPromoDismissed(tenantSlug);
    setOpen(false);
  }

  if (!open || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="邀请奖励弹层"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md rounded-[28px] border border-white/40 bg-white p-5 shadow-[0_24px_68px_rgba(0,0,0,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="关闭邀请奖励弹层"
          onClick={handleClose}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-900"
        >
          <X size={16} />
        </button>

        <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
          <Sparkles size={12} />
          Invite Rewards
        </p>
        <h2 className="mt-3 text-xl font-semibold text-neutral-900">邀请好友上传首只乌龟，双方各得 {firstUploadDays} 天</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          好友从公开页注册后会自动绑定；首次成功上传一只乌龟后，双方各得 {firstUploadDays} 天，奖励会直接延长 PRO 到期时间。
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-neutral-50 px-3 py-2">
            <p className="text-[11px] text-neutral-500">首只上传</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">双方各 {firstUploadDays} 天</p>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-3 py-2">
            <p className="text-[11px] text-neutral-500">自动绑定</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">注册后自动建联</p>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-3 py-2">
            <p className="text-[11px] text-neutral-500">本月上限</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{monthAwardedText}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDismissForever}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            不再提醒
          </button>
          <Link
            href={`/app/${tenantSlug}/account?tab=referral`}
            onClick={handleClose}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            立即邀请
          </Link>
        </div>

        {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
      </div>
    </div>,
    portalRoot,
  );
}
