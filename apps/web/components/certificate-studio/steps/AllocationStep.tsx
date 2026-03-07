'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { CertificateStudioState } from '@/components/certificate-studio/types';
import type { SaleBatch, SaleAllocation } from '@eggturtle/shared';

interface AllocationStepProps {
  studio: CertificateStudioState;
  setStudio: React.Dispatch<React.SetStateAction<CertificateStudioState>>;
  selectedBatch: SaleBatch | null;
  selectedAllocation: SaleAllocation | null;
  creatingSaleAllocation: boolean;
  onCreateAllocation: () => Promise<void>;
}

export function AllocationStep({ studio, setStudio, selectedBatch, selectedAllocation, creatingSaleAllocation, onCreateAllocation }: AllocationStepProps) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 02</p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">登记成交分配</h3>
          <p className="mt-1 text-sm text-neutral-500">一窝可拆多次成交，每次生成证书都会扣减月配额。</p>
        </div>
        <Badge className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">可用于补发重开</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>历史客户列表</Label>
          <NativeSelect value={studio.selectedAllocationId} onChange={(event) => setStudio((current) => ({ ...current, selectedAllocationId: event.target.value }))} disabled={!selectedBatch}>
            <option value="">请选择或先新增成交分配</option>
            {selectedBatch?.allocations.map((allocation) => (
              <option key={allocation.id} value={allocation.id}>
                {allocation.allocationNo} · {allocation.buyerName} · {allocation.quantity} 只
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>买家名称</Label>
          <Input value={studio.buyerName} onChange={(event) => setStudio((current) => ({ ...current, buyerName: event.target.value }))} placeholder="如：张先生 / 深圳龟友会" />
        </div>
        <div className="space-y-2">
          <Label>联系方式</Label>
          <Input value={studio.buyerContact} onChange={(event) => setStudio((current) => ({ ...current, buyerContact: event.target.value }))} placeholder="手机号 / 备注联系信息" />
        </div>
        <div className="space-y-2">
          <Label>成交数量</Label>
          <Input type="number" min={1} value={studio.allocationQuantity} onChange={(event) => setStudio((current) => ({ ...current, allocationQuantity: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>单价</Label>
          <Input inputMode="decimal" placeholder="如 2680" value={studio.unitPrice} onChange={(event) => setStudio((current) => ({ ...current, unitPrice: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>成交渠道</Label>
          <Input value={studio.channel} onChange={(event) => setStudio((current) => ({ ...current, channel: event.target.value }))} placeholder="朋友圈 / 私聊 / 直播" />
        </div>
        <div className="space-y-2">
          <Label>成交时间</Label>
          <Input type="datetime-local" value={studio.soldAt} onChange={(event) => setStudio((current) => ({ ...current, soldAt: event.target.value }))} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>成交备注</Label>
          <Textarea value={studio.allocationNote} onChange={(event) => setStudio((current) => ({ ...current, allocationNote: event.target.value }))} placeholder="例如：已收定金、是否包邮、是否老客户返单。" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
        <div className="space-y-1 text-sm text-neutral-600">
          <p className="font-semibold text-neutral-900">{selectedAllocation?.allocationNo ?? '尚未绑定历史客户记录'}</p>
          <p>
            买家：{selectedAllocation?.buyerName ?? '待登记'} · 渠道：{selectedAllocation?.channel ?? '待登记'} · 数量：{selectedAllocation?.quantity ?? 0}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void onCreateAllocation()} disabled={!selectedBatch || !studio.buyerName.trim() || creatingSaleAllocation}>
          {creatingSaleAllocation ? '登记中...' : '新增成交分配'}
        </Button>
      </div>
    </div>
  );
}
