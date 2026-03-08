'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { CertificateStudioState } from '@/components/certificate-studio/types';
import type { SaleBatch, SaleSubjectMedia } from '@eggturtle/shared';
import { formatDateShort } from '@/components/certificate-studio/utils';
import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';

interface SubjectMediaStepProps {
  studio: CertificateStudioState;
  setStudio: React.Dispatch<React.SetStateAction<CertificateStudioState>>;
  selectedBatch: SaleBatch | null;
  selectedSubjectMedia: SaleSubjectMedia | null;
  uploadingSubjectMedia: boolean;
  onUploadMedia: () => Promise<void>;
}

export function SubjectMediaStep({ studio, setStudio, selectedBatch, selectedSubjectMedia, uploadingSubjectMedia, onUploadMedia }: SubjectMediaStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 03</p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">上传成交主体图</h3>
          <p className="mt-1 text-sm text-neutral-500">先选已有主图或上传新图；命名和默认主图设置改为按需展开。</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
          <Camera size={14} />
          商家水印
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>主体图记录</Label>
          <NativeSelect value={studio.selectedSubjectMediaId} onChange={(event) => setStudio((current) => ({ ...current, selectedSubjectMediaId: event.target.value }))} disabled={!selectedBatch}>
            <option value="">请选择或先上传主体图</option>
            {selectedBatch?.subjectMedia.map((media) => (
              <option key={media.id} value={media.id}>
                {media.label ?? '未命名主体图'}
                {media.isPrimary ? ' · 主图' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>上传新图</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setStudio((current) => ({ ...current, subjectFile: nextFile }));
            }}
          />
        </div>
      </div>

      <button
        type="button"
        data-ui="button"
        className="mt-4 inline-flex min-h-0 items-center bg-transparent p-0 text-sm font-medium text-neutral-600 underline-offset-4 transition hover:bg-transparent hover:text-neutral-900 hover:underline"
        onClick={() => setShowAdvanced((current) => !current)}
      >
        {showAdvanced ? '收起图片设置' : '补充图片标签和默认主图'}
      </button>

      {showAdvanced ? (
        <div className="mt-3 grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>图片标签</Label>
            <Input value={studio.subjectLabel} onChange={(event) => setStudio((current) => ({ ...current, subjectLabel: event.target.value }))} placeholder="如：3月成交主体 / 腹甲特写" />
          </div>
          <div className="flex items-end rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
            <label className="inline-flex items-center gap-2 font-medium text-neutral-700">
              <input type="checkbox" checked={studio.subjectIsPrimary} onChange={(event) => setStudio((current) => ({ ...current, subjectIsPrimary: event.target.checked }))} />
              设为该批次默认主体图
            </label>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-end">
        <Button variant="secondary" onClick={() => void onUploadMedia()} disabled={!studio.selectedEggEventId || !studio.subjectFile || uploadingSubjectMedia}>
          {uploadingSubjectMedia ? '上传中...' : '上传主体图'}
        </Button>
      </div>
      {selectedSubjectMedia ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
          <img src={resolveAuthenticatedAssetUrl(selectedSubjectMedia.contentPath)} alt={selectedSubjectMedia.label ?? '主体图'} className="h-52 w-full object-cover" />
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-600">
            <div>
              <p className="font-semibold text-neutral-900">{selectedSubjectMedia.label ?? '成交主体图'}</p>
              <p>
                {selectedSubjectMedia.isPrimary ? '当前默认图' : '备用主体图'} · {formatDateShort(selectedSubjectMedia.createdAt)}
              </p>
            </div>
            <Badge className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow-sm">{selectedSubjectMedia.sizeBytes} bytes</Badge>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-neutral-500">上传一张专门拍摄的成交主体图，证书会更有“电子发票 + 藏品凭证”的质感。</p>
      )}
    </div>
  );
}
