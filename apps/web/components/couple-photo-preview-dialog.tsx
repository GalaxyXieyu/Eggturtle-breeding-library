'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { HeartHandshake, Loader2, X } from 'lucide-react';

import { modalCloseButtonClass } from '@/components/ui/floating-actions';
import { cn } from '@/lib/utils';

type CouplePhotoPreviewDialogProps = {
  open: boolean;
  imageUrl?: string | null;
  loading?: boolean;
  title: string;
  subtitle?: string;
  className?: string;
  onClose: () => void;
};

export default function CouplePhotoPreviewDialog({
  open,
  imageUrl,
  loading = false,
  title,
  subtitle,
  className,
  onClose,
}: CouplePhotoPreviewDialogProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const titleId = useId();

  const resolvedSubtitle =
    subtitle?.trim() || '建议在手机端长按图片保存到相册，分享给客户更稳定。';

  useEffect(() => {
    setPortalRoot(document.body);

    return () => setPortalRoot(null);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    setImageLoaded(false);
  }, [imageUrl]);

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    open ? (
      <div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={onClose}
      >
        <div
          className={cn(
            'relative flex max-h-[min(94dvh,920px)] w-full max-w-none flex-col overflow-hidden rounded-t-[32px] border border-neutral-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-neutral-900 shadow-2xl sm:max-h-[min(88vh,920px)] sm:max-w-[min(88vw,36rem)] sm:rounded-[32px] sm:p-5',
            className,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative z-10 mb-3 flex items-start justify-between gap-3 sm:mb-4">
            <div className="min-w-0 space-y-1.5">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600 sm:text-[11px]">
                <HeartHandshake size={12} />
                夫妻图
              </p>
              <p id={titleId} className="line-clamp-1 text-lg font-bold tracking-tight sm:text-xl">
                {title}
              </p>
              <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500 sm:text-sm">
                {resolvedSubtitle}
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭夫妻图弹窗"
              className={modalCloseButtonClass}
              onClick={onClose}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-2 sm:py-3">
            <div className="flex h-full min-h-[min(62dvh,32rem)] w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:min-h-[min(72vh,42rem)] sm:rounded-3xl sm:p-4">
              {imageUrl ? (
                <div className="relative mx-auto flex aspect-[2/3] w-full max-w-[min(84vw,21rem)] min-h-[17.5rem] items-center justify-center overflow-hidden rounded-2xl bg-neutral-900 p-1 shadow-xl sm:max-w-[21rem]">
                  <img
                    src={imageUrl}
                    alt={`${title}夫妻图预览`}
                    className="h-full w-full rounded-[20px] object-contain"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                  {!imageLoaded ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-neutral-900/70">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                        <Loader2 size={18} className="animate-spin" />
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : loading ? (
                <div className="mx-auto flex aspect-[2/3] w-full max-w-[min(84vw,19rem)] min-h-[17.5rem] flex-col items-center justify-center gap-4 rounded-2xl bg-white px-6 text-center text-sm text-neutral-500 shadow-sm sm:max-w-[19rem]">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                    <Loader2 size={18} className="animate-spin" />
                  </span>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold text-neutral-900">正在生成夫妻图...</p>
                    <p className="text-xs leading-6 text-neutral-500">沿用海报预览的等待态，生成完成后会自动替换成图片预览。</p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex aspect-[2/3] w-full max-w-[min(84vw,19rem)] min-h-[17.5rem] flex-col items-center justify-center gap-4 rounded-2xl bg-white px-6 text-center text-sm text-neutral-500 shadow-sm sm:max-w-[19rem]">
                  暂无夫妻图预览
                </div>
              )}
            </div>
          </div>
          {imageUrl ? (
            <p className="relative z-10 mt-1 text-center text-xs text-neutral-500">
              手机端建议长按海报图片后选择“保存到相册”。
            </p>
          ) : null}

          <div className="relative z-10 mt-3 grid grid-cols-1 gap-2.5 sm:mt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-neutral-900 bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
            >
              关闭预览
            </button>
          </div>
        </div>
      </div>
    ) : null,
    portalRoot,
  );
}
