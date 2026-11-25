'use client';

import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';

/** Labelled in-page filter field (client-side filtering, no navigation). */
export function FilterInput({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('relative w-full max-w-md', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-muted" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 100))}
        placeholder={placeholder}
        autoComplete="off"
        className="h-11 w-full rounded-control border border-line bg-surface-1 pl-12 pr-12 text-body text-fg placeholder:text-fg-muted hover:border-line-strong focus:border-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2">
          <IconButton label="Clear filter" icon={<X />} size="md" onClick={() => onChange('')} />
        </span>
      )}
    </div>
  );
}
