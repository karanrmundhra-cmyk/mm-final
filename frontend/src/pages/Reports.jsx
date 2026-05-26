import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Loader, Download, Check, Trash2, BarChart2, RefreshCw, AlertTriangle } from "lucide-react";
import DigestWidget from "@/components/DigestWidget";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatAmount } from "@/lib/utils";

const TABS = ["Inbox", "Briefing", "Synopsis", "Signals", "Pending Review"];

export default function Reports() {
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab || "Inbox");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const loadTab = useCallback(async (t) => {
    setLoading(true);
    try {
      if (t === "Briefing") {
        const { data: d } = await api.get("/reports/briefing");
        setData(prev => ({ ...prev, briefing: d }));
      } else if (t === "Synopsis") {
        const { data: d } = await api.get("/reports/cashflow-monthly");
        setData(prev => ({ ...prev, synopsis: d }));
      } else if (t === "Signals") {
        const { data: d } = await api.get("/reports/patterns");
        setData(prev => ({ ...prev, signals: d }));
      } else if (t === "Inbox") {
        const { data: d } = await api.get("/reports/timeline");
        setData(prev => ({ ...prev, inbox: d }));
      } else if (t === "Pending Review") {
        setPendingLoading(true);
        const { data: d } = await api.get("/pending-review");
        /* API may return an array or {items:[]} shape — normalise to array */
        setPendingItems(Array.isArray(d) ? d : (d?.items || d?.results || d?.data || []));
        setPendingLoading(false);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (id) => {
    try {
      await api.post(`/pending-review/${id}/approve`);
      toast.success("✓ Approved");
      setPendingItems(ps => ps.filter(p => p.id !== id));
    } catch {}
  };

  const discard = async (id) => {
    try {
      await api.delete(`/pending-review/${id}`);
      toast.success("✓ Discarded");
      setPendingItems(ps => ps.filter(p => p.id !== id));
    } catch {}
  };

  const exportCsv = (type) => {
    window.open(`${api.defaults.baseURL}/export/${type}.csv`, "_blank");
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Reports</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>Insights and review</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv("tasks")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:bg-white/5"
                  style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
            <Download size={12} /> Tasks
          </button>
          <button onClick={() => exportCsv("cashflow")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:bg-white/5"
                  style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
            <Download size={12} /> Cash Flow
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: "var(--mm-border)" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-2 text-sm font-medium transition-colors relative"
                  style={{ color: tab === t ? "var(--mm-text)" : "var(--mm-muted)" }}>
            {t}
            {tab === t && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                   style={{ background: "var(--mm-gold)" }} />
            )}
          </button>
        ))}
      </div>

      {loading && tab !== "Pending Review" ? (
        <LoadingBlock />
      ) : (
        <>
          {/* Inbox — timeline */}
          {tab === "Inbox" && (
            <div className="space-y-3">
              {(data.inbox || []).length === 0 ? (
                <EmptySection icon="📋" title="No timeline data" />
              ) : (data.inbox || []).map((item, i) => (
                <div key={i} className="mm-card px-4 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                       style={{ background: "var(--mm-gold)" }} />
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: "var(--mm-text)" }}>{item.label || item.task || item.title}</p>
                    <p className="text-xs" style={{ color: "var(--mm-muted)" }}>{item.date} · {item.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Briefing */}
          {tab === "Briefing" && (
            <div className="space-y-4">
              {/* Weekly AI digest */}
              <DigestWidget />

              {/* Daily briefing */}
              {data.briefing ? (
                <>
                  <div className="mm-card p-4">
                    <p className="text-xs mb-2" style={{ color: "var(--mm-muted)", letterSpacing: "0.04em" }}>Today's Briefing</p>
                    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--mm-text)" }}>
                      {data.briefing.summary || data.briefing}
                    </p>
                  </div>
                  {data.briefing.sections && data.briefing.sections.map((s, i) => (
                    <div key={i} className="mm-card p-4">
                      <p className="text-xs mb-2" style={{ color: "var(--mm-muted)", letterSpacing: "0.04em" }}>{s.title}</p>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--mm-text)" }}>{s.content}</p>
                    </div>
                  ))}
                </>
              ) : (
                <EmptySection icon="📊" title="No briefing data yet" />
              )}
            </div>
          )}

          {/* Synopsis — cashflow */}
          {tab === "Synopsis" && (
            <div className="space-y-4">
              {data.synopsis ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(data.synopsis.totals || []).map(t => (
                      <div key={t.category} className="mm-card p-4 text-center">
                        <p className="text-xs mb-1" style={{ color: "var(--mm-muted)" }}>{t.category}</p>
                        <p className="text-lg font-semibold" style={{ color: t.category === "Income" ? "var(--mm-gold)" : t.category === "Expense" ? "var(--mm-muted)" : "var(--mm-text)" }}>
                          ₹{formatAmount(t.total || 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(data.synopsis.monthly || []).length > 0 && (
                    <div className="mm-card p-4">
                      <p className="text-xs mb-3" style={{ color: "var(--mm-muted)", letterSpacing: "0.04em" }}>Monthly Trend</p>
                      <div className="space-y-2">
                        {data.synopsis.monthly.map((m, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs w-16 flex-shrink-0" style={{ color: "var(--mm-muted)" }}>{m.month}</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--mm-surface-2)" }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (m.income / (data.synopsis.max_income || 1)) * 100)}%`, background: "var(--mm-gold)" }} />
                            </div>
                            <span className="text-xs w-20 text-right" style={{ color: "var(--mm-text)" }}>₹{formatAmount(m.income)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptySection icon="💰" title="No financial data" />
              )}
            </div>
          )}

          {/* Signals — patterns */}
          {tab === "Signals" && (
            <div className="space-y-3">
              {data.signals ? (
                (Array.isArray(data.signals) ? data.signals : data.signals.insights || []).map((s, i) => (
                  <div key={i} className="mm-card px-4 py-3 flex items-start gap-3">
                    <BarChart2 size={16} style={{ color: "var(--mm-gold)", flexShrink: 0, marginTop: 2 }} />
                    <p className="text-sm" style={{ color: "var(--mm-text)" }}>{typeof s === "string" ? s : s.insight || s.text}</p>
                  </div>
                ))
              ) : (
                <EmptySection icon="📈" title="No signals yet" />
              )}
              {data.signals && (Array.isArray(data.signals) ? data.signals : data.signals.insights || []).length === 0 && (
                <EmptySection icon="📈" title="No signals yet" desc="Add more data to see patterns." />
              )}
            </div>
          )}

          {/* Pending Review */}
          {tab === "Pending Review" && (
            <div className="space-y-3">
              {pendingLoading ? <LoadingBlock /> : pendingItems.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <Check size={40} style={{ color: "var(--mm-gold)" }} />
                  <h3 className="text-base font-semibold" style={{ color: "var(--mm-text)" }}>All clear</h3>
                  <p className="text-sm" style={{ color: "var(--mm-muted)" }}>No items need review.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl mb-2"
                       style={{ background: "rgba(201,169,97,0.06)", border: "1px solid var(--mm-border-gold)" }}>
                    <AlertTriangle size={14} style={{ color: "var(--mm-gold)" }} />
                    <p className="text-xs" style={{ color: "var(--mm-gold)" }}>
                      {pendingItems.length} item{pendingItems.length !== 1 ? "s" : ""} need review — low-confidence AI parses, duplicates, or failed imports.
                    </p>
                  </div>
                  {pendingItems.map(item => (
                    <div key={item.id} className="mm-card px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-1.5 py-0.5 rounded-full capitalize"
                                  style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)" }}>
                              {item._type || item.type}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: "var(--mm-surface-3)", color: "var(--mm-muted)" }}>
                              {item.confidence || "low"} confidence
                            </span>
                          </div>
                          <p className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>
                            {item.task || item.title || item.activity || item.vendor || "Untitled"}
                          </p>
                          {item.review_reason && (
                            <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>{item.review_reason}</p>
                          )}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => approve(item.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
                                  style={{ background: "rgba(201,169,97,0.08)", color: "var(--mm-gold)", border: "1px solid var(--mm-border-gold)" }}>
                            <Check size={11} /> Approve
                          </button>
                          <button onClick={() => discard(item.id)}
                                  className="p-1.5 rounded-lg"
                                  style={{ color: "var(--mm-muted)" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptySection({ icon, title, desc }) {
  return (
    <div className="flex flex-col items-center py-16 gap-3 text-center">
      <span style={{ fontSize: 36 }}>{icon}</span>
      <p className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>{title}</p>
      {desc && <p className="text-xs" style={{ color: "var(--mm-muted)" }}>{desc}</p>}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex justify-center py-12">
      <Loader size={24} className="animate-spin" style={{ color: "var(--mm-gold)" }} />
    </div>
  );
}
