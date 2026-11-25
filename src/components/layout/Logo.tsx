import Link from 'next/link';
import { useId } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * Brand mark — "Noir & Gold": ink tile with a gold hairline frame and a faceted gold play glyph.
 * Same geometry as the favicon set (scripts/gen-icons.mjs); keep the two in sync.
 */
export function LogoMark({ className }: { className?: string }) {
  // unique gradient ids: the mark can appear several times on a page (header, footer, sign-in dialog)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const bg = `${id}-bg`;
  const gold = `${id}-gold`;
  const sheen = `${id}-sheen`;
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={cn('size-8 shrink-0', className)}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#23232c" />
          <stop offset="1" stopColor="#07070a" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0bf" />
          <stop offset=".45" stopColor="#f5b83d" />
          <stop offset="1" stopColor="#a86a0c" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${bg})`} />
      <rect x="1.25" y="1.25" width="61.5" height="61.5" rx="13.8" fill="none" stroke={`url(#${gold})`} strokeOpacity=".55" strokeWidth="1.5" />
      <rect width="64" height="32" rx="15" fill={`url(#${sheen})`} />
      <path d="M25 18.5 L47 32 L25 45.5 Z" fill={`url(#${gold})`} stroke={`url(#${gold})`} strokeWidth="5" strokeLinejoin="round" />
      <path d="M25 18.5 L47 32 L36 32 Z" fill="#fff" fillOpacity=".22" />
    </svg>
  );
}

/** Wordmark logo linking home: mark + gold "mk" / white "movies". */
export function Logo({ className, wordmarkClassName }: { className?: string; wordmarkClassName?: string }) {
  return (
    <Link
      href="/"
      aria-label="mkmovies home"
      className={cn('inline-flex h-11 items-center gap-2.5 rounded-control pr-1 text-fg', className)}
    >
      <LogoMark />
      <span className={cn('text-[19px] tracking-[-0.02em]', wordmarkClassName)}>
        <span className="bg-[linear-gradient(135deg,#fff0bf_0%,#f5b83d_50%,#c98a1c_100%)] bg-clip-text font-bold text-transparent">
          mk
        </span>
        <span className="font-medium text-fg">movies</span>
      </span>
    </Link>
  );
}
