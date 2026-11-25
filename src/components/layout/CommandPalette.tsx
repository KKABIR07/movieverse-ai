'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, Compass, Film, Loader2, Search, Star, TrendingUp, Tv, User, X } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import { useDebounced } from '@/lib/hooks/useDebounced';
import { formatYear } from '@/lib/format';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/components/ui/cn';
import { tmdbUrl } from '@/components/media/tmdbImage';
import type { SearchMultiResult } from '@/types/tmdb';
import { pushRecent, readRecent, writeRecent } from './recentSearches';

const MIN_QUERY = 2;
const MAX_RESULTS = 8;

type Option =
  | { kind: 'result'; key: string; item: SearchMultiResult; href: string }
  | { kind: 'all'; key: string; query: string }
  | { kind: 'recent'; key: string; term: string }
  | { kind: 'link'; key: string; label: string; href: string; icon: ReactNode };

const QUICK_LINKS: Option[] = [
  { kind: 'link', key: 'l-trending', label: 'Trending this week', href: '/trending', icon: <TrendingUp /> },
  { kind: 'link', key: 'l-top', label: 'Top rated movies', href: '/top-rated', icon: <Star /> },
  { kind: 'link', key: 'l-discover', label: 'Discover by genre and mood', href: '/discover', icon: <Compass /> },
];

function hrefFor(r: SearchMultiResult): string {
  if (r.media_type === 'tv') return `/tv/${r.id}`;
  if (r.media_type === 'person') return `/person/${r.id}`;
  return `/movie/${r.id}`;
}

function ResultThumb({ r }: { r: SearchMultiResult }) {
  const path = r.media_type === 'person' ? r.profile_path : r.poster_path;
  const Fallback = r.media_type === 'person' ? User : r.media_type === 'tv' ? Tv : Film;
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden bg-surface-3 text-fg-muted',
        r.media_type === 'person' ? 'size-10 rounded-full' : 'h-[60px] w-10 rounded-[6px]',
      )}
    >
      {path ? (
        <Image
          src={tmdbUrl(path, 'w185')!}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
        />
      ) : (
        <Fallback aria-hidden className="size-4" />
      )}
    </span>
  );
}

function resultMeta(r: SearchMultiResult): string {
  if (r.media_type === 'person') return 'Person';
  const year = formatYear(r.release_date ?? r.first_air_date, '');
  const type = r.media_type === 'tv' ? 'TV show' : 'Movie';
  return year ? `${type} · ${year}` : type;
}

function OptionRow({
  id,
  selected,
  onHover,
  onSelect,
  className,
  children,
}: {
  id: string;
  selected: boolean;
  onHover: () => void;
  onSelect: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onMouseMove={selected ? undefined : onHover}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-2',
        selected ? 'bg-surface-3 text-fg' : 'text-fg-secondary',
        className,
      )}
    >
      {children}
    </li>
  );
}

