import { describe, expect, it } from 'vitest';
import { PRIMARY_NAV, isNavActive } from './nav';
import { pushRecent } from './recentSearches';
import { paginationRange } from '../ui/paginationRange';
import { matchesHotkey } from '../../lib/hooks/useHotkey';

const nav = (label: string) => PRIMARY_NAV.find((n) => n.label === label)!;

describe('isNavActive', () => {
  it('home only matches exactly', () => {
    expect(isNavActive(nav('Home'), '/')).toBe(true);
    expect(isNavActive(nav('Home'), '/movies')).toBe(false);
  });
  it('detail routes light up their section', () => {
    expect(isNavActive(nav('Movies'), '/movie/550')).toBe(true);
    expect(isNavActive(nav('Movies'), '/movies')).toBe(true);
    expect(isNavActive(nav('TV shows'), '/tv/1399')).toBe(true);
    expect(isNavActive(nav('TV shows'), '/movie/1')).toBe(false);
    expect(isNavActive(nav('People'), '/person/287')).toBe(true);
    expect(isNavActive(nav('Shorts'), null)).toBe(false);
  });
});

describe('pushRecent', () => {
  it('puts the term first, dedupes case-insensitively, caps', () => {
    expect(pushRecent(['dune', 'Alien'], 'alien')).toEqual(['alien', 'dune']);
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
    expect(pushRecent(['a'], '   ')).toEqual(['a']);
  });
});

describe('paginationRange', () => {
  it('lists every page when it fits', () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('adds gaps', () => {
    expect(paginationRange(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
    expect(paginationRange(10, 20)).toEqual([1, 'gap-start', 9, 10, 11, 'gap-end', 20]);
    expect(paginationRange(20, 20)).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
  });
  it('clamps out-of-range pages', () => {
    expect(paginationRange(99, 3)).toEqual([1, 2, 3]);
    expect(paginationRange(0, 0)).toEqual([1]);
  });
});

describe('matchesHotkey', () => {
  const ev = (key: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });
  it('mod accepts Ctrl or Cmd', () => {
    expect(matchesHotkey(ev('k', { ctrlKey: true }), 'mod+k')).toBe(true);
    expect(matchesHotkey(ev('K', { metaKey: true }), 'mod+k')).toBe(true);
    expect(matchesHotkey(ev('k'), 'mod+k')).toBe(false);
  });
  it('plain keys reject modifiers', () => {
    expect(matchesHotkey(ev('/'), '/')).toBe(true);
    expect(matchesHotkey(ev('/', { ctrlKey: true }), '/')).toBe(false);
    expect(matchesHotkey(ev('k', { altKey: true }), 'mod+k')).toBe(false);
  });
});
