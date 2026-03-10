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
      <div className={`public-bg-card public-border-default rounded-2xl border p-3 shadow-[0_8px_20px_rgba(0,0,0,0.06)] ${className ?? ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="public-text-subtle text-[11px] font-semibold uppercase tracking-wide">永久链接</p>
            <p className="public-text-primary truncate font-mono text-sm" title={maskedPath}>
              {maskedPath}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="public-btn-secondary shrink-0"
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
