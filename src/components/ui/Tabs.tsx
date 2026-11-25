'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  /** Panel content. Omit when you render the content yourself (then pass `panels={false}`). */
  panel?: ReactNode;
  disabled?: boolean;
  /** Optional count shown after the label. */
  count?: number;
}

export interface TabsProps<T extends string = string> {
  /** Accessible name for the tablist, e.g. "Movie sections". */
  label: string;
  items: readonly TabItem<T>[];
  /** Controlled value. */
  value?: T;
  /** Uncontrolled initial value (defaults to the first enabled tab). */
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** Render tabpanels from `items[].panel` (default true). */
  panels?: boolean;
  /** 'underline' (default) or 'pill'. */
  appearance?: 'underline' | 'pill';
  className?: string;
  panelClassName?: string;
}

/**
 * WAI-ARIA tabs: roving tabindex, ←/→/Home/End move + activate, aria-selected, panels linked by id.
 * @example
 * <Tabs label="Details" items={[{ id: 'cast', label: 'Cast', panel: <Cast /> }, { id: 'reviews', label: 'Reviews', panel: <Reviews /> }]} />
 */
export function Tabs<T extends string = string>({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  panels = true,
  appearance = 'underline',
  className,
  panelClassName,
}: TabsProps<T>) {
  const baseId = useId();
  const firstEnabled = items.find((i) => !i.disabled)?.id;
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? firstEnabled);
  const active = value ?? inner ?? firstEnabled;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: T) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.id === active);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    if (next === null) return;
    e.preventDefault();
    const id = enabled[next].id;
    select(id);
    refs.current[id]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn(
          'flex gap-1 overflow-x-auto no-scrollbar',
          appearance === 'underline' ? 'border-b border-line' : 'rounded-full bg-surface-1 border border-line p-1 w-fit max-w-full',
        )}
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[item.id] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={panels ? `${baseId}-panel-${item.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-1.5 px-4 text-caption font-medium whitespace-nowrap transition-colors',
                'disabled:opacity-40 disabled:pointer-events-none',
                appearance === 'underline'
                  ? cn(
                      'h-11 -mb-px border-b-2',
                      selected ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                    )
                  : cn('h-9 rounded-full', selected ? 'bg-fg text-ground' : 'text-fg-muted hover:text-fg'),
              )}
            >
              {item.label}
              {item.count != null && <span className="tabular text-micro opacity-70">{item.count}</span>}
            </button>
          );
        })}
      </div>
      {panels &&
        items.map((item) =>
          item.panel === undefined ? null : (
            <div
              key={item.id}
              role="tabpanel"
              id={`${baseId}-panel-${item.id}`}
              aria-labelledby={`${baseId}-tab-${item.id}`}
              hidden={item.id !== active}
              tabIndex={0}
              className={cn('pt-6 outline-none', panelClassName)}
            >
              {item.id === active ? item.panel : null}
            </div>
          ),
        )}
    </div>
  );
}
