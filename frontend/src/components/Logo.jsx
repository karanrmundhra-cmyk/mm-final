import React from "react";

/**
 * Mind Matters — Official MM Monogram Logo (SVG)
 * Double-ring medallion with interlocked MM and falling teardrop accents.
 * Transparent background — adapts to dark and light themes.
 */
export default function Logo({ size = 44 }) {
  const id = `mm-grad-${size}`;
  const r  = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Mind Matters"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#E4C98C" />
          <stop offset="45%"  stopColor="#C9A961" />
          <stop offset="100%" stopColor="#8B6030" />
        </linearGradient>
      </defs>

      {/* ── Double ring border ── */}
      <circle cx="100" cy="100" r="92" stroke={`url(#${id})`} strokeWidth="3"   fill="none" />
      <circle cx="100" cy="100" r="85" stroke={`url(#${id})`} strokeWidth="1.2" fill="none" />

      {/* ── MM Monogram ──
          Left outer vertical  : (48, 150) → (48, 55)
          Left diagonal        : (48, 55)  → (100, 107)
          Right diagonal       : (100, 107)→ (152, 55)
          Right outer vertical : (152, 55) → (152, 150)
      ── */}
      <path
        d="M 48 150 L 48 55 L 100 107 L 152 55 L 152 150"
        stroke={`url(#${id})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* ── Upper small teardrop (rounded top, pointed bottom) ── */}
      <path
        d="M 100 111
           C 94 111 88.5 116 88.5 122
           C 88.5 128.5 93.5 133.5 100 133.5
           C 106.5 133.5 111.5 128.5 111.5 122
           C 111.5 118 109 113.5 106 111.5
           Q 103 109.5 100 111 Z"
        stroke={`url(#${id})`}
        strokeWidth="2"
        fill="none"
      />

      {/* ── Lower larger teardrop ── */}
      <path
        d="M 100 136
           C 92 136 83 143 83 152
           C 83 161 90.5 168 100 168
           C 109.5 168 117 161 117 152
           C 117 145.5 113 138.5 108.5 136.5
           Q 104.5 134.5 100 136 Z"
        stroke={`url(#${id})`}
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}
