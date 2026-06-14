import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* film strip holes — top row */}
        {[4, 13, 22].map((x) => (
          <div
            key={x}
            style={{
              position: 'absolute',
              top: 3,
              left: x,
              width: 4,
              height: 4,
              background: 'rgba(255,255,255,0.35)',
              borderRadius: 1,
            }}
          />
        ))}
        {/* film strip holes — bottom row */}
        {[4, 13, 22].map((x) => (
          <div
            key={x + 100}
            style={{
              position: 'absolute',
              bottom: 3,
              left: x,
              width: 4,
              height: 4,
              background: 'rgba(255,255,255,0.35)',
              borderRadius: 1,
            }}
          />
        ))}
        {/* "mk" text */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-0.5px',
            fontFamily: 'sans-serif',
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          mk
        </span>
      </div>
    ),
    { ...size },
  );
}
