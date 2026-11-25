import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn, displayClass } from './cn';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'overlay';
export type IconButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<IconButtonVariant, string> = {
  ghost: 'text-fg-secondary hover:text-fg hover:bg-surface-2',
  secondary: 'bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong',
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press',
  /** For use on top of imagery: dark translucent disc. */
  overlay: 'bg-ground/70 text-fg backdrop-blur-md border border-white/10 hover:bg-ground/90',
};

const sizes: Record<IconButtonSize, string> = {
  sm: 'size-9 [&_svg]:size-4',
  md: 'size-11 [&_svg]:size-5',
  lg: 'size-13 [&_svg]:size-6',
};

interface CommonProps {
  /** REQUIRED accessible name (becomes aria-label and the tooltip). */
  label: string;
  /** The icon, e.g. <X />. */
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Small count badge (hidden when 0/undefined; "9+" above 9). Put the count in `label` too. */
  badge?: number;
  /** Fully round instead of the radius token. */
  round?: boolean;
  /** Suppress the native title tooltip. */
  noTitle?: boolean;
  className?: string;
}

type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'aria-label'> & {
  href?: undefined;
  /** Toggle state → aria-pressed. */
  pressed?: boolean;
  ref?: Ref<HTMLButtonElement>;
};
type NativeLink = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className' | 'href' | 'aria-label'> & {
  href: string;
  pressed?: undefined;
  ref?: Ref<HTMLAnchorElement>;
};

export type IconButtonProps = CommonProps & (NativeButton | NativeLink);

function Badge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span
      aria-hidden
      className="tabular absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-accent text-on-accent text-micro font-semibold leading-5 text-center ring-2 ring-ground"
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

/**
 * Icon-only control. `label` is required and announced to screen readers.
 * @example <IconButton label="Close" icon={<X />} onClick={onClose} />
 * @example <IconButton label="Watchlist, 3 items" href="/watchlist" icon={<Bookmark />} badge={3} />
 */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  badge,
  round,
  noTitle,
  className,
  ...rest
}: IconButtonProps) {
  const classes = cn(
    displayClass(className, 'inline-flex'),
    'relative shrink-0 items-center justify-center transition-colors duration-120 ease-projector',
    'disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    round ? 'rounded-full' : size === 'sm' ? 'rounded-chip' : 'rounded-control',
    className,
  );
  const title = noTitle ? undefined : label;

  if (typeof rest.href === 'string') {
    const { href, ref, pressed: _p, ...anchor } = rest as NativeLink;
    void _p;
    return (
      <Link ref={ref} href={href} aria-label={label} title={title} className={classes} {...anchor}>
        {icon}
        <Badge count={badge} />
      </Link>
    );
  }

  const { pressed, type = 'button', ref, href: _h, ...button } = rest as NativeButton;
  void _h;
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      className={classes}
      {...button}
    >
      {icon}
      <Badge count={badge} />
    </button>
  );
}
