# mkmovies components: "Projector" design system

API reference for page authors. Everything here is typed, accessible, and built on the
tokens in `src/app/globals.css`. Import from the barrels:

```ts
import { Button, IconButton, Dialog, Rating /* … */ } from '@/components/ui';
import { MediaCard, Rail, HeroFrame /* … */ } from '@/components/media';
```

## Rules

- **One accent.** Amber (`bg-accent` / `text-accent`) is for the primary action, focus rings,
  active marks and ratings. Do not introduce other brand colours. Genre swatches
  (`bg-genre-*`) are only allowed as small bars or dots.
- **Text sizes:** use the scale (`text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body-lg`,
  `text-body`, `text-caption`, `text-micro`). Nothing below 12px (`text-micro`). No `font-black`.
- **Numbers** (ratings, counts, runtimes): add `tabular`.
- **Targets:** primary controls are at least 44px (`Button` md/lg, `IconButton` md).
- **Ratings:** only the TMDB score via `<Rating>`. Never show RT/Metacritic/IMDb numbers.
- **Images:** pass a full TMDB URL (use `posterSrc` / `backdropSrc` / `profileSrc`) and an accurate
  `sizes`. The global loader (`src/lib/image-loader.ts`) picks the TMDB CDN bucket. Use
  `preload` only on the page's LCP image (`priority` is deprecated in Next 16).
- **Layout:** `<main>` is already padded by the header height and (on phones) the tab bar.
  Full-bleed heroes use `<HeroFrame>`, which slides under the transparent header by itself.
  Use `px-gutter` for the page side padding (16 / 32 / 48px).
- **No class conflicts:** there is no tailwind-merge. Don't pass a class that fights a component's
  own class of the same property (for example `h-10` to a `Button`); pick a `size` instead.
  Display overrides such as `hidden md:inline-flex` ARE supported on `Button` / `IconButton`.

## Tokens (Tailwind utilities)

| Group | Utilities |
|---|---|
| Ground / surfaces | `bg-ground` `bg-surface-1` `bg-surface-2` `bg-surface-3` |
| Lines | `border-line` `border-line-strong` (also `ring-*`, `divide-*`) |
| Text | `text-fg` `text-fg-secondary` `text-fg-muted` |
| Accent | `bg-accent` `hover:bg-accent-hover` `active:bg-accent-press` `text-accent` `text-on-accent` |
| Status | `text-success` `bg-success` `text-danger` `bg-danger` |
| Genre bars | `bg-genre-action` `-drama` `-comedy` `-horror` `-scifi` `-romance` `-animation` `-thriller` |
| Type | `text-display` (72→40, clamp) `text-h1` (64→36) `text-h2` 24 `text-h3` 20 `text-body-lg` 17 `text-body` 15 `text-caption` 13 `text-micro` 12, `font-sans` (Geist), `font-mono` |
| Radius | `rounded-chip` 8 · `rounded-control` 12 · `rounded-card` 14 · `rounded-panel` 16 · `rounded-hero` 22 · `rounded-full` |
| Shadow | `shadow-card` `shadow-pop` |
| Motion | `duration-120` `duration-200` `duration-320`, `ease-projector`, `animate-fade-in` `animate-rise-in` |
| Helpers | `px-gutter` `pb-tabbar` `no-scrollbar` `fade-x` `tabular` `skeleton` |
| CSS vars | `--header-h` 64px · `--tabbar-h` 64px · `--gutter` · `--dur-fast/base/slow` |

Contrast (WCAG AA ≥ 4.5:1 verified): `fg-muted` #A1A1AD is 5.87:1 on `surface-3`, the worst case;
amber on ground is 11:1; `on-accent` on amber is 11:1.

Legacy vars (`--bg-primary`, `--accent-primary`, `--text-muted`, `--border`, …) are aliased to the
new tokens so pre-redesign pages keep rendering. Don't use them in new code.

## UI primitives (`@/components/ui`)

