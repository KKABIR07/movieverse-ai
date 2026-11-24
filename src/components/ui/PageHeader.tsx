import type { ReactNode } from 'react';
import { cn } from './cn';

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions (buttons). */
  actions?: ReactNode;
  /** Row under the title, e.g. filters or tabs. */
  children?: ReactNode;
  /** Use the 72px display size instead of h1. */
  display?: boolean;
  className?: string;
}

/**
 * Top of a non-hero page. Renders the page's single <h1>.
 * The root layout already pads <main> by the header height; this adds the page rhythm.
 * @example <PageHeader eyebrow="Browse" title="Movies" description="Every film on TMDB." actions={<Button>Shuffle</Button>} />
 */
export function PageHeader({ title, eyebrow, description, actions, children, display, className }: PageHeaderProps) {
  return (
    <header className={cn('px-gutter pt-8 pb-6 md:pt-12 md:pb-8', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && (
            <p className="text-micro font-medium uppercase tracking-[0.08em] text-accent mb-2">{eyebrow}</p>
          )}
          <h1 className={cn(display ? 'text-display' : 'text-h1', 'text-fg text-balance')}>{title}</h1>
          {description && <p className="text-body-lg text-fg-secondary mt-3 max-w-2xl text-pretty">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}
