import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
          borderRadius: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* film strip holes — top */}
        {[18, 72, 126].map((x) => (
          <div
            key={x}
            style={{
              position: 'absolute',
              top: 16,
              left: x,
              width: 20,
              height: 20,
              background: 'rgba(255,255,255,0.3)',
              borderRadius: 4,
            }}
          />
        ))}
        {/* film strip holes — bottom */}
        {[18, 72, 126].map((x) => (
          <div
            key={x + 100}
            style={{
              position: 'absolute',
              bottom: 16,
              left: x,
              width: 20,
              height: 20,
              background: 'rgba(255,255,255,0.3)',
              borderRadius: 4,
            }}
          />
        ))}
        {/* main text */}
        <span
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-3px',
            fontFamily: 'sans-serif',
            lineHeight: 1,
          }}
        >
          mk
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '3px',
            fontFamily: 'sans-serif',
            marginTop: 4,
          }}
        >
          MOVIES
        </span>
      </div>
    ),
    { ...size },
  );
}
