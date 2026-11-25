import { cn } from './cn';

export type SkeletonVariant = 'block' | 'poster' | 'backdrop' | 'text' | 'circle' | 'card';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  /** Legacy: explicit rounded-* class (pre-redesign callers). */
  rounded?: string;
  /** For variant="text": number of lines (default 1). */
  lines?: number;
}

/**
 * Loading placeholder. Always aria-hidden; announce loading on the container
 * (e.g. aria-busy="true") instead.
 * @example <Skeleton variant="poster" />
 * @example <Skeleton variant="text" lines={3} />
 * @example <Skeleton className="h-6 w-40" />
 */
export function Skeleton({ variant = 'block', className, rounded, lines = 1 }: SkeletonProps) {
  if (variant === 'card') return <MediaCardSkeleton className={className} />;
  if (variant === 'text') {
    return (
      <div aria-hidden className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
          <div
            key={i}
            className={cn('skeleton h-3.5 rounded-chip', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
          />
        ))}
      </div>
    );
  }
  const shape: Record<Exclude<SkeletonVariant, 'card' | 'text'>, string> = {
    block: rounded ?? 'rounded-chip',
    poster: 'aspect-[2/3] w-full rounded-card',
    backdrop: 'aspect-video w-full rounded-card',
    circle: 'aspect-square rounded-full',
  };
  return <div aria-hidden className={cn('skeleton', shape[variant], className)} />;
}

/** Poster + two text lines: the MediaCard footprint. */
export function MediaCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-2.5', className)}>
      <div className="skeleton aspect-[2/3] w-full rounded-card" />
      <div className="skeleton h-4 w-4/5 rounded-chip" />
      <div className="skeleton h-3 w-1/2 rounded-chip" />
    </div>
  );
}

/** @deprecated use <MediaCardSkeleton /> or <Skeleton variant="card" />. Kept for pre-redesign pages. */
export function MovieCardSkeleton() {
  return <MediaCardSkeleton />;
}

/** Detail-page placeholder: backdrop + title block. */
export function MovieDetailSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <div className="skeleton h-[60vh] w-full" />
      <div className="px-gutter space-y-4">
        <div className="skeleton h-10 w-2/3 rounded-chip" />
        <div className="skeleton h-6 w-1/3 rounded-chip" />
        <div className="skeleton h-32 w-full rounded-card" />
      </div>
    </div>
  );
}
