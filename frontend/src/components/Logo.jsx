import React from "react";

/**
 * Mind Matters — SVG Sigil Logo
 * Monogrammed "M" inside a thin gold-gradient circle ring.
 * Never recolor. Always pair sigil + ring together.
 */
export default function Logo({ size = 44 }) {
  const id = `mm-logo-grad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Mind Matters"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#E4C98C" />
          <stop offset="100%" stopColor="#C9A961" />
        </linearGradient>
      </defs>

      {/* Thin gold circle frame */}
      <circle
        cx="22" cy="22" r="20"
        stroke={`url(#${id})`}
        strokeWidth="1.2"
        fill="none"
      />

      {/* Geometric M sigil — clean strokes, no fill */}
      <path
        d="M11 31 L11 13 L22 25 L33 13 L33 31"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
