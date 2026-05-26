import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ChevronDown, ChevronUp, Check,
  ClipboardList, Plus, X, GripVertical,
  Calendar, TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import WorldClock from "@/components/WorldClock";
import CountdownTimer from "@/components/CountdownTimer";
import CountdownDate from "@/components/CountdownDate";

/* ── Fixed news tabs (no customisation needed) ───────────────── */
const FIXED_NEWS_TABS = [
  { id: "general",       label: "General"       },
  { id: "business",      label: "Business"      },
  { id: "tech",          label: "Tech"          },
  { id: "politics",      label: "Politics"      },
  { id: "sports",        label: "Sports"        },
  { id: "science",       label: "Science"       },
  { id: "health",        label: "Health"        },
  { id: "entertainment", label: "Entertainment" },
  { id: "india",         label: "India"         },
];

/* ── Default draggable section order ─────────────────────────── */
const DEFAULT_SECTION_ORDER = [
  "overdue", "today", "routines",
  "cashflow", "reminders_deadlines", "quote",
  "news", "worldclock", "timers",
];

/* ── Module-level sub-components (stable refs — no unmount/remount) ─ */

function Section({ id, title, count, extra, children, onToggle, isOpenFn }) {
  const open = isOpenFn(id);
  return (
    <div className="mb-5">
      <button onClick={() => onToggle(id)}
              className="w-full flex items-center justify-between py-2 text-left group">
        <div className="flex items-center gap-2.5">
          <GripVertical size={13}
            className="opacity-0 group-hover:opacity-40 transition-opacity cursor-grab flex-shrink-0"
            style={{ color: "var(--mm-muted)" }} />
          <span style={{
            fontSize: 13, fontWeight: 700, letterSpacing: "0.01em",
            color: "var(--mm-text)", fontFamily: "'Outfit', sans-serif",
          }}>
            {title}
          </span>
          {count > 0 && (
            <span style={{
              background: "var(--mm-surface-3)", color: "var(--mm-muted)",
              fontSize: 10, borderRadius: 6, padding: "1px 6px",
            }}>
              {count}
            </span>
          )}
          {extra}
        </div>
        <span style={{ color: "var(--mm-muted)", opacity: 0.5 }}>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}

function DraggableSection({ id, children, dragId, dragOverId, onDragStart, onDragEnd, onDragOver, onDrop }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(id)}
      onDragEnd={onDragEnd}
      onDragOver={e => onDragOver(e, id)}
      onDrop={e => onDrop(e, id)}
      style={{
        opacity:       dragId === id ? 0.45 : 1,
        outline:       dragOverId === id && dragId !== id ? "2px solid var(--mm-gold)" : "none",
        outlineOffset: 4,
        borderRadius:  12,
        transition:    "opacity 0.15s, outline 0.1s",
      }}
    >
      {children}
    </div>
  );
}

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

/* BMP-only Unicode weather symbols — no supplementary-plane emoji,
   no variation selectors → guaranteed to render in all browsers.      */
function wxEmoji(code) {
  const c = parseInt(code, 10);
  if (c === 113) return "☀";   // clear
  if ([116, 119, 122].includes(c)) return "⛅"; // partly cloudy
  if ([143, 248, 260].includes(c)) return "☁";  // fog / haze → cloud
  if ([200, 386, 389, 392, 395].includes(c)) return "⚡"; // thunder
  if ([227, 230, 335, 338, 371, 374].includes(c)) return "❄"; // snow
  if (c >= 176) return "☂";   // rain
  return "⛅";
}

/* Format API date strings (YYYY-MM-DD or ISO) → "26 May" */
function fmtDate(str) {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}


/* ── Weather badge ────────────────────────────────────────────────
   paddingTop pushes the circle below the floating ProjectSelector
   badge (top-4 + ~32px height = ~48px).
   ─────────────────────────────────────────────────────────────── */
