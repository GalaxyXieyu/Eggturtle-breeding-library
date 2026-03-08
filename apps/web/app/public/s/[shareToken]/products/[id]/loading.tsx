export default function PublicShareDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 px-3 pb-24 pt-3">
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <div className="h-[60vh] animate-pulse rounded-3xl bg-neutral-300/75" />
        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="h-6 w-2/5 animate-pulse rounded bg-neutral-200" />
          <div className="mt-3 h-4 w-3/5 animate-pulse rounded bg-neutral-100" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
          <div className="mt-5 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`detail-loading-pill-${index}`} className="h-8 animate-pulse rounded-full bg-neutral-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
