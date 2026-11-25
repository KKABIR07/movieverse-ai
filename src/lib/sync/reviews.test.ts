import { describe, expect, it, vi } from 'vitest';
import { createReviewsApi, validateReview } from './reviews';
import { createFollowsApi, fromServerFollow } from './follows';
import { ApiError, friendlyError } from './http';

describe('validateReview', () => {
  it('accepts 1..10 integer ratings and 1..2000 chars', () => {
    expect(validateReview({ rating: 8, content: 'Great.' })).toEqual({});
    expect(validateReview({ rating: 10, content: 'x'.repeat(2000) })).toEqual({});
  });
  it('rejects out-of-range ratings and empty / long text', () => {
    expect(validateReview({ rating: 0, content: 'ok' }).rating).toBeDefined();
    expect(validateReview({ rating: 7.5, content: 'ok' }).rating).toBeDefined();
    expect(validateReview({ rating: 5, content: '   ' }).content).toMatch(/few words/);
    expect(validateReview({ rating: 5, content: 'x'.repeat(2001) }).content).toMatch(/2,000/);
  });
});

describe('reviews api', () => {
  it('trims content and posts JSON', async () => {
    const fetchImpl = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ review: { id: 'r' } }), { status: 201 }));
    await createReviewsApi(fetchImpl).save({ movieId: 550, movieTitle: 'Fight Club', rating: 9, content: '  Wow  ' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/reviews');
    expect(JSON.parse(init.body as string)).toMatchObject({ movieId: 550, rating: 9, content: 'Wow', spoiler: false });
  });
  it('lists by movie id', async () => {
    const fetchImpl = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ reviews: [{ id: 'a' }] }), { status: 200 }));
    await expect(createReviewsApi(fetchImpl).list(550)).resolves.toEqual([{ id: 'a' }]);
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/reviews?movieId=550');
  });
});

describe('follows api', () => {
  it('maps server follows', () => {
    expect(fromServerFollow({ personId: 287, personName: 'Brad Pitt', department: 'Acting', followedAt: 'T' })).toEqual({
      id: 287,
      name: 'Brad Pitt',
      profile_path: null,
      known_for_department: 'Acting',
      followedAt: 'T',
    });
  });
  it('dedupes and caps count ids', async () => {
    const fetchImpl = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ counts: { '1': 3, '2': 0 } }), { status: 200 }));
    await expect(createFollowsApi(fetchImpl).counts([1, 2, 2, -1])).resolves.toEqual({ 1: 3, 2: 0 });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/follows/counts?ids=1,2');
  });
});

describe('friendlyError', () => {
  it('maps the documented codes', () => {
    expect(friendlyError(new ApiError(429, 'RATE_LIMITED', ''))).toMatch(/Too many/);
    expect(friendlyError(new ApiError(503, 'DB_UNAVAILABLE', ''))).toMatch(/unavailable/);
    expect(friendlyError(new ApiError(409, 'WATCHLIST_FULL', ''))).toMatch(/full/);
    expect(friendlyError(new Error('x'), 'fallback')).toBe('fallback');
  });
});