function WeatherBadge({ weather }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div style={{
        width: 68, height: 68, borderRadius: "50%",
        border: "1.5px solid var(--mm-border-gold)",
        background: "rgba(212,175,55,0.04)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 3,
      }}>
        {/* Explicit emoji font prevents white-box rendering */}
        <span style={{
          fontSize: 24, lineHeight: 1,
          fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
        }}>
          {weather.emoji}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 300, fontFamily: "'Outfit', sans-serif",
          color: "var(--mm-text)", letterSpacing: "0.02em",
        }}>
          {weather.temp}°C
        </span>
      </div>
      <span style={{
        fontSize: 9, color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
        maxWidth: 72, textAlign: "center", lineHeight: 1.3,
      }}>
        {weather.desc}
      </span>
    </div>
  );
}

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
        placeholder="Affirmation…"
        rows={2}
        className="w-full resize-none outline-none bg-transparent"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 16, fontStyle: "italic",
          color: "var(--mm-text)", lineHeight: 1.65, border: "none",
        }}
      />
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data,          setData]          = useState(null);
  const [news,          setNews]          = useState([]);
  const [activeNewsTab, setActiveNewsTab] = useState(0);   // index into FIXED_NEWS_TABS; length = Others
  const [customRss,     setCustomRss]     = useState(() => localStorage.getItem("mm_news_custom_url") || "");
  const [quote,         setQuote]         = useState(null);
  const [collapsed,     setCollapsed]     = useState({});
  const [now,           setNow]           = useState(new Date());
  const [completedIds,  setCompletedIds]  = useState(new Set());
  const [showReview,    setShowReview]    = useState(false);
  /* Finance period toggle */
  const [financeView,   setFinanceView]   = useState("month"); // "month" | "year"
  const [yearlyData,    setYearlyData]    = useState(null);
  /* Drag-and-drop section order */
  const [sectionOrder,  setSectionOrder]  = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mm_section_order"));
      if (!saved) return DEFAULT_SECTION_ORDER;
      // merge: keep saved order but append any new sections not yet in it
      const set = new Set(saved);
      return [...saved, ...DEFAULT_SECTION_ORDER.filter(id => !set.has(id))];
    } catch { return DEFAULT_SECTION_ORDER; }
  });
  const [dragId,        setDragId]        = useState(null);
  const [dragOverId,    setDragOverId]    = useState(null);
  const [weather,       setWeather]       = useState(null);
  const [showNewsCategoryPicker, setShowNewsCategoryPicker] = useState(false);

  /* Clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  /* Weekly review banner */
  useEffect(() => {
    const key = `mm_review_week_${getWeekNumber()}`;
    if (!localStorage.getItem(key)) setShowReview(true);
  }, []);
  const dismissReview = () => {
    localStorage.setItem(`mm_review_week_${getWeekNumber()}`, "1");
    setShowReview(false);
  };

  /* Weather — wttr.in, no API key needed */
  useEffect(() => {
    fetch("https://wttr.in/?format=j1")
      .then(r => r.json())
      .then(d => {
        const c = d.current_condition?.[0];
        if (!c) return;
        setWeather({
          temp:  c.temp_C,
          desc:  (c.weatherDesc?.[0]?.value || "").split(" ").slice(0, 3).join(" ").replace(/\b\w/g, ch => ch.toUpperCase()),
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
  const isOthersTab = activeNewsTab === FIXED_NEWS_TABS.length;
  useEffect(() => {
    if (isOthersTab) {
      if (!customRss) return;
      api.get("/news", { params: { custom_url: customRss } })
         .then(r => setNews(r.data.items || []))
         .catch(() => {});
      return;
    }
    const tab = FIXED_NEWS_TABS[activeNewsTab];
    if (!tab) return;
    api.get("/news", { params: { category: tab.id } })
       .then(r => setNews(r.data.items || []))
       .catch(() => {});
  }, [activeNewsTab, customRss, isOthersTab]);

  const toggle = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const isOpen = (key) => !collapsed[key];

  /* Drag-and-drop handlers */
  const handleDragStart = (id) => setDragId(id);
  const handleDragEnd   = ()   => { setDragId(null); setDragOverId(null); };
  const handleDragOver  = (e, id) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop      = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setSectionOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to   = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      localStorage.setItem("mm_section_order", JSON.stringify(next));
      return next;
    });
    setDragId(null);
    setDragOverId(null);
  };

  const completeTask = async (id) => {
    try {
      await api.patch(`/tasks/${id}`, { status: "Completed" });
      setCompletedIds(s => new Set([...s, id]));
    } catch {}
  };

  /* Derived */
  const spendingInsight = (() => {
    if (!data?.cashflow) return null;
    const exp = data.cashflow["Expense"] || 0;
    return exp > 0 ? `₹${formatAmount(exp)} spent this month` : null;
  })();

  /* Convenience shorthands passed as props to module-level Section/DraggableSection */
  const sectionProps  = { onToggle: toggle, isOpenFn: isOpen };
  const dragProps     = { dragId, dragOverId,
                          onDragStart: handleDragStart, onDragEnd: handleDragEnd,
                          onDragOver:  handleDragOver,  onDrop:    handleDrop };

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
      <span className="text-xs flex-shrink-0" style={{ color: "var(--mm-muted)" }}>{fmtDate(t.date)}</span>
    </div>
  );

  /* ── Render ── */
  return (
    <div className="px-6 py-8 space-y-7" style={{ maxWidth: "100%" }}>

      {/* ── Hero: Greeting (left) + Weather circle (right) ── */}
      <div className="flex items-center gap-6">

        {/* Left: Date + Greeting + Gold line */}
        <div className="flex-1 min-w-0">
          <p style={{
            fontSize: 11, color: "var(--mm-muted)", letterSpacing: "0.12em",
            fontFamily: "'Outfit', sans-serif", marginBottom: 14,
          }}>
            {now.toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            })}
            {" · "}
            {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </p>

          {/* Greeting — 20% smaller than before */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(30px, 4.2vw, 61px)",
            fontWeight: 300, lineHeight: 1.1,
            color: "var(--mm-text)", letterSpacing: "-0.01em",
          }}>
            {timeGreeting()},{" "}
            <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--mm-gold)", letterSpacing: "0.01em" }}>
              {user?.first_name}{user?.last_name ? ` ${user.last_name}` : ""}
            </em>
            <span style={{ color: "var(--mm-text)" }}>.</span>
          </h1>

          {/* Gold accent line */}
          <div style={{
            width: 48, height: 1.5, marginTop: 16, borderRadius: 2,
            background: "linear-gradient(90deg, var(--mm-gold), transparent)",
          }} />
        </div>

        {/* Right: Weather circle (where the 0% ring was) */}
        {weather && <WeatherBadge weather={weather} />}
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
            <div key={s.label} className="mm-card p-4 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-light mm-font-display" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="mt-1" style={{
                fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending review ── */}
      {data?.pending_review_count > 0 && (
        <button onClick={() => navigate("/reports", { state: { tab: "Pending Review" } })}
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


      {/* ── Draggable sections ── */}
      {sectionOrder.map(sectionId => {
        const DS = (id, children) => (
          <DraggableSection key={id} id={id} {...dragProps}>{children}</DraggableSection>
        );
        const S = (id, title, children, opts = {}) => (
          <Section id={id} title={title} {...sectionProps} {...opts}>{children}</Section>
        );

        switch (sectionId) {

          case "overdue": {
            const rows = data?.overdue?.filter(t => !completedIds.has(t.id)) || [];
            return rows.length > 0 ? DS("overdue", S("overdue", "Overdue",
              <div className="mm-card overflow-hidden">
                {rows.map(t => <TaskCheckRow key={t.id} t={t} to="/tasks" />)}
              </div>, { count: rows.length })) : null;
          }

          case "today": {
            const rows = data?.due_today?.filter(t => !completedIds.has(t.id)) || [];
            return rows.length > 0 ? DS("today", S("today", "Today's Tasks",
              <div className="mm-card overflow-hidden">
                {rows.map(t => <TaskCheckRow key={t.id} t={t} to="/tasks" />)}
              </div>, { count: rows.length })) : null;
          }

          case "soon":
            return null; // Coming Up section removed

          case "routines":
            return data?.routines?.length > 0 ? DS("routines", S("routines", "Today's Routines",
              <div className="mm-card overflow-hidden">
                {data.routines.map(r => (
                  <button key={r.id} onClick={() => navigate("/routines")}
                          className="mm-row w-full flex items-center gap-3 px-3 py-2.5 text-left border-b"
                          style={{ borderColor: "var(--mm-border)" }}>
                    <div className="w-4 h-4 flex items-center justify-center border flex-shrink-0"
                         style={{
                           borderColor: r.done_today ? "var(--mm-gold)" : "var(--mm-border)",
                           background:  r.done_today ? "rgba(212,175,55,0.12)" : "transparent",
                           borderRadius: "50%",
                         }}>
                      {r.done_today && <span style={{ color: "var(--mm-gold)", fontSize: 9, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span className="flex-1 text-sm"
                          style={{ color: "var(--mm-text)", opacity: r.done_today ? 0.5 : 1 }}>
                      {r.activity}
                    </span>
                    {r.streak > 0 && <span style={{ color: "var(--mm-gold)", fontSize: 10 }}>🔥{r.streak}</span>}
                    <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{r.group}</span>
                  </button>
                ))}
              </div>)) : null;

          case "cashflow":
            return data?.cashflow ? DS("cashflow", S("cashflow", "Financial Overview",
              <>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(financeView === "year" && yearlyData ? yearlyData : data.cashflow).map(([cat, val]) => (
                    <button key={cat} onClick={() => navigate("/cash-flow")}
                            className="mm-card mm-row p-4 text-left">
                      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                                    color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>
                        {cat}
                      </div>
                      <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                        ₹{formatAmount(val)}
                      </div>
                    </button>
                  ))}
                  <button onClick={() => navigate("/cash-flow")} className="mm-card mm-row p-4 text-left">
                    <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                                  color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>
                      Upcoming Payments
                    </div>
                    <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                      {data.upcoming_payments !== undefined
                        ? `₹${formatAmount(data.upcoming_payments)}`
                        : <span style={{ fontSize: 13, color: "var(--mm-muted)" }}>—</span>}
                    </div>
                  </button>
                  <button onClick={() => navigate("/cash-flow")} className="mm-card mm-row p-4 text-left">
                    <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                                  color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>
                      Upcoming Receipts
                    </div>
                    <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                      {data.upcoming_receipts !== undefined
                        ? `₹${formatAmount(data.upcoming_receipts)}`
                        : <span style={{ fontSize: 13, color: "var(--mm-muted)" }}>—</span>}
                    </div>
                  </button>
                </div>
                {financeView === "year" && !yearlyData && (
                  <p className="text-xs mt-3 px-1 text-center" style={{ color: "var(--mm-muted)" }}>
                    Year-to-date totals coming soon
                  </p>
                )}
                {spendingInsight && financeView === "month" && (
                  <p className="text-xs mt-2 px-1" style={{ color: "var(--mm-muted)" }}>
                    {spendingInsight}
                  </p>
                )}
              </>,
              {
                extra: (
                  <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                    {["month", "year"].map(v => (
                      <button key={v} onClick={() => setFinanceView(v)}
                              style={{
                                fontSize: 9, padding: "2px 8px", borderRadius: 20,
                                fontFamily: "'Outfit', sans-serif", letterSpacing: "0.05em",
                                textTransform: "uppercase",
                                background: financeView === v ? "var(--mm-gold)" : "var(--mm-surface-3)",
                                color:      financeView === v ? "#0a0a0a" : "var(--mm-muted)",
                                border: "none", cursor: "pointer",
                              }}>
                        {v === "month" ? "Month" : "Year"}
                      </button>
                    ))}
                  </div>
                ),
              })) : null;

          case "reminders_deadlines":
            return ((data?.reminders?.length > 0) || (data?.due_soon?.length > 0)) ? DS("reminders_deadlines",
              S("reminders_deadlines", "Today's Reminders",
                <div className="mm-card overflow-hidden">
                  {data?.reminders?.slice(0, 3).map(r => (
                    <button key={`rem-${r.id}`} onClick={() => navigate("/reminders")}
                            className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left border-b"
                            style={{ borderColor: "var(--mm-border)" }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: "var(--mm-gold)", boxShadow: "0 0 5px rgba(212,175,55,0.5)" }} />
                      <span className="flex-1 text-sm truncate" style={{ color: "var(--mm-text)" }}>{r.title}</span>
                      <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                                     color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif", flexShrink: 0 }}>
                        Reminder
                      </span>
                      {r.fire_at && (
                        <span className="text-xs flex-shrink-0" style={{ color: "var(--mm-muted)" }}>
                          {new Date(r.fire_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </button>
                  ))}
                  {data?.due_soon?.slice(0, 3).map(t => (
                    <button key={`dl-${t.id}`} onClick={() => navigate("/tasks")}
                            className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left border-b"
                            style={{ borderColor: "var(--mm-border)" }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: "var(--mm-muted)", opacity: 0.5 }} />
                      <span className="flex-1 text-sm truncate" style={{ color: "var(--mm-text)" }}>{t.task}</span>
                      <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                                     color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif", flexShrink: 0 }}>
                        Deadline
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: "var(--mm-muted)" }}>{fmtDate(t.date)}</span>
                    </button>
                  ))}
                </div>)) : null;

          case "quote":
            return quote ? DS("quote", S("quote", "Today's Note From The World",
              <>
                <div className="px-5 py-5"
                     style={{ borderLeft: "3px solid var(--mm-border-gold)",
                              background: "var(--mm-surface-2)", borderRadius: "0 16px 16px 0" }}>
                  <p className="mm-font-serif text-base italic"
                     style={{ color: "var(--mm-text)", lineHeight: 1.7 }}>
                    "{quote.quote}"
                  </p>
                  {quote.author && (
                    <p className="text-xs mt-2 uppercase tracking-widest" style={{ color: "var(--mm-muted)" }}>
                      — {quote.author}
                    </p>
                  )}
                </div>
                <AffirmationCard />
              </>)) : null;

          case "news": {
            const currentCategoryLabel = isOthersTab
              ? "Others (Custom RSS)"
              : (FIXED_NEWS_TABS[activeNewsTab]?.label || "General");
            return DS("news", S("news", "News",
              <div className="space-y-3">
                {/* Compact category selector */}
                <div className="relative">
                  <div
                    className="mm-card flex items-center justify-between px-4 py-2.5 cursor-pointer"
                    onClick={() => setShowNewsCategoryPicker(v => !v)}
                    style={{ userSelect: "none" }}>
                    <span className="text-sm" style={{ color: "var(--mm-text)" }}>
                      {currentCategoryLabel}
                    </span>
                    <div className="flex items-center gap-1.5" style={{ color: "var(--mm-gold)" }}>
                      <span style={{ fontSize: 11, fontFamily: "'Outfit', sans-serif", letterSpacing: "0.06em" }}>Edit</span>
                      <ChevronDown size={11}
                        style={{ transform: showNewsCategoryPicker ? "rotate(180deg)" : "none",
                                 transition: "transform 0.2s" }} />
                    </div>
                  </div>
                  {showNewsCategoryPicker && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 overflow-hidden animate-fade-in"
                         style={{
                           background: "var(--mm-surface)",
                           border: "1px solid var(--mm-border)",
                           borderRadius: 12,
                           boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                         }}>
                      {FIXED_NEWS_TABS.map((tab, i) => (
                        <button key={tab.id}
                                onClick={() => { setActiveNewsTab(i); setShowNewsCategoryPicker(false); }}
                                className="w-full text-left px-4 py-2.5 text-sm mm-row transition-colors"
                                style={{
                                  color: activeNewsTab === i && !isOthersTab
                                    ? "var(--mm-gold)" : "var(--mm-muted)",
                                }}>
                          {tab.label}
                        </button>
                      ))}
                      <button
                        onClick={() => { setActiveNewsTab(FIXED_NEWS_TABS.length); setShowNewsCategoryPicker(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm mm-row transition-colors"
                        style={{
                          borderTop: "1px solid var(--mm-border)",
                          color: isOthersTab ? "var(--mm-gold)" : "var(--mm-muted)",
                        }}>
                        Others (Custom RSS)
                      </button>
                    </div>
                  )}
                </div>

                {isOthersTab && (
                  <div className="flex gap-2">
                    <input value={customRss} onChange={e => setCustomRss(e.target.value)}
                           placeholder="Paste a custom RSS feed URL…"
                           className="mm-form-input flex-1 text-xs" />
                    <button onClick={() => localStorage.setItem("mm_news_custom_url", customRss)}
                            className="mm-btn-gold px-4 text-xs">Save</button>
                  </div>
                )}

                <div className="mm-card overflow-hidden">
                  {news.length === 0
                    ? <p className="p-4 text-sm" style={{ color: "var(--mm-muted)" }}>No news available</p>
                    : news.filter(item => item && typeof item === "string" && item.trim().length > 5 && item !== "Google News").map((item, i) => (
                        <a key={i}
                           href={`https://www.google.com/search?q=${encodeURIComponent(item)}`}
                           target="_blank" rel="noopener noreferrer"
                           className="mm-row flex items-center gap-2 px-4 py-2.5 border-b last:border-0 group"
                           style={{ borderColor: "var(--mm-border)", textDecoration: "none" }}>
                          <span className="flex-1 text-sm" style={{ color: "var(--mm-muted)" }}>{item}</span>
                          <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                style={{ color: "var(--mm-gold)" }}>→</span>
                        </a>
                      ))
                  }
                </div>
              </div>));
          }

          case "worldclock":
            return DS("worldclock", S("worldclock", "World Clock", <WorldClock />));

          case "timers":
            return DS("timers", S("timers", "Timers",
              <div className="grid grid-cols-2 gap-4">
                <div className="mm-card p-5 flex flex-col items-center justify-center"><CountdownTimer /></div>
                <div className="mm-card p-5 flex flex-col items-center justify-center"><CountdownDate /></div>
              </div>));

          default:
            return null;
        }
      })}

    </div>
  );
}
