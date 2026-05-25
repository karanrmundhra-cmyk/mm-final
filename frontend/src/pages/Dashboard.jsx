import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ChevronDown, ChevronUp, Check,
  Star, ClipboardList, Edit2, Plus, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

/* ── Helpers ─────────────────────────────────────────────────────── */
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getWeekNumber(d = new Date()) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

function wxEmoji(code) {
  const c = parseInt(code, 10);
  if (c === 113) return "☀️";
  if ([116, 119, 122].includes(c)) return "⛅";
  if ([143, 248, 260].includes(c)) return "🌫️";
  if ([200, 386, 389, 392, 395].includes(c)) return "⛈️";
  if ([227, 230, 335, 338, 371, 374].includes(c)) return "❄️";
  if (c >= 176) return "🌧️";
  return "🌤️";
}

/* ── News tab config ─────────────────────────────────────────────── */
const CATEGORY_OPTIONS = [
  { value: "general",       label: "General"       },
  { value: "business",      label: "Business"      },
  { value: "tech",          label: "Technology"    },
  { value: "science",       label: "Science"       },
  { value: "health",        label: "Health"        },
  { value: "sports",        label: "Sports"        },
  { value: "entertainment", label: "Entertainment" },
];
const COUNTRY_OPTIONS = [
  { value: "india",     label: "India"     },
  { value: "world",     label: "World"     },
  { value: "us",        label: "USA"       },
  { value: "uk",        label: "UK"        },
  { value: "canada",    label: "Canada"    },
  { value: "australia", label: "Australia" },
  { value: "uae",       label: "UAE"       },
  { value: "singapore", label: "Singapore" },
  { value: "germany",   label: "Germany"   },
  { value: "japan",     label: "Japan"     },
];

const DEFAULT_NEWS_TABS = [
  { id: 1, label: "General",  category: "general"  },
  { id: 2, label: "Business", category: "business" },
  { id: 3, label: "Tech",     category: "tech"     },
  { id: 4, label: "India",    category: "india"    },
  { id: 5, label: "World",    category: "world"    },
];

