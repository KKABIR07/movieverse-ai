import { MovieCard } from './MovieCard';
import { MovieCardSkeleton } from '@/components/ui/Skeleton';
import type { Movie, TVShow } from '@/types/tmdb';

interface MovieGridProps {
  items: (Movie | TVShow)[];
  mediaType?: 'movie' | 'tv';
  loading?: boolean;
  skeletonCount?: number;
  cols?: string;
}

export function MovieGrid({
  items,
  mediaType = 'movie',
  loading = false,
  skeletonCount = 20,
  cols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
}: MovieGridProps) {
  if (loading) {
    return (
      <div className={`grid ${cols} gap-4`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <MovieCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
        <p className="text-lg font-medium">No results found</p>
        <p className="text-sm mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className={`grid ${cols} gap-4`}>
      {items.map((item) => (
        <MovieCard key={item.id} item={item} mediaType={mediaType} />
      ))}
    </div>
  );
}
