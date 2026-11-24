import { describe, expect, it } from 'vitest';
import imageLoader, { tmdbSizeForWidth, TMDB_WIDTH_BUCKETS } from './image-loader';

describe('tmdbSizeForWidth', () => {
  it('maps widths to the smallest bucket that covers them', () => {
    expect(tmdbSizeForWidth(16)).toBe('w92');
    expect(tmdbSizeForWidth(92)).toBe('w92');
    expect(tmdbSizeForWidth(93)).toBe('w154');
    expect(tmdbSizeForWidth(256)).toBe('w342');
    expect(tmdbSizeForWidth(384)).toBe('w500');
    expect(tmdbSizeForWidth(640)).toBe('w780');
    expect(tmdbSizeForWidth(1080)).toBe('w1280');
    expect(tmdbSizeForWidth(1280)).toBe('w1280');
  });

  it('uses original above the largest bucket', () => {
    expect(tmdbSizeForWidth(1281)).toBe('original');
    expect(tmdbSizeForWidth(3840)).toBe('original');
  });

  it('falls back to the smallest bucket for invalid widths', () => {
    expect(tmdbSizeForWidth(0)).toBe('w92');
    expect(tmdbSizeForWidth(-5)).toBe('w92');
    expect(tmdbSizeForWidth(Number.NaN)).toBe('w92');
  });

  it('buckets are strictly ascending', () => {
    const sorted = [...TMDB_WIDTH_BUCKETS].sort((a, b) => a - b);
    expect([...TMDB_WIDTH_BUCKETS]).toEqual(sorted);
  });
});

describe('imageLoader', () => {
  it('rewrites TMDB poster URLs to the bucket for the requested width', () => {
    expect(imageLoader({ src: 'https://image.tmdb.org/t/p/w500/abc.jpg', width: 256 })).toBe(
      'https://image.tmdb.org/t/p/w342/abc.jpg',
    );
  });

  it('downsizes TMDB original backdrops', () => {
    expect(imageLoader({ src: 'https://image.tmdb.org/t/p/original/bd.jpg', width: 1080, quality: 80 })).toBe(
      'https://image.tmdb.org/t/p/w1280/bd.jpg',
    );
  });

  it('upgrades to original for very wide requests', () => {
    expect(imageLoader({ src: 'https://image.tmdb.org/t/p/w780/bd.jpg', width: 1920 })).toBe(
      'https://image.tmdb.org/t/p/original/bd.jpg',
    );
  });

  it('handles non-w size tokens like h632 profiles', () => {
    expect(imageLoader({ src: 'https://image.tmdb.org/t/p/h632/p.jpg', width: 128 })).toBe(
      'https://image.tmdb.org/t/p/w154/p.jpg',
    );
  });

  it('returns local assets unchanged', () => {
    expect(imageLoader({ src: '/placeholder-poster.svg', width: 640 })).toBe('/placeholder-poster.svg');
    expect(imageLoader({ src: '/ceo.png', width: 64 })).toBe('/ceo.png');
  });

  it('returns YouTube thumbnails unchanged', () => {
    const yt = 'https://i.ytimg.com/vi/abc123/hqdefault.jpg';
    expect(imageLoader({ src: yt, width: 480 })).toBe(yt);
    const yt2 = 'https://img.youtube.com/vi/abc123/mqdefault.jpg';
    expect(imageLoader({ src: yt2, width: 320 })).toBe(yt2);
  });

  it('returns data URIs unchanged', () => {
    const d = 'data:image/png;base64,AAAA';
    expect(imageLoader({ src: d, width: 10 })).toBe(d);
  });

  it('does not touch look-alike hosts', () => {
    const evil = 'https://image.tmdb.org.evil.com/t/p/w500/x.jpg';
    expect(imageLoader({ src: evil, width: 100 })).toBe(evil);
  });
});