| Component | Props | Example |
|---|---|---|
| `Button` | `variant?: 'primary'\|'secondary'\|'ghost'\|'danger'`, `size?: 'sm'\|'md'\|'lg'` (36/44/52px), `leadingIcon?`, `trailingIcon?`, `loading?`, `block?`, `href?` (renders next/link; `http…` opens in a new tab) + native button/anchor props, `ref` | `<Button href="/discover" variant="secondary" trailingIcon={<ArrowRight />}>Browse</Button>` |
| `buttonClass(variant, size, className)` | class string for custom elements | `<Link className={buttonClass('ghost','sm')} …>` |
| `IconButton` | **`label: string` (required, becomes aria-label)**, `icon`, `variant?: 'ghost'\|'secondary'\|'primary'\|'overlay'`, `size?: 'sm'\|'md'\|'lg'`, `badge?: number`, `round?`, `pressed?` (aria-pressed), `href?`, `noTitle?` | `<IconButton label="Close" icon={<X />} onClick={close} />` |
| `Chip` | `selected?`, `size?: 'sm'\|'md'`, `icon?`, `count?`, `href?` (link, aria-current) or button props (aria-pressed) | `<Chip selected={g===28} onClick={() => setG(28)}>Action</Chip>` |
| `ToggleGroup` | `label`, `options: {value,label,icon?,disabled?}[]`, `type?: 'single'\|'multiple'`, `value`, `onChange`, `allowDeselect?`, `layout?: 'wrap'\|'scroll'`, `size?` | `<ToggleGroup label="Type" options={[{value:'movie',label:'Movies'},{value:'tv',label:'TV'}]} value={t} onChange={setT} />` |
| `SectionHeader` | `title`, `id?`, `as?: 'h2'\|'h3'`, `eyebrow?`, `description?`, `href?` + `seeAllLabel?`, `onPrev?`/`onNext?` + `canPrev?`/`canNext?`, `actions?` | `<SectionHeader title="Trending" href="/trending" />` |
| `PageHeader` | `title` (the page h1), `eyebrow?`, `description?`, `actions?`, `children?` (filters row), `display?` | `<PageHeader eyebrow="Browse" title="Movies" />` |
| `Pagination` | `page`, `totalPages`, `hrefForPage(p) => string`, `clampToTmdb?` (500 max, default true), `siblings?`, `label?` | `<Pagination page={p} totalPages={d.total_pages} hrefForPage={(p) => `/movies?page=${p}`} />` |
| `Dialog` | `open`, `onClose`, `title` (required), `hideTitle?`, `description?`, `footer?`, `size?: 'sm'\|'md'\|'lg'\|'xl'`, `placement?: 'center'\|'top'\|'sheet'`, `initialFocusRef?`, `showClose?`, `closeOnBackdrop?`, `bodyClassName?` (replaces default padding). Focus trap, focus return, Esc, scroll lock, portal. Mark the field to focus first with `data-autofocus`. | `<Dialog open={o} onClose={() => setO(false)} title="Share list">…</Dialog>` |
| `Skeleton` | `variant?: 'block'\|'poster'\|'backdrop'\|'text'\|'circle'\|'card'`, `lines?` (text), `className?` | `<Skeleton variant="text" lines={3} />` |
| `MediaCardSkeleton` | `className?` | `<MediaCardSkeleton />` |
| `EmptyState` | `icon?`, `title`, `description?`, `action?`, `compact?` | `<EmptyState icon={<Bookmark />} title="Nothing saved yet" action={<Button href="/discover">Find something</Button>} />` |
| `ErrorState` | `title?`, `description?`, `onRetry?`, `retryLabel?`, `compact?` (role="alert") | `<ErrorState onRetry={() => refetch()} />` |
| `Rating` | `value` (vote_average), `voteCount?`, `size?: 'sm'\|'md'\|'lg'`, `variant?: 'chip'\|'plain'`, `showVotes?`. Renders nothing for unrated titles. SR text: "TMDB rating 8.1 out of 10". | `<Rating value={m.vote_average} voteCount={m.vote_count} />` |
| `Tabs` | `label`, `items: {id,label,panel?,disabled?,count?}[]`, `value?`/`defaultValue?`/`onValueChange?`, `panels?` (default true), `appearance?: 'underline'\|'pill'` | `<Tabs label="Details" items={[{id:'cast',label:'Cast',panel:<Cast/>}]} />` |
| `toast()` / `Toaster` | `toast({ title, description?, tone?: 'neutral'\|'success'\|'danger', duration?, action?: {label,onClick} })` or `toast('Saved')`. `Toaster` is already mounted in Providers (aria-live). | `toast({ title: 'Link copied', tone: 'success' })` |
| `cn(...)`, `displayClass()` | class helpers | |

Still available for old pages: `MovieCardSkeleton`, `MovieDetailSkeleton`, `StarRating`, `RatingBadge`, `SetupBanner`.

## Media components (`@/components/media`)

All accept any TMDB shape (`Movie`, `TVShow`, multi-search result, `KnownForItem`, `WatchlistItem`)
or a normalised `MediaSummary`. Pass `mediaType` when the object is ambiguous.

