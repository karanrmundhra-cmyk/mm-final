import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, RefreshCw, DollarSign, FileText, Bell, BarChart2,
         Settings, AlertCircle, Clock, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { formatAmount, timeAgo } from "@/lib/utils";

const QUICK_NAV = [
  { to: "/tasks", icon: CheckSquare, label: "Tasks", color: "#4F8EF7" },
  { to: "/routines", icon: RefreshCw, label: "Routines", color: "#A855F7" },
  { to: "/cash-flow", icon: DollarSign, label: "Cash Flow", color: "#14B8A6" },
  { to: "/notes", icon: FileText, label: "Notes", color: "#EAB308" },
  { to: "/reminders", icon: Bell, label: "Reminders", color: "#22C55E" },
  { to: "/people", icon: "👥", label: "People", color: "#EC4899" },
  { to: "/reports", icon: BarChart2, label: "Reports", color: "#F97316" },
  { to: "/settings", icon: Settings, label: "Settings", color: "#8B8FA8" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [news, setNews] = useState([]);
  const [newsCategory, setNewsCategory] = useState("general");
  const [customRss, setCustomRss] = useState(() => localStorage.getItem("mm_news_custom_url") || "");
  const [showCustomRss, setShowCustomRss] = useState(false);
  const [quote, setQuote] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const [dashRes, quoteRes] = await Promise.all([
        api.get("/dashboard"),
        api.get("/quote/today").catch(() => ({ data: null }))
      ]);
      setData(dashRes.data);
      setQuote(quoteRes.data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const params = customRss ? { custom_url: customRss } : { category: newsCategory };
        const { data } = await api.get("/news", { params });
        setNews(data.items || []);
      } catch {}
    };
    fetchNews();
  }, [newsCategory, customRss]);

  const toggle = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const isOpen = (key) => !collapsed[key];

  const Section = ({ id, title, children, count }) => (
    <div className="mb-4">
      <button onClick={() => toggle(id)}
              className="w-full flex items-center justify-between py-2 text-left">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--mm-muted)" }}>
            {title}
          </span>
          {count > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)" }}>
              {count}
            </span>
          )}
        </div>
        {isOpen(id) ? <ChevronUp size={14} style={{ color: "var(--mm-muted)" }} />
                     : <ChevronDown size={14} style={{ color: "var(--mm-muted)" }} />}
      </button>
      {isOpen(id) && <div className="animate-fade-in">{children}</div>}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>
          {data?.greeting || "Good morning"}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--mm-muted)" }}>
          {data?.date || now.toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          {" · "}
          {now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })}
        </p>
      </div>

      {/* Stats row */}
      {data?.stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Pending", value: data.stats.pending, color: "var(--mm-muted)" },
            { label: "Overdue", value: data.stats.overdue, color: data.stats.overdue > 0 ? "#E05252" : "var(--mm-muted)" },
            { label: "Done today", value: data.stats.done_today, color: "#52C77A" },
            { label: "Reminders", value: data.stats.reminders_due, color: "var(--mm-gold)" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center"
                 style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pending review banner */}
      {data?.pending_review_count > 0 && (
        <button
          onClick={() => navigate("/reports")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:opacity-90 transition-opacity"
          style={{ background: "#E0A05211", border: "1px solid #E0A05244" }}>
          <AlertTriangle size={16} style={{ color: "#E0A052", flexShrink: 0 }} />
          <div className="flex-1">
            <span className="text-sm font-medium" style={{ color: "#E0A052" }}>
              Pending Review — {data.pending_review_count} item{data.pending_review_count !== 1 ? "s" : ""}
            </span>
            <p className="text-xs" style={{ color: "#E0A05288" }}>Low-confidence items, duplicates, failed imports</p>
          </div>
          <span className="text-xs" style={{ color: "#E0A052" }}>Review →</span>
        </button>
      )}

      {/* Overdue */}
      {data?.overdue?.length > 0 && (
        <Section id="overdue" title="🔴 Overdue" count={data.overdue.length}>
          <div className="space-y-1">
            {data.overdue.map(t => (
              <button key={t.id} onClick={() => navigate("/tasks")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#E05252" }} />
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>{t.task}</span>
                <span className="text-xs" style={{ color: "#E05252" }}>{t.date}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Due today */}
      {data?.due_today?.length > 0 && (
        <Section id="today" title="📅 Due Today" count={data.due_today.length}>
          <div className="space-y-1">
            {data.due_today.map(t => (
              <button key={t.id} onClick={() => navigate("/tasks")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--mm-gold)" }} />
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>{t.task}</span>
                {t.name && <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{t.name}</span>}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Due soon */}
      {data?.due_soon?.length > 0 && (
        <Section id="soon" title="⏳ Due Soon">
          <div className="space-y-1">
            {data.due_soon.map(t => (
              <button key={t.id} onClick={() => navigate("/tasks")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--mm-muted)" }} />
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>{t.task}</span>
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{t.date}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Reminders */}
      {data?.reminders?.length > 0 && (
        <Section id="reminders" title="🔔 Upcoming Reminders">
          <div className="space-y-1">
            {data.reminders.map(r => (
              <button key={r.id} onClick={() => navigate("/reminders")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left">
                <Bell size={14} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>{r.title}</span>
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>
                  {r.fire_at ? new Date(r.fire_at).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }) : ""}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Routines */}
      {data?.routines?.length > 0 && (
        <Section id="routines" title="✅ Today's Routines">
          <div className="space-y-1">
            {data.routines.map(r => (
              <button key={r.id} onClick={() => navigate("/routines")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left">
                <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0`}
                     style={{ borderColor: r.done_today ? "#52C77A" : "var(--mm-border)",
                              background: r.done_today ? "#52C77A22" : "transparent" }}>
                  {r.done_today && <span style={{ color: "#52C77A", fontSize: 10 }}>✓</span>}
                </div>
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)", opacity: r.done_today ? 0.6 : 1 }}>
                  {r.activity}
                </span>
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{r.group}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Cash flow */}
      {data?.cashflow && (
        <Section id="cashflow" title="💰 Month Finances">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.cashflow).map(([cat, val]) => (
              <button key={cat} onClick={() => navigate("/cash-flow")}
                      className="rounded-xl p-3 text-left hover:opacity-90"
                      style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
                <div className="text-xs" style={{ color: "var(--mm-muted)" }}>{cat}</div>
                <div className="text-base font-semibold mt-0.5" style={{ color: "var(--mm-text)" }}>
                  ₹{formatAmount(val)}
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Quick nav */}
      <Section id="quicknav" title="Quick Access">
        <div className="grid grid-cols-4 gap-2">
          {QUICK_NAV.map(n => {
            const Icon = typeof n.icon === "string" ? null : n.icon;
            return (
              <button key={n.to} onClick={() => navigate(n.to)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl hover:opacity-90 transition-opacity"
                      style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                     style={{ background: `${n.color}22` }}>
                  {Icon ? <Icon size={18} style={{ color: n.color }} />
                        : <span style={{ fontSize: 18 }}>{n.icon}</span>}
                </div>
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* AI Brief */}
      {quote && (
        <Section id="brief" title="💡 Daily Quote">
          <div className="rounded-xl px-4 py-3"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
            <p className="text-sm italic mm-font-serif" style={{ color: "var(--mm-text)" }}>"{quote.quote}"</p>
            {quote.author && (
              <p className="text-xs mt-2" style={{ color: "var(--mm-muted)" }}>— {quote.author}</p>
            )}
          </div>
        </Section>
      )}

      {/* News */}
      <Section id="news" title="📰 News">
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {["general","business","tech","india","world"].map(c => (
              <button key={c} onClick={() => setNewsCategory(c)}
                      className="px-2.5 py-1 rounded-full text-xs capitalize transition-colors"
                      style={{
                        background: newsCategory === c && !showCustomRss ? "var(--mm-gold)" : "var(--mm-surface-2)",
                        color: newsCategory === c && !showCustomRss ? "#0A0A0A" : "var(--mm-muted)",
                        border: `1px solid var(--mm-border)`
                      }}>
                {c}
              </button>
            ))}
            <button onClick={() => setShowCustomRss(s => !s)}
                    className="px-2.5 py-1 rounded-full text-xs transition-colors"
                    style={{
                      background: showCustomRss ? "var(--mm-gold)" : "var(--mm-surface-2)",
                      color: showCustomRss ? "#0A0A0A" : "var(--mm-muted)",
                      border: `1px solid var(--mm-border)`
                    }}>
              Custom RSS
            </button>
          </div>
          {showCustomRss && (
            <div className="flex gap-2">
              <input value={customRss} onChange={e => setCustomRss(e.target.value)}
                     placeholder="https://feed.example.com/rss"
                     className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
                     style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                              color: "var(--mm-text)" }} />
              <button onClick={() => { localStorage.setItem("mm_news_custom_url", customRss); }}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
                Save
              </button>
            </div>
          )}
          <div className="space-y-1">
            {news.map((item, i) => (
              <p key={i} className="text-sm py-1.5 border-b" style={{ color: "var(--mm-muted)",
                                                                        borderColor: "var(--mm-border)" }}>
                {item}
              </p>
            ))}
            {news.length === 0 && (
              <p className="text-sm" style={{ color: "var(--mm-muted)" }}>No news available</p>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
