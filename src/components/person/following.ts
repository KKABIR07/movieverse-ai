/**
 * Filtering / sorting for the Following page (pure, unit-tested).
 */
import type { FollowedPerson } from '../../types/tmdb';

export type FollowingSort = 'recent' | 'name';

/** Department groups shown as filter chips. */
export function departmentOf(p: Pick<FollowedPerson, 'known_for_department'>): string {
  return p.known_for_department?.trim() || 'Acting';
}

/** Departments present in the list, most common first (ties alphabetical). */
export function departments(list: readonly FollowedPerson[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of list) counts.set(departmentOf(p), (counts.get(departmentOf(p)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function filterFollowing(
  list: readonly FollowedPerson[],
  { department, query, sort }: { department?: string | null; query?: string; sort?: FollowingSort },
): FollowedPerson[] {
  const q = (query ?? '').trim().toLowerCase();
  const out = list.filter((p) => (!department || departmentOf(p) === department) && (!q || p.name.toLowerCase().includes(q)));
  if (sort === 'name') return [...out].sort((a, b) => a.name.localeCompare(b.name));
  return [...out].sort((a, b) => (Date.parse(b.followedAt) || 0) - (Date.parse(a.followedAt) || 0));
}

/** "Acting" → "Actors" etc. for chip labels. */
export function departmentLabel(d: string): string {
  const map: Record<string, string> = {
    Acting: 'Actors',
    Directing: 'Directors',
    Writing: 'Writers',
    Production: 'Producers',
    Sound: 'Composers & sound',
    Camera: 'Cinematographers',
    Editing: 'Editors',
  };
  return map[d] ?? d;
}
