'use client';

import { Share2 } from 'lucide-react';

import TenantShareDialogTrigger from '@/components/tenant-share-dialog-trigger';
import { FloatingActionButton, FloatingActionDock } from '@/components/ui/floating-actions';
import { cn } from '@/lib/utils';
import type { TenantShareIntent, TenantSharePosterVariant } from '@/lib/tenant-share';

type TenantFloatingShareButtonProps = {
  intent: TenantShareIntent;
  className?: string;
  inline?: boolean;
  title?: string;
  subtitle?: string;
  previewImageUrl?: string | null;
  posterImageUrls?: string[];
  posterVariant?: TenantSharePosterVariant;
};

export default function TenantFloatingShareButton({
  intent,
  className,
  inline,
  title,
  subtitle,
  previewImageUrl,
  posterImageUrls,
  posterVariant,
}: TenantFloatingShareButtonProps) {
  return (
    <TenantShareDialogTrigger
      intent={intent}
      title={title}
      subtitle={subtitle}
      previewImageUrl={previewImageUrl}
      posterImageUrls={posterImageUrls}
      posterVariant={posterVariant}
      trigger={({ onClick, pending }) =>
        inline ? (
          <FloatingActionButton
            onClick={onClick}
            disabled={pending}
            aria-label="打开当前页分享弹窗"
            title={pending ? '正在准备...' : '打开分享弹窗'}
            className={cn('disabled:opacity-60', className)}
          >
            <Share2 size={20} />
          </FloatingActionButton>
        ) : (
          <FloatingActionDock className={className}>
            <FloatingActionButton
              onClick={onClick}
              disabled={pending}
              aria-label="打开当前页分享弹窗"
              title={pending ? '正在准备...' : '打开分享弹窗'}
              className="disabled:opacity-60"
            >
              <Share2 size={20} />
            </FloatingActionButton>
          </FloatingActionDock>
        )
      }
    />
  );
}
