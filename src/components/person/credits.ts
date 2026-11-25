/**
 * Person filmography helpers (pure, server + client safe, unit-tested).
 *
 * TMDB `combined_credits` lists one row per role, so a person who plays two characters in a show,
 * or both directs and writes a film, appears several times. These helpers merge those rows into one
 * credit per title, sort them for display and pick a "known for" shelf.
 */
import type { Person } from '../../types/tmdb';

export type CreditMediaType = 'movie' | 'tv';

/** One title in a person's filmography (roles merged). */
export interface PersonCredit {
  id: number;
  mediaType: CreditMediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  /** release_date / first_air_date ("" when unknown) */
  date: string;
  /** Characters (cast) or jobs (crew), de-duplicated, in TMDB order. */
  roles: string[];
  /** Crew department of the first job (crew credits only). */
  department?: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  /** TV: episodes this person appears in (cast), when TMDB reports it. */
  episodeCount?: number;
  genreIds: number[];
}

/** Loose view of a TMDB combined-credit row (cast or crew). */
interface RawCredit {
  id?: unknown;
  media_type?: unknown;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  job?: string;
  department?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  episode_count?: number;
  genre_ids?: number[];
}

/** TV talk / news / reality genres: appearances as "Self", not roles. */
const SELF_TV_GENRES = new Set([10767, 10763, 10764]);

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function key(mediaType: CreditMediaType, id: number) {
  return `${mediaType}:${id}`;
}

/** Merge rows (cast or crew) into one credit per title. Rows without a valid id / media type are dropped. */
export function mergeCredits(rows: readonly RawCredit[] | undefined, role: 'cast' | 'crew'): PersonCredit[] {
  const byKey = new Map<string, PersonCredit>();
  for (const r of rows ?? []) {
    if (!r || typeof r.id !== 'number' || !Number.isInteger(r.id) || r.id <= 0) continue;
    if (r.media_type !== 'movie' && r.media_type !== 'tv') continue;
    const mediaType = r.media_type;
    const k = key(mediaType, r.id);
    const label = (role === 'cast' ? r.character : r.job)?.trim() ?? '';
    const existing = byKey.get(k);
    if (existing) {
      if (label && !existing.roles.includes(label)) existing.roles.push(label);
      if (r.episode_count) existing.episodeCount = Math.max(existing.episodeCount ?? 0, r.episode_count);
      continue;
    }
    byKey.set(k, {
      id: r.id,
      mediaType,
      title: (mediaType === 'tv' ? (r.name ?? r.title) : (r.title ?? r.name))?.trim() || 'Untitled',
      posterPath: r.poster_path ?? null,
      backdropPath: r.backdrop_path ?? null,
      date: (mediaType === 'tv' ? (r.first_air_date ?? r.release_date) : (r.release_date ?? r.first_air_date)) || '',
      roles: label ? [label] : [],
      department: role === 'crew' ? r.department || undefined : undefined,
      voteAverage: num(r.vote_average),
      voteCount: num(r.vote_count),
      popularity: num(r.popularity),
      episodeCount: r.episode_count || undefined,
      genreIds: Array.isArray(r.genre_ids) ? r.genre_ids : [],
    });
  }
  return [...byKey.values()];
}

const time = (d: string) => {
  const t = /^\d{4}/.test(d) ? Date.parse(d.length === 4 ? `${d}-01-01` : d) : NaN;
  return Number.isFinite(t) ? t : null;
};

/**
 * Newest first. Undated credits (usually announced projects) come first, as on TMDB, ordered by
 * popularity; ties on the same date fall back to popularity, then title, so the order is stable.
 */
export function sortCreditsByDate(credits: readonly PersonCredit[]): PersonCredit[] {
  return [...credits].sort((a, b) => {
    const ta = time(a.date);
    const tb = time(b.date);
    if (ta === null && tb !== null) return -1;
    if (tb === null && ta !== null) return 1;
    if (ta !== null && tb !== null && ta !== tb) return tb - ta;
    if (b.popularity !== a.popularity) return b.popularity - a.popularity;
    return a.title.localeCompare(b.title);
  });
}

/** True for talk-show / news / reality appearances and "Self" roles. */
export function isSelfAppearance(c: PersonCredit): boolean {
  if (c.mediaType === 'tv' && c.genreIds.some((g) => SELF_TV_GENRES.has(g))) return true;
  return c.roles.length > 0 && c.roles.every((r) => /^(self|himself|herself|themselves)\b/i.test(r));
}

/**
 * "Known for": the titles with the most TMDB votes (a stable signal; `popularity` swings daily),
 * skipping talk shows and "Self" appearances, requiring a poster, de-duplicated across cast + crew.
 */
export function knownFor(credits: readonly PersonCredit[], n = 12): PersonCredit[] {
  const seen = new Set<string>();
  return [...credits]
    .filter((c) => c.posterPath && !isSelfAppearance(c))
    .sort((a, b) => b.voteCount - a.voteCount || b.popularity - a.popularity)
    .filter((c) => {
      const k = key(c.mediaType, c.id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, n);
}

/** Crew credits grouped by department (departments ordered by credit count, desc), each sorted by date. */
export function groupCrewByDepartment(crew: readonly PersonCredit[]): { department: string; credits: PersonCredit[] }[] {
  const groups = new Map<string, PersonCredit[]>();
  for (const c of crew) {
    const d = c.department || 'Crew';
    const list = groups.get(d);
    if (list) list.push(c);
    else groups.set(d, [c]);
  }
  return [...groups.entries()]
    .map(([department, list]) => ({ department, credits: sortCreditsByDate(list) }))
    .sort((a, b) => b.credits.length - a.credits.length || a.department.localeCompare(b.department));
}

export interface Filmography {
  cast: PersonCredit[];
  crew: PersonCredit[];
  movies: PersonCredit[];
  tv: PersonCredit[];
  knownFor: PersonCredit[];
  /** Unique titles across cast + crew. */
  totalTitles: number;
}

/** Everything the person page renders, from one TMDB person payload. */
export function buildFilmography(person: Pick<Person, 'combined_credits'>, knownForCount = 12): Filmography {
  const cast = sortCreditsByDate(mergeCredits(person.combined_credits?.cast as RawCredit[] | undefined, 'cast'));
  const crew = sortCreditsByDate(mergeCredits(person.combined_credits?.crew as RawCredit[] | undefined, 'crew'));
  const titles = new Set([...cast, ...crew].map((c) => key(c.mediaType, c.id)));
  return {
    cast,
    crew,
    movies: cast.filter((c) => c.mediaType === 'movie'),
    tv: cast.filter((c) => c.mediaType === 'tv'),
    knownFor: knownFor([...cast, ...crew], knownForCount),
    totalTitles: titles.size,
  };
}

/** Age in whole years at `on` (default today), from TMDB "YYYY-MM-DD" dates; null if unknown. */
export function ageInYears(birthday: string | null | undefined, on?: string | null): number | null {
  const b = birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday : null;
  if (!b) return null;
  const end = on && /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : new Date().toISOString().slice(0, 10);
  const [by, bm, bd] = b.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  let age = ey - by;
  if (em < bm || (em === bm && ed < bd)) age--;
  return age >= 0 && age < 130 ? age : null;
}
