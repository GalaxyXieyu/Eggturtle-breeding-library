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

const OUTPUT_HEIGHT = 1000;
const OUTPUT_WIDTH = 1600;
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

type ShareCoverCropDialogProps = {
  confirming?: boolean;
  onClose: () => void;
  onConfirm: (payload: { blob: Blob; fileName: string }) => Promise<void> | void;
  open: boolean;
  sourceName?: string;
  sourceUrl: string | null;
};

export default function ShareCoverCropDialog({
  confirming = false,
  onClose,
  onConfirm,
  open,
  sourceName,
  sourceUrl,
}: ShareCoverCropDialogProps) {
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
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;

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
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob);
            return;
          }

          reject(new Error('封面裁切失败，请重试。'));
        },
        'image/jpeg',
        0.92,
      );
    });

    await onConfirm({ blob, fileName: sourceName || 'share-cover.jpg' });
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="裁切分享封面图"
      onClick={confirming ? undefined : onClose}
    >
      <div
        className="w-full overflow-hidden rounded-t-[32px] border border-neutral-200 bg-[#fcfcfa] text-neutral-900 shadow-2xl sm:max-w-2xl sm:rounded-[32px]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-4 sm:px-5">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-neutral-900">裁切封面图</p>
            <p className="text-sm text-neutral-500">固定比例 16:10。拖拽调整位置，滑动缩放大小。</p>
          </div>
          <button
            type="button"
            aria-label="关闭裁切弹窗"
            className={modalCloseButtonClass}
            disabled={confirming}
            onClick={onClose}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </header>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div
            ref={frameRef}
            className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-[28px] bg-neutral-950 touch-none"
            onPointerDown={handlePointerDown}
          >
            {sourceUrl && cropMetrics && !imageError ? (
              <img
                src={sourceUrl}
                alt="封面裁切预览"
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  height: cropMetrics.baseHeight,
                  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  width: cropMetrics.baseWidth,
                }}
              />
            ) : null}
            {!cropMetrics && !imageError ? (
              <div className="flex h-full items-center justify-center text-sm text-white/70">
                图片加载中...
              </div>
            ) : null}
            {imageError ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/80">
                {imageError}
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-0 border border-white/20" />
            <div className="pointer-events-none absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-35">
              {Array.from({ length: 16 }).map((_, index) => (
                <span key={`crop-grid-${index}`} className="border border-white/15" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-neutral-900">缩放</p>
              <span className="text-xs text-neutral-500">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={confirming || zoom <= MIN_ZOOM}
                onClick={() => setZoom((current) => clamp(current - 0.1, MIN_ZOOM, MAX_ZOOM))}
              >
                <Minus size={16} />
              </Button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                disabled={confirming || !cropMetrics}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-2 w-full accent-neutral-900"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={confirming || zoom >= MAX_ZOOM}
                onClick={() => setZoom((current) => clamp(current + 0.1, MIN_ZOOM, MAX_ZOOM))}
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>
        </div>

        <footer className="border-t border-neutral-200 bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] sm:px-5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={confirming}
              onClick={onClose}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              disabled={confirming || !cropMetrics || Boolean(imageError)}
              onClick={() => void handleConfirm()}
            >
              {confirming ? '保存中...' : '裁切并保存'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败，请重新选择一张图片。'));
    image.src = src;
  });
}
