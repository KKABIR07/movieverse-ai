import { ImageResponse } from 'next/og';

// Static brand card (no TMDB data), so it is safe to prerender at build time.
export const alt = 'mkmovies: discover movies and TV shows';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GROUND = '#0b0b0f';
const SURFACE = '#141419';
const LINE = '#2a2a33';
const FG = '#f4f4f6';
const MUTED = '#a1a1ad';
const ACCENT = '#f5b83d';
const BARS = ['#ff7a59', '#8f9cff', '#ffd166', '#4cc9f0', '#7bd88f', '#b388ff'];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: GROUND,
          padding: '72px 80px',
          fontFamily: 'sans-serif',
          color: FG,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              // brand mark: same violet→indigo tile as the favicon
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            mk
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>mkmovies</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: ACCENT }}>
            What to watch tonight
          </div>
          <div style={{ marginTop: 18, fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3, maxWidth: 940 }}>
            Discover movies & TV shows
          </div>
          <div style={{ marginTop: 22, fontSize: 30, color: MUTED, maxWidth: 900 }}>
            Trending lists, top 10s, genres and cast. Ratings from TMDB.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {BARS.map((c) => (
              <div key={c} style={{ width: 56, height: 8, borderRadius: 8, background: c }} />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              padding: '10px 20px',
              borderRadius: 999,
              background: SURFACE,
              border: `1px solid ${LINE}`,
              fontSize: 24,
              color: MUTED,
            }}
          >
            mkmovies.site
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
