'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
  shareToken: string;
  className?: string;
};

export default function PublicPermalinkBar({ shareToken, className }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const permalink = useMemo(() => `/public/s/${shareToken}`, [shareToken]);
  const maskedPath = useMemo(() => {
    const suffix = shareToken.slice(-4);
    return `/public/s/****${suffix}`;
  }, [shareToken]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleCopy() {
    const absolutePermalink = `${window.location.origin}${permalink}`;

    try {
      await navigator.clipboard.writeText(absolutePermalink);
      setToast('已复制永久链接');
    } catch {
      setToast('复制失败，请手动复制');
    }
  }

  return (
    <>
      <div className={`rounded-2xl border border-black/5 bg-white/90 p-3 shadow-[0_8px_20px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/70 ${className ?? ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">永久链接</p>
            <p className="truncate font-mono text-sm text-neutral-800 dark:text-neutral-100" title={maskedPath}>
              {maskedPath}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-900 hover:text-white hover:shadow-sm dark:border-white/20 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            复制永久链接
          </button>
        </div>
      </div>

      {toast ? (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-[70] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      ) : null}
    </>
  );
}
