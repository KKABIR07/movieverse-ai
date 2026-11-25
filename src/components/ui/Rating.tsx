import { Star } from 'lucide-react';
import { formatCount, formatRating } from '@/lib/format';
import { cn } from './cn';

export interface RatingProps {
  /** TMDB vote_average (0–10). */
  value: number | null | undefined;
  /** TMDB vote_count; a 0 score with no votes renders nothing. */
  voteCount?: number | null;
  size?: 'sm' | 'md' | 'lg';
  /** 'chip' = pill with background (for imagery); 'plain' = inline text. */
  variant?: 'chip' | 'plain';
  /** Show "· 12.3K votes" after the score (lg only reads well). */
  showVotes?: boolean;
  className?: string;
}

const sizes = {
  sm: 'text-micro gap-1 [&_svg]:size-3',
  md: 'text-caption gap-1 [&_svg]:size-3.5',
  lg: 'text-body gap-1.5 [&_svg]:size-4',
};

/**
 * TMDB community score. Visual "★ 8.1", announced as "TMDB rating 8.1 out of 10".
 * This is the ONLY score we show; never fabricate RT/Metacritic/IMDb numbers.
 * Renders nothing when there is no score.
 * @example <Rating value={movie.vote_average} voteCount={movie.vote_count} />
 */
export function Rating({ value, voteCount, size = 'md', variant = 'chip', showVotes, className }: RatingProps) {
  const score = formatRating(value, voteCount);
  if (!score) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold tabular leading-none',
        sizes[size],
        variant === 'chip' && 'rounded-full bg-ground/75 backdrop-blur-md border border-white/10 px-2 py-1 text-fg',
        variant === 'plain' && 'text-fg',
        className,
      )}
    >
      <Star aria-hidden className="fill-accent text-accent" />
      <span aria-hidden>{score}</span>
      {showVotes && voteCount ? (
        <span aria-hidden className="font-normal text-fg-muted">
          · {formatCount(voteCount)} votes
        </span>
      ) : null}
      <span className="sr-only">
        TMDB rating {score} out of 10{showVotes && voteCount ? `, ${voteCount} votes` : ''}
      </span>
    </span>
  );
}
