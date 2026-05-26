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

/* ── News categories ─────────────────────────────────────────── */
const ALL_NEWS_CATEGORIES = [
  { id: "general",       label: "General"       },
  { id: "business",      label: "Business"      },
  { id: "tech",          label: "Tech"          },
  { id: "politics",      label: "Politics"      },
  { id: "sports",        label: "Sports"        },
  { id: "science",       label: "Science"       },
  { id: "health",        label: "Health"        },
  { id: "entertainment", label: "Entertainment" },
];

/* 5 slots — slots 1-3 user-selectable, slot 4 = country filter, slot 5 = others */
const DEFAULT_NEWS_SLOTS = ["general", "business", "tech", "country", "others"];

/* ── News countries (for datalist autocomplete) ──────────────── */
const NEWS_COUNTRIES = [
  { code: "",   label: "Global"           },
  { code: "in", label: "India"            },
  { code: "us", label: "United States"    },
  { code: "gb", label: "United Kingdom"   },
  { code: "au", label: "Australia"        },
  { code: "ca", label: "Canada"           },
  { code: "ae", label: "UAE"              },
  { code: "sg", label: "Singapore"        },
  { code: "de", label: "Germany"          },
  { code: "fr", label: "France"           },
  { code: "jp", label: "Japan"            },
  { code: "cn", label: "China"            },
  { code: "br", label: "Brazil"           },
  { code: "za", label: "South Africa"     },
  { code: "ng", label: "Nigeria"          },
  { code: "eg", label: "Egypt"            },
  { code: "pk", label: "Pakistan"         },
  { code: "bd", label: "Bangladesh"       },
  { code: "ru", label: "Russia"           },
  { code: "it", label: "Italy"            },
  { code: "es", label: "Spain"            },
  { code: "mx", label: "Mexico"           },
  { code: "id", label: "Indonesia"        },
  { code: "ar", label: "Argentina"        },
  { code: "sa", label: "Saudi Arabia"     },
  { code: "tr", label: "Turkey"           },
  { code: "th", label: "Thailand"         },
  { code: "ph", label: "Philippines"      },
  { code: "my", label: "Malaysia"         },
  { code: "nl", label: "Netherlands"      },
  { code: "se", label: "Sweden"           },
  { code: "ch", label: "Switzerland"      },
  { code: "no", label: "Norway"           },
  { code: "nz", label: "New Zealand"      },
  { code: "kr", label: "South Korea"      },
  { code: "il", label: "Israel"           },
  { code: "ke", label: "Kenya"            },
  { code: "gh", label: "Ghana"            },
  { code: "pt", label: "Portugal"         },
  { code: "pl", label: "Poland"           },
  { code: "ua", label: "Ukraine"          },
  { code: "ir", label: "Iran"             },
  { code: "iq", label: "Iraq"             },
  { code: "qe", label: "Qatar"            },
  { code: "kw", label: "Kuwait"           },
  { code: "lk", label: "Sri Lanka"        },
  { code: "np", label: "Nepal"            },
  { code: "vn", label: "Vietnam"          },
  { code: "tw", label: "Taiwan"           },
];

