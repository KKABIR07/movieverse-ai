import { describe, expect, it } from 'vitest';
import { departmentLabel, departments, filterFollowing } from './following';
import type { FollowedPerson } from '../../types/tmdb';

const p = (id: number, name: string, dept: string, followedAt: string): FollowedPerson => ({
  id,
  name,
  profile_path: null,
  known_for_department: dept,
  followedAt,
});

const list = [
  p(1, 'Zendaya', 'Acting', '2026-01-03T00:00:00Z'),
  p(2, 'Denis Villeneuve', 'Directing', '2026-01-05T00:00:00Z'),
  p(3, 'Austin Butler', 'Acting', '2026-01-01T00:00:00Z'),
  p(4, 'No Dept', '', '2026-01-02T00:00:00Z'),
];

describe('following filters', () => {
  it('counts departments (empty → Acting), most common first', () => {
    expect(departments(list)).toEqual([
      { value: 'Acting', count: 3 },
      { value: 'Directing', count: 1 },
    ]);
  });

  it('sorts by follow time (newest first) or by name', () => {
    expect(filterFollowing(list, {}).map((x) => x.id)).toEqual([2, 1, 4, 3]);
    expect(filterFollowing(list, { sort: 'name' }).map((x) => x.name)).toEqual(['Austin Butler', 'Denis Villeneuve', 'No Dept', 'Zendaya']);
  });

  it('filters by department and name', () => {
    expect(filterFollowing(list, { department: 'Directing' }).map((x) => x.id)).toEqual([2]);
    expect(filterFollowing(list, { department: 'Acting', query: 'BUT' }).map((x) => x.id)).toEqual([3]);
    expect(filterFollowing(list, { query: 'nobody' })).toEqual([]);
  });

  it('labels departments', () => {
    expect(departmentLabel('Acting')).toBe('Actors');
    expect(departmentLabel('Crew')).toBe('Crew');
  });
});
