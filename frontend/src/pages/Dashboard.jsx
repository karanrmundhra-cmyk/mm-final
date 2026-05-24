import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare, RefreshCw, DollarSign, FileText, Bell, BarChart2,
  Settings, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatAmount, timeAgo } from "@/lib/utils";
import DigestWidget from "@/components/DigestWidget";

const QUICK_NAV = [
  { to:"/tasks",     icon:CheckSquare, label:"Tasks",     color:"#4F8EF7" },
  { to:"/routines",  icon:RefreshCw,   label:"Routines",  color:"#A855F7" },
  { to:"/cash-flow", icon:DollarSign,  label:"Cash Flow", color:"#14B8A6" },
  { to:"/notes",     icon:FileText,    label:"Notes",     color:"#EAB308" },
  { to:"/reminders", icon:Bell,        label:"Reminders", color:"#22C55E" },
  { to:"/people",    icon:null,        label:"People",    color:"#EC4899", emoji:"👥" },
  { to:"/reports",   icon:BarChart2,   label:"Reports",   color:"#F97316" },
  { to:"/settings",  icon:Settings,    label:"Settings",  color:"#8B8FA8" },
];

const NEWS_CATS = ["general","business","tech","india","world"];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data,         setData]         = useState(null);
  const [news,         setNews]         = useState([]);
  const [newsCategory, setNewsCategory] = useState("general");
  const [customRss,    setCustomRss]    = useState(() => localStorage.getItem("mm_news_custom_url")||"");
  const [showCustomRss,setShowCustomRss]= useState(false);
  const [quote,        setQuote]        = useState(null);
  const [collapsed,    setCollapsed]    = useState({});
  const [now,          setNow]          = useState(new Date());
  const [completedIds, setCompletedIds] = useState(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const [dashRes, quoteRes] = await Promise.all([
        api.get("/dashboard"),
        api.get("/quote/today").catch(() => ({ data:null })),
      ]);
      setData(dashRes.data);
      setQuote(quoteRes.data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const params = customRss ? { custom_url:customRss } : { category:newsCategory };
        const { data } = await api.get("/news",{ params });
        setNews(data.items||[]);
      } catch {}
    };
    fetchNews();
  }, [newsCategory, customRss]);

  const toggle  = (key) => setCollapsed(c => ({ ...c, [key]:!c[key] }));
  const isOpen  = (key) => !collapsed[key];

  const completeTask = async (id) => {
    try {
      await api.patch(`/tasks/${id}`, { status: "Completed" });
      setCompletedIds(s => new Set([...s, id]));
    } catch {}
  };

  const Section = ({ id, title, count, children }) => (
    <div className="mb-5">
      <button onClick={() => toggle(id)}
              className="w-full flex items-center justify-between py-2 text-left group">
        <div className="flex items-center gap-2.5">
          <span className="mm-label">{title}</span>
          {count > 0 && (
            <span className="text-xs px-1.5 py-0.5"
                  style={{ background:"var(--mm-surface-3)", color:"var(--mm-muted)", fontSize:10 }}>
              {count}
            </span>
          )}
        </div>
        <span style={{ color:"var(--mm-muted)", opacity:0.5 }}>
          {isOpen(id)
            ? <ChevronUp size={12} />
            : <ChevronDown size={12} />}
        </span>
      </button>
      {isOpen(id) && <div className="animate-fade-in">{children}</div>}
    </div>
  );

  const ItemRow = ({ to, dot, dotColor, main, sub, right, rightColor }) => (
    <button onClick={() => navigate(to)}
            className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left border-b"
            style={{ borderColor:"var(--mm-border)" }}>
      <div className="w-2 h-2 flex-shrink-0"
           style={{ background:dotColor, borderRadius:"50%", boxShadow:`0 0 6px ${dotColor}66` }} />
      <span className="flex-1 text-sm" style={{ color:"var(--mm-text)" }}>{main}</span>
      {sub && <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{sub}</span>}
      {right && <span className="text-xs font-medium" style={{ color:rightColor||"var(--mm-muted)" }}>{right}</span>}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto px-5 py-7 space-y-7">

      {/* ── Greeting ── */}
      <div>
        <h1 className="mm-font-display" style={{ fontSize:32, fontWeight:400, color:"var(--mm-text)" }}>
          {data?.greeting || "Good morning"}
        </h1>
        <p className="mt-1" style={{ fontSize:11, color:"var(--mm-muted)", letterSpacing:"0.15em" }}>
          {data?.date || now.toLocaleDateString("en-IN",{ weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          {" · "}
          {now.toLocaleTimeString("en-IN",{ hour:"2-digit", minute:"2-digit" })}
        </p>
      </div>

      {/* ── Stats ── */}
      {data?.stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label:"Pending",   value:data.stats.pending,       color:"var(--mm-muted)" },
            { label:"Overdue",   value:data.stats.overdue,       color:data.stats.overdue>0 ? "#E05252" : "var(--mm-muted)" },
            { label:"Done Today",value:data.stats.done_today,    color:"#52C77A" },
            { label:"Reminders", value:data.stats.reminders_due, color:"var(--mm-gold)" },
          ].map((s) => (
            <div key={s.label} className="mm-card p-4 text-center">
              <div className="text-3xl font-light mm-font-display" style={{ color:s.color }}>{s.value}</div>
              <div className="mt-1 mm-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending review banner ── */}
      {data?.pending_review_count > 0 && (
        <button onClick={() => navigate("/reports")}
                className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ background:"#E0A05211", border:"1px solid #E0A05244", borderRadius:16 }}>
          <AlertTriangle size={15} style={{ color:"#E0A052", flexShrink:0 }} />
          <div className="flex-1">
            <span className="text-sm font-medium" style={{ color:"#E0A052" }}>
              {data.pending_review_count} item{data.pending_review_count!==1?"s":""} need review
            </span>
            <p className="text-xs mt-0.5" style={{ color:"#E0A05288" }}>
              Low-confidence items, duplicates, failed imports
            </p>
          </div>
          <span className="text-xs uppercase tracking-widest" style={{ color:"#E0A052" }}>Review →</span>
        </button>
      )}

      {/* ── Overdue ── */}
      {data?.overdue?.length > 0 && (
        <Section id="overdue" title="Overdue" count={data.overdue.filter(t => !completedIds.has(t.id)).length}>
          <div className="mm-card overflow-hidden">
            {data.overdue.filter(t => !completedIds.has(t.id)).map(t => (
              <div key={t.id} className="mm-row flex items-center gap-3 px-4 py-3 border-b"
                   style={{ borderColor:"var(--mm-border)" }}>
                <button onClick={() => completeTask(t.id)}
                        className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors hover:border-green-500"
                        style={{ borderColor:"var(--mm-border)", flexShrink:0 }}
                        title="Mark complete">
                  <Check size={10} style={{ color:"var(--mm-border)", opacity:0.5 }} />
                </button>
                <button onClick={() => navigate("/tasks")} className="flex-1 text-left flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:"#E05252", boxShadow:"0 0 6px #E0525266" }} />
                  <span className="text-sm" style={{ color:"var(--mm-text)" }}>{t.task}</span>
                </button>
                <span className="text-xs" style={{ color:"#E05252" }}>{t.date}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Due today ── */}
      {data?.due_today?.length > 0 && (
        <Section id="today" title="Due Today" count={data.due_today.filter(t => !completedIds.has(t.id)).length}>
          <div className="mm-card overflow-hidden">
            {data.due_today.filter(t => !completedIds.has(t.id)).map(t => (
              <div key={t.id} className="mm-row flex items-center gap-3 px-4 py-3 border-b"
                   style={{ borderColor:"var(--mm-border)" }}>
                <button onClick={() => completeTask(t.id)}
                        className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors hover:border-green-500"
                        style={{ borderColor:"var(--mm-border)", flexShrink:0 }}
                        title="Mark complete">
                  <Check size={10} style={{ color:"var(--mm-border)", opacity:0.5 }} />
                </button>
                <button onClick={() => navigate("/tasks")} className="flex-1 text-left flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:"var(--mm-gold)", boxShadow:"0 0 6px var(--mm-gold)66" }} />
                  <span className="text-sm" style={{ color:"var(--mm-text)" }}>{t.task}</span>
                  {t.name && <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{t.name}</span>}
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Due soon ── */}
      {data?.due_soon?.length > 0 && (
        <Section id="soon" title="Due Soon">
          <div className="mm-card overflow-hidden">
            {data.due_soon.map(t => (
              <ItemRow key={t.id} to="/tasks" dotColor="var(--mm-border)"
                       main={t.task} right={t.date} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Reminders ── */}
      {data?.reminders?.length > 0 && (
        <Section id="reminders" title="Upcoming Reminders">
          <div className="mm-card overflow-hidden">
            {data.reminders.map(r => (
              <ItemRow key={r.id} to="/reminders" dotColor="var(--mm-gold)"
                       main={r.title}
                       right={r.fire_at ? new Date(r.fire_at).toLocaleTimeString("en-IN",{ hour:"2-digit", minute:"2-digit" }) : ""} />
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
                      style={{ borderColor:"var(--mm-border)" }}>
                <div className="w-4 h-4 flex items-center justify-center border flex-shrink-0"
                     style={{ borderColor:r.done_today ? "#52C77A" : "var(--mm-border)",
                              background:r.done_today ? "#52C77A22" : "transparent", borderRadius:"50%" }}>
                  {r.done_today && <span style={{ color:"#52C77A", fontSize:9, fontWeight:700 }}>✓</span>}
                </div>
                <span className="flex-1 text-sm" style={{ color:"var(--mm-text)", opacity:r.done_today?0.55:1 }}>
                  {r.activity}
                </span>
                <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{r.group}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── Cash flow ── */}
      {data?.cashflow && (
        <Section id="cashflow" title="Month Finances">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.cashflow).map(([cat,val]) => (
              <button key={cat} onClick={() => navigate("/cash-flow")}
                      className="mm-card mm-row p-4 text-left">
                <div className="mm-label mb-1.5">{cat}</div>
                <div className="text-xl font-light mm-font-display" style={{ color:"var(--mm-text)" }}>
                  ₹{formatAmount(val)}
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── Quick access ── */}
      <Section id="quicknav" title="Quick Access">
        <div className="grid grid-cols-4 gap-2">
          {QUICK_NAV.map((n) => {
            const Icon = n.icon;
            return (
              <button key={n.to} onClick={() => navigate(n.to)} title={n.label}
                      className="mm-card mm-row flex flex-col items-center gap-2.5 p-4">
                <div className="w-9 h-9 flex items-center justify-center"
                     style={{ background:`${n.color}18`, borderRadius:12 }}>
                  {Icon
                    ? <Icon size={16} style={{ color:n.color }} />
                    : <span style={{ fontSize:16 }}>{n.emoji}</span>}
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
               style={{ borderLeft:"3px solid var(--mm-border-gold)", background:"var(--mm-surface-2)",
                        borderRadius:"0 16px 16px 0" }}>
            <p className="mm-font-serif text-base italic" style={{ color:"var(--mm-text)", lineHeight:1.7 }}>
              "{quote.quote}"
            </p>
            {quote.author && (
              <p className="text-xs mt-2 uppercase tracking-widest" style={{ color:"var(--mm-muted)" }}>
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
                      className={`mm-filter-tab capitalize ${newsCategory===c && !showCustomRss ? "active" : ""}`}>
                {c}
              </button>
            ))}
            <button onClick={() => setShowCustomRss(s=>!s)}
                    className={`mm-filter-tab ${showCustomRss ? "active" : ""}`}>
              Custom RSS
            </button>
          </div>
          {showCustomRss && (
            <div className="flex gap-2">
              <input value={customRss} onChange={e => setCustomRss(e.target.value)}
                     placeholder="https://feed.example.com/rss"
                     className="mm-form-input flex-1 text-xs" />
              <button onClick={() => localStorage.setItem("mm_news_custom_url",customRss)}
                      className="mm-btn-gold px-4 text-xs">
                Save
              </button>
            </div>
          )}
          <div className="mm-card overflow-hidden">
            {news.length === 0
              ? <p className="p-4 text-sm" style={{ color:"var(--mm-muted)" }}>No news available</p>
              : news.map((item,i) => (
                  <p key={i} className="px-4 py-2.5 text-sm border-b last:border-0"
                     style={{ color:"var(--mm-muted)", borderColor:"var(--mm-border)" }}>
                    {item}
                  </p>
                ))
            }
          </div>
        </div>
      </Section>

    </div>
  );
}