function OptionContent({ opt }: { opt: Option }) {
  switch (opt.kind) {
    case 'result': {
      const r = opt.item;
      return (
        <>
          <ResultThumb r={r} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-medium text-fg">{r.title ?? r.name}</span>
            <span className="block text-micro text-fg-muted tabular">{resultMeta(r)}</span>
          </span>
          {typeof r.vote_average === 'number' && r.vote_average > 0 && r.media_type !== 'person' && (
            <span className="tabular text-micro text-fg-muted">
              <Star aria-hidden className="mr-1 inline size-3 fill-accent text-accent" />
              {r.vote_average.toFixed(1)}
            </span>
          )}
        </>
      );
    }
    case 'all':
      return (
        <>
          <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2 text-accent">
            <Search aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-body">
            See all results for <span className="font-semibold text-fg">“{opt.query}”</span>
          </span>
          <ArrowRight aria-hidden className="size-4 text-fg-muted" />
        </>
      );
    case 'recent':
      return (
        <>
          <Clock aria-hidden className="size-4 shrink-0 text-fg-muted" />
          <span className="min-w-0 flex-1 truncate text-body">{opt.term}</span>
        </>
      );
    case 'link':
      return (
        <>
          <span className="grid size-8 shrink-0 place-items-center text-fg-muted [&_svg]:size-4">{opt.icon}</span>
          <span className="min-w-0 flex-1 truncate text-body">{opt.label}</span>
          <ArrowRight aria-hidden className="size-4 text-fg-muted" />
        </>
      );
  }
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readRecent()));

  const term = useDebounced(query.trim(), 250);
  const enabled = term.length >= MIN_QUERY;
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['command-palette', term],
    queryFn: () => tmdb.search.multi(term),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

  const typing = query.trim().length > 0;
  const results = useMemo(
    () =>
      (data?.results ?? [])
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv' || r.media_type === 'person')
        .slice(0, MAX_RESULTS),
    [data],
  );

  const options: Option[] = useMemo(() => {
    if (typing) {
      const res: Option[] = enabled
        ? results.map((item) => ({ kind: 'result', key: `${item.media_type}:${item.id}`, item, href: hrefFor(item) }))
        : [];
      return [...res, { kind: 'all', key: 'all', query: query.trim() }];
    }
    return [...recent.map((t): Option => ({ kind: 'recent', key: `r-${t}`, term: t })), ...QUICK_LINKS];
  }, [typing, enabled, results, recent, query]);

  const activeIndex = Math.min(active, options.length - 1);
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  useEffect(() => {
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const remember = (t: string) => {
    const next = pushRecent(recent, t);
    setRecent(next);
    writeRecent(next);
  };

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const choose = (opt: Option | undefined) => {
    if (!opt) return;
    switch (opt.kind) {
      case 'result':
        remember(query);
        go(opt.href);
        break;
      case 'all':
        remember(opt.query);
        go(`/search?q=${encodeURIComponent(opt.query)}`);
        break;
      case 'recent':
        setQuery(opt.term);
        setActive(0);
        inputRef.current?.focus();
        break;
      case 'link':
        go(opt.href);
        break;
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((activeIndex + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((activeIndex - 1 + options.length) % options.length);
    } else if (e.key === 'Home' && e.ctrlKey) {
      setActive(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(options[activeIndex]);
    }
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent([]);
    setActive(0);
  };

  const status = !typing
    ? ''
    : !enabled
      ? 'Type at least 2 characters'
      : isFetching
        ? 'Searching…'
        : isError
          ? 'Search failed'
          : `${results.length} result${results.length === 1 ? '' : 's'}`;

  const firstLinkIndex = typing ? -1 : options.findIndex((o) => o.kind === 'link');

  return (
    <div className="flex max-h-[min(640px,calc(100dvh-10vh-32px))] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search aria-hidden className="size-5 shrink-0 text-fg-muted" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-activedescendant={options.length ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-label="Search movies, TV shows and people"
          placeholder="Search movies, TV shows, people…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-14 min-w-0 flex-1 bg-transparent text-body-lg text-fg placeholder:text-fg-muted outline-none"
        />
        {isFetching && <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-fg-muted" />}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setActive(0);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="grid size-9 shrink-0 place-items-center rounded-chip text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="hidden h-7 shrink-0 items-center rounded-[6px] border border-line bg-surface-2 px-2 text-micro text-fg-muted hover:text-fg sm:inline-flex"
        >
          Esc<span className="sr-only"> to close search</span>
        </button>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!typing && recent.length > 0 && (
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <span className="text-micro font-medium uppercase tracking-[0.08em] text-fg-muted">Recent</span>
            <button type="button" onClick={clearRecent} className="h-8 rounded-chip px-2 text-micro text-fg-muted hover:text-fg">
              Clear
            </button>
          </div>
        )}
        {typing && isError && (
          <div className="flex items-center justify-between gap-3 px-3 py-3 text-caption text-fg-muted">
            <span>Search is unavailable right now.</span>
            <button type="button" onClick={() => refetch()} className="h-8 rounded-chip px-2 font-medium text-accent hover:bg-surface-2">
              Retry
            </button>
          </div>
        )}
        {typing && enabled && !isFetching && !isError && results.length === 0 && (
          <p className="px-3 py-3 text-caption text-fg-muted">No quick matches for “{term}”.</p>
        )}

        <ul id={listId} role="listbox" aria-label="Search suggestions" className="flex flex-col gap-0.5">
          {options.map((opt, i) => (
            <Fragment key={opt.key}>
              {i === firstLinkIndex && (
                <li
                  role="presentation"
                  aria-hidden
                  className="px-3 pb-1 pt-3 text-micro font-medium uppercase tracking-[0.08em] text-fg-muted"
                >
                  Jump to
                </li>
              )}
              <OptionRow
                id={optionId(i)}
                selected={i === activeIndex}
                onHover={() => setActive(i)}
                onSelect={() => choose(opt)}
                className={opt.kind === 'all' ? 'mt-1' : undefined}
              >
                <OptionContent opt={opt} />
              </OptionRow>
            </Fragment>
          ))}
        </ul>
      </div>

      <div className="hidden items-center gap-4 border-t border-line px-4 py-2.5 text-micro text-fg-muted sm:flex">
        <span>
          <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to navigate
        </span>
        <span>
          <kbd className="font-sans">Enter</kbd> to open
        </span>
        <span>
          <kbd className="font-sans">Esc</kbd> to close
        </span>
        <span className="ml-auto">Data from TMDB</span>
      </div>
    </div>
  );
}

/**
 * Global search dialog. Opened by the header search button, the mobile tab bar,
 * ⌘K / Ctrl K, and "/" (when not typing). Debounced TMDB multi-search,
 * ↑ ↓ Enter Esc keyboard support, recent searches, "See all results".
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Search"
      hideTitle
      showClose={false}
      placement="top"
      size="lg"
      bodyClassName="p-0"
      className="max-sm:mt-0"
    >
      <PaletteBody onClose={onClose} />
    </Dialog>
  );
}
