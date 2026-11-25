import { formatCount, formatRating } from '@/lib/format';
import { cn } from '@/components/ui/cn';

export interface ScoreRingProps {
  /** TMDB vote_average (0–10). */
  value: number | null | undefined;
  voteCount?: number | null;
  size?: number;
  className?: string;
}

/**
 * Circular TMDB score + vote count. Renders "Not yet rated" instead of a fake 0.
 * The ring is decorative; screen readers get "TMDB rating 8.4 out of 10 from 30K votes".
 */
export function ScoreRing({ value, voteCount, size = 64, className }: ScoreRingProps) {
  const score = formatRating(value, voteCount);
  if (!score) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div
          aria-hidden
          className="grid shrink-0 place-items-center rounded-full border-2 border-dashed border-line-strong text-caption text-fg-muted"
          style={{ width: size, height: size }}
        >
          NR
        </div>
        <div>
          <p className="text-caption font-medium text-fg">Not yet rated</p>
          <p className="text-micro text-fg-muted">TMDB score</p>
        </div>
      </div>
    );
  }
  const pct = Math.min(1, Math.max(0, Number(score) / 10));
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const votes = voteCount ? formatCount(voteCount) : null;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-h3 font-semibold tabular text-fg">{score}</span>
      </div>
      <div>
        <p className="sr-only">
          TMDB rating {score} out of 10{votes ? ` from ${votes} votes` : ''}
        </p>
        <p aria-hidden className="text-caption font-medium text-fg">
          TMDB score
        </p>
        {votes && (
          <p aria-hidden className="text-micro tabular text-fg-muted">
            {votes} votes
          </p>
        )}
      </div>
    </div>
  );
}