/* ── Default draggable section order ─────────────────────────── */
const DEFAULT_SECTION_ORDER = [
  "overdue", "today", "routines",
  "reminders_deadlines", "cashflow", "quote",
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

/* Format API date strings (YYYY-MM-DD or ISO) → "26 May" */
function fmtDate(str) {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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
           background: "rgba(201,169,97,0.04)",
           borderRadius: "0 16px 16px 0",
         }}>
      <div className="flex items-center justify-between mb-2">
        <p style={{
          fontSize: 10, letterSpacing: "0.05em",
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

  const [data,           setData]          = useState(null);
  const [news,           setNews]          = useState([]);
  /* News slots — 5 customisable pills; index 4 is always "others" */
  const [newsSlots,      setNewsSlots]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("mm_news_slots")) || DEFAULT_NEWS_SLOTS; }
    catch { return DEFAULT_NEWS_SLOTS; }
  });
  const [activeNewsSlot, setActiveNewsSlot] = useState(0);
  const [customRss,      setCustomRss]     = useState(() => localStorage.getItem("mm_news_custom_url") || "");
  const [newsKeywords,   setNewsKeywords]  = useState(() => localStorage.getItem("mm_news_keywords") || "");
  /* Country stored as label for easy datalist UX */
  const [newsCountryLabel, setNewsCountryLabel] = useState(() => {
    const code = localStorage.getItem("mm_news_country") || "";
    return NEWS_COUNTRIES.find(c => c.code === code)?.label || "Global";
  });
  const [quote,          setQuote]         = useState(null);
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
      // deduplicate saved order first, then append any new sections not yet in it
      const deduped = [...new Set(saved)];
      const set = new Set(deduped);
      const merged = [...deduped, ...DEFAULT_SECTION_ORDER.filter(id => !set.has(id))];
      // ── Migration: ensure reminders_deadlines is before cashflow ──
      const ri = merged.indexOf("reminders_deadlines");
      const ci = merged.indexOf("cashflow");
      if (ri !== -1 && ci !== -1 && ri > ci) {
        merged.splice(ri, 1);
        merged.splice(ci, 0, "reminders_deadlines");
        localStorage.setItem("mm_section_order", JSON.stringify(merged));
      }
      return merged;
    } catch { return DEFAULT_SECTION_ORDER; }
  });
  const [dragId,        setDragId]        = useState(null);
  const [dragOverId,    setDragOverId]    = useState(null);
  const [showNewsPicker, setShowNewsPicker] = useState(false);

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

  /* Year-to-date totals — fetch once when user switches to Year view */
  useEffect(() => {
    if (financeView !== "year") return;
    api.get("/cashflow/totals")
      .then(r => setYearlyData(r.data))
      .catch(() => {});
  }, [financeView]);

  /* News — driven by active slot */
  const activeSlotId    = newsSlots[activeNewsSlot] || "general";
  const isOthersSlot    = activeSlotId === "others";
  const isCountrySlot   = activeSlotId === "country";
  const newsCountryCode = NEWS_COUNTRIES.find(c => c.label === newsCountryLabel)?.code || "";
  useEffect(() => {
    setNews([]);
    if (isOthersSlot) {
      if (customRss) {
        api.get("/news", { params: { custom_url: customRss } })
           .then(r => setNews(r.data.items || r.data || []))
           .catch(() => {});
      } else if (newsKeywords) {
        const params = { q: newsKeywords };
        if (newsCountryCode) params.gl = newsCountryCode;
        api.get("/news", { params })
           .then(r => setNews(r.data.items || r.data || []))
           .catch(() => {});
      }
      return;
    }
    if (isCountrySlot) {
      const params = { category: "general" };
      if (newsCountryCode) params.gl = newsCountryCode;
      api.get("/news", { params })
         .then(r => setNews(r.data.items || r.data || []))
         .catch(() => {});
      return;
    }
    api.get("/news", { params: { category: activeSlotId } })
       .then(r => setNews(r.data.items || r.data || []))
       .catch(() => {});
  }, [activeNewsSlot, activeSlotId, isOthersSlot, isCountrySlot, newsCountryCode, customRss, newsKeywords]); // eslint-disable-line

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

      {/* ── Hero: Greeting ── */}
      <div>
        <div className="min-w-0">
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
              {user?.first_name || (user?.name || "Friend").split(" ")[0]}
            </em>
            <span style={{ color: "var(--mm-text)" }}>.</span>
          </h1>

          {/* Gold accent line */}
          <div style={{
            width: 48, height: 1.5, marginTop: 16, borderRadius: 2,
            background: "linear-gradient(90deg, var(--mm-gold), transparent)",
          }} />
        </div>
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
            { label: "Pending",    value: data.stats.pending,       color: "var(--mm-muted)",  to: "/tasks" },
            { label: "Overdue",    value: data.stats.overdue,       color: data.stats.overdue > 0 ? "var(--mm-text)" : "var(--mm-muted)", to: "/tasks" },
            { label: "Done Today", value: data.stats.done_today,    color: "var(--mm-gold)",   to: "/tasks" },
            { label: "Reminders",  value: data.stats.reminders_due, color: "var(--mm-gold)",   to: "/reminders" },
          ].map(s => (
            <button key={s.label} onClick={() => navigate(s.to)}
                    className="mm-card flex flex-col items-center justify-center text-center group"
                    style={{ padding: "20px 12px", minHeight: 90, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--mm-border-gold)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = ""}>
              <div className="text-3xl font-light mm-font-display" style={{ color: s.color, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{
                marginTop: 6, fontSize: 10, letterSpacing: "0.04em",
                color: "var(--mm-muted)", fontFamily: "'Inter','Outfit',sans-serif", fontWeight: 500,
              }}>
                {s.label}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Pending review ── */}
      {data?.pending_review_count > 0 && (
        <button onClick={() => navigate("/reports", { state: { tab: "Pending Review" } })}
                className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{
                  background: "rgba(201,169,97,0.06)",
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
          <span className="text-xs" style={{ color: "var(--mm-gold)", letterSpacing: "0.04em" }}>
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
            return DS("today", S("today", "Today's Tasks",
              <div className="mm-card overflow-hidden">
                {rows.length > 0
                  ? rows.map(t => <TaskCheckRow key={t.id} t={t} to="/tasks" />)
                  : (
                    <button onClick={() => navigate("/tasks")}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: "var(--mm-gold)", opacity: 0.25 }} />
                      <span className="text-sm" style={{ color: "var(--mm-muted)" }}>
                        No Tasks Due Today
                        {data?.stats?.pending > 0 && (
                          <span style={{ opacity: 0.6 }}> · {data.stats.pending} pending</span>
                        )}
                      </span>
                    </button>
                  )
                }
              </div>, { count: rows.length }));
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
                           background:  r.done_today ? "rgba(201,169,97,0.12)" : "transparent",
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
                {/* Month / Year toggle — inside children so it hides when collapsed */}
                <div className="flex gap-1 mb-3" onClick={e => e.stopPropagation()}>
                  {["month", "year"].map(v => (
                    <button key={v} onClick={() => setFinanceView(v)}
                            style={{
                              fontSize: 9, padding: "2px 8px", borderRadius: 20,
                              fontFamily: "'Outfit', sans-serif", letterSpacing: "0.05em",
                              background: financeView === v ? "var(--mm-gold)" : "var(--mm-surface-3)",
                              color:      financeView === v ? "#0a0a0a" : "var(--mm-muted)",
                              border: "none", cursor: "pointer",
                            }}>
                      {v === "month" ? "Month" : "Year"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(financeView === "year" && yearlyData ? yearlyData : data.cashflow).map(([cat, val]) => (
                    <button key={cat} onClick={() => navigate("/cash-flow")}
                            className="mm-card mm-row p-4 text-left">
                      <div style={{ fontSize: 10, letterSpacing: "0.04em",
                                    color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>
                        {cat}
                      </div>
                      <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                        ₹{formatAmount(val)}
                      </div>
                    </button>
                  ))}
                  <button onClick={() => navigate("/cash-flow")} className="mm-card mm-row p-4 text-left">
                    <div style={{ fontSize: 10, letterSpacing: "0.04em",
                                  color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>
                      Upcoming Payments
                    </div>
                    <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                      ₹{formatAmount(data.upcoming_payments || 0)}
                    </div>
                  </button>
                  <button onClick={() => navigate("/cash-flow")} className="mm-card mm-row p-4 text-left">
                    <div style={{ fontSize: 10, letterSpacing: "0.04em",
                                  color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>
                      Upcoming Receipts
                    </div>
                    <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                      ₹{formatAmount(data.upcoming_receipts || 0)}
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
              </>)) : null;

          case "reminders_deadlines":
            return ((data?.reminders?.length > 0) || (data?.due_soon?.length > 0)) ? DS("reminders_deadlines",
              S("reminders_deadlines", "Today's Reminders",
                <div className="mm-card overflow-hidden">
                  {data?.reminders?.slice(0, 3).map(r => (
                    <button key={`rem-${r.id}`} onClick={() => navigate("/reminders")}
                            className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left border-b"
                            style={{ borderColor: "var(--mm-border)" }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: "var(--mm-gold)", boxShadow: "0 0 5px rgba(201,169,97,0.5)" }} />
                      <span className="flex-1 text-sm truncate" style={{ color: "var(--mm-text)" }}>{r.title}</span>
                      <span style={{ fontSize: 9, letterSpacing: "0.03em",
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
                      <span style={{ fontSize: 9, letterSpacing: "0.03em",
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
                    <p className="text-xs mt-2" style={{ color: "var(--mm-muted)", letterSpacing: "0.04em" }}>
                      — {quote.author}
                    </p>
                  )}
                </div>
                <AffirmationCard />
              </>)) : null;

          case "news": {
            /* 5-slot tab pills — rendered INSIDE children so they hide when collapsed */
            const newsPills = (
              <div className="flex gap-1 flex-wrap mb-3" onClick={e => e.stopPropagation()}>
                {newsSlots.map((slotId, i) => {
                  let label;
                  if (slotId === "others")  label = "Others";
                  else if (slotId === "country") label = newsCountryLabel || "Global";
                  else label = ALL_NEWS_CATEGORIES.find(c => c.id === slotId)?.label || slotId;
                  return (
                    <button key={i}
                            onClick={e => { e.stopPropagation(); setActiveNewsSlot(i); }}
                            style={{
                              fontSize: 9, padding: "2px 9px", borderRadius: 20, border: "none",
                              fontFamily: "'Outfit', sans-serif", letterSpacing: "0.04em",
                              cursor: "pointer",
                              background: activeNewsSlot === i ? "var(--mm-gold)" : "var(--mm-surface-3)",
                              color:      activeNewsSlot === i ? "#0a0a0a" : "var(--mm-muted)",
                            }}>
                      {label}
                    </button>
                  );
                })}
                <button onClick={e => { e.stopPropagation(); setShowNewsPicker(true); }}
                        style={{
                          fontSize: 9, padding: "2px 8px", borderRadius: 20, cursor: "pointer",
                          background: "transparent", border: "1px solid var(--mm-border)",
                          color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
                        }}>
                  Edit
                </button>
              </div>
            );

            return DS("news", S("news", "News",
              <div className="space-y-3">
                {/* Tab pills — visible only when section is open */}
                {newsPills}

                {/* Others slot — RSS + keyword inputs */}
                {isOthersSlot && (
                  <div className="space-y-2">
                    <input value={customRss} onChange={e => setCustomRss(e.target.value)}
                           placeholder="Custom RSS feed URL (optional)…"
                           className="mm-form-input text-xs w-full" />
                    <input value={newsKeywords} onChange={e => setNewsKeywords(e.target.value)}
                           placeholder="Research keywords (e.g. AI, climate, Bitcoin)…"
                           className="mm-form-input text-xs w-full" />
                    <button onClick={() => {
                              localStorage.setItem("mm_news_custom_url", customRss);
                              localStorage.setItem("mm_news_keywords", newsKeywords);
                            }}
                            className="mm-btn-gold px-4 text-xs">Save & Fetch</button>
                  </div>
                )}

                <div className="mm-card overflow-hidden">
                  {news.length === 0
                    ? <p className="p-4 text-sm" style={{ color: "var(--mm-muted)" }}>
                        {isOthersSlot ? "Enter a URL or keywords above, then tap Save & Fetch." : "No News Available"}
                      </p>
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

      {/* ── News picker modal ── */}
      {showNewsPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
             style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(14px)" }}
             onClick={() => setShowNewsPicker(false)}>
          <div className="w-full max-w-lg animate-slide-up"
               style={{
                 background: "var(--mm-surface)",
                 borderRadius: "24px 24px 0 0",
                 border: "1px solid var(--mm-border-gold)",
                 borderBottom: "none",
                 padding: 24, maxHeight: "82vh", overflowY: "auto",
               }}
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, color: "var(--mm-text)" }}>
                Customise News Tabs
              </h3>
              <button onClick={() => setShowNewsPicker(false)} className="mm-icon-btn" style={{ fontSize: 18 }}>×</button>
            </div>

            {/* 3 editable slots (slot 4 = Country, slot 5 = Others — both fixed) */}
            <p style={{ fontSize: 9, letterSpacing: "0.06em", color: "var(--mm-gold)",
                        fontFamily: "'Outfit', sans-serif", marginBottom: 12 }}>
              Tab Slots
            </p>
            {newsSlots.slice(0, 3).map((slotId, slotIdx) => (
              <div key={slotIdx} className="mb-4">
                <p style={{ fontSize: 9, color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
                            letterSpacing: "0.05em", marginBottom: 6 }}>
                  Slot {slotIdx + 1}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_NEWS_CATEGORIES.map(cat => (
                    <button key={cat.id}
                            onClick={() => {
                              const next = [...newsSlots];
                              next[slotIdx] = cat.id;
                              setNewsSlots(next);
                              localStorage.setItem("mm_news_slots", JSON.stringify(next));
                            }}
                            className="mm-filter-tab"
                            style={{
                              background: newsSlots[slotIdx] === cat.id ? "var(--mm-gold)" : "var(--mm-surface-3)",
                              color:      newsSlots[slotIdx] === cat.id ? "#0a0a0a" : "var(--mm-muted)",
                              border: "none",
                            }}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Country — type-and-autofill datalist */}
            <p style={{ fontSize: 9, letterSpacing: "0.06em", color: "var(--mm-gold)",
                        fontFamily: "'Outfit', sans-serif", marginBottom: 8, marginTop: 8 }}>
              Country Filter
            </p>
            <input
              value={newsCountryLabel}
              onChange={e => {
                setNewsCountryLabel(e.target.value);
                const match = NEWS_COUNTRIES.find(c => c.label.toLowerCase() === e.target.value.toLowerCase());
                if (match) localStorage.setItem("mm_news_country", match.code);
              }}
              list="mm-news-countries"
              placeholder="Start typing a country…"
              className="mm-form-input text-xs w-full mb-5" />
            <datalist id="mm-news-countries">
              {NEWS_COUNTRIES.map(c => <option key={c.code} value={c.label} />)}
            </datalist>

            <button onClick={() => setShowNewsPicker(false)} className="mm-btn-gold w-full py-2.5">
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
