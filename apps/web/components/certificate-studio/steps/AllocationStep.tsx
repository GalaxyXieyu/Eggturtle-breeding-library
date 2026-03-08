'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CertificateStudioState } from '@/components/certificate-studio/types';
import type { SaleBatch } from '@eggturtle/shared';

interface AllocationStepProps {
  studio: CertificateStudioState;
  setStudio: React.Dispatch<React.SetStateAction<CertificateStudioState>>;
  selectedBatch: SaleBatch | null;
}

export function AllocationStep({ studio, setStudio, selectedBatch }: AllocationStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 02</p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">填写客户信息</h3>
          <p className="mt-1 text-sm text-neutral-500">只需填写买家名称；成交记录会在生成正式证书时自动创建。</p>
        </div>
        <Badge className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">买家名必填</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>买家名称</Label>
          <Input value={studio.buyerName} onChange={(event) => setStudio((current) => ({ ...current, buyerName: event.target.value }))} placeholder="如：张先生 / 深圳龟友会" />
        </div>
        <div className="space-y-2">
          <Label>成交数量</Label>
          <Input type="number" min={1} value={studio.allocationQuantity} onChange={(event) => setStudio((current) => ({ ...current, allocationQuantity: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>单价</Label>
          <Input inputMode="decimal" placeholder="如 2680" value={studio.unitPrice} onChange={(event) => setStudio((current) => ({ ...current, unitPrice: event.target.value }))} />
        </div>
      </div>

      <button
        type="button"
        data-ui="button"
        className="mt-4 inline-flex min-h-0 items-center bg-transparent p-0 text-sm font-medium text-neutral-600 underline-offset-4 transition hover:bg-transparent hover:text-neutral-900 hover:underline"
        onClick={() => setShowAdvanced((current) => !current)}
      >
        {showAdvanced ? '收起低频信息' : '补充联系方式 / 渠道 / 备注'}
      </button>

      {showAdvanced ? (
        <div className="mt-3 grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>联系方式</Label>
            <Input value={studio.buyerContact} onChange={(event) => setStudio((current) => ({ ...current, buyerContact: event.target.value }))} placeholder="手机号 / 备注联系信息" />
          </div>
          <div className="space-y-2">
            <Label>成交渠道</Label>
            <Input value={studio.channel} onChange={(event) => setStudio((current) => ({ ...current, channel: event.target.value }))} placeholder="朋友圈 / 私聊 / 直播" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>成交时间</Label>
            <Input type="datetime-local" value={studio.soldAt} onChange={(event) => setStudio((current) => ({ ...current, soldAt: event.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>成交备注</Label>
            <Textarea value={studio.allocationNote} onChange={(event) => setStudio((current) => ({ ...current, allocationNote: event.target.value }))} placeholder="例如：已收定金、是否包邮、是否老客户返单。" />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
        <div className="space-y-1 text-sm text-neutral-600">
          <p className="font-semibold text-neutral-900">成交记录将自动创建</p>
          <p>
            {selectedBatch
              ? `证书确认时会写入批次 ${selectedBatch.batchNo}，默认数量 ${Number(studio.allocationQuantity) || 1}。`
              : '请先在第 1 步选择生蛋事件并上传主体图。'}
          </p>
        </div>
      </div>
    </div>
  );
}
