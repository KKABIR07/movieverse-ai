/**
 * "Feed" of releases from people the user follows (pure, unit-tested).
 * Merges every followed person's filmography into one release timeline: upcoming titles
 * (soonest first) and recent ones (newest first), each attributed to the people involved.
 */
import type { PersonCredit } from './credits';

export interface FeedPerson {
  id: number;
  name: string;
  credits: PersonCredit[];
}

export interface FeedEntry {
  credit: PersonCredit;
  /** Followed people involved in this title, in follow order. */
  people: { id: number; name: string }[];
}

export interface Feed {
  upcoming: FeedEntry[];
  recent: FeedEntry[];
}

export interface FeedOptions {
  /** "YYYY-MM-DD" (UTC) — injectable for tests. */
  today?: string;
  /** How far back "recent" reaches, in days (default 730). */
  recentDays?: number;
  /** Cap per section (default 48). */
  limit?: number;
  mediaType?: 'all' | 'movie' | 'tv';
  /** Case-insensitive title filter. */
  query?: string;
}

const DAY = 86_400_000;
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export function buildFeed(people: readonly FeedPerson[], opts: FeedOptions = {}): Feed {
  const today = opts.today && isDate(opts.today) ? opts.today : new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(today);
  const since = todayMs - (opts.recentDays ?? 730) * DAY;
  const limit = opts.limit ?? 48;
  const q = (opts.query ?? '').trim().toLowerCase();
  const type = opts.mediaType ?? 'all';

  const byKey = new Map<string, FeedEntry>();
  for (const p of people) {
    for (const c of p.credits) {
      if (!isDate(c.date)) continue;
      if (type !== 'all' && c.mediaType !== type) continue;
      if (q && !c.title.toLowerCase().includes(q)) continue;
      const key = `${c.mediaType}:${c.id}`;
      const entry = byKey.get(key);
      if (entry) {
        if (!entry.people.some((x) => x.id === p.id)) entry.people.push({ id: p.id, name: p.name });
        // Prefer the copy that has a poster.
        if (!entry.credit.posterPath && c.posterPath) entry.credit = c;
      } else {
        byKey.set(key, { credit: c, people: [{ id: p.id, name: p.name }] });
      }
    }
  }

  const upcoming: FeedEntry[] = [];
  const recent: FeedEntry[] = [];
  for (const e of byKey.values()) {
    const t = Date.parse(e.credit.date);
    if (t > todayMs) upcoming.push(e);
    else if (t >= since) recent.push(e);
  }
  const byTitle = (a: FeedEntry, b: FeedEntry) => a.credit.title.localeCompare(b.credit.title);
  upcoming.sort((a, b) => Date.parse(a.credit.date) - Date.parse(b.credit.date) || byTitle(a, b));
  recent.sort((a, b) => Date.parse(b.credit.date) - Date.parse(a.credit.date) || byTitle(a, b));
  return { upcoming: upcoming.slice(0, limit), recent: recent.slice(0, limit) };
}

/** "with A", "with A and B", "with A, B and 2 others". */
export function formatPeople(people: readonly { name: string }[]): string {
  const names = people.map((p) => p.name);
  if (!names.length) return '';
  if (names.length === 1) return `with ${names[0]}`;
  if (names.length === 2) return `with ${names[0]} and ${names[1]}`;
  const rest = names.length - 2;
  return `with ${names[0]}, ${names[1]} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}
