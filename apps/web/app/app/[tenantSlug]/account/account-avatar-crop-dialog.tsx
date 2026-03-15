/* eslint-disable @next/next/no-img-element */
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Minus, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';

const OUTPUT_SIZE = 800;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type DragState = {
  originX: number;
  originY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

type Size = {
  height: number;
  width: number;
};

type AccountAvatarCropDialogProps = {
  confirming?: boolean;
  onClose: () => void;
  onConfirm: (payload: { blob: Blob; fileName: string }) => Promise<void> | void;
  open: boolean;
  sourceName?: string;
  sourceUrl: string | null;
};

export default function AccountAvatarCropDialog({
  confirming = false,
  onClose,
  onConfirm,
  open,
  sourceName,
  sourceUrl,
}: AccountAvatarCropDialogProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState<Size>({ height: 0, width: 0 });
  const [imageSize, setImageSize] = useState<Size>({ height: 0, width: 0 });
  const [imageError, setImageError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    if (!open || !sourceUrl) {
      return;
    }

    let cancelled = false;
    setImageError(null);
    setImageSize({ height: 0, width: 0 });
    setPosition({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (!cancelled) {
        setImageSize({ height: image.naturalHeight, width: image.naturalWidth });
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setImageError('图片加载失败，请重新选择一张图片。');
      }
    };
    image.src = sourceUrl;

    return () => {
      cancelled = true;
    };
  }, [open, sourceUrl]);

  useEffect(() => {
    if (!open || !frameRef.current) {
      return;
    }

    const node = frameRef.current;
    const updateFrameSize = () => {
      setFrameSize({ height: node.clientHeight, width: node.clientWidth });
    };

    updateFrameSize();

    const resizeObserver = new ResizeObserver(updateFrameSize);
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [open]);

  const cropMetrics = useMemo(() => {
    if (!frameSize.width || !frameSize.height || !imageSize.width || !imageSize.height) {
      return null;
    }

    const baseScale = Math.max(
      frameSize.width / imageSize.width,
      frameSize.height / imageSize.height,
    );
    const baseWidth = imageSize.width * baseScale;
    const baseHeight = imageSize.height * baseScale;
    const scaledWidth = baseWidth * zoom;
    const scaledHeight = baseHeight * zoom;

    return {
      baseHeight,
      baseScale,
      baseWidth,
      scaledHeight,
      scaledWidth,
    };
  }, [frameSize.height, frameSize.width, imageSize.height, imageSize.width, zoom]);

  const clampPosition = useCallback(
    (nextPosition: { x: number; y: number }) => {
      if (!cropMetrics) {
        return nextPosition;
      }

      const maxOffsetX = Math.max(0, (cropMetrics.scaledWidth - frameSize.width) / 2);
      const maxOffsetY = Math.max(0, (cropMetrics.scaledHeight - frameSize.height) / 2);

      return {
        x: clamp(nextPosition.x, -maxOffsetX, maxOffsetX),
        y: clamp(nextPosition.y, -maxOffsetY, maxOffsetY),
      };
    },
    [cropMetrics, frameSize.height, frameSize.width],
  );

  useEffect(() => {
    setPosition((current) => clampPosition(current));
  }, [clampPosition]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      setPosition(
        clampPosition({
          x: dragState.originX + deltaX,
          y: dragState.originY + deltaY,
        }),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === dragState.pointerId) {
        setDragState(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [clampPosition, dragState]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!cropMetrics || imageError || confirming) {
      return;
    }

    event.preventDefault();
    setDragState({
      originX: position.x,
      originY: position.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    });
  };

  async function handleConfirm() {
    if (!sourceUrl || !cropMetrics) {
      return;
    }

    const image = await loadImage(sourceUrl);
    const left = (frameSize.width - cropMetrics.scaledWidth) / 2 + position.x;
    const top = (frameSize.height - cropMetrics.scaledHeight) / 2 + position.y;
    const sourceX = Math.max(0, (0 - left) / cropMetrics.baseScale / zoom);
    const sourceY = Math.max(0, (0 - top) / cropMetrics.baseScale / zoom);
    const sourceWidth = Math.min(
      image.naturalWidth,
      frameSize.width / cropMetrics.baseScale / zoom,
    );
    const sourceHeight = Math.min(
      image.naturalHeight,
      frameSize.height / cropMetrics.baseScale / zoom,
    );

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas unavailable');
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob);
            return;
          }

          reject(new Error('头像裁切失败，请重试。'));
        },
        'image/jpeg',
        0.92,
      );
    });

    await onConfirm({ blob, fileName: ensureJpegFileName(sourceName) });
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="裁切头像"
      onClick={confirming ? undefined : onClose}
    >
      <div
        className="w-full overflow-hidden rounded-t-[32px] border border-neutral-200 bg-[#fcfcfa] text-neutral-900 shadow-2xl sm:max-w-xl sm:rounded-[32px]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
              avatar crop
            </p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">调整头像显示区域</h2>
            <p className="mt-1 text-sm text-neutral-500">拖动和缩放，最终会保存为正方形头像。</p>
          </div>
          <button
            type="button"
            aria-label="关闭头像裁切"
            className={modalCloseButtonClass}
            onClick={confirming ? undefined : onClose}
          >
            <X size={17} strokeWidth={2.6} />
          </button>
        </header>

        <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          <div className="overflow-hidden rounded-[30px] border border-neutral-200 bg-[radial-gradient(circle_at_top,rgba(255,212,0,0.16),transparent_40%),linear-gradient(180deg,#f5f5f4,#e7e5e4)] p-4">
            <div
              ref={frameRef}
              className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-[30px] bg-neutral-900/10"
              onPointerDown={handlePointerDown}
              style={{ touchAction: 'none' }}
            >
              {sourceUrl && cropMetrics ? (
                <img
                  src={sourceUrl}
                  alt="头像裁切预览"
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  draggable={false}
                  style={{
                    height: cropMetrics.scaledHeight,
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                    width: cropMetrics.scaledWidth,
                  }}
                />
              ) : null}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[86%] w-[86%] rounded-full border-2 border-white/90 shadow-[0_0_0_999px_rgba(15,23,42,0.46)]" />
              </div>
            </div>
          </div>

          {imageError ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {imageError}
            </p>
          ) : null}

          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="缩小"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={confirming || zoom <= MIN_ZOOM}
                onClick={() => setZoom((current) => clamp(current - 0.1, MIN_ZOOM, MAX_ZOOM))}
              >
                <Minus size={16} />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                disabled={confirming}
                className="h-2 w-full accent-neutral-900"
              />
              <button
                type="button"
                aria-label="放大"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={confirming || zoom >= MAX_ZOOM}
                onClick={() => setZoom((current) => clamp(current + 0.1, MIN_ZOOM, MAX_ZOOM))}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={confirming} onClick={onClose}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={confirming || Boolean(imageError)}
              onClick={() => void handleConfirm()}
            >
              {confirming ? '保存中…' : '裁切并保存'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ensureJpegFileName(value?: string) {
  const normalized = value?.trim().replace(/\.[^./]+$/, '') || 'avatar';
  return `${normalized}.jpg`;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load error'));
    image.src = src;
  });
}