| Component | Props | Example |
|---|---|---|
| `MediaCard` | `item`, `mediaType?`, `sizes?` (default `POSTER_SIZES.grid`), `preload?`, `showRating?`, `showWatchlist?`, `trailerPreview?` (hover-capable pointers only, after 800ms, off under reduced motion), `meta?`, `headingLevel?` | `<MediaCard item={movie} sizes={POSTER_SIZES.rail} trailerPreview />` |
| `PersonCard` | `person: {id,name,profile_path,known_for_department?,character?,job?}`, `subtitle?`, `footer?` (outside the link, e.g. FollowButton), `size?: 'sm'\|'md'\|'lg'`, `sizes?` | `<PersonCard person={castMember} />` |
| `Rail` | `title?` (renders SectionHeader wired to the arrows), `label?` (aria name without a title), `eyebrow?`, `description?`, `href?`, `actions?`, `variant?: 'poster'\|'wide'\|'person'\|'top10'`, `itemWidth?`, `gap?`, `loading?` + `skeleton?` + `skeletonCount?`, `children` (one per item) | `<Rail title="Now playing" href="/movies" loading={isLoading} skeleton={<MediaCardSkeleton />}>{items.map(m => <MediaCard key={m.id} item={m} sizes={POSTER_SIZES.rail} />)}</Rail>` |
| `Top10Rail` | `items`, `title?`, `href?`, `eyebrow?`, `mediaType?`, `loading?` | `<Top10Rail title="Top 10 movies this week" items={trending.results} mediaType="movie" />` |
| `Backdrop` | `path`, `alt?` (default decorative), `preload?`, `sizes?` (100vw), `scrim?: 'bottom'\|'left'\|'hero'\|'full'\|'none'`, `position?`. Parent must be `relative`. | `<div className="relative aspect-video"><Backdrop path={m.backdrop_path} /></div>` |
| `HeroFrame` | `backdropPath`, `preload?`, `children` (bottom-left content), `aside?`, `height?: 'md'\|'lg'\|'full'`, `position?`, `label?` | `<HeroFrame backdropPath={m.backdrop_path} preload><h1 className="text-display">{m.title}</h1></HeroFrame>` |
| `MediaGrid` | `items`, `mediaType?`, `loading?`, `skeletonCount?`, `empty?`, `preloadCount?`, `trailerPreview?`, `renderItem?`, `label?` | `<MediaGrid items={data?.results} loading={isLoading} empty={<EmptyState title="No results" />} />` |
| `WatchlistButton` | `item`, `mediaType?`, `appearance?: 'icon'\|'button'`, `size?`, `announce?` (Undo toast, default true). Prompts sign-in when signed out. | `<WatchlistButton item={movie} appearance="button" />` |
| helpers | `toMediaSummary(item, type?)`, `mediaHref(m)`, `toWatchlistItem(m)`, `inferMediaType`, `posterSrc`, `backdropSrc`, `profileSrc`, `tmdbUrl(path,size)`, `POSTER_SIZES.{grid,rail,thumb,detail}`, `RAIL_ITEM_WIDTH`, `MEDIA_GRID_COLS` | |

`Backdrop`, `HeroFrame`, `PersonCard`, `Top10Rail` and `MediaGrid` are server-component safe;
`MediaCard`, `Rail` and `WatchlistButton` are client components (usable from either).

## Shell (`@/components/layout`, mounted by `app/layout.tsx`)

`Header` (pill nav, search trigger, chat, watchlist, auth), `CommandPalette` (⌘K / Ctrl K / "/"),
`MobileTabBar` (< 768px), `Footer`, `ChatWidget`, `AuthModal`, `Toaster`. Pages never mount these.

Open things from anywhere:

```ts
import { openAuth, openSearch } from '@/store';
openAuth('signup');   // sign-in dialog (legacy window event `mkmovies:openAuth` still works)
openSearch();         // command palette
useChatStore.getState().setChatOpen(true);
```

`Sidebar.tsx` (filters) is no longer mounted globally; reuse its filter UI on /discover.

## Stores (`@/store`)

- Persisted stores rehydrate after the first render (no hydration errors). Gate
  localStorage-derived UI with `useStoresHydrated()` from `@/store/hydration` if you need to avoid an empty flash.
- Watchlist is keyed by `${media_type}:${id}`. **Always pass the media type:**
  `has(id, 'tv')`, `remove(id, 'tv')`, `hasInAny(id, type)`, `removeFromList(listId, id, type)`,
  `toggle(item)`. Calls without a type only match movies (or items with no type).
- Selector hooks (re-render only on the value they read): `useIsInWatchlist(id, type)`,
  `useWatchlistCount()`, `useWatchlistToggle()`, `useActiveWatchlistItems()`, `useUserRating(id)`,
  `useUser()`, `useAuthStatus()` (from `@/store/authStore`).
- `useAuthStore` no longer persists `user`; `status` is `'unknown' | 'authenticated' | 'anonymous'`.
- Logout or switching accounts wipes watchlist, reviews, ratings, following (memory + storage).
- `useChatStore` is server-backed: `fetchRoom(room)`, `sendMessage(text, sender)`, `messagesByRoom`.

## Hooks and formatters

`@/lib/hooks`: `useHydrated()`, `useMediaQuery(q)`, `useCanHover()`, `usePrefersReducedMotion()`,
`useDebounced(value, ms)`, `useHotkey('mod+k', fn, { allowInInputs })`.

`@/lib/format` (UTC-safe, server = client output): `formatYear(date, fallback?)`,
`formatDate(date, options?)`, `formatRuntime(min)`, `formatRating(avg, votes?)` (null when unrated),
`formatCount(n)`, `formatRelativeTime(iso)`. Prefer these over the old helpers in `lib/tmdb`.
