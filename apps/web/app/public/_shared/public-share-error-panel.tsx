'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  title: string;
  message: string;
  shareToken: string;
  canAutoRefresh?: boolean;
};

export default function PublicShareErrorPanel({ title, message, shareToken, canAutoRefresh = false }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const hasAutoRefreshTriggeredRef = useRef(false);

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

    if (hasAutoRefreshTriggeredRef.current) {
      return;
    }

    hasAutoRefreshTriggeredRef.current = true;
    void refreshShareLink();
  }, [canAutoRefresh, refreshShareLink]);

  return (
    <main className="share-shell">
      <section className="card panel stack">
        <h1>{title}</h1>
        <p className="notice notice-error">{message}</p>
        {canAutoRefresh && refreshing ? <p className="notice">正在自动刷新永久链接，请稍候...</p> : null}
        {refreshError ? <p className="notice notice-warning">{refreshError}</p> : null}
      </section>

      {toast ? (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-[70] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
