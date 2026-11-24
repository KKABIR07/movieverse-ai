import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,transform] duration-120 ease-projector ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press',
  secondary: 'bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong',
  ghost: 'text-fg-secondary hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger border border-danger/35 hover:bg-danger/20',
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 min-w-9 px-3 text-caption rounded-chip [&_svg]:size-4',
  md: 'h-11 min-w-11 px-4 text-body rounded-control [&_svg]:size-[18px]',
  lg: 'h-13 min-w-13 px-6 text-body-lg rounded-control [&_svg]:size-5',
};

/** Class string for anything that should look like a button (e.g. a custom Link). */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, buttonVariants[variant], buttonSizes[size], className);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the label. */
  leadingIcon?: ReactNode;
  /** Icon after the label. */
  trailingIcon?: ReactNode;
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
  /** Stretch to container width. */
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & {
  href?: undefined;
  ref?: Ref<HTMLButtonElement>;
};
type NativeLink = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className' | 'href'> & {
  /** Renders next/link instead of <button>. External URLs (http…) open in a new tab with rel="noopener noreferrer". */
  href: string;
  prefetch?: boolean;
  /** Replace instead of push history. */
  replace?: boolean;
  scroll?: boolean;
  ref?: Ref<HTMLAnchorElement>;
};

export type ButtonProps = CommonProps & (NativeButton | NativeLink);

/**
 * @example <Button onClick={save}>Save</Button>
 * @example <Button href="/discover" variant="secondary" trailingIcon={<ArrowRight />}>Browse</Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  loading = false,
  block = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(buttonClass(variant, size), block && 'w-full', className);
  const content = (
    <>
      {loading ? <Loader2 aria-hidden className="animate-spin" /> : leadingIcon}
      {children}
      {trailingIcon}
    </>
  );

  if (typeof rest.href === 'string') {
    const { href, prefetch, replace, scroll, ref, ...anchor } = rest as NativeLink;
    if (/^https?:\/\//.test(href)) {
      return (
        <a ref={ref} href={href} target="_blank" rel="noopener noreferrer" className={classes} {...anchor}>
          {content}
        </a>
      );
    }
    return (
      <Link ref={ref} href={href} prefetch={prefetch} replace={replace} scroll={scroll} className={classes} {...anchor}>
        {content}
      </Link>
    );
  }

  const { type = 'button', disabled, ref, href: _href, ...button } = rest as NativeButton;
  void _href;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...button}
    >
      {content}
    </button>
  );
}
