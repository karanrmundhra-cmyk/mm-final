import React, { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";

const PRESETS = [15, 30, 45, 60];

export default function CountdownTimer() {
  const [totalSecs,  setTotalSecs]  = useState(null);
  const [remaining,  setRemaining]  = useState(null);
  const [running,    setRunning]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [customVal,  setCustomVal]  = useState("");
  const intervalRef = useRef(null);

  const start = (mins) => {
    clearInterval(intervalRef.current);
    const secs = Math.round(mins) * 60;
    setTotalSecs(secs);
    setRemaining(secs);
    setDone(false);
    setRunning(true);
  };

  const toggle = () => setRunning(r => !r);

  const cancel = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setRemaining(null);
    setTotalSecs(null);
    setDone(false);
    setCustomVal("");
  };

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!running || remaining === null) return;
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          setDone(true);
          /* Browser notification if granted */
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("⏰ Mind Matters", { body: "Your timer is done!" });
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Preset selection ── */
  if (remaining === null) {
    return (
      <div>
        <div className="grid grid-cols-4 gap-3">
          {PRESETS.map(m => (
            <button key={m} onClick={() => start(m)}
                    className="mm-card mm-row p-4 text-center flex flex-col items-center gap-1 transition-all"
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--mm-border-gold)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ""; }}>
              <span className="text-3xl font-light mm-font-display" style={{ color: "var(--mm-gold)" }}>
                {m}
              </span>
              <span className="mm-label">Min</span>
            </button>
          ))}
        </div>

        {/* Custom time input */}
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number" min="1" max="999"
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            placeholder="Custom Minutes…"
            className="mm-form-input flex-1 text-xs"
            onKeyDown={e => {
              if (e.key === "Enter" && parseFloat(customVal) > 0) {
                start(parseFloat(customVal));
              }
            }}
          />
          <button
            onClick={() => parseFloat(customVal) > 0 && start(parseFloat(customVal))}
            className="mm-btn-gold px-4 text-xs py-2"
            style={{ opacity: parseFloat(customVal) > 0 ? 1 : 0.4 }}>
            Start
          </button>
        </div>
      </div>
    );
  }

  /* ── Running / paused / done ── */
  const pct    = totalSecs > 0 ? remaining / totalSecs : 0;
  const SIZE   = 224;
  const R      = 98;
  const CIRC   = 2 * Math.PI * R;
  const offset = CIRC * (1 - pct);
  const mins   = Math.floor(remaining / 60);
  const secs   = remaining % 60;
  const endTime = new Date(Date.now() + remaining * 1000);

  return (
    <div className="flex flex-col items-center gap-5">

      {/* Radial ring + time display */}
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track ring */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R}
                  fill="none"
                  stroke="rgba(240,237,232,0.07)"
                  strokeWidth="5" />
          {/* Progress ring — thin like Mac's radial timer */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R}
                  fill="none"
                  stroke={done ? "#22C55E" : "rgba(240,237,232,0.42)"}
                  strokeWidth="5"
                  strokeDasharray={CIRC}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.92s linear, stroke 0.3s" }}
                  transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`} />
        </svg>

        {/* Overlay text */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 8,
        }}>
          {!done && (
            <div className="flex items-center gap-1.5"
                 style={{
                   fontSize: 11, color: "var(--mm-muted)",
                   fontFamily: "'Outfit', sans-serif",
                 }}>
              <Bell size={10} />
              {endTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
            </div>
          )}

          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: done ? 36 : 52,
            fontWeight: 300,
            color: done ? "#22C55E" : "var(--mm-text)",
            lineHeight: 1,
            letterSpacing: "-0.025em",
          }}>
            {done
              ? "Done!"
              : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
          </p>

          {!done && (
            <p style={{
              fontSize: 9, color: "var(--mm-muted)",
              letterSpacing: "0.06em",
              fontFamily: "'Outfit', sans-serif",
            }}>
              {running ? "Timer" : "Paused"}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button onClick={cancel}
                style={{
                  padding: "10px 32px",
                  background: "var(--mm-surface-2)",
                  border: "1px solid var(--mm-border)",
                  borderRadius: 40,
                  color: "var(--mm-muted)",
                  fontSize: 14,
                  fontFamily: "'Outfit', sans-serif",
                  cursor: "pointer",
                }}>
          Cancel
        </button>

        {done ? (
          <button onClick={cancel}
                  className="mm-btn-gold"
                  style={{ padding: "10px 32px", borderRadius: 40, fontSize: 14 }}>
            New Timer
          </button>
        ) : (
          <button onClick={toggle}
                  style={{
                    padding: "10px 32px",
                    background: running ? "rgba(240,237,232,0.18)" : "var(--mm-gold)",
                    border: "none",
                    borderRadius: 40,
                    color: running ? "var(--mm-text)" : "#0a0a0a",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                    cursor: "pointer",
                  }}>
            {running ? "Pause" : "Resume"}
          </button>
        )}
      </div>
    </div>
  );
}
