import Form from 'next/form';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

export interface SearchFormProps {
  /** Form target, e.g. "/search" or "/stars". */
  action: string;
  defaultValue?: string;
  placeholder: string;
  /** Accessible label for the field. */
  label: string;
  /** Extra params to keep (e.g. the active tab). */
  hidden?: Record<string, string | undefined>;
  className?: string;
}

/**
 * GET search form (next/form: client-side navigation, works without JS).
 * Re-key it on the query (`key={q}`) so it re-syncs when the URL changes elsewhere.
 */
export function SearchForm({ action, defaultValue, placeholder, label, hidden, className }: SearchFormProps) {
  return (
    <Form action={action} role="search" className={cn('flex w-full max-w-2xl gap-2', className)}>
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-muted" />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={100}
          className="h-13 w-full rounded-control border border-line bg-surface-1 pl-12 pr-4 text-body text-fg placeholder:text-fg-muted hover:border-line-strong focus:border-accent"
        />
      </div>
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Button type="submit" size="lg">
        Search
      </Button>
    </Form>
  );
}
