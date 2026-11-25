import Link from 'next/link';
import type { ReactNode } from 'react';
import { chipClass } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';

export interface FilterLinkOption {
  value: string;
  label: ReactNode;
  href: string;
}

export interface FilterLinksProps {
  /** Accessible name for the group, e.g. "Content type". */
  label: string;
  options: readonly FilterLinkOption[];
  value: string;
  size?: 'sm' | 'md';
  /** Keep the scroll position (in-page toggles such as the home rail). */
  keepScroll?: boolean;
  /** Scroll horizontally when the options overflow (default true). */
  scrollable?: boolean;
  className?: string;
}

/**
 * URL-driven toggle row: each option is a crawlable link (works without JS); the active one has
 * aria-current="page". Server-component safe.
 * @example <FilterLinks label="Type" value={type} options={[{ value: 'movie', label: 'Movies', href: '/top-rated' }]} />
 */
export function FilterLinks({ label, options, value, size = 'md', keepScroll = false, scrollable = true, className }: FilterLinksProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex gap-2', scrollable ? 'no-scrollbar -mx-1 overflow-x-auto px-1 py-1' : 'flex-wrap', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Link
            key={o.value}
            href={o.href}
            scroll={keepScroll ? false : undefined}
            aria-current={selected ? 'page' : undefined}
            // the pseudo-element grows the hit area to ≥44px without changing the chip's look
            className={cn(
              chipClass(selected, size),
              "relative before:absolute before:inset-x-0 before:content-['']",
              size === 'sm' ? 'before:-inset-y-1.5' : 'before:-inset-y-1',
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
