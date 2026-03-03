'use client';

import { useState } from 'react';
import {
  createShareRequestSchema,
  createShareResponseSchema,
  meResponseSchema
} from '@eggturtle/shared';
import { Share2 } from 'lucide-react';

import { ApiError, apiRequest } from '../lib/api-client';
import { cn } from '../lib/utils';

export type TenantShareIntent = 'feed' | 'series' | { productId: string };

type TenantFloatingShareButtonProps = {
  intent: TenantShareIntent;
  className?: string;
  /** 为 true 时只渲染按钮，不包 fixed 容器，用于与其他 FAB 放在同一容器内堆叠 */
  inline?: boolean;
};

function buildSharePath(intent: TenantShareIntent): string {
  if (intent === 'feed') return '';
  if (intent === 'series') return '/series';
  return `/products/${intent.productId}`;
}

function buildPermanentShareUrl(shareToken: string, intent: TenantShareIntent): string {
  const pathSuffix = buildSharePath(intent);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/public/s/${shareToken}${pathSuffix}`;
  }
  return `/public/s/${shareToken}${pathSuffix}`;
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '创建分享链接失败';
}

export default function TenantFloatingShareButton({ intent, className, inline }: TenantFloatingShareButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenShare() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const meResponse = await apiRequest('/me', {
        responseSchema: meResponseSchema
      });

      if (!meResponse.tenantId) {
        setError('当前租户上下文未就绪，暂时无法生成链接。');
        return;
      }

      const payload = createShareRequestSchema.parse({
        resourceType: 'tenant_feed',
        resourceId: meResponse.tenantId
      });

      const createShareResponse = await apiRequest('/shares', {
        method: 'POST',
        body: payload,
        requestSchema: createShareRequestSchema,
        responseSchema: createShareResponseSchema
      });

      const url = buildPermanentShareUrl(createShareResponse.share.shareToken, intent);
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        window.location.href = url;
      }
    } catch (err) {
      setError(formatError(err));
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
          className={cn(
            'tenant-fab-button disabled:opacity-60',
            className
          )}
        >
          <Share2 size={20} />
        </button>
      ) : (
        <div
          className={cn(
            'mobile-fab fixed right-4 z-50 sm:right-6 lg:right-8 lg:bottom-6',
            className
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
            className="ml-2 font-semibold underline"
          >
            关闭
          </button>
        </div>
      ) : null}
    </>
  );
}
