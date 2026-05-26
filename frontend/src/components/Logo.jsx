import React from "react";

/**
 * Mind Matters — MM Monogram Logo (SVG)
 *
 * Structure (matches the official brand mark):
 *  - Outer ring: thick, copper-gold gradient
 *  - Gap
 *  - Inner ring: thin, same gradient
 *  - MM strokes: two outer verticals + two inner diagonals meeting at centre
 *  - Two teardrop accents hanging from the centre V-point
 *
 * Transparent background — crisp on dark and light themes.
 */
export default function Logo({ size = 44 }) {
  const id = `mmg-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Mind Matters"
      style={{ flexShrink: 0 }}
    >
      <defs>
        {/* Main copper-gold gradient — top-left light → bottom-right dark */}
        <linearGradient id={id} x1="60" y1="60" x2="440" y2="440" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#D4956B" />
          <stop offset="35%"  stopColor="#C9A961" />
          <stop offset="70%"  stopColor="#B07D3A" />
          <stop offset="100%" stopColor="#8B5520" />
        </linearGradient>
      </defs>

      {/* ── Outer ring — thick ── */}
      <circle cx="250" cy="250" r="232"
              stroke={`url(#${id})`} strokeWidth="18" fill="none" />

      {/* ── Inner ring — thin, close to outer ── */}
      <circle cx="250" cy="250" r="210"
              stroke={`url(#${id})`} strokeWidth="4" fill="none" />

      {/* ── MM Monogram strokes ──
          Four strokes forming two interlocked M's:
            Left outer vertical  : (105, 380) → (105, 138)
            Left inner diagonal  : (105, 138) → (250, 272)
            Right inner diagonal : (250, 272) → (395, 138)
            Right outer vertical : (395, 138) → (395, 380)
      ── */}
      <polyline
        points="105,380 105,138 250,272 395,138 395,380"
        stroke={`url(#${id})`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* ── Upper teardrop (small) — pointed bottom, rounded top ──
          Centre ≈ (250, 295), radius ≈ 22, tip at 335
      ── */}
      <path
        d="M 250 274
           C 236 274 228 284 228 296
           C 228 310 238 320 250 320
           C 262 320 272 310 272 296
           C 272 284 264 274 250 274 Z"
        stroke={`url(#${id})`}
        strokeWidth="6"
        strokeLinejoin="round"
        fill="none"
      />

      {/* ── Lower teardrop (larger) — pointed bottom, rounded top ──
          Centre ≈ (250, 352), radius ≈ 30, tip at 400
      ── */}
      <path
        d="M 250 324
           C 231 324 218 338 218 354
           C 218 372 232 385 250 385
           C 268 385 282 372 282 354
           C 282 338 269 324 250 324 Z"
        stroke={`url(#${id})`}
        strokeWidth="6"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
