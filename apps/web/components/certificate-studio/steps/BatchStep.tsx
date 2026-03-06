'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { CertificateStudioState } from '@/components/certificate-studio/types';
import type { ProductEvent, SaleBatch } from '@eggturtle/shared';
import { formatDateShort } from '@/components/certificate-studio/utils';

interface BatchStepProps {
  studio: CertificateStudioState;
  setStudio: React.Dispatch<React.SetStateAction<CertificateStudioState>>;
  eggEvents: ProductEvent[];
  eggEventOptionLabels: Map<string, string>;
  saleBatches: SaleBatch[];
  selectedBatch: SaleBatch | null;
  creatingSaleBatch: boolean;
  onCreateBatch: () => Promise<void>;
}

export function BatchStep({
  studio,
  setStudio,
  eggEvents,
  eggEventOptionLabels,
  saleBatches,
  selectedBatch,
  creatingSaleBatch,
  onCreateBatch
}: BatchStepProps) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 01</p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">锁定销售批次</h3>
          <p className="mt-1 text-sm text-neutral-500">一张证书必须绑定一个生蛋事件，一个事件可以拆分成多个客户分配。</p>
        </div>
        <Badge className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">父本按事件锁定</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
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
                selectedAllocationId: matchedBatch?.allocations[0]?.id ?? '',
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
        </div>
        <div className="space-y-2">
          <Label>销售批次</Label>
          <NativeSelect
            value={studio.selectedBatchId}
            onChange={(event) => {
              const nextBatch = saleBatches.find((batch) => batch.id === event.target.value) ?? null;
              setStudio((current) => ({
                ...current,
                selectedEggEventId: nextBatch?.eggEventId ?? current.selectedEggEventId,
                selectedBatchId: nextBatch?.id ?? '',
                selectedAllocationId: nextBatch?.allocations[0]?.id ?? '',
                selectedSubjectMediaId: nextBatch?.subjectMedia.find((item) => item.isPrimary)?.id ?? nextBatch?.subjectMedia[0]?.id ?? ''
              }));
            }}
          >
            <option value="">新建或选择批次</option>
            {saleBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batchNo} · 剩余 {batch.remainingQuantity}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label>计划数量</Label>
          <Input type="number" min={1} value={studio.plannedQuantity} onChange={(event) => setStudio((current) => ({ ...current, plannedQuantity: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>价格下限</Label>
          <Input inputMode="decimal" placeholder="如 1999" value={studio.priceLow} onChange={(event) => setStudio((current) => ({ ...current, priceLow: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>价格上限</Label>
          <Input inputMode="decimal" placeholder="如 2888" value={studio.priceHigh} onChange={(event) => setStudio((current) => ({ ...current, priceHigh: event.target.value }))} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>批次备注</Label>
          <Textarea value={studio.batchNote} onChange={(event) => setStudio((current) => ({ ...current, batchNote: event.target.value }))} placeholder="记录这一窝的亮点、留种比例、发朋友圈角度等。" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3">
        <div className="space-y-1 text-sm text-neutral-600">
          <p className="font-semibold text-neutral-900">{selectedBatch?.batchNo ?? '尚未创建批次'}</p>
          <p>
            父本快照：{selectedBatch?.sireCodeSnapshot ?? '未锁定'} · 事件时间：{selectedBatch ? formatDateShort(selectedBatch.eventDateSnapshot) : '待绑定'}
          </p>
        </div>
        <Button variant="primary" onClick={() => void onCreateBatch()} disabled={!studio.selectedEggEventId || creatingSaleBatch}>
          {creatingSaleBatch ? '批次生成中...' : selectedBatch ? '按当前事件同步批次' : '创建销售批次'}
        </Button>
      </div>
    </div>
  );
}
