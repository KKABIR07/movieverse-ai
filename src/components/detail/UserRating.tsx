'use client';

import { useId, useState } from 'react';
import { Lock, Star } from 'lucide-react';
import { useRatingsStore, useUserRating, type MediaType } from '@/store';
import { useStoresHydrated } from '@/store/hydration';
import { cn } from '@/components/ui/cn';

export interface UserRatingProps {
  id: number;
  mediaType: MediaType;
  title: string;
  className?: string;
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Masterpiece'];

/**
 * "Your rating": 5-star radiogroup (native radios → arrow keys work). Stored on this device only
 * (1..10 = stars × 2) and labelled as private.
 */
export function UserRating({ id, mediaType, title, className }: UserRatingProps) {
  const name = useId();
  const hydrated = useStoresHydrated();
  const stored = useUserRating(id, mediaType);
  const stars = hydrated && stored ? Math.ceil(stored / 2) : 0;
  const [hover, setHover] = useState(0);
  const shown = hover || stars;

  const set = (n: number) => useRatingsStore.getState().rate(id, n * 2, mediaType);
  const clear = () => useRatingsStore.getState().clearRating(id, mediaType);

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="flex items-center gap-1.5 text-caption font-medium text-fg">
        Your rating
        <span className="inline-flex items-center gap-1 text-micro font-normal text-fg-muted">
          <Lock className="size-3" aria-hidden /> Private
        </span>
      </legend>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="group relative grid size-9 cursor-pointer place-items-center rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
              onMouseEnter={() => setHover(n)}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={stars === n}
                onChange={() => set(n)}
                className="sr-only"
                aria-label={`${n} of 5 stars, ${LABELS[n]}, for ${title}`}
              />
              <Star
                aria-hidden
                className={cn(
                  'size-6 transition-colors duration-120',
                  n <= shown ? 'fill-accent text-accent' : 'text-fg-muted group-hover:text-fg-secondary',
                )}
              />
            </label>
          ))}
        </div>
        <span className="min-w-20 text-micro text-fg-muted" aria-live="polite">
          {shown ? LABELS[shown] : 'Not rated'}
        </span>
        {stars > 0 && (
          <button type="button" onClick={clear} className="text-micro text-fg-muted underline-offset-2 hover:text-fg hover:underline">
            Clear
          </button>
        )}
      </div>
    </fieldset>
  );
}
