import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, SHARE_MAX_ITEMS } from './shareLink';

const items = [
  { id: 194, media_type: 'movie' as const, title: 'Amélie', poster_path: '/abc.jpg', release_date: '2001-04-25', vote_average: 7.9 },
  { id: 129, media_type: 'movie' as const, title: '千と千尋の神隠し 🐉', poster_path: null, release_date: '2001-07-20', vote_average: 8.5 },
  { id: 1399, media_type: 'tv' as const, title: 'Game of Thrones', poster_path: '/got.jpg', release_date: '', vote_average: 8.4 },
];

describe('share links', () => {
  it('round-trips unicode titles and media types', () => {
    const { code, truncated } = encodeShare(items, 'Liste de Zoé');
    expect(truncated).toBe(false);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const out = decodeShare(code);
    expect(out?.name).toBe('Liste de Zoé');
    expect(out?.items).toEqual(items);
  });

  it('caps the list and reports truncation', () => {
    const many = Array.from({ length: SHARE_MAX_ITEMS + 5 }, (_, i) => ({ ...items[0], id: i + 1 }));
    const { code, truncated } = encodeShare(many);
    expect(truncated).toBe(true);
    expect(decodeShare(code)?.items).toHaveLength(SHARE_MAX_ITEMS);
  });

  it('drops unsafe poster paths and bad dates when encoding', () => {
    const { code } = encodeShare([{ ...items[0], poster_path: 'javascript:alert(1)', release_date: 'nope' }]);
    expect(decodeShare(code)?.items[0]).toMatchObject({ poster_path: null, release_date: '' });
  });

  it('rejects malformed payloads', () => {
    const enc = (o: unknown) =>
      Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeShare(null)).toBeNull();
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('not base64 !!')).toBeNull();
    expect(decodeShare('AAAA')).toBeNull();
    expect(decodeShare(enc({ v: 2, i: [] }))).toBeNull();
    expect(decodeShare(enc({ v: 1, i: [['x', 1, 'T', null, null, null]] }))).toBeNull();
    expect(decodeShare(enc({ v: 1, i: [['m', -4, 'T', null, null, null]] }))).toBeNull();
    expect(decodeShare(enc({ v: 1, i: [['m', 4, 'T', '/../../x', null, null]] }))).toBeNull();
    expect(decodeShare('A'.repeat(30_000))).toBeNull();
  });

  it('dedupes by media type + id but keeps movie and tv with the same id', () => {
    const { code } = encodeShare([
      { ...items[0], id: 1399 },
      { ...items[2] },
      { ...items[2] },
    ]);
    expect(decodeShare(code)?.items.map((i) => `${i.media_type}:${i.id}`)).toEqual(['movie:1399', 'tv:1399']);
  });
});
