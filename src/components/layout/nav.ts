export interface NavItem {
  href: string;
  label: string;
  /** Extra path prefixes that should mark this item active (e.g. /movie/123 → Movies). */
  match?: readonly string[];
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/movies', label: 'Movies', match: ['/movie/', '/top-rated', '/trending', '/genre/'] },
  { href: '/tv', label: 'TV shows', match: ['/tv/'] },
  { href: '/discover', label: 'Discover' },
  { href: '/shorts', label: 'Shorts' },
  { href: '/stars', label: 'People', match: ['/person/', '/following', '/feed'] },
];

/** Is `item` the active section for `pathname`? */
export function isNavActive(item: Pick<NavItem, 'href' | 'match'>, pathname: string | null): boolean {
  if (!pathname) return false;
  if (item.href === '/') return pathname === '/';
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return item.match?.some((p) => pathname.startsWith(p)) ?? false;
}
