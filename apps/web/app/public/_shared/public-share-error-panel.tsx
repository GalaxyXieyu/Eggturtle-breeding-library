'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Props = {
  title: string;
  message: string;
  shareToken: string;
  canAutoRefresh?: boolean;
};

const MAX_AUTO_REFRESH = 1;

export default function PublicShareErrorPanel({ title, message, shareToken, canAutoRefresh = false }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const storageKey = useMemo(() => `public-share-refresh-attempt:${shareToken}`, [shareToken]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const refreshShareLink = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    setToast('链接正在刷新...');

    try {
      const response = await fetch(`/api/public/share-refresh/${shareToken}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('刷新失败，请稍后重试。');
      }

      const payload = (await response.json()) as { location?: string };
      const nextLocation = payload.location;
      if (!nextLocation) {
        throw new Error('刷新失败，请稍后重试。');
      }

      setToast('链接已刷新，正在跳转...');
      window.setTimeout(() => {
        window.location.replace(nextLocation);
      }, 650);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '刷新失败，请稍后重试。';
      setToast(nextMessage);
      setRefreshError(nextMessage);
      setRefreshing(false);
    }
  }, [shareToken]);

  useEffect(() => {
    if (!canAutoRefresh) {
      return;
    }

    const attemptedCount = Number(window.sessionStorage.getItem(storageKey) || '0');
    if (attemptedCount >= MAX_AUTO_REFRESH) {
      return;
    }

    window.sessionStorage.setItem(storageKey, String(attemptedCount + 1));
    void refreshShareLink();
  }, [canAutoRefresh, refreshShareLink, storageKey]);

  return (
    <main className="share-shell">
      <section className="card panel stack">
        <h1>{title}</h1>
        <p className="notice notice-error">{message}</p>
        {refreshError ? <p className="notice notice-warning">{refreshError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void refreshShareLink();
            }}
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 transition hover:border-neutral-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            disabled={refreshing}
          >
            {refreshing ? '刷新中...' : '点击刷新'}
          </button>
        </div>
      </section>

      {toast ? (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-[70] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
