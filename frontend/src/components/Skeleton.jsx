import React from "react";

/**
 * #5 — Skeleton screens
 * Shimmer placeholders that match the shape of real content.
 * Usage:
 *   <Skeleton.Page />          — full page list skeleton
 *   <Skeleton.Card />          — single card
 *   <Skeleton.Row count={5} /> — table rows
 *   <Skeleton.Stat />          — stat number box
 */

const shimmer = {
  background: "linear-gradient(90deg, var(--mm-surface-2) 25%, var(--mm-surface-3) 50%, var(--mm-surface-2) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
};

// Inject shimmer keyframe once
if (typeof document !== "undefined" && !document.getElementById("mm-shimmer")) {
  const s = document.createElement("style");
  s.id = "mm-shimmer";
  s.textContent = `@keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }`;
  document.head.appendChild(s);
}

function Block({ w = "100%", h = 12, r = 8, className = "", style = {} }) {
  return (
    <div className={className}
         style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...shimmer, ...style }} />
  );
}

function Row({ count = 5 }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b"
             style={{ borderColor: "var(--mm-border)" }}>
          <Block w={18} h={18} r={50} />
          <Block w="45%" h={13} />
          <Block w="20%" h={11} style={{ marginLeft: "auto" }} />
        </div>
      ))}
    </div>
  );
}

function Card() {
  return (
    <div className="mm-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Block w={40} h={40} r={12} />
        <div className="flex-1 space-y-2">
          <Block w="60%" h={13} />
          <Block w="35%" h={10} />
        </div>
      </div>
      <Block w="80%" h={11} />
    </div>
  );
}

function Stat() {
  return (
    <div className="mm-card p-4 text-center space-y-2">
      <Block w={48} h={28} r={6} style={{ margin: "0 auto" }} />
      <Block w={56} h={10} r={4} style={{ margin: "0 auto" }} />
    </div>
  );
}

function Page({ rows = 6 }) {
  return (
    <div className="px-5 py-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Block w={140} h={22} r={8} />
          <Block w={80} h={10} r={4} />
        </div>
        <Block w={110} h={36} r={20} />
      </div>
      {/* Content rows */}
      <div className="mm-card overflow-hidden">
        <Row count={rows} />
      </div>
    </div>
  );
}

function TwoCol({ rows = 5 }) {
  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden">
      <div className="w-72 flex-shrink-0 border-r space-y-0 pt-4"
           style={{ borderColor: "var(--mm-border)" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <Block w={32} h={32} r={10} />
            <div className="flex-1 space-y-1.5">
              <Block w="70%" h={12} />
              <Block w="45%" h={10} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Block w={48} h={2} />
      </div>
    </div>
  );
}

const Skeleton = { Block, Row, Card, Stat, Page, TwoCol };
export default Skeleton;
