import Link from 'next/link';
import { Film } from 'lucide-react';
import { cn } from '@/components/ui/cn';

/** Brand mark (original mkmovies design): violet→indigo rounded square with a film glyph. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(135deg,#7c3aed_0%,#4f46e5_100%)] text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.6)]',
        className,
      )}
    >
      <Film className="size-[17px]" strokeWidth={2.25} />
    </span>
  );
}

/** Wordmark logo linking home: mark + the original violet→indigo→cyan gradient "mkmovies". */
export function Logo({ className, wordmarkClassName }: { className?: string; wordmarkClassName?: string }) {
  return (
    <Link
      href="/"
      aria-label="mkmovies home"
      className={cn('inline-flex h-11 items-center gap-2.5 rounded-control pr-1 text-fg', className)}
    >
      <LogoMark />
      <span
        className={cn(
          'bg-[linear-gradient(135deg,#a78bfa_0%,#818cf8_50%,#67e8f9_100%)] bg-clip-text text-[18px] font-bold tracking-[-0.02em] text-transparent',
          wordmarkClassName,
        )}
      >
        mkmovies
      </span>
    </Link>
  );
}
