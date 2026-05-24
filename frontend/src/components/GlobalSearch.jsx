import React, { useState, useEffect, useRef } from "react";
import { Search, X, CheckSquare, FileText, Bell, DollarSign, Users, Vault } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

const TYPE_META = {
  task:        { icon: CheckSquare, color: "#D4AF37", label: "Task", route: "/tasks" },
  routine:     { icon: RefreshCw,   color: "#D4AF37", label: "Routine", route: "/routines" },
  transaction: { icon: DollarSign,  color: "#D4AF37", label: "Transaction", route: "/cash-flow" },
  note:        { icon: FileText,    color: "#D4AF37", label: "Note", route: "/notes" },
  reminder:    { icon: Bell,        color: "#D4AF37", label: "Reminder", route: "/reminders" },
  person:      { icon: Users,       color: "#D4AF37", label: "Person", route: "/people" },
  document:    { icon: Vault,       color: "#D4AF37", label: "Document", route: "/vault" },
};

function RefreshCw(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>;
}

export default function GlobalSearch({ onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [suggestions, setSuggestions] = useState(null);
  const navigate = useNavigate();
  const inputRef = useRef();

  useEffect(() => {
    api.get("/dashboard").then(r => setSuggestions(r.data)).catch(() => {});
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/search", { params: { q } });
        setResults(data);
      } catch {}
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const filtered = filter === "all" ? results : results.filter(r => r.type === filter);
  const types = ["all", ...new Set(results.map(r => r.type))];

  const open = (result) => {
    const meta = TYPE_META[result.type];
    if (meta) navigate(meta.route);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 p-4"
         style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-xl overflow-hidden animate-slide-up"
           style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3"
             style={{ borderBottom: "1px solid var(--mm-border)" }}>
          <Search size={18} style={{ color: "var(--mm-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search tasks, notes, people, transactions..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--mm-text)" }}
            onKeyDown={e => e.key === "Escape" && onClose()}
          />
          {loading && <div className="w-4 h-4 border-2 rounded-full animate-spin"
                           style={{ borderColor: "var(--mm-gold)", borderTopColor: "transparent" }} />}
          <button onClick={onClose} style={{ color: "var(--mm-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Type chips */}
        {results.length > 0 && (
          <div className="flex gap-2 px-4 py-2 overflow-x-auto"
               style={{ borderBottom: "1px solid var(--mm-border)" }}>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="px-2.5 py-1 rounded-full text-xs capitalize whitespace-nowrap transition-colors"
                style={{
                  background: filter === t ? "var(--mm-gold)" : "var(--mm-surface-2)",
                  color: filter === t ? "#0A0A0A" : "var(--mm-muted)",
                  border: `1px solid ${filter === t ? "transparent" : "var(--mm-border)"}`
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 && q.length >= 2 && !loading && (
            <div className="flex flex-col items-center py-12 gap-3" style={{ color: "var(--mm-muted)" }}>
              <Search size={32} style={{ opacity: 0.3 }} />
              <p className="text-sm">No results for "{q}"</p>
              <p className="text-xs">Try different keywords or a person's name</p>
            </div>
          )}
          {q.length < 2 && (
            <div className="p-4">
              {!suggestions ? (
                <div className="flex flex-col items-center py-8 gap-2" style={{ color:"var(--mm-muted)" }}>
                  <Search size={24} style={{ opacity:0.3 }} />
                  <p className="text-sm">Search tasks, notes, people, transactions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.due_today?.length > 0 && (
                    <div>
                      <p className="mm-label mb-2 px-1">Due Today</p>
                      {suggestions.due_today.slice(0,3).map(t => (
                        <button key={t.id} onClick={() => { navigate("/tasks"); onClose(); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                               style={{ background:"rgba(212,175,55,0.1)" }}>
                            <span style={{ color:"var(--mm-gold)", fontSize:12 }}>✓</span>
                          </div>
                          <span className="flex-1 text-sm" style={{ color:"var(--mm-text)" }}>{t.task}</span>
                          {t.name && <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{t.name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {suggestions.reminders?.length > 0 && (
                    <div>
                      <p className="mm-label mb-2 px-1">Upcoming Reminders</p>
                      {suggestions.reminders.slice(0,3).map(r => (
                        <button key={r.id} onClick={() => { navigate("/reminders"); onClose(); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                               style={{ background:"rgba(212,175,55,0.15)" }}>
                            <span style={{ color:"var(--mm-gold)", fontSize:12 }}>🔔</span>
                          </div>
                          <span className="flex-1 text-sm" style={{ color:"var(--mm-text)" }}>{r.title}</span>
                          {r.fire_at && <span className="text-xs" style={{ color:"var(--mm-muted)" }}>
                            {new Date(r.fire_at).toLocaleTimeString("en-IN",{ hour:"2-digit", minute:"2-digit" })}
                          </span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {suggestions.overdue?.length > 0 && (
                    <div>
                      <p className="mm-label mb-2 px-1">Overdue</p>
                      {suggestions.overdue.slice(0,2).map(t => (
                        <button key={t.id} onClick={() => { navigate("/tasks"); onClose(); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                               style={{ background:"var(--mm-surface-3)" }}>
                            <span style={{ color:"var(--mm-muted)", fontSize:12 }}>!</span>
                          </div>
                          <span className="flex-1 text-sm" style={{ color:"var(--mm-text)" }}>{t.task}</span>
                          <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{t.date}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!suggestions.due_today?.length && !suggestions.reminders?.length && !suggestions.overdue?.length && (
                    <div className="flex flex-col items-center py-8 gap-2" style={{ color:"var(--mm-muted)" }}>
                      <Search size={24} style={{ opacity:0.3 }} />
                      <p className="text-sm">Search tasks, notes, people, transactions</p>
                    </div>
                  )}
                  <div className="pt-2 border-t text-center" style={{ borderColor:"var(--mm-border)" }}>
                    <p className="text-xs" style={{ color:"var(--mm-muted)" }}>Start typing to search everything</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {filtered.map((r, i) => {
            const meta = TYPE_META[r.type] || { label: r.type, color: "#888" };
            const Icon = meta.icon || FileText;
            return (
              <button
                key={i}
                onClick={() => open(r)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                style={{ borderBottom: "1px solid var(--mm-border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: `${meta.color}22` }}>
                  <Icon size={14} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: `${meta.color}22`, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-sm font-medium truncate" style={{ color: "var(--mm-text)" }}>
                      {r.label}
                    </span>
                  </div>
                  {r.preview && (
                    <p className="text-xs truncate" style={{ color: "var(--mm-muted)" }}>{r.preview}</p>
                  )}
                  {r.meta && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)", opacity: 0.7 }}>{r.meta}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
