import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare, RefreshCw, DollarSign, FileText, Bell, BarChart2,
  Settings, AlertTriangle, ChevronDown, ChevronUp, Check,
  Star, ClipboardList,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import DigestWidget from "@/components/DigestWidget";
import CompletionRing from "@/components/CompletionRing";

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getWeekNumber(d = new Date()) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

const QUICK_NAV = [
  { to:"/tasks",     icon:CheckSquare, label:"Tasks"     },
  { to:"/routines",  icon:RefreshCw,   label:"Routines"  },
  { to:"/cash-flow", icon:DollarSign,  label:"Cash Flow" },
  { to:"/notes",     icon:FileText,    label:"Notes"     },
  { to:"/reminders", icon:Bell,        label:"Reminders" },
  { to:"/people",    icon:null,        label:"People",   emoji:"👥" },
  { to:"/reports",   icon:BarChart2,   label:"Reports"   },
  { to:"/settings",  icon:Settings,    label:"Settings"  },
];

const NEWS_CATS = ["general","business","tech","india","world"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user }  = useAuth();
  const [data,          setData]          = useState(null);
  const [news,          setNews]          = useState([]);
  const [newsCategory,  setNewsCategory]  = useState("general");
  const [customRss,     setCustomRss]     = useState(() => localStorage.getItem("mm_news_custom_url") || "");
  const [showCustomRss, setShowCustomRss] = useState(false);
  const [quote,         setQuote]         = useState(null);
  const [collapsed,     setCollapsed]     = useState({});
  const [now,           setNow]           = useState(new Date());
  const [completedIds,  setCompletedIds]  = useState(new Set());
  const [showReview,    setShowReview]    = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Weekly review banner: show if not dismissed this week
  useEffect(() => {
    const key = `mm_review_week_${getWeekNumber()}`;
    if (!localStorage.getItem(key)) setShowReview(true);
  }, []);

  const dismissReview = () => {
    localStorage.setItem(`mm_review_week_${getWeekNumber()}`, "1");
    setShowReview(false);
  };

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

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const params = customRss ? { custom_url: customRss } : { category: newsCategory };
        const { data: d } = await api.get("/news", { params });
        setNews(d.items || []);
      } catch {}
    };
    fetchNews();
  }, [newsCategory, customRss]);

  const toggle  = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const isOpen  = (key) => !collapsed[key];

  const completeTask = async (id) => {
    try {
      await api.patch(`/tasks/${id}`, { status: "Completed" });
      setCompletedIds(s => new Set([...s, id]));
    } catch {}
  };

  /* ── Derived: day completion ring data ── */
  const tasksDone    = data?.stats?.done_today || 0;
  const tasksTotal   = (data?.stats?.pending || 0) + tasksDone;
  const routinesDone = (data?.routines || []).filter(r => r.done_today).length;
  const routinesTotal= (data?.routines || []).length;
  const ringDone     = tasksDone + routinesDone;
  const ringTotal    = tasksTotal + routinesTotal;

  /* ── Top 3 tasks for today (due today, sorted by priority then flagged) ── */
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

  /* ── Spending insight ── */
  const spendingInsight = (() => {
    if (!data?.cashflow) return null;
    const exp = data.cashflow["Expense"] || 0;
    // Compare vs previous month if available — placeholder
    return exp > 0 ? `₹${formatAmount(exp)} spent this month` : null;
  })();

  const Section = ({ id, title, count, children }) => (
    <div className="mb-5">
      <button onClick={() => toggle(id)}
              className="w-full flex items-center justify-between py-2 text-left group">
        <div className="flex items-center gap-2.5">
          <span className="mm-label">{title}</span>
          {count > 0 && (
            <span className="text-xs px-1.5 py-0.5"
                  style={{ background: "var(--mm-surface-3)", color: "var(--mm-muted)", fontSize: 10, borderRadius: 6 }}>
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

  return (
    <div className="max-w-2xl mx-auto px-5 py-7 space-y-7">

      {/* ── Greeting + Completion Ring ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="mm-font-display" style={{ fontSize: 36, fontWeight: 300, color: "var(--mm-text)", lineHeight: 1.15 }}>
            {timeGreeting()},
            <br />
            <em style={{ color: "var(--mm-gold)", fontWeight: 400 }}>
              {user?.first_name}{user?.last_name ? ` ${user.last_name}` : ""}
            </em>
            <span style={{ color: "var(--mm-muted)" }}>.</span>
          </h1>
          <p className="mt-2" style={{ fontSize: 11, color: "var(--mm-muted)", letterSpacing: "0.15em" }}>
            {now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}
            {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Day completion ring */}
        {ringTotal > 0 && (
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <CompletionRing done={ringDone} total={ringTotal} size={76} stroke={6} label="Today" />
            {ringDone === ringTotal && ringTotal > 0 && (
              <span className="text-xs" style={{ color: "var(--mm-gold)" }}>🔥 All done!</span>
            )}
          </div>
        )}
      </div>

      {/* ── Weekly Review Banner ── */}
      {showReview && (
        <div className="mm-review-banner flex items-center gap-3 animate-slide-up">
          <ClipboardList size={18} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--mm-gold)" }}>Time for your weekly review</p>
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
              <div className="text-3xl font-light mm-font-display" style={{ color: s.color }}>{s.value}</div>
              <div className="mt-1 mm-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending review banner ── */}
      {data?.pending_review_count > 0 && (
        <button onClick={() => navigate("/reports")}
                className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ background: "rgba(212,175,55,0.06)", border: "1px solid var(--mm-border-gold)", borderRadius: 16 }}>
          <AlertTriangle size={15} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />
          <div className="flex-1">
            <span className="text-sm font-medium" style={{ color: "var(--mm-gold)" }}>
              {data.pending_review_count} item{data.pending_review_count !== 1 ? "s" : ""} need review
            </span>
            <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>
              Low-confidence items, duplicates, failed imports
            </p>
          </div>
          <span className="text-xs uppercase tracking-widest" style={{ color: "var(--mm-gold)" }}>Review →</span>
        </button>
      )}

      {/* ── Top 3 Focus Card ── */}
      {top3.length > 0 && (
        <div className="mm-card p-4" style={{ borderColor: "var(--mm-border-gold)", background: "rgba(212,175,55,0.03)" }}>
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
        <Section id="overdue" title="Overdue" count={data.overdue.filter(t => !completedIds.has(t.id)).length}>
          <div className="mm-card overflow-hidden">
            {data.overdue.filter(t => !completedIds.has(t.id)).map(t => (
              <TaskCheckRow key={t.id} t={t} to="/tasks" />
            ))}
          </div>
        </Section>
      )}

      {/* ── Due today ── */}
      {data?.due_today?.length > 0 && (
        <Section id="today" title="Due Today" count={data.due_today.filter(t => !completedIds.has(t.id)).length}>
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
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--mm-border)" }} />
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
                  {r.fire_at ? new Date(r.fire_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
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
                     style={{ borderColor: r.done_today ? "var(--mm-gold)" : "var(--mm-border)",
                              background: r.done_today ? "rgba(212,175,55,0.12)" : "transparent", borderRadius: "50%" }}>
                  {r.done_today && <span style={{ color: "var(--mm-gold)", fontSize: 9, fontWeight: 700 }}>✓</span>}
                </div>
                <span className="flex-1 text-sm" style={{ color: "var(--mm-text)", opacity: r.done_today ? 0.5 : 1 }}>
                  {r.activity}
                </span>
                {r.streak > 0 && (
                  <span className="text-xs" style={{ color: "var(--mm-gold)", fontSize: 10 }}>🔥{r.streak}</span>
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

      {/* ── Quick access ── */}
      <Section id="quicknav" title="Quick Access">
        <div className="grid grid-cols-4 gap-2">
          {QUICK_NAV.map(n => {
            const Icon = n.icon;
            return (
              <button key={n.to} onClick={() => navigate(n.to)} title={n.label}
                      className="mm-card mm-row flex flex-col items-center gap-2.5 p-4">
                <div className="w-9 h-9 flex items-center justify-center"
                     style={{ background: "rgba(212,175,55,0.12)", borderRadius: 12 }}>
                  {Icon ? <Icon size={16} style={{ color: "var(--mm-gold)" }} />
                        : <span style={{ fontSize: 16 }}>{n.emoji}</span>}
                </div>
                <span className="mm-label">{n.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Weekly Digest ── */}
      <Section id="digest" title="Weekly Digest">
        <DigestWidget />
      </Section>

      {/* ── Daily quote ── */}
      {quote && (
        <Section id="quote" title="Daily Reflection">
          <div className="px-5 py-5"
               style={{ borderLeft: "3px solid var(--mm-border-gold)", background: "var(--mm-surface-2)",
                        borderRadius: "0 16px 16px 0" }}>
            <p className="mm-font-serif text-base italic" style={{ color: "var(--mm-text)", lineHeight: 1.7 }}>
              "{quote.quote}"
            </p>
            {quote.author && (
              <p className="text-xs mt-2 uppercase tracking-widest" style={{ color: "var(--mm-muted)" }}>
                — {quote.author}
              </p>
            )}
          </div>
        </Section>
      )}

      {/* ── News ── */}
      <Section id="news" title="News">
        <div className="space-y-3">
          <div className="flex gap-1 flex-wrap">
            {NEWS_CATS.map(c => (
              <button key={c} onClick={() => { setNewsCategory(c); setShowCustomRss(false); }}
                      className={`mm-filter-tab capitalize ${newsCategory === c && !showCustomRss ? "active" : ""}`}>
                {c}
              </button>
            ))}
            <button onClick={() => setShowCustomRss(s => !s)}
                    className={`mm-filter-tab ${showCustomRss ? "active" : ""}`}>
              Custom RSS
            </button>
          </div>
          {showCustomRss && (
            <div className="flex gap-2">
              <input value={customRss} onChange={e => setCustomRss(e.target.value)}
                     placeholder="https://feed.example.com/rss"
                     className="mm-form-input flex-1 text-xs" />
              <button onClick={() => localStorage.setItem("mm_news_custom_url", customRss)}
                      className="mm-btn-gold px-4 text-xs">
                Save
              </button>
            </div>
          )}
          <div className="mm-card overflow-hidden">
            {news.length === 0
              ? <p className="p-4 text-sm" style={{ color: "var(--mm-muted)" }}>No news available</p>
              : news.map((item, i) => (
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
        </div>
      </Section>

    </div>
  );
}
