'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { CertificateStudioState } from '@/components/certificate-studio/types';
import type { ProductEvent, SaleBatch, SaleSubjectMedia } from '@eggturtle/shared';
import { formatDateShort } from '@/components/certificate-studio/utils';
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone';
import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';

interface BatchStepProps {
  studio: CertificateStudioState;
  setStudio: React.Dispatch<React.SetStateAction<CertificateStudioState>>;
  eggEvents: ProductEvent[];
  eggEventOptionLabels: Map<string, string>;
  saleBatches: SaleBatch[];
  selectedBatch: SaleBatch | null;
  selectedSubjectMedia: SaleSubjectMedia | null;
  uploadingSubjectMedia: boolean;
  onUploadMedia: () => Promise<void>;
}

export function BatchStep({
  studio,
  setStudio,
  eggEvents,
  eggEventOptionLabels,
  saleBatches,
  selectedBatch,
  selectedSubjectMedia,
  uploadingSubjectMedia,
  onUploadMedia
}: BatchStepProps) {
  const batchHint = selectedBatch
    ? `已绑定批次 ${selectedBatch.batchNo}`
    : studio.selectedEggEventId
      ? '上传主题图时自动创建并绑定批次'
      : '请先选择生蛋事件';

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-neutral-500">第 1 步 · 批次</p>
        <p className="text-sm text-neutral-600">选择事件并上传主题图，系统自动复用该事件批次。</p>
      </div>

      <div className="space-y-2">
        <Label>生蛋事件</Label>
        <NativeSelect
          value={studio.selectedEggEventId}
          onChange={(event) => {
            const nextEggEventId = event.target.value;
            const matchedBatch = saleBatches.find((batch) => batch.eggEventId === nextEggEventId) ?? null;
            setStudio((current) => ({
              ...current,
              selectedEggEventId: nextEggEventId,
              selectedBatchId: matchedBatch?.id ?? '',
              selectedAllocationId: '',
              selectedSubjectMediaId: matchedBatch?.subjectMedia.find((item) => item.isPrimary)?.id ?? matchedBatch?.subjectMedia[0]?.id ?? ''
            }));
          }}
        >
          <option value="">请选择生蛋事件</option>
          {eggEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {eggEventOptionLabels.get(event.id) ?? `${formatDateShort(event.eventDate)} · 数量 ${event.eggCount ?? '-'}`}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-neutral-500">{batchHint}</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>主题图</Label>
          <NativeSelect
            value={studio.selectedSubjectMediaId}
            onChange={(event) => setStudio((current) => ({ ...current, selectedSubjectMediaId: event.target.value }))}
            disabled={!selectedBatch}
          >
            <option value="">{selectedBatch ? '选择已上传主题图' : '先选事件并上传主题图'}</option>
            {selectedBatch?.subjectMedia.map((media) => (
              <option key={media.id} value={media.id}>
                {media.label ?? '未命名主体图'}
                {media.isPrimary ? ' · 主图' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <ImageUploadDropzone
            inputId="certificate-subject-upload"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setStudio((current) => ({ ...current, subjectFile: nextFile }));
              event.target.value = '';
            }}
            actionText={studio.subjectFile ? '重新选择图片' : '选择图片'}
            title={studio.subjectFile ? `已选择：${studio.subjectFile.name}` : '点击选择主题图文件'}
            description="建议上传清晰近景图，证书展示效果更好。"
            helperText={studio.selectedEggEventId ? '上传后将自动绑定当前事件批次。' : '先选择生蛋事件再上传。'}
            disabled={!studio.selectedEggEventId || uploadingSubjectMedia}
          />
          <Button
            variant="secondary"
            onClick={() => void onUploadMedia()}
            disabled={!studio.selectedEggEventId || !studio.subjectFile || uploadingSubjectMedia}
            className="justify-self-end"
          >
            {uploadingSubjectMedia ? '上传中...' : '上传主题图'}
          </Button>
        </div>

        {selectedSubjectMedia ? (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <img src={resolveAuthenticatedAssetUrl(selectedSubjectMedia.contentPath)} alt={selectedSubjectMedia.label ?? '主题图'} className="h-40 w-full object-cover" />
            <div className="px-3 py-2 text-xs text-neutral-600">
              {selectedSubjectMedia.label ?? '成交主体图'} · {selectedSubjectMedia.isPrimary ? '当前主图' : '备用图'}
            </div>
          </div>
        ) : null}

        {selectedBatch ? (
          <p className="text-xs text-neutral-500">
            父本快照 {selectedBatch.sireCodeSnapshot} · 事件日期 {formatDateShort(selectedBatch.eventDateSnapshot)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
