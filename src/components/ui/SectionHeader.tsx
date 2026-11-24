import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './cn';

export interface SectionHeaderProps {
  title: ReactNode;
  /** Id for the heading, so a section can use aria-labelledby. */
  id?: string;
  /** Heading level; default h2. */
  as?: 'h2' | 'h3';
  /** Small label above the title, e.g. "This week". */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** "See all" destination. */
  href?: string;
  seeAllLabel?: string;
  /** Prev/next controls (e.g. wired to a Rail). Hidden below md, where users swipe. */
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  /** Extra controls on the right (e.g. a ToggleGroup). */
  actions?: ReactNode;
  className?: string;
}

/**
 * @example <SectionHeader title="Trending now" href="/trending" />
 * @example <SectionHeader id="top10" title="Top 10 this week" onPrev={rail.prev} onNext={rail.next} canPrev={rail.canPrev} canNext={rail.canNext} />
 */
export function SectionHeader({
  title,
  id,
  as: Heading = 'h2',
  eyebrow,
  description,
  href,
  seeAllLabel = 'See all',
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  actions,
  className,
}: SectionHeaderProps) {
  const hasArrows = !!(onPrev || onNext);
  return (
    <div className={cn('flex items-end justify-between gap-4 mb-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-micro font-medium uppercase tracking-[0.08em] text-fg-muted mb-1">{eyebrow}</p>}
        <Heading id={id} className={cn(Heading === 'h2' ? 'text-h2' : 'text-h3', 'text-fg truncate')}>
          {title}
        </Heading>
        {description && <p className="text-caption text-fg-muted mt-1">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        {href && (
          <Link
            href={href}
            className="group inline-flex h-11 items-center gap-1 rounded-control px-3 text-caption font-medium text-fg-secondary hover:text-fg hover:bg-surface-2 transition-colors"
          >
            {seeAllLabel}
            <span className="sr-only">: {typeof title === 'string' ? title : 'section'}</span>
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
        {hasArrows && (
          <div className="hidden md:flex items-center gap-1 ml-1">
            <IconButton size="sm" variant="secondary" label="Scroll left" icon={<ChevronLeft />} onClick={onPrev} disabled={!canPrev} />
            <IconButton size="sm" variant="secondary" label="Scroll right" icon={<ChevronRight />} onClick={onNext} disabled={!canNext} />
          </div>
        )}
      </div>
    </div>
  );
}
