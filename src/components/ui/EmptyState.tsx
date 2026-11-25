import type { ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';

export interface EmptyStateProps {
  /** Lucide icon element, e.g. <Bookmark />. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a <Button>. */
  action?: ReactNode;
  /** Tighter padding for use inside rails/panels. */
  compact?: boolean;
  className?: string;
}

/**
 * Nothing-here state with a next step.
 * @example <EmptyState icon={<Bookmark />} title="Your watchlist is empty" description="Save titles to watch later." action={<Button href="/discover">Find something</Button>} />
 */
export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-panel border border-dashed border-line',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-16',
        className,
      )}
    >
      {icon && (
        <div aria-hidden className="mb-1 grid size-12 place-items-center rounded-full bg-surface-2 text-fg-muted [&_svg]:size-6">
          {icon}
        </div>
      )}
      <p className="text-h3 text-fg">{title}</p>
      {description && <p className="max-w-sm text-body text-fg-muted text-pretty">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Shows a "Try again" button. */
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Failed-to-load state. Announced via role="alert".
 * @example <ErrorState description="We couldn't reach TMDB." onRetry={() => refetch()} />
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  compact,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-panel border border-line bg-surface-1',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-16',
        className,
      )}
    >
      <div aria-hidden className="mb-1 grid size-12 place-items-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <p className="text-h3 text-fg">{title}</p>
      {description && <p className="max-w-sm text-body text-fg-muted text-pretty">{description}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} leadingIcon={<RotateCcw />} className="mt-2">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
