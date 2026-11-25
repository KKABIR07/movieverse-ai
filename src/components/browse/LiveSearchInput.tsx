'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Form from 'next/form';
import { useRouter } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { buildHref } from './params';

export interface LiveSearchInputProps {
  /** Page path, e.g. "/stars". */
  action: string;
  /** Current query from the URL. */
  value: string;
  label: string;
  placeholder: string;
  /** Other params to keep while searching (dropped when empty). */
  keep?: Record<string, string | undefined>;
  delay?: number;
  className?: string;
}

/**
 * Search field that updates `?q=` as you type (debounced, history replace) so the server renders
 * the results. Still a plain GET form, so Enter works without JavaScript.
 */
export function LiveSearchInput({ action, value, label, placeholder, keep, delay = 350, className }: LiveSearchInputProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(value);
  // the last query this component wrote to the URL (state for render, ref for the timer callback)
  const [pushed, setPushed] = useState(value);
  const lastPushed = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // URL changed elsewhere (back/forward, header search) → re-sync the field. Our own
  // replace() also changes `value`, but then it equals `pushed` and the typing is kept.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    if (value !== pushed) {
      setText(value);
      setPushed(value);
    }
  }

  useEffect(() => {
    lastPushed.current = value;
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const schedule = (next: string, wait = delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim();
      if (q === lastPushed.current) return;
      lastPushed.current = q;
      setPushed(q);
      startTransition(() => router.replace(buildHref(action, { ...(q ? {} : keep), q: q || undefined }), { scroll: false }));
    }, wait);
  };

  return (
    <Form action={action} role="search" className={cn('relative w-full max-w-xl', className)}>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-muted" />
      <input
        type="search"
        name="q"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          schedule(e.target.value);
        }}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        className="h-13 w-full rounded-control border border-line bg-surface-1 pl-12 pr-14 text-body text-fg placeholder:text-fg-muted hover:border-line-strong focus:border-accent [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
        {pending ? (
          <span role="status" className="grid size-11 place-items-center">
            <Loader2 aria-hidden className="size-4 animate-spin text-fg-muted" />
            <span className="sr-only">Searching</span>
          </span>
        ) : (
          text && <IconButton label="Clear search" icon={<X />} onClick={() => {
              setText('');
              schedule('', 0);
            }} />
        )}
      </span>
    </Form>
  );
}
