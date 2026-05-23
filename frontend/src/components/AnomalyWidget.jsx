/**
 * AnomalyWidget — spending anomaly detection banner for CashFlow page.
 * Loads lazily; shows nothing when no anomalies are found.
 */
import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronUp, Loader } from "lucide-react";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/utils";

export default function AnomalyWidget() {
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get("/cashflow/anomalies")
      .then(r => setResult(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center gap-2 px-4 py-3 mb-3 mm-card text-xs"
         style={{ color: "var(--mm-muted)" }}>
      <Loader size={12} className="animate-spin" style={{ color: "var(--mm-gold)" }} />
      Analysing spending patterns…
    </div>
  );

  if (!result || !result.anomalies || result.anomalies.length === 0) return null;

  const { anomalies, insight, month } = result;
  const topAnomaly = anomalies[0];

  const sevColor = {
    high:   "#E05252",
    medium: "#D4AF37",
    info:   "#4F8EF7",
  };

  return (
    <div className="mm-card mb-5 overflow-hidden animate-fade-in">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={13} style={{ color: sevColor[topAnomaly.severity] || "var(--mm-gold)", flexShrink: 0 }} />
          <div>
            <span className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>
              {anomalies.length} spending anomal{anomalies.length === 1 ? "y" : "ies"} detected
            </span>
            <span className="text-xs ml-2" style={{ color: "var(--mm-muted)" }}>{month}</span>
          </div>
        </div>
        <span style={{ color: "var(--mm-muted)" }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 animate-fade-in"
             style={{ borderColor: "var(--mm-border)" }}>

          {/* AI insight */}
          {insight && (
            <p className="text-sm py-3 italic" style={{ color: "var(--mm-muted)" }}>
              "{insight}"
            </p>
          )}

          {/* Anomaly list */}
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i}
                   className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                   style={{ background: `${sevColor[a.severity]}08`,
                            border: `1px solid ${sevColor[a.severity]}22` }}>

                <div className="flex-shrink-0">
                  {a.direction === "up"
                    ? <TrendingUp size={14} style={{ color: sevColor[a.severity] }} />
                    : a.direction === "down"
                    ? <TrendingDown size={14} style={{ color: "#52C77A" }} />
                    : <AlertTriangle size={14} style={{ color: sevColor[a.severity] }} />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--mm-text)" }}>
                    {a.category}
                  </p>
                  <p className="text-xs" style={{ color: "var(--mm-muted)" }}>
                    ₹{formatAmount(a.current)} this month
                    {a.avg_3mo > 0 && ` · avg ₹${formatAmount(a.avg_3mo)}`}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <span className="text-sm font-medium"
                        style={{ color: a.direction === "down" ? "#52C77A" : sevColor[a.severity] }}>
                    {a.direction === "new" ? "New" : `${a.change_pct > 0 ? "+" : ""}${a.change_pct.toFixed(0)}%`}
                  </span>
                  {a.direction !== "new" && (
                    <p className="text-xs" style={{ color: "var(--mm-muted)", fontSize: 10 }}>
                      vs 3-mo avg
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
