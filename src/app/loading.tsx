import { MediaCardSkeleton } from '@/components/ui/Skeleton';

/** Route-level fallback while a segment streams in. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="px-gutter pt-8 md:pt-12">
      <div aria-hidden className="skeleton h-9 w-56 rounded-chip" />
      <div aria-hidden className="skeleton mt-3 h-4 w-80 max-w-full rounded-chip" />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  );
}
