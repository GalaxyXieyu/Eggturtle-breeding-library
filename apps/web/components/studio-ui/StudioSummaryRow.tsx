interface StudioSummaryRowProps {
  label: string;
  value: string;
  subdued?: string;
}

export function StudioSummaryRow({ label, value, subdued }: StudioSummaryRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-neutral-500">{label}</span>
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-semibold text-neutral-900">{value}</p>
        {subdued ? <p className="mt-0.5 text-[11px] text-neutral-500">{subdued}</p> : null}
      </div>
    </div>
  );
}
