import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type ChipSize = 'sm' | 'md';

export function chipClass(selected = false, size: ChipSize = 'md', className?: string) {
  return cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
    'transition-colors duration-120 ease-projector select-none',
    size === 'sm' ? 'h-8 px-3 text-caption [&_svg]:size-3.5' : 'h-10 px-4 text-caption [&_svg]:size-4',
    selected
      ? 'bg-fg text-ground border-fg'
      : 'bg-surface-1 text-fg-secondary border-line hover:text-fg hover:border-line-strong hover:bg-surface-2',
    className,
  );
}

interface ChipBase {
  selected?: boolean;
  size?: ChipSize;
  icon?: ReactNode;
  /** Optional trailing count, e.g. "Action 24". */
  count?: number;
  className?: string;
  children: ReactNode;
}

export type ChipProps =
  | (ChipBase & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & { href?: undefined })
  | (ChipBase & { href: string; onClick?: () => void; 'aria-current'?: 'page' | boolean });

/**
 * Filter / tag pill. As a button it is a toggle (aria-pressed = selected).
 * As a link (href) it uses aria-current when selected.
 * @example <Chip selected={genre === 28} onClick={() => setGenre(28)}>Action</Chip>
 * @example <Chip href="/genre/28">Action</Chip>
 */
export function Chip(props: ChipProps) {
  const { selected = false, size = 'md', icon, count, className, children } = props;
  const inner = (
    <>
      {icon}
      <span>{children}</span>
      {count != null && <span className="tabular text-micro font-normal">{count}</span>}
    </>
  );
  if (typeof props.href === 'string') {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        aria-current={selected ? 'page' : props['aria-current']}
        className={chipClass(selected, size, className)}
      >
        {inner}
      </Link>
    );
  }
  const { selected: _s, size: _z, icon: _i, count: _c, className: _cl, children: _ch, href: _h, type = 'button', ...rest } =
    props;
  void _s; void _z; void _i; void _c; void _cl; void _ch; void _h;
  return (
    <button type={type} aria-pressed={selected} className={chipClass(selected, size, className)} {...rest}>
      {inner}
    </button>
  );
}

export interface ToggleOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface ToggleGroupBase<T extends string | number> {
  /** Accessible name for the group, e.g. "Content type". */
  label: string;
  options: readonly ToggleOption<T>[];
  size?: ChipSize;
  /** Wrap onto multiple lines (default) or scroll horizontally. */
  layout?: 'wrap' | 'scroll';
  className?: string;
}

export type ToggleGroupProps<T extends string | number> = ToggleGroupBase<T> &
  (
    | { type?: 'single'; value: T | null; onChange: (value: T) => void; /** Allow clicking the active option to clear. */ allowDeselect?: false }
    | { type?: 'single'; value: T | null; onChange: (value: T | null) => void; allowDeselect: true }
    | { type: 'multiple'; value: readonly T[]; onChange: (value: T[]) => void; allowDeselect?: never }
  );

/**
 * A row of toggle chips (each `aria-pressed`). Single or multiple selection.
 * @example <ToggleGroup label="Type" options={[{value:'movie',label:'Movies'},{value:'tv',label:'TV'}]} value={type} onChange={setType} />
 * @example <ToggleGroup type="multiple" label="Genres" options={genreOptions} value={genres} onChange={setGenres} />
 */
export function ToggleGroup<T extends string | number>(props: ToggleGroupProps<T>) {
  const { label, options, size = 'md', layout = 'wrap', className } = props;

  const isSelected = (v: T) =>
    props.type === 'multiple' ? props.value.includes(v) : props.value === v;

  const handle = (v: T) => {
    if (props.type === 'multiple') {
      const cur = props.value;
      props.onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
    } else if (props.allowDeselect) {
      props.onChange(props.value === v ? null : v);
    } else {
      props.onChange(v);
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex gap-2',
        layout === 'wrap' ? 'flex-wrap' : 'overflow-x-auto no-scrollbar -mx-1 px-1 py-1',
        className,
      )}
    >
      {options.map((o) => (
        <Chip
          key={String(o.value)}
          size={size}
          icon={o.icon}
          selected={isSelected(o.value)}
          disabled={o.disabled}
          onClick={() => handle(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
