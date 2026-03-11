'use client';

import { Button } from '@/components/ui/button';
import type { ProductCouplePhoto } from '@eggturtle/shared';
import { formatDateShort } from '@/components/certificate-studio/utils';
import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';

interface CouplePhotoSectionProps {
  isFemaleBreeder: boolean;
  currentCouplePhoto: ProductCouplePhoto | null;
  couplePhotoHistory: ProductCouplePhoto[];
  generatingCouplePhoto: boolean;
  onGenerate: () => Promise<void>;
}

export function CouplePhotoSection({ isFemaleBreeder, currentCouplePhoto, couplePhotoHistory, generatingCouplePhoto, onGenerate }: CouplePhotoSectionProps) {
  // Add cache-bust parameter to force browser reload on new generation
  const buildCouplePhotoUrl = (contentPath: string, generatedAt: string) => {
    const timestamp = new Date(generatedAt).getTime();
    const pathWithCacheBust = `${contentPath}${contentPath.includes('?') ? '&' : '?'}t=${timestamp}`;
    return resolveAuthenticatedAssetUrl(pathWithCacheBust);
  };

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">母龟夫妻照</h3>
          <p className="mt-1 text-sm text-neutral-500">手动生成，用于朋友圈广告和售种前预热。</p>
        </div>
        <Button variant="primary" disabled={!isFemaleBreeder || generatingCouplePhoto} onClick={() => void onGenerate()}>
          {generatingCouplePhoto ? '生成中...' : '生成夫妻照'}
        </Button>
      </div>
      {!isFemaleBreeder ? <p className="mt-3 text-xs text-neutral-500">仅母龟可以生成夫妻照。</p> : null}
      {currentCouplePhoto ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
          <img src={buildCouplePhotoUrl(currentCouplePhoto.contentPath, currentCouplePhoto.generatedAt)} alt="当前夫妻照" className="h-64 w-full object-cover" />
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-neutral-600">
            <p className="font-semibold text-neutral-900">
              {currentCouplePhoto.femaleCodeSnapshot} × {currentCouplePhoto.maleCodeSnapshot}
            </p>
            <p>{formatDateShort(currentCouplePhoto.generatedAt)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">暂无当前夫妻照。</p>
      )}
      {couplePhotoHistory.length > 0 ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {couplePhotoHistory.slice(0, 6).map((photo) => (
            <div key={photo.id} className="space-y-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-2">
              <img src={buildCouplePhotoUrl(photo.contentPath, photo.generatedAt)} alt={`${photo.femaleCodeSnapshot}-${photo.maleCodeSnapshot}`} className="h-20 w-full rounded-xl object-cover" />
              <p className="truncate text-[11px] font-semibold text-neutral-800">
                {photo.femaleCodeSnapshot} × {photo.maleCodeSnapshot}
              </p>
              <p className="text-[10px] text-neutral-500">{formatDateShort(photo.generatedAt)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
