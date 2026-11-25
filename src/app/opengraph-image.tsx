import { ImageResponse } from 'next/og';

const BRAND_MARK = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>' +
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#23232c"/><stop offset="1" stop-color="#07070a"/></linearGradient>' +
    '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0bf"/><stop offset=".45" stop-color="#f5b83d"/><stop offset="1" stop-color="#a86a0c"/></linearGradient></defs>' +
    '<rect width="64" height="64" rx="15" fill="url(#bg)"/>' +
    '<rect x="1.25" y="1.25" width="61.5" height="61.5" rx="13.8" fill="none" stroke="url(#gold)" stroke-opacity=".55" stroke-width="1.5"/>' +
    '<path d="M25 18.5 L47 32 L25 45.5 Z" fill="url(#gold)" stroke="url(#gold)" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M25 18.5 L47 32 L36 32 Z" fill="#fff" fill-opacity=".22"/></svg>',
)}`;

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
          {/* brand mark: "Noir & Gold" (same geometry as <LogoMark> and the favicon) */}
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (Satori) renders plain <img>; next/image does not apply */}
          <img src={BRAND_MARK} width={64} height={64} alt="" />
          <div style={{ display: 'flex', fontSize: 36, letterSpacing: -1 }}>
            <span style={{ fontWeight: 700, color: '#f5b83d' }}>mk</span>
            <span style={{ fontWeight: 500 }}>movies</span>
          </div>
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
