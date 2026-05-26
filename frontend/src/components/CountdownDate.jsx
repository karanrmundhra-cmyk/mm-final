import React, { useState, useEffect } from "react";
import { Edit2, Check, Calendar } from "lucide-react";

export default function CountdownDate() {
  const [target,     setTarget]     = useState(() => localStorage.getItem("mm_cdate_target")  || "");
  const [label,      setLabel]      = useState(() => localStorage.getItem("mm_cdate_label")   || "Event Countdown");
  const [labelDraft, setLabelDraft] = useState(label);
  const [dateDraft,  setDateDraft]  = useState(() => localStorage.getItem("mm_cdate_target")  || "");
  const [editLabel,  setEditLabel]  = useState(false);
  const [editDate,   setEditDate]   = useState(false);
  const [tick,       setTick]       = useState(0); // forces 1-second re-renders

  /* Tick every second while there's a target */
  useEffect(() => {
    if (!target) return;
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [target]);

  /* Compute remaining time */
  const remaining = (() => {
    if (!target) return null;
    const t = new Date(target);
    if (isNaN(t)) return null;
    const diff = t - Date.now();
    if (diff <= 0) return { done: true };
    return {
      done:  false,
      days:  Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      mins:  Math.floor((diff % 3600000)  / 60000),
      secs:  Math.floor((diff % 60000)    / 1000),
    };
  })(); // eslint-disable-line react-hooks/exhaustive-deps

  const saveDate = () => {
    if (!dateDraft) return;
    setTarget(dateDraft);
    localStorage.setItem("mm_cdate_target", dateDraft);
    setEditDate(false);
  };

  const saveLabel = () => {
    setLabel(labelDraft);
    localStorage.setItem("mm_cdate_label", labelDraft);
    setEditLabel(false);
  };

  const clear = () => {
    setTarget(""); setDateDraft("");
    localStorage.removeItem("mm_cdate_target");
  };

  const pad = n => String(n).padStart(2, "0");

  /* ── No date set / edit date mode ── */
  if (!target || editDate) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <Calendar size={28} style={{ color: "var(--mm-gold)", opacity: 0.6 }} />
        <p style={{ fontSize: 12, color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
                    letterSpacing: "0.06em" }}>
          {editDate ? "Change Target Date" : "Set A Countdown Date"}
        </p>
        <input
          type="datetime-local"
          value={dateDraft}
          onChange={e => setDateDraft(e.target.value)}
          className="mm-form-input text-xs"
          style={{ width: "100%", colorScheme: "dark" }}
        />
        <div className="flex gap-2">
          {editDate && (
            <button onClick={() => setEditDate(false)}
                    style={{
                      padding: "8px 20px",
                      background: "var(--mm-surface-2)",
                      border: "1px solid var(--mm-border)",
                      borderRadius: 40,
                      color: "var(--mm-muted)",
                      fontSize: 13,
                      fontFamily: "'Outfit', sans-serif",
                      cursor: "pointer",
                    }}>
              Cancel
            </button>
          )}
          <button onClick={saveDate}
                  disabled={!dateDraft}
                  style={{
                    padding: "8px 28px",
                    background: "var(--mm-gold)",
                    border: "none",
                    borderRadius: 40,
                    color: "#0a0a0a",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                    cursor: "pointer",
                    opacity: dateDraft ? 1 : 0.4,
                  }}>
            Start
          </button>
        </div>
      </div>
    );
  }

  /* ── Arrived ── */
  if (remaining?.done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, color: "#22C55E" }}>
          🎉 Arrived!
        </p>
        <p style={{ fontSize: 11, color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif" }}>
          {label}
        </p>
        <button onClick={clear}
                className="mm-btn-gold"
                style={{ padding: "8px 28px", borderRadius: 40, fontSize: 13 }}>
          Set New Date
        </button>
      </div>
    );
  }

  /* ── Live countdown ── */
  return (
    <div className="flex flex-col items-center gap-3 py-2">

      {/* Editable label */}
      {editLabel ? (
        <div className="flex items-center gap-1">
          <input
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveLabel()}
            autoFocus
            className="mm-form-input text-xs"
            style={{ width: 150, textAlign: "center" }}
          />
          <button onClick={saveLabel} style={{ color: "var(--mm-gold)", padding: 4 }}>
            <Check size={12} />
          </button>
        </div>
      ) : (
        <button onClick={() => { setLabelDraft(label); setEditLabel(true); }}
                className="flex items-center gap-1.5 group"
                style={{
                  fontSize: 9, letterSpacing: "0.06em",
                  color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
                  background: "none", border: "none", cursor: "pointer",
                }}>
          {label}
          <Edit2 size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Days — large display number */}
      <div className="flex flex-col items-center" style={{ gap: 4 }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 56,
          fontWeight: 300,
          lineHeight: 1,
          color: "var(--mm-text)",
          letterSpacing: "-0.025em",
          display: "block",
        }}>
          {remaining.days}
        </span>
        <span style={{
          fontSize: 9, color: "var(--mm-muted)", letterSpacing: "0.06em",
          fontFamily: "'Outfit', sans-serif",
        }}>
          {remaining.days === 1 ? "Day" : "Days"}
        </span>
      </div>

      {/* HH : MM : SS */}
      <div className="flex items-end gap-0.5">
        {[
          { v: remaining.hours, l: "Hrs" },
          { v: remaining.mins,  l: "Min" },
          { v: remaining.secs,  l: "Sec" },
        ].map(({ v, l }, i) => (
          <React.Fragment key={l}>
            {i > 0 && (
              <span style={{
                fontSize: 18, color: "var(--mm-muted)", opacity: 0.3,
                paddingBottom: 10, paddingInline: 1,
              }}>
                :
              </span>
            )}
            <div className="flex flex-col items-center" style={{ gap: 1 }}>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 26, fontWeight: 300,
                color: "var(--mm-muted)", lineHeight: 1,
              }}>
                {pad(v)}
              </span>
              <span style={{
                fontSize: 7, color: "var(--mm-muted)", letterSpacing: "0.05em",
                fontFamily: "'Outfit', sans-serif", opacity: 0.6,
              }}>
                {l}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Change date */}
      <button onClick={() => { setDateDraft(target); setEditDate(true); }}
              style={{
                fontSize: 10, color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
                opacity: 0.4, background: "none", border: "none", cursor: "pointer",
                marginTop: 4,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}>
        Change Date
      </button>
    </div>
  );
}
