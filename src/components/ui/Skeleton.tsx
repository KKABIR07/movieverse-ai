interface SkeletonProps {
  className?: string;
  rounded?: string;
}

export function Skeleton({ className = '', rounded = 'rounded-lg' }: SkeletonProps) {
  return <div className={`skeleton ${rounded} ${className}`} aria-hidden="true" />;
}

export function MovieCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[2/3] w-full" rounded="rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function MovieDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <Skeleton className="h-[60vh] w-full" rounded="rounded-none" />
      <div className="container mx-auto px-4 space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
