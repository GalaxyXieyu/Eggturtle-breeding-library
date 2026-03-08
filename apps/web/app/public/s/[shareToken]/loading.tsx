export default function PublicShareFeedLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 px-2 pb-24 pt-3">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-3 h-[240px] animate-pulse rounded-2xl bg-neutral-300/70 lg:h-[320px]" />
        <div className="mb-3 h-24 animate-pulse rounded-2xl bg-neutral-200/85" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`feed-loading-card-${index}`} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <div className="aspect-square animate-pulse bg-neutral-200/90" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
