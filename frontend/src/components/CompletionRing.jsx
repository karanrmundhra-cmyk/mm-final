import React, { useEffect, useRef } from "react";

export default function CompletionRing({ done = 0, total = 0, size = 80, stroke = 6, label }) {
  const circleRef = useRef(null);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const offset = circumference * (1 - pct);

  // Animate on mount / change
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.style.setProperty("--dash-total", circumference);
    circleRef.current.style.setProperty("--dash-offset", offset);
    circleRef.current.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
      if (circleRef.current) circleRef.current.style.strokeDashoffset = offset;
    });
  }, [done, total, circumference, offset]);

  const isDone = pct === 1;

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0"
         style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke="var(--mm-surface-3)" strokeWidth={stroke} />
        {/* Progress arc */}
        {total > 0 && (
          <circle ref={circleRef}
                  cx={size / 2} cy={size / 2} r={r}
                  fill="none"
                  stroke="var(--mm-gold)"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference}
                  style={{
                    transition: "stroke-dashoffset 1s cubic-bezier(0.25,0.46,0.45,0.94)",
                    filter: "drop-shadow(0 0 5px rgba(212,175,55,0.45))",
                  }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mm-font-display font-light"
              style={{
                fontSize: size / 3.8,
                color: isDone ? "var(--mm-gold)" : "var(--mm-text)",
                lineHeight: 1,
              }}>
          {total === 0 ? "—" : isDone ? "✓" : `${Math.round(pct * 100)}%`}
        </span>
        {label && (
          <span style={{
            fontSize: 8, color: "var(--mm-muted)", letterSpacing: "0.12em",
            textTransform: "uppercase", marginTop: 3,
            fontFamily: "'Outfit',sans-serif",
          }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
