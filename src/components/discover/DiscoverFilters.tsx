'use client';

import { useId, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Genre } from '@/types/tmdb';
import { Button } from '@/components/ui/Button';
import { Chip, ToggleGroup } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/components/ui/cn';
import { yearOptions } from '@/components/browse/params';
import {
  DECADES,
  DEFAULT_STATE,
  LANGUAGE_OPTIONS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  activeFilterCount,
  discoverHref,
  withFilters,
  type DiscoverState,
  type SortKey,
} from './state';

export interface DiscoverFiltersProps {
  state: DiscoverState;
  movieGenres: Genre[];
  tvGenres: Genre[];
  /** Current year (from the server, so server and client render the same list). */
  currentYear: number;
}

type Patch = Partial<Omit<DiscoverState, 'page'>>;

const selectClass =
  'h-11 w-full min-w-0 appearance-none rounded-control border border-line bg-surface-2 pl-3 pr-8 text-caption text-fg ' +
  'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2716%27%20height%3D%2716%27%20fill%3D%27none%27%20stroke%3D%27%23a1a1ad%27%20stroke-width%3D%272%27%20viewBox%3D%270%200%2024%2024%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[position:right_10px_center] bg-no-repeat ' +
  'hover:border-line-strong transition-colors';

function Field({ label, children, className }: { label: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-micro font-medium text-fg-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** Year / rating / language / sort selects (shared by the desktop bar and the mobile sheet). */
function Selects({ state, onChange, years }: { state: DiscoverState; onChange: (p: Patch) => void; years: number[] }) {
  const num = (v: string) => (v ? Number(v) : undefined);
  return (
    <>
      <Field label="From year">
        {(id) => (
          <select id={id} className={selectClass} value={state.yearFrom ?? ''} onChange={(e) => onChange({ yearFrom: num(e.target.value) })}>
            <option value="">Any</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="To year">
        {(id) => (
          <select id={id} className={selectClass} value={state.yearTo ?? ''} onChange={(e) => onChange({ yearTo: num(e.target.value) })}>
            <option value="">Any</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Minimum rating">
        {(id) => (
          <select id={id} className={selectClass} value={state.rating ?? ''} onChange={(e) => onChange({ rating: num(e.target.value) })}>
            <option value="">Any</option>
            {RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.toFixed(1)}+
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Original language">
        {(id) => (
          <select id={id} className={selectClass} value={state.lang ?? ''} onChange={(e) => onChange({ lang: e.target.value || undefined })}>
            <option value="">Any</option>
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Sort by">
        {(id) => (
          <select id={id} className={selectClass} value={state.sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}>
            {SORT_OPTIONS.filter((o) => !(o.movieOnly && state.type === 'tv')).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    </>
  );
}

/**
 * Discover filters. Desktop: a sticky bar that applies each change immediately. Phones: a
 * compact sticky bar plus a bottom-sheet dialog with a draft that applies on "Show results".
 * Every change navigates to the new canonical URL (page reset to 1); the server renders results.
 */
export function DiscoverFilters({ state, movieGenres, tvGenres, currentYear }: DiscoverFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<DiscoverState>(state);
  const years = useMemo(() => yearOptions(currentYear), [currentYear]);

  const genresFor = (type: DiscoverState['type']) => (type === 'tv' ? tvGenres : movieGenres);

  /** Switching type drops genre ids that do not exist for the new type. */
  const patchState = (s: DiscoverState, p: Patch): DiscoverState => {
    if (p.type && p.type !== s.type) {
      const valid = new Set(genresFor(p.type).map((g) => g.id));
      return withFilters(s, { ...p, genres: (p.genres ?? s.genres).filter((g) => valid.has(g)) });
    }
    return withFilters(s, p);
  };

  const navigate = (next: DiscoverState) => {
    startTransition(() => router.push(discoverHref(next), { scroll: false }));
  };
  const apply = (p: Patch) => navigate(patchState(state, p));

  const openSheet = () => {
    setDraft(state);
    setSheetOpen(true);
  };

  const count = activeFilterCount(state);
  const genreOptions = genresFor(state.type).map((g) => ({ value: g.id, label: g.name }));
  const draftGenreOptions = genresFor(draft.type).map((g) => ({ value: g.id, label: g.name }));
  const typeOptions = [
    { value: 'movie' as const, label: 'Movies' },
    { value: 'tv' as const, label: 'TV shows' },
  ];

  const status = (
    <span role="status" aria-live="polite" className="inline-flex h-11 items-center gap-2 text-caption text-fg-muted">
      {pending && (
        <>
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Updating results
        </>
      )}
    </span>
  );

  return (
    <div className="sticky top-[var(--header-h)] z-20 border-y border-line bg-ground/92 backdrop-blur-md">
      {/* Desktop */}
      <div className="hidden px-gutter py-4 md:block">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span aria-hidden className="text-micro font-medium text-fg-muted">
              Type
            </span>
            <ToggleGroup label="Content type" options={typeOptions} value={state.type} onChange={(v) => apply({ type: v })} />
          </div>
          <div className="grid flex-1 grid-cols-5 gap-3 min-w-[560px]">
            <Selects state={state} onChange={apply} years={years} />
          </div>
          <div className="flex items-center gap-2">
            {status}
            {(count > 0 || state.sort !== 'popular') && (
              <Button
                variant="ghost"
                leadingIcon={<RotateCcw />}
                onClick={() => navigate({ ...DEFAULT_STATE, type: state.type })}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4">
          <ToggleGroup
            type="multiple"
            label="Genres"
            size="sm"
            layout="scroll"
            options={genreOptions}
            value={state.genres}
            onChange={(v) => apply({ genres: v })}
          />
        </div>
      </div>

      {/* Phones */}
      <div className="flex items-center justify-between gap-2 px-gutter py-2 md:hidden">
        <ToggleGroup label="Content type" size="md" options={typeOptions} value={state.type} onChange={(v) => apply({ type: v })} />
        <div className="flex items-center gap-1">
          <span role="status" aria-live="polite" className="inline-flex size-6 items-center justify-center">
            {pending && <Loader2 aria-hidden className="size-4 animate-spin text-fg-muted" />}
            <span className="sr-only">{pending ? 'Updating results' : ''}</span>
          </span>
          <Button variant="secondary" leadingIcon={<SlidersHorizontal />} onClick={openSheet} aria-haspopup="dialog">
            Filters{count > 0 && <span className="tabular text-accent"> {count}</span>}
          </Button>
        </div>
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        placement="sheet"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft({ ...DEFAULT_STATE, type: draft.type })}>
              Reset
            </Button>
            <Button
              onClick={() => {
                setSheetOpen(false);
                navigate(withFilters(draft, {}));
              }}
            >
              Show results
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-caption font-semibold text-fg">Type</legend>
            <ToggleGroup label="Content type" options={typeOptions} value={draft.type} onChange={(v) => setDraft((d) => patchState(d, { type: v }))} />
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-caption font-semibold text-fg">Genres</legend>
            <ToggleGroup
              type="multiple"
              label="Genres"
              size="sm"
              options={draftGenreOptions}
              value={draft.genres}
              onChange={(v) => setDraft((d) => withFilters(d, { genres: v }))}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-caption font-semibold text-fg">Decade</legend>
            <div role="group" aria-label="Decade" className="flex flex-wrap gap-2">
              {DECADES.map((d) => {
                const selected = draft.yearFrom === d.from && draft.yearTo === d.to;
                return (
                  <Chip
                    key={d.label}
                    size="sm"
                    selected={selected}
                    onClick={() =>
                      setDraft((s) => withFilters(s, selected ? { yearFrom: undefined, yearTo: undefined } : { yearFrom: d.from, yearTo: d.to }))
                    }
                  >
                    {d.label}
                  </Chip>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Selects state={draft} onChange={(p) => setDraft((d) => withFilters(d, p))} years={years} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