/* ── Personal Affirmation card ───────────────────────────────────── */
function AffirmationCard() {
  const [text, setText]   = useState(() => localStorage.getItem("mm_affirmation") || "");
  const [saved, setSaved] = useState(false);
  const timer             = useRef(null);

  const onChange = (v) => {
    setText(v);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      localStorage.setItem("mm_affirmation", v);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  return (
    <div className="px-5 py-4 mt-3"
         style={{
           borderLeft: "3px solid var(--mm-border-gold)",
           background: "rgba(212,175,55,0.04)",
           borderRadius: "0 16px 16px 0",
         }}>
      <div className="flex items-center justify-between mb-2">
        <p style={{
          fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "var(--mm-gold)", fontFamily: "'Outfit', sans-serif",
        }}>
          Personal Affirmation
        </p>
        {saved && (
          <span style={{ fontSize: 10, color: "#22C55E", fontFamily: "'Outfit', sans-serif" }}>
            ✓ Saved
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder="Write your personal affirmation for today…"
        rows={2}
        className="w-full resize-none outline-none bg-transparent"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 16,
          fontStyle: "italic",
          color: "var(--mm-text)",
          lineHeight: 1.65,
          border: "none",
        }}
      />
    </div>
  );
}

/* ── News tab manager modal ──────────────────────────────────────── */
function NewsTabModal({ tabs, onSave, onClose }) {
  const [local, setLocal] = useState(tabs.map(t => ({ ...t })));

  const update = (i, key, val) =>
    setLocal(arr => arr.map((t, j) => j === i ? { ...t, [key]: val } : t));
  const add    = () => {
    if (local.length >= 5) return;
    setLocal(arr => [...arr, { id: Date.now(), label: "My Tab", category: "general" }]);
  };
  const remove = (i) => setLocal(arr => arr.filter((_, j) => j !== i));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)" }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md animate-scale-in"
           style={{
             background: "var(--mm-surface)",
             border: "1px solid var(--mm-border-gold)",
             borderRadius: 24, padding: 24,
           }}>
        <div className="flex items-center justify-between mb-5">
          <h3 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20, fontWeight: 400, color: "var(--mm-text)",
          }}>
            Manage News Tabs
          </h3>
          <button onClick={onClose} className="mm-icon-btn">×</button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--mm-muted)" }}>
          Customise up to 5 tabs — choose any category or country.
        </p>

        <div className="space-y-2.5 mb-3">
          {local.map((tab, i) => (
            <div key={tab.id} className="flex items-center gap-2">
              <input
                value={tab.label}
                onChange={e => update(i, "label", e.target.value)}
                placeholder="Tab name"
                className="mm-form-input text-xs"
                style={{ flex: "0 0 96px" }}
              />
              <select
                value={tab.category}
                onChange={e => update(i, "category", e.target.value)}
                className="mm-form-input text-xs flex-1">
                <optgroup label="Categories">
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Countries">
                  {COUNTRY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              </select>
              <button onClick={() => remove(i)}
                      style={{ color: "var(--mm-muted)", opacity: 0.5, padding: 4 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {local.length < 5 && (
          <button onClick={add}
                  className="w-full flex items-center justify-center gap-1.5 py-2 mb-3"
                  style={{
                    border: "1px dashed var(--mm-border)", borderRadius: 12,
                    color: "var(--mm-muted)", fontSize: 12,
                    fontFamily: "'Outfit', sans-serif",
                  }}>
            <Plus size={12} /> Add Tab
          </button>
        )}

        <button onClick={() => { onSave(local); onClose(); }}
                className="mm-btn-gold w-full py-2.5 text-xs">
          Save Changes
        </button>
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data,          setData]         = useState(null);
  const [news,          setNews]         = useState([]);
  const [newsTabs,      setNewsTabs]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("mm_news_tabs") || "null") || DEFAULT_NEWS_TABS; }
    catch { return DEFAULT_NEWS_TABS; }
  });
  const [activeNewsTab, setActiveNewsTab] = useState(0);
  const [customRss,     setCustomRss]    = useState(() => localStorage.getItem("mm_news_custom_url") || "");
  const [showOthersRss, setShowOthersRss]= useState(false);
  const [showTabModal,  setShowTabModal] = useState(false);
  const [quote,         setQuote]        = useState(null);
  const [collapsed,     setCollapsed]    = useState({});
  const [now,           setNow]          = useState(new Date());
  const [completedIds,  setCompletedIds] = useState(new Set());
  const [showReview,    setShowReview]   = useState(false);
  const [weather,       setWeather]      = useState(null);

  /* Clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  /* Weekly review */
  useEffect(() => {
    const key = `mm_review_week_${getWeekNumber()}`;
    if (!localStorage.getItem(key)) setShowReview(true);
  }, []);
  const dismissReview = () => {
    localStorage.setItem(`mm_review_week_${getWeekNumber()}`, "1");
    setShowReview(false);
  };

  /* Weather via wttr.in (no API key needed) */
  useEffect(() => {
    fetch("https://wttr.in/?format=j1")
      .then(r => r.json())
      .then(d => {
        const c = d.current_condition?.[0];
        if (!c) return;
        setWeather({
          temp:  c.temp_C,
          desc:  (c.weatherDesc?.[0]?.value || "").split(" ").slice(0, 2).join(" "),
          emoji: wxEmoji(c.weatherCode),
        });
      })
      .catch(() => {});
  }, []);

  /* Dashboard data + quote */
  const load = useCallback(async () => {
    try {
      const [dashRes, quoteRes] = await Promise.all([
        api.get("/dashboard"),
        api.get("/quote/today").catch(() => ({ data: null })),
      ]);
      setData(dashRes.data);
      setQuote(quoteRes.data);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  /* News */
  const isOthersTab = activeNewsTab === newsTabs.length;
  useEffect(() => {
    if (isOthersTab) {
      if (!customRss) return;
      api.get("/news", { params: { custom_url: customRss } })
         .then(r => setNews(r.data.items || []))
         .catch(() => {});
      return;
    }
    const tab = newsTabs[activeNewsTab];
    if (!tab) return;
    api.get("/news", { params: { category: tab.category } })
       .then(r => setNews(r.data.items || []))
       .catch(() => {});
  }, [activeNewsTab, newsTabs, customRss, isOthersTab]);

  const saveNewsTabs = (tabs) => {
    setNewsTabs(tabs);
    localStorage.setItem("mm_news_tabs", JSON.stringify(tabs));
  };

  const toggle = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const isOpen = (key) => !collapsed[key];

  const completeTask = async (id) => {
    try {
      await api.patch(`/tasks/${id}`, { status: "Completed" });
      setCompletedIds(s => new Set([...s, id]));
    } catch {}
  };

  /* Derived */
  const top3 = [...(data?.due_today || [])]
    .filter(t => !completedIds.has(t.id))
    .sort((a, b) => {
      const pOrder = { P1: 0, P2: 1, P3: 2, P4: 3, "": 4 };
      const pa = pOrder[a.priority ?? ""] ?? 4;
      const pb = pOrder[b.priority ?? ""] ?? 4;
      if (pa !== pb) return pa - pb;
      if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
      return 0;
    })
    .slice(0, 3);

  const spendingInsight = (() => {
    if (!data?.cashflow) return null;
    const exp = data.cashflow["Expense"] || 0;
    return exp > 0 ? `₹${formatAmount(exp)} spent this month` : null;
  })();

  /* ── Sub-components ── */
  const Section = ({ id, title, count, children }) => (
    <div className="mb-5">
      <button onClick={() => toggle(id)}
              className="w-full flex items-center justify-between py-2 text-left group">
        <div className="flex items-center gap-2.5">
          <span className="mm-label">{title}</span>
          {count > 0 && (
            <span className="text-xs px-1.5 py-0.5"
                  style={{ background: "var(--mm-surface-3)", color: "var(--mm-muted)",
                           fontSize: 10, borderRadius: 6 }}>
              {count}
            </span>
          )}
        </div>
        <span style={{ color: "var(--mm-muted)", opacity: 0.5 }}>
          {isOpen(id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {isOpen(id) && <div className="animate-fade-in">{children}</div>}
    </div>
  );

  const TaskCheckRow = ({ t, to }) => (
    <div className="mm-row flex items-center gap-3 px-4 py-3 border-b"
         style={{ borderColor: "var(--mm-border)" }}>
      <button
        onClick={() => completeTask(t.id)}
        className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all"
        style={{ borderColor: "var(--mm-border)" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--mm-gold)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--mm-border)"}
        title="Mark complete">
        <Check size={10} style={{ color: "var(--mm-muted)", opacity: 0.4 }} />
      </button>
      <button onClick={() => navigate(to)} className="flex-1 text-left flex items-center gap-2 min-w-0">
        <span className="text-sm truncate" style={{ color: "var(--mm-text)" }}>{t.task}</span>
        {t.priority && <span className={`mm-est-pill mm-${t.priority.toLowerCase()}`}>{t.priority}</span>}
        {t.estimate && <span className="mm-est-pill">{t.estimate}</span>}
        {t.name && <span className="text-xs flex-shrink-0" style={{ color: "var(--mm-muted)" }}>{t.name}</span>}
      </button>
      <span className="text-xs flex-shrink-0" style={{ color: "var(--mm-muted)" }}>{t.date}</span>
    </div>
  );

  /* ── Render ── */
  return (
    <div className="px-6 py-8 space-y-7" style={{ maxWidth: "100%" }}>

      {/* ── Hero Greeting ── */}
      <div>
        {/* Date · Time — small caps above */}
        <p style={{
          fontSize: 11, color: "var(--mm-muted)", letterSpacing: "0.18em",
          textTransform: "uppercase", fontFamily: "'Outfit', sans-serif", marginBottom: 14,
        }}>
          {now.toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
          }).toUpperCase()}
          {" · "}
          {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
        </p>

        {/* Greeting + inline weather */}
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(38px, 5.2vw, 76px)",
          fontWeight: 300, lineHeight: 1.1,
          color: "var(--mm-text)", letterSpacing: "-0.01em",
        }}>
          {timeGreeting()},{" "}
          <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--mm-gold)", letterSpacing: "0.01em" }}>
            {user?.first_name}{user?.last_name ? ` ${user.last_name}` : ""}
          </em>
          <span style={{ color: "var(--mm-text)" }}>.</span>
          {weather && (
            <span style={{
              fontSize: "0.38em", fontStyle: "normal", fontWeight: 300,
              color: "var(--mm-muted)", marginLeft: "0.7em",
              verticalAlign: "middle", letterSpacing: "0.02em", whiteSpace: "nowrap",
            }}>
              {weather.emoji} {weather.desc} {weather.temp}°C
            </span>
          )}
        </h1>

        {/* Gold accent line */}
        <div style={{
          width: 48, height: 1.5, marginTop: 18, borderRadius: 2,
          background: "linear-gradient(90deg, var(--mm-gold), transparent)",
        }} />
      </div>

      {/* ── Weekly Review Banner ── */}
      {showReview && (
        <div className="mm-review-banner flex items-center gap-3 animate-slide-up">
          <ClipboardList size={18} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--mm-gold)" }}>
              Time for your weekly review
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>
              Reflect on last week, clear your inbox, plan what matters most.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => { navigate("/reports"); dismissReview(); }}
                    className="mm-btn-gold px-4 py-2 text-xs">Start →</button>
            <button onClick={dismissReview}
                    className="mm-icon-btn" style={{ fontSize: 16, opacity: 0.5 }}>×</button>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      {data?.stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Pending",    value: data.stats.pending,       color: "var(--mm-muted)" },
            { label: "Overdue",    value: data.stats.overdue,       color: data.stats.overdue > 0 ? "var(--mm-text)" : "var(--mm-muted)" },
            { label: "Done Today", value: data.stats.done_today,    color: "var(--mm-gold)" },
            { label: "Reminders",  value: data.stats.reminders_due, color: "var(--mm-gold)" },
          ].map(s => (
            <div key={s.label} className="mm-card p-4 text-center">
              <div className="text-3xl font-light mm-font-display" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="mt-1 mm-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending review ── */}
      {data?.pending_review_count > 0 && (
        <button onClick={() => navigate("/reports")}
                className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{
                  background: "rgba(212,175,55,0.06)",
                  border: "1px solid var(--mm-border-gold)", borderRadius: 16,
                }}>
          <AlertTriangle size={15} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />
          <div className="flex-1">
            <span className="text-sm font-medium" style={{ color: "var(--mm-gold)" }}>
              {data.pending_review_count} item{data.pending_review_count !== 1 ? "s" : ""} need review
            </span>
            <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>
              Low-confidence items, duplicates, failed imports
            </p>
          </div>
          <span className="text-xs uppercase tracking-widest" style={{ color: "var(--mm-gold)" }}>
            Review →
          </span>
        </button>
      )}

      {/* ── Top 3 Focus ── */}
      {top3.length > 0 && (
        <div className="mm-card p-4"
             style={{ borderColor: "var(--mm-border-gold)", background: "rgba(212,175,55,0.03)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Star size={12} style={{ color: "var(--mm-gold)" }} />
            <span className="mm-label" style={{ color: "var(--mm-gold)" }}>Top 3 for today</span>
          </div>
          <div className="space-y-2">
            {top3.map((t, i) => (
              <button key={t.id} onClick={() => completeTask(t.id)}
                      className="w-full flex items-center gap-3 text-left group"
                      title="Mark complete">
                <div className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all group-hover:border-[var(--mm-gold)]"
                     style={{ borderColor: "var(--mm-border)" }}>
                  <span className="text-xs font-semibold" style={{ color: "var(--mm-muted)" }}>{i + 1}</span>
                </div>
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>{t.task}</span>
                {t.priority && <span className={`mm-est-pill mm-${t.priority.toLowerCase()}`}>{t.priority}</span>}
                {t.estimate  && <span className="mm-est-pill">{t.estimate}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Overdue ── */}
      {data?.overdue?.length > 0 && (
        <Section id="overdue" title="Overdue"
                 count={data.overdue.filter(t => !completedIds.has(t.id)).length}>
          <div className="mm-card overflow-hidden">
            {data.overdue.filter(t => !completedIds.has(t.id)).map(t => (
              <TaskCheckRow key={t.id} t={t} to="/tasks" />
            ))}
          </div>
        </Section>
      )}

      {/* ── Due today ── */}
      {data?.due_today?.length > 0 && (
        <Section id="today" title="Due Today"
                 count={data.due_today.filter(t => !completedIds.has(t.id)).length}>
          <div className="mm-card overflow-hidden">
            {data.due_today.filter(t => !completedIds.has(t.id)).map(t => (
              <TaskCheckRow key={t.id} t={t} to="/tasks" />
            ))}
          </div>
        </Section>
      )}

      {/* ── Due soon ── */}
      {data?.due_soon?.length > 0 && (
        <Section id="soon" title="Due Soon">
          <div className="mm-card overflow-hidden">
            {data.due_soon.map(t => (
              <button key={t.id} onClick={() => navigate("/tasks")}
                      className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left border-b"
                      style={{ borderColor: "var(--mm-border)" }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "var(--mm-border)" }} />
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>{t.task}</span>
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{t.date}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── Reminders ── */}
      {data?.reminders?.length > 0 && (
        <Section id="reminders" title="Upcoming Reminders">
          <div className="mm-card overflow-hidden">
            {data.reminders.map(r => (
              <button key={r.id} onClick={() => navigate("/reminders")}
                      className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left border-b"
                      style={{ borderColor: "var(--mm-border)" }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "var(--mm-gold)", boxShadow: "0 0 6px rgba(212,175,55,0.5)" }} />
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>{r.title}</span>
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>
                  {r.fire_at
                    ? new Date(r.fire_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit", minute: "2-digit",
                      })
                    : ""}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── Routines ── */}
      {data?.routines?.length > 0 && (
        <Section id="routines" title="Today's Routines">
          <div className="mm-card overflow-hidden">
            {data.routines.map(r => (
              <button key={r.id} onClick={() => navigate("/routines")}
                      className="mm-row w-full flex items-center gap-3 px-3 py-2.5 text-left border-b"
                      style={{ borderColor: "var(--mm-border)" }}>
                <div className="w-4 h-4 flex items-center justify-center border flex-shrink-0"
                     style={{
                       borderColor: r.done_today ? "var(--mm-gold)" : "var(--mm-border)",
                       background: r.done_today ? "rgba(212,175,55,0.12)" : "transparent",
                       borderRadius: "50%",
                     }}>
                  {r.done_today && (
                    <span style={{ color: "var(--mm-gold)", fontSize: 9, fontWeight: 700 }}>✓</span>
                  )}
                </div>
                <span className="flex-1 text-sm"
                      style={{ color: "var(--mm-text)", opacity: r.done_today ? 0.5 : 1 }}>
                  {r.activity}
                </span>
                {r.streak > 0 && (
                  <span className="text-xs" style={{ color: "var(--mm-gold)", fontSize: 10 }}>
                    🔥{r.streak}
                  </span>
                )}
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{r.group}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── Cash flow ── */}
      {data?.cashflow && (
        <Section id="cashflow" title="Month Finances">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.cashflow).map(([cat, val]) => (
              <button key={cat} onClick={() => navigate("/cash-flow")}
                      className="mm-card mm-row p-4 text-left">
                <div className="mm-label mb-1.5">{cat}</div>
                <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                  ₹{formatAmount(val)}
                </div>
              </button>
            ))}
          </div>
          {spendingInsight && (
            <p className="text-xs mt-2 px-1" style={{ color: "var(--mm-muted)" }}>
              {spendingInsight}
            </p>
          )}
        </Section>
      )}

      {/* ── Today's Note from the World ── */}
      {quote && (
        <Section id="quote" title="Today's Note from the World">
          <div className="px-5 py-5"
               style={{
                 borderLeft: "3px solid var(--mm-border-gold)",
                 background: "var(--mm-surface-2)",
                 borderRadius: "0 16px 16px 0",
               }}>
            <p className="mm-font-serif text-base italic"
               style={{ color: "var(--mm-text)", lineHeight: 1.7 }}>
              "{quote.quote}"
            </p>
            {quote.author && (
              <p className="text-xs mt-2 uppercase tracking-widest"
                 style={{ color: "var(--mm-muted)" }}>
                — {quote.author}
              </p>
            )}
          </div>

          {/* Personal Affirmation — always shows below the quote */}
          <AffirmationCard />
        </Section>
      )}

      {/* ── News ── */}
      <Section id="news" title="News">
        <div className="space-y-3">

          {/* Tab row */}
          <div className="flex items-center gap-1 flex-wrap">
            {newsTabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => { setActiveNewsTab(i); setShowOthersRss(false); }}
                className={`mm-filter-tab capitalize ${activeNewsTab === i && !isOthersTab ? "active" : ""}`}>
                {tab.label}
              </button>
            ))}

            {/* Others (RSS) tab */}
            <button
              onClick={() => { setActiveNewsTab(newsTabs.length); setShowOthersRss(true); }}
              className={`mm-filter-tab ${isOthersTab ? "active" : ""}`}>
              Others
            </button>

            {/* Manage tabs */}
            <button
              onClick={() => setShowTabModal(true)}
              className="mm-filter-tab"
              title="Manage tabs"
              style={{ marginLeft: "auto" }}>
              <Edit2 size={10} />
            </button>
          </div>

          {/* Others RSS input */}
          {isOthersTab && (
            <div className="flex gap-2">
              <input
                value={customRss}
                onChange={e => setCustomRss(e.target.value)}
                placeholder="Paste a custom RSS feed URL…"
                className="mm-form-input flex-1 text-xs"
              />
              <button
                onClick={() => localStorage.setItem("mm_news_custom_url", customRss)}
                className="mm-btn-gold px-4 text-xs">
                Save
              </button>
            </div>
          )}

          {/* News list */}
          <div className="mm-card overflow-hidden">
            {news.length === 0
              ? <p className="p-4 text-sm" style={{ color: "var(--mm-muted)" }}>
                  No news available
                </p>
              : news.map((item, i) => (
                  <a key={i}
                     href={`https://www.google.com/search?q=${encodeURIComponent(item)}`}
                     target="_blank" rel="noopener noreferrer"
                     className="mm-row flex items-center gap-2 px-4 py-2.5 border-b last:border-0 group"
                     style={{ borderColor: "var(--mm-border)", textDecoration: "none" }}>
                    <span className="flex-1 text-sm" style={{ color: "var(--mm-muted)" }}>
                      {item}
                    </span>
                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          style={{ color: "var(--mm-gold)" }}>→</span>
                  </a>
                ))
            }
          </div>
        </div>
      </Section>

      {/* ── News tab manager modal ── */}
      {showTabModal && (
        <NewsTabModal
          tabs={newsTabs}
          onSave={saveNewsTabs}
          onClose={() => setShowTabModal(false)}
        />
      )}

    </div>
  );
}
