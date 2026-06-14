'use client';

export function DancingAnimeIcon({ size = 42 }: { size?: number }) {
  return (
    <>
      <style>{`
        @keyframes mv-dance {
          0%   { transform: rotate(-9deg) translateY(0px)   scaleX(1);    }
          20%  { transform: rotate( 5deg) translateY(-6px)  scaleX(0.97); }
          40%  { transform: rotate(-7deg) translateY(-2px)  scaleX(1.02); }
          60%  { transform: rotate( 9deg) translateY(-8px)  scaleX(0.97); }
          80%  { transform: rotate(-5deg) translateY(-2px)  scaleX(1.02); }
          100% { transform: rotate(-9deg) translateY(0px)   scaleX(1);    }
        }
        @keyframes mv-hair {
          0%, 100% { transform: rotate(-4deg); }
          50%       { transform: rotate( 4deg); }
        }
        @keyframes mv-arm-l {
          0%, 100% { transform: rotate(30deg); }
          50%       { transform: rotate(-40deg); }
        }
        @keyframes mv-arm-r {
          0%, 100% { transform: rotate(-30deg); }
          50%       { transform: rotate( 40deg); }
        }
        @keyframes mv-leg-l {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50%       { transform: translateY(-4px) rotate(10deg); }
        }
        @keyframes mv-leg-r {
          0%, 100% { transform: translateY(-4px) rotate(5deg); }
          50%       { transform: translateY(0) rotate(-10deg); }
        }
        .mv-char      { animation: mv-dance 0.72s ease-in-out infinite; transform-origin: 50% 95%; display:block; }
        .mv-hair-el   { animation: mv-hair  0.72s ease-in-out infinite; transform-origin: 50% 100%; }
        .mv-arm-l-el  { animation: mv-arm-l 0.72s ease-in-out infinite; transform-origin: 100% 30%; }
        .mv-arm-r-el  { animation: mv-arm-r 0.72s ease-in-out infinite; transform-origin: 0% 30%; }
        .mv-leg-l-el  { animation: mv-leg-l 0.72s ease-in-out infinite; transform-origin: 50% 0%; }
        .mv-leg-r-el  { animation: mv-leg-r 0.72s ease-in-out infinite; transform-origin: 50% 0%; }
      `}</style>

      <div className="mv-char" style={{ width: size, height: size, flexShrink: 0 }}>
        <svg
          viewBox="0 0 80 100"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          {/* ── Hair (back layer) ── */}
          <g className="mv-hair-el">
            <ellipse cx="40" cy="24" rx="23" ry="17" fill="#7c3aed" />
            {/* twin-tail left */}
            <path d="M 18 28 Q 6 38 10 60 Q 14 55 18 44 Z" fill="#6d28d9" />
            {/* twin-tail right */}
            <path d="M 62 28 Q 74 38 70 60 Q 66 55 62 44 Z" fill="#6d28d9" />
          </g>

          {/* ── Head ── */}
          <circle cx="40" cy="30" r="21" fill="#fdd9b0" />

          {/* ── Bangs ── */}
          <g className="mv-hair-el">
            <path d="M 19 24 Q 24 8 40 7 Q 56 8 61 24 Q 52 17 40 16 Q 28 17 19 24 Z" fill="#7c3aed" />
          </g>

          {/* ── Eyes ── */}
          {/* Left eye white */}
          <ellipse cx="32" cy="30" rx="6" ry="7" fill="#1a0a3e" />
          <ellipse cx="32" cy="30.5" rx="4.5" ry="5.5" fill="#4f46e5" />
          <ellipse cx="32" cy="31" rx="3" ry="4" fill="#1a0a3e" />
          <circle cx="34" cy="28" r="2" fill="white" />
          <circle cx="31" cy="32" r="1" fill="white" opacity="0.6" />
          {/* Right eye */}
          <ellipse cx="48" cy="30" rx="6" ry="7" fill="#1a0a3e" />
          <ellipse cx="48" cy="30.5" rx="4.5" ry="5.5" fill="#4f46e5" />
          <ellipse cx="48" cy="31" rx="3" ry="4" fill="#1a0a3e" />
          <circle cx="50" cy="28" r="2" fill="white" />
          <circle cx="47" cy="32" r="1" fill="white" opacity="0.6" />

          {/* ── Blush ── */}
          <ellipse cx="26" cy="36" rx="5" ry="2.5" fill="#ffb3c8" opacity="0.75" />
          <ellipse cx="54" cy="36" rx="5" ry="2.5" fill="#ffb3c8" opacity="0.75" />

          {/* ── Smile ── */}
          <path d="M 34 40 Q 40 46 46 40" stroke="#ff6b9d" strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* ── Neck ── */}
          <rect x="36" y="50" width="8" height="8" fill="#fdd9b0" />

          {/* ── Body (dress) ── */}
          <path d="M 24 57 Q 24 54 36 52 L 44 52 Q 56 54 56 57 L 60 88 Q 50 91 40 91 Q 30 91 20 88 Z" fill="#7c3aed" />
          {/* dress shine overlay */}
          <path d="M 28 62 Q 40 67 52 62 Q 48 79 40 80 Q 32 79 28 62 Z" fill="#8b5cf6" opacity="0.45" />

          {/* ── Left arm ── */}
          <g className="mv-arm-l-el">
            <path d="M 24 59 Q 10 60 6 73 Q 9 76 13 74 Q 16 63 26 62 Z" fill="#fdd9b0" />
            <circle cx="6" cy="75" r="4" fill="#fdd9b0" />
          </g>

          {/* ── Right arm ── */}
          <g className="mv-arm-r-el">
            <path d="M 56 59 Q 70 60 74 73 Q 71 76 67 74 Q 64 63 54 62 Z" fill="#fdd9b0" />
            <circle cx="74" cy="75" r="4" fill="#fdd9b0" />
          </g>

          {/* ── Left leg ── */}
          <g className="mv-leg-l-el">
            <rect x="26" y="88" width="11" height="10" rx="5" fill="#4c1d95" />
            <ellipse cx="31" cy="98" rx="8" ry="3.5" fill="#1e1b4b" />
          </g>

          {/* ── Right leg ── */}
          <g className="mv-leg-r-el">
            <rect x="43" y="88" width="11" height="10" rx="5" fill="#4c1d95" />
            <ellipse cx="49" cy="98" rx="8" ry="3.5" fill="#1e1b4b" />
          </g>

          {/* ── Sparkles ── */}
          <text x="2" y="14" fontSize="9" opacity="0.9">✨</text>
          <text x="65" y="18" fontSize="8" opacity="0.8">⭐</text>
        </svg>
      </div>
    </>
  );
}
