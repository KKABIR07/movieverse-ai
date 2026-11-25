import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatRating, formatRelativeTime, formatRuntime, formatYear, parseDateUTC } from './format';

describe('formatYear / formatDate (UTC-safe)', () => {
  it('never shifts a TMDB date across a year boundary', () => {
    expect(formatYear('2024-01-01')).toBe('2024');
    expect(formatYear('1999-12-31')).toBe('1999');
    expect(formatDate('2024-01-01')).toBe('Jan 1, 2024');
  });
  it('handles empty and invalid input', () => {
    expect(formatYear(undefined)).toBe('—');
    expect(formatYear('', '')).toBe('');
    expect(formatYear('not a date')).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(parseDateUTC('2024-02-30')?.toISOString()).toBe('2024-03-01T00:00:00.000Z');
  });
  it('supports custom options', () => {
    expect(formatDate('2024-05-03', { year: 'numeric', month: 'long' })).toBe('May 2024');
  });
});

describe('formatRuntime', () => {
  it('formats minutes', () => {
    expect(formatRuntime(142)).toBe('2h 22m');
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(120)).toBe('2h');
  });
  it('falls back for missing/zero/negative', () => {
    expect(formatRuntime(0)).toBe('—');
    expect(formatRuntime(undefined)).toBe('—');
    expect(formatRuntime(-5, 'n/a')).toBe('n/a');
  });
});

describe('formatRating', () => {
  it('formats to one decimal and clamps', () => {
    expect(formatRating(8.123)).toBe('8.1');
    expect(formatRating(11)).toBe('10.0');
  });
  it('is null-safe and hides unrated titles', () => {
    expect(formatRating(null)).toBeNull();
    expect(formatRating(undefined)).toBeNull();
    expect(formatRating(Number.NaN)).toBeNull();
    expect(formatRating(0, 0)).toBeNull();
    expect(formatRating(0)).toBeNull();
    expect(formatRating(0, 12)).toBe('0.0');
  });
});

describe('formatCount', () => {
  it('compacts', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1234)).toBe('1.2K');
    expect(formatCount(12_345)).toBe('12.3K');
    expect(formatCount(123_456)).toBe('123K');
    expect(formatCount(999_950)).toBe('1M');
    expect(formatCount(2_500_000)).toBe('2.5M');
    expect(formatCount(3_100_000_000)).toBe('3.1B');
    expect(formatCount(-1500)).toBe('-1.5K');
    expect(formatCount(null)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-01-10T12:00:00Z');
  it('buckets', () => {
    expect(formatRelativeTime('2026-01-10T11:59:50Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-01-10T11:55:00Z', now)).toBe('5m ago');
    expect(formatRelativeTime('2026-01-10T09:00:00Z', now)).toBe('3h ago');
    expect(formatRelativeTime('2026-01-08T12:00:00Z', now)).toBe('2d ago');
    expect(formatRelativeTime('2025-12-01T12:00:00Z', now)).toBe('Dec 1');
    expect(formatRelativeTime(undefined, now)).toBe('');
  });
});
