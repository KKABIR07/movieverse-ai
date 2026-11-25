'use client';

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { cn } from '@/components/ui/cn';

export type RailVariant = 'poster' | 'wide' | 'person' | 'top10';

/** Item widths (also used for `sizes`). */
export const RAIL_ITEM_WIDTH: Record<RailVariant, string> = {
  poster: 'clamp(140px, 38vw, 200px)',
  wide: 'clamp(260px, 78vw, 400px)',
  person: 'clamp(104px, 28vw, 136px)',
  top10: 'clamp(210px, 60vw, 280px)',
};

export interface RailProps {
  /** Section title. When given, Rail renders a SectionHeader wired to its arrows. */
  title?: ReactNode;
  /** Accessible name for the list when there is no visible title (or to override it). */
  label?: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** "See all" link. */
  href?: string;
  /** Extra header actions (e.g. a ToggleGroup). */
  actions?: ReactNode;
  variant?: RailVariant;
  /** Override the per-item width (any CSS length / clamp()). */
  itemWidth?: string;
  /** Gap between items in px (default 16). */
  gap?: number;
  /** One child per item. Each is wrapped in an <li>. */
  children: ReactNode;
  /** Show N skeleton slots instead of children. */
  loading?: boolean;
  skeleton?: ReactNode;
  skeletonCount?: number;
  className?: string;
}

/**
 * Horizontal scroll-snap row with edge fades, prev/next buttons (md+), and
 * ←/→ keyboard navigation between items. Bleeds to the viewport edge but snaps
 * items to the page gutter.
 * @example
 * <Rail title="Trending this week" href="/trending">
 *   {movies.map((m) => <MediaCard key={m.id} item={m} sizes={POSTER_SIZES.rail} />)}
 * </Rail>
 */
export function Rail({
  title,
  label,
  eyebrow,
  description,
  href,
  actions,
  variant = 'poster',
  itemWidth,
  gap = 16,
  children,
  loading = false,
  skeleton,
  skeletonCount = 8,
  className,
}: RailProps) {
  const scroller = useRef<HTMLUListElement>(null);
  const headingId = useId();
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const frame = requestAnimationFrame(measure);
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure, loading]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const items = Array.from(scroller.current?.children ?? []) as HTMLElement[];
    const idx = items.findIndex((li) => li.contains(document.activeElement));
    if (idx === -1) return;
    const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
    const target = items[nextIdx]?.querySelector<HTMLElement>('a[href],button:not([disabled])');
    if (!target) return;
    e.preventDefault();
    target.focus({ preventScroll: true });
    items[nextIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const width = itemWidth ?? RAIL_ITEM_WIDTH[variant];
  const items = loading
    ? Array.from({ length: skeletonCount }, (_, i) => <div key={`sk-${i}`}>{skeleton}</div>)
    : Children.toArray(children).filter(isValidElement);

  const fadeStart = edges.start ? '0px' : '48px';
  const fadeEnd = edges.end ? '0px' : '48px';

  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : label}
      aria-busy={loading || undefined}
      className={cn('relative', className)}
    >
      {title && (
        <div className="px-gutter">
          <SectionHeader
            id={headingId}
            title={title}
            eyebrow={eyebrow}
            description={description}
            href={href}
            actions={actions}
            onPrev={() => page(-1)}
            onNext={() => page(1)}
            canPrev={!edges.start}
            canNext={!edges.end}
          />
        </div>
      )}
      <ul
        ref={scroller}
        onKeyDown={onKeyDown}
        aria-label={title ? undefined : label}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain px-gutter scroll-px-[var(--gutter)] pb-2 pt-1"
        style={{
          gap,
          maskImage: `linear-gradient(to right, transparent 0, #000 ${fadeStart}, #000 calc(100% - ${fadeEnd}), transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to right, transparent 0, #000 ${fadeStart}, #000 calc(100% - ${fadeEnd}), transparent 100%)`,
        }}
      >
        {items.map((child, i) => (
          <li
            key={(isValidElement(child) && child.key) || i}
            className="shrink-0 snap-start"
            style={{ width }}
          >
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
