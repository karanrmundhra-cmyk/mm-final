import React from "react";

export default function Sparkline({ values = [], color = "#D4AF37", width = 72, height = 28 }) {
  const valid = values.filter(v => typeof v === "number");
  if (valid.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const range = max - min || 1;
  const pad = 3;
  const pts = valid.map((v, i) => {
    const x = pad + (i / (valid.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const [lx, ly] = pts.split(" ").pop().split(",");
  return (
    <svg width={width} height={height} style={{ overflow:"visible", flexShrink:0 }}>
      <polyline points={pts} fill="none" stroke={color}
                strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.65} />
      <circle cx={lx} cy={ly} r={2.5} fill={color} />
    </svg>
  );
}
