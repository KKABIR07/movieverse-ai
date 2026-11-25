/** Loading layout that mirrors DetailHero + tabs + sidebar (no layout shift when data lands). */
export function DetailSkeleton({ round = false, label = 'Loading details' }: { round?: boolean; label?: string }) {
  return (
    <div aria-busy="true" className="pb-16">
      <span className="sr-only" role="status">
        {label}…
      </span>
      <div aria-hidden className="relative -mt-[var(--header-h)] h-[42vh] min-h-[260px] bg-surface-1 md:h-[58vh] md:min-h-[420px]">
        <div className="absolute inset-0 bg-gradient-to-t from-ground to-transparent" />
      </div>
      <div aria-hidden className="relative -mt-28 flex flex-col gap-6 px-gutter sm:-mt-36 md:-mt-52 md:flex-row md:items-end md:gap-10">
        <div className={`skeleton w-36 shrink-0 sm:w-44 md:w-[260px] ${round ? 'aspect-square rounded-full' : 'aspect-[2/3] rounded-[18px]'}`} />
        <div className="flex-1 space-y-3 md:pb-2">
          <div className="flex gap-2">
            <div className="skeleton h-8 w-20 rounded-full" />
            <div className="skeleton h-8 w-24 rounded-full" />
          </div>
          <div className="skeleton h-12 w-3/4 max-w-xl rounded-chip md:h-16" />
          <div className="skeleton h-5 w-1/2 max-w-md rounded-chip" />
          <div className="skeleton h-4 w-64 max-w-full rounded-chip" />
        </div>
      </div>
      <div aria-hidden className="mt-6 px-gutter">
        <div className="skeleton h-24 w-full rounded-panel md:w-[640px]" />
      </div>
      <div aria-hidden className="mt-10 grid gap-10 px-gutter lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-line pb-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-5 w-16 rounded-chip" />
            ))}
          </div>
          <div className="skeleton h-4 w-full rounded-chip" />
          <div className="skeleton h-4 w-11/12 rounded-chip" />
          <div className="skeleton h-4 w-4/5 rounded-chip" />
          <div className="flex gap-4 pt-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="skeleton size-24 rounded-full" />
                <div className="skeleton h-3 w-16 rounded-chip" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="skeleton h-48 rounded-panel" />
          <div className="skeleton h-64 rounded-panel" />
        </div>
      </div>
    </div>
  );
}
