'use client';

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';

import { formatApiError } from '../lib/error-utils';
import { createTenantFeedShareLink } from '../lib/tenant-share';
import { cn } from '../lib/utils';

export type TenantShareIntent = 'feed' | 'series' | { productId: string };

type TenantFloatingShareButtonProps = {
  intent: TenantShareIntent;
  className?: string;
  /** 为 true 时只渲染按钮，不包 fixed 容器，用于与其他 FAB 放在同一容器内堆叠 */
  inline?: boolean;
};

export default function TenantFloatingShareButton({
  intent,
  className,
  inline,
}: TenantFloatingShareButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function handleOpenShare() {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const share = await createTenantFeedShareLink({
        intent,
        missingTenantMessage: '当前租户上下文未就绪，暂时无法生成链接。',
      });
      const url = share.permanentUrl;
      try {
        await navigator.clipboard.writeText(url);
        setNotice(`已复制链接：${url}`);
      } catch {
        setError('链接已生成，但自动复制失败，请手动复制。');
      }

      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        setError('浏览器拦截了新窗口，请允许弹窗后重试。');
      }
    } catch (err) {
      setError(formatApiError(err, '创建分享链接失败'));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {inline ? (
        <button
          type="button"
          onClick={() => void handleOpenShare()}
          disabled={pending}
          aria-label="打开当前页分享链接"
          title={pending ? '正在打开...' : '打开分享页'}
          className={cn('tenant-fab-button disabled:opacity-60', className)}
        >
          <Share2 size={20} />
        </button>
      ) : (
        <div
          className={cn(
            'mobile-fab fixed right-6 z-50 sm:right-6 lg:right-8 lg:bottom-6',
            className,
          )}
        >
          <button
            type="button"
            onClick={() => void handleOpenShare()}
            disabled={pending}
            aria-label="打开当前页分享链接"
            title={pending ? '正在打开...' : '打开分享页'}
            className="tenant-fab-button disabled:opacity-60"
          >
            <Share2 size={20} />
          </button>
        </div>
      )}
      {error ? (
        <div
          className="fixed left-4 right-4 z-50 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/90 dark:text-red-200 sm:left-auto sm:right-6 sm:max-w-xs"
          role="alert"
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 inline-flex items-center rounded bg-transparent px-1.5 py-0.5 text-xs font-semibold text-red-700 underline-offset-2 hover:underline dark:text-red-300"
          >
            关闭
          </button>
        </div>
      ) : null}
      {notice ? (
        <div
          className="fixed left-4 right-4 z-50 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200 sm:left-auto sm:right-6 sm:max-w-xs"
          role="status"
        >
          {notice}
        </div>
      ) : null}
    </>
  );
}
