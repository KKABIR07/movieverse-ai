/** Recent search terms for the command palette (localStorage, per browser). */
export const RECENT_KEY = 'mkmovies-recent-searches';
export const RECENT_MAX = 6;

/** Pure: put `term` first, dedupe case-insensitively, cap length. */
export function pushRecent(list: readonly string[], term: string, max = RECENT_MAX): string[] {
  const t = term.trim();
  if (!t) return [...list];
  return [t, ...list.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, max);
}

export function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function writeRecent(list: readonly string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* storage blocked */
  }
}
