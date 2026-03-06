'use client';

import { Gem } from 'lucide-react';
import type { GetProductCertificateEligibilityResponse, SaleBatch, SaleSubjectMedia } from '@eggturtle/shared';

interface CertificateStudioCardProps {
  certificateEligibility: GetProductCertificateEligibilityResponse | null;
  selectedBatch: SaleBatch | null;
  selectedSubjectMedia: SaleSubjectMedia | null;
}

export function CertificateStudioCard({ certificateEligibility, selectedBatch, selectedSubjectMedia }: CertificateStudioCardProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-neutral-900 bg-neutral-950 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
      <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(255,212,0,0.2),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.04),_transparent_52%)] px-5 py-5 text-white lg:grid-cols-[1.2fr_0.8fr] lg:px-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">
            <Gem size={14} />
            Certificate Studio
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold leading-tight">成交后发证，批次绑定生蛋事件，主体图独立归档。</h3>
            <p className="max-w-2xl text-sm leading-6 text-white/70">
              先锁定生蛋事件和父本快照，再登记客户分配与成交主体图，最后生成带验真二维码的收藏证书；夫妻照继续作为朋友圈售种物料使用。
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Quota</p>
            <p className="mt-2 text-2xl font-semibold text-white">{certificateEligibility?.quota.remaining ?? 0}</p>
            <p className="text-xs text-white/60">本月剩余 / {certificateEligibility?.quota.limit ?? 100}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Batch</p>
            <p className="mt-2 truncate text-lg font-semibold text-white">{selectedBatch?.batchNo ?? '未选择'}</p>
            <p className="text-xs text-white/60">
              剩余 {selectedBatch?.remainingQuantity ?? 0} / {selectedBatch?.plannedQuantity ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Subject</p>
            <p className="mt-2 text-lg font-semibold text-white">{selectedSubjectMedia ? '已绑定' : '待上传'}</p>
            <p className="text-xs text-white/60">成交主体图 {selectedSubjectMedia ? '可预览' : '将出现在证书中央'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
