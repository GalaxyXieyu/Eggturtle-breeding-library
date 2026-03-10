interface CertificatePosterPlaceholderProps {
  breederCode?: string;
  mateCode?: string | null;
}

export function CertificatePosterPlaceholder({
  breederCode,
  mateCode
}: CertificatePosterPlaceholderProps) {
  return (
    <div className="relative aspect-[0.78] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,224,140,0.36),_transparent_36%),linear-gradient(180deg,_#f6f0df_0%,_#ede2c8_100%)] p-4 sm:p-5">
      <div className="absolute inset-4 rounded-[28px] border border-black/10 bg-white/80 shadow-[0_18px_38px_rgba(95,69,14,0.14)]" />
      <div className="relative z-10 flex h-full flex-col justify-between rounded-[24px] border border-black/6 bg-white/88 p-5 backdrop-blur-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-500">Breeding Traceability Record</p>
          <h4 className="mt-4 text-3xl font-semibold text-neutral-900">待生成证书</h4>
          <p className="mt-3 text-sm leading-6 text-neutral-500">卖出时再补买家、生蛋事件和成交主体图，卡面会保持像收藏证书一样的层级感。</p>
        </div>
        <div className="rounded-[20px] border border-dashed border-neutral-300 bg-neutral-50/90 p-4 text-sm text-neutral-600">
          <p className="font-semibold text-neutral-900">{breederCode ?? '母龟'}{mateCode ? ` × ${mateCode}` : ''}</p>
          <p className="mt-1">生成后会写入验真二维码、父母本快照与成交主体图。</p>
        </div>
      </div>
    </div>
  );
}
