import Link from 'next/link';
import { cn } from '@/components/ui/cn';

/** Amber rounded square with a play glyph. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-chip bg-accent', className)}>
      <svg viewBox="0 0 24 24" className="size-4 translate-x-[1px]" fill="currentColor">
        <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z" className="text-on-accent" />
      </svg>
    </span>
  );
}

/** Wordmark logo linking home. */
export function Logo({ className, wordmarkClassName }: { className?: string; wordmarkClassName?: string }) {
  return (
    <Link
      href="/"
      aria-label="mkmovies home"
      className={cn('inline-flex h-11 items-center gap-2.5 rounded-control pr-1 text-fg', className)}
    >
      <LogoMark />
      <span className={cn("text-[17px] font-semibold tracking-[-0.02em]", wordmarkClassName)}>mkmovies</span>
    </Link>
  );
}
