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

/* ── Comprehensive news options (categories + every country) ─────── */
const ALL_NEWS_OPTIONS = [
  // 7 categories
  { group: "Categories", value: "general",       label: "General"              },
  { group: "Categories", value: "politics",      label: "Politics"             },
  { group: "Categories", value: "business",      label: "Business"             },
  { group: "Categories", value: "tech",          label: "Technology"           },
  { group: "Categories", value: "science",       label: "Science"              },
  { group: "Categories", value: "health",        label: "Health"               },
  { group: "Categories", value: "sports",        label: "Sports"               },
  { group: "Categories", value: "entertainment", label: "Entertainment"        },
  // Countries
  { group: "Countries",  value: "world",         label: "World"                },
  { group: "Countries",  value: "india",         label: "India"                },
  { group: "Countries",  value: "us",            label: "United States"        },
  { group: "Countries",  value: "uk",            label: "United Kingdom"       },
  { group: "Countries",  value: "canada",        label: "Canada"               },
  { group: "Countries",  value: "australia",     label: "Australia"            },
  { group: "Countries",  value: "uae",           label: "UAE"                  },
  { group: "Countries",  value: "singapore",     label: "Singapore"            },
  { group: "Countries",  value: "germany",       label: "Germany"              },
  { group: "Countries",  value: "france",        label: "France"               },
  { group: "Countries",  value: "japan",         label: "Japan"                },
  { group: "Countries",  value: "china",         label: "China"                },
  { group: "Countries",  value: "russia",        label: "Russia"               },
  { group: "Countries",  value: "brazil",        label: "Brazil"               },
  { group: "Countries",  value: "south_africa",  label: "South Africa"         },
  { group: "Countries",  value: "nigeria",       label: "Nigeria"              },
  { group: "Countries",  value: "egypt",         label: "Egypt"                },
  { group: "Countries",  value: "south_korea",   label: "South Korea"          },
  { group: "Countries",  value: "indonesia",     label: "Indonesia"            },
  { group: "Countries",  value: "pakistan",      label: "Pakistan"             },
  { group: "Countries",  value: "bangladesh",    label: "Bangladesh"           },
  { group: "Countries",  value: "malaysia",      label: "Malaysia"             },
  { group: "Countries",  value: "thailand",      label: "Thailand"             },
  { group: "Countries",  value: "vietnam",       label: "Vietnam"              },
  { group: "Countries",  value: "philippines",   label: "Philippines"          },
  { group: "Countries",  value: "sri_lanka",     label: "Sri Lanka"            },
  { group: "Countries",  value: "nepal",         label: "Nepal"                },
  { group: "Countries",  value: "israel",        label: "Israel"               },
  { group: "Countries",  value: "saudi_arabia",  label: "Saudi Arabia"         },
  { group: "Countries",  value: "turkey",        label: "Turkey"               },
  { group: "Countries",  value: "iran",          label: "Iran"                 },
  { group: "Countries",  value: "iraq",          label: "Iraq"                 },
  { group: "Countries",  value: "jordan",        label: "Jordan"               },
  { group: "Countries",  value: "qatar",         label: "Qatar"                },
  { group: "Countries",  value: "kuwait",        label: "Kuwait"               },
  { group: "Countries",  value: "bahrain",       label: "Bahrain"              },
  { group: "Countries",  value: "oman",          label: "Oman"                 },
  { group: "Countries",  value: "italy",         label: "Italy"                },
  { group: "Countries",  value: "spain",         label: "Spain"                },
  { group: "Countries",  value: "netherlands",   label: "Netherlands"          },
  { group: "Countries",  value: "sweden",        label: "Sweden"               },
  { group: "Countries",  value: "norway",        label: "Norway"               },
  { group: "Countries",  value: "denmark",       label: "Denmark"              },
  { group: "Countries",  value: "finland",       label: "Finland"              },
  { group: "Countries",  value: "switzerland",   label: "Switzerland"          },
  { group: "Countries",  value: "austria",       label: "Austria"              },
  { group: "Countries",  value: "belgium",       label: "Belgium"              },
  { group: "Countries",  value: "poland",        label: "Poland"               },
  { group: "Countries",  value: "ukraine",       label: "Ukraine"              },
  { group: "Countries",  value: "czech",         label: "Czech Republic"       },
  { group: "Countries",  value: "romania",       label: "Romania"              },
  { group: "Countries",  value: "greece",        label: "Greece"               },
  { group: "Countries",  value: "portugal",      label: "Portugal"             },
  { group: "Countries",  value: "mexico",        label: "Mexico"               },
  { group: "Countries",  value: "argentina",     label: "Argentina"            },
  { group: "Countries",  value: "colombia",      label: "Colombia"             },
  { group: "Countries",  value: "chile",         label: "Chile"                },
  { group: "Countries",  value: "peru",          label: "Peru"                 },
  { group: "Countries",  value: "venezuela",     label: "Venezuela"            },
  { group: "Countries",  value: "new_zealand",   label: "New Zealand"          },
  { group: "Countries",  value: "hong_kong",     label: "Hong Kong"            },
  { group: "Countries",  value: "taiwan",        label: "Taiwan"               },
  { group: "Countries",  value: "kenya",         label: "Kenya"                },
  { group: "Countries",  value: "ethiopia",      label: "Ethiopia"             },
  { group: "Countries",  value: "ghana",         label: "Ghana"                },
  { group: "Countries",  value: "tanzania",      label: "Tanzania"             },
  { group: "Countries",  value: "morocco",       label: "Morocco"              },
  { group: "Countries",  value: "algeria",       label: "Algeria"              },
  { group: "Countries",  value: "ireland",       label: "Ireland"              },
  { group: "Countries",  value: "hungary",       label: "Hungary"              },
  { group: "Countries",  value: "belarus",       label: "Belarus"              },
  { group: "Countries",  value: "kazakhstan",    label: "Kazakhstan"           },
  { group: "Countries",  value: "uzbekistan",    label: "Uzbekistan"           },
];

const DEFAULT_NEWS_TABS = [
  { id: 1, label: "General",  category: "general"  },
  { id: 2, label: "Business", category: "business" },
  { id: 3, label: "Tech",     category: "tech"     },
  { id: 4, label: "Politics", category: "politics" },
  { id: 5, label: "India",    category: "india"    },
];

/* ── Weather badge (replaces the old completion ring) ────────────── */
function WeatherBadge({ weather, project }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <span style={{
        fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
      }}>
        {project || "Personal"}
      </span>
      <div style={{
        width: 76, height: 76, borderRadius: "50%",
        border: "1.5px solid var(--mm-border-gold)",
        background: "rgba(212,175,55,0.04)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 3,
      }}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>{weather.emoji}</span>
        <span style={{
          fontSize: 13, fontWeight: 300, fontFamily: "'Outfit', sans-serif",
          color: "var(--mm-text)", letterSpacing: "0.02em",
        }}>
          {weather.temp}°C
        </span>
      </div>
      <span style={{
        fontSize: 9, color: "var(--mm-muted)", fontFamily: "'Outfit', sans-serif",
        maxWidth: 80, textAlign: "center", lineHeight: 1.3,
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
        placeholder="Write your personal affirmation for today…"
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

/* ── News tab manager modal ──────────────────────────────────────── */
function NewsTabModal({ tabs, onSave, onClose }) {
  const [local, setLocal] = useState(tabs.map(t => ({ ...t })));
  const [query, setQuery] = useState("");

  const update = (i, key, val) =>
    setLocal(arr => arr.map((t, j) => j === i ? { ...t, [key]: val } : t));
  const add    = () => {
    if (local.length >= 5) return;
    setLocal(arr => [...arr, { id: Date.now(), label: "My Tab", category: "general" }]);
  };
  const remove = (i) => setLocal(arr => arr.filter((_, j) => j !== i));

  const filtered = query.trim()
    ? ALL_NEWS_OPTIONS.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase()))
    : ALL_NEWS_OPTIONS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)" }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg animate-scale-in"
           style={{
             background: "var(--mm-surface)", border: "1px solid var(--mm-border-gold)",
             borderRadius: 24, padding: 24, maxHeight: "85vh", overflowY: "auto",
           }}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20, fontWeight: 400, color: "var(--mm-text)",
          }}>
            Manage News Tabs
          </h3>
          <button onClick={onClose} className="mm-icon-btn">×</button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--mm-muted)" }}>
          Up to 5 tabs — choose any category or country. Start typing to filter.
        </p>

        <div className="space-y-3 mb-4">
          {local.map((tab, i) => (
            <div key={tab.id}>
              <div className="flex items-center gap-2">
                <input
                  value={tab.label}
                  onChange={e => update(i, "label", e.target.value)}
                  placeholder="Tab name"
                  className="mm-form-input text-xs"
                  style={{ flex: "0 0 90px" }}
                />
                {/* Searchable datalist input */}
                <input
                  list={`news-opts-${i}`}
                  value={tab.category}
                  onChange={e => update(i, "category", e.target.value)}
                  placeholder="Type category or country…"
                  className="mm-form-input text-xs flex-1"
                />
                <datalist id={`news-opts-${i}`}>
                  {ALL_NEWS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </datalist>
                <button onClick={() => remove(i)}
                        style={{ color: "var(--mm-muted)", opacity: 0.5, padding: 4, flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                  <X size={13} />
                </button>
              </div>
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

  const [data,          setData]          = useState(null);
  const [news,          setNews]          = useState([]);
  const [newsTabs,      setNewsTabs]      = useState(() => {
    try { return JSON.parse(localStorage.getItem("mm_news_tabs") || "null") || DEFAULT_NEWS_TABS; }
    catch { return DEFAULT_NEWS_TABS; }
  });
  const [activeNewsTab, setActiveNewsTab] = useState(0);
  const [customRss,     setCustomRss]     = useState(() => localStorage.getItem("mm_news_custom_url") || "");
  const [showTabModal,  setShowTabModal]  = useState(false);
  const [quote,         setQuote]         = useState(null);
  const [collapsed,     setCollapsed]     = useState({});
  const [now,           setNow]           = useState(new Date());
  const [completedIds,  setCompletedIds]  = useState(new Set());
  const [showReview,    setShowReview]    = useState(false);
  const [weather,       setWeather]       = useState(null);
  const [activeProject, setActiveProject] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mm_project") || "null")?.name || "Personal"; }
    catch { return "Personal"; }
  });

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
          desc:  (c.weatherDesc?.[0]?.value || "").split(" ").slice(0, 3).join(" "),
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
      const pa = pOrder[a.priority ?? ""] ?? 4, pb = pOrder[b.priority ?? ""] ?? 4;
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

      {/* ── Hero: Greeting (left) + Weather circle (right) ── */}
      <div className="flex items-start gap-6">

        {/* Left: Date + Greeting + Gold line */}
        <div className="flex-1 min-w-0">
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
        {weather && <WeatherBadge weather={weather} project={activeProject} />}
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
                      className="w-full flex items-center gap-3 text-left group" title="Mark complete">
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

      {/* ── Due Soon — top 3 only ── */}
      {data?.due_soon?.length > 0 && (
        <Section id="soon" title="Due Soon">
          <div className="mm-card overflow-hidden">
            {data.due_soon.slice(0, 3).map(t => (
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
                  <span style={{ color: "var(--mm-gold)", fontSize: 10 }}>🔥{r.streak}</span>
                )}
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{r.group}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── Month Finances — 6 cards (Income, Expense, Savings, Balance + upcoming) ── */}
      {data?.cashflow && (
        <Section id="cashflow" title="Month Finances">
          <div className="grid grid-cols-2 gap-3">
            {/* Standard cashflow keys */}
            {Object.entries(data.cashflow).map(([cat, val]) => (
              <button key={cat} onClick={() => navigate("/cash-flow")}
                      className="mm-card mm-row p-4 text-left">
                <div className="mm-label mb-1.5">{cat}</div>
                <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                  ₹{formatAmount(val)}
                </div>
              </button>
            ))}
            {/* Upcoming Payments */}
            <button onClick={() => navigate("/cash-flow")} className="mm-card mm-row p-4 text-left">
              <div className="mm-label mb-1.5">Upcoming Payments</div>
              <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                {data.upcoming_payments !== undefined
                  ? `₹${formatAmount(data.upcoming_payments)}`
                  : <span style={{ fontSize: 13, color: "var(--mm-muted)" }}>—</span>}
              </div>
            </button>
            {/* Upcoming Receipts */}
            <button onClick={() => navigate("/cash-flow")} className="mm-card mm-row p-4 text-left">
              <div className="mm-label mb-1.5">Upcoming Receipts</div>
              <div className="text-xl font-light mm-font-display" style={{ color: "var(--mm-text)" }}>
                {data.upcoming_receipts !== undefined
                  ? `₹${formatAmount(data.upcoming_receipts)}`
                  : <span style={{ fontSize: 13, color: "var(--mm-muted)" }}>—</span>}
              </div>
            </button>
          </div>
          {spendingInsight && (
            <p className="text-xs mt-2 px-1" style={{ color: "var(--mm-muted)" }}>
              {spendingInsight}
            </p>
          )}
        </Section>
      )}

      {/* ── Reminders & Deadlines (below finances, top 3 each) ── */}
      {((data?.reminders?.length > 0) || (data?.due_soon?.length > 0)) && (
        <Section id="reminders_deadlines" title="Reminders & Deadlines">
          <div className="mm-card overflow-hidden">
            {/* Upcoming reminders — top 3 */}
            {data?.reminders?.slice(0, 3).map(r => (
              <button key={`rem-${r.id}`} onClick={() => navigate("/reminders")}
                      className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left border-b"
                      style={{ borderColor: "var(--mm-border)" }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "var(--mm-gold)", boxShadow: "0 0 5px rgba(212,175,55,0.5)" }} />
                <span className="flex-1 text-sm truncate" style={{ color: "var(--mm-text)" }}>
                  {r.title}
                </span>
                <span className="mm-label flex-shrink-0">Reminder</span>
                {r.fire_at && (
                  <span className="text-xs flex-shrink-0" style={{ color: "var(--mm-muted)" }}>
                    {new Date(r.fire_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                )}
              </button>
            ))}
            {/* Upcoming deadlines (due_soon top 3) */}
            {data?.due_soon?.slice(0, 3).map(t => (
              <button key={`dl-${t.id}`} onClick={() => navigate("/tasks")}
                      className="mm-row w-full flex items-center gap-3 px-4 py-3 text-left border-b"
                      style={{ borderColor: "var(--mm-border)" }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "var(--mm-muted)", opacity: 0.5 }} />
                <span className="flex-1 text-sm truncate" style={{ color: "var(--mm-text)" }}>
                  {t.task}
                </span>
                <span className="mm-label flex-shrink-0">Deadline</span>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--mm-muted)" }}>{t.date}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── Reminders standalone (kept for context) ── */}
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
                    ? new Date(r.fire_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : ""}
                </span>
              </button>
            ))}
          </div>
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
              <p className="text-xs mt-2 uppercase tracking-widest" style={{ color: "var(--mm-muted)" }}>
                — {quote.author}
              </p>
            )}
          </div>
          <AffirmationCard />
        </Section>
      )}

      {/* ── News ── */}
      <Section id="news" title="News">
        <div className="space-y-3">
          {/* Tab row */}
          <div className="flex items-center gap-1 flex-wrap">
            {newsTabs.map((tab, i) => (
              <button key={tab.id}
                      onClick={() => setActiveNewsTab(i)}
                      className={`mm-filter-tab capitalize ${activeNewsTab === i && !isOthersTab ? "active" : ""}`}>
                {tab.label}
              </button>
            ))}
            <button onClick={() => setActiveNewsTab(newsTabs.length)}
                    className={`mm-filter-tab ${isOthersTab ? "active" : ""}`}>
              Others
            </button>
            <button onClick={() => setShowTabModal(true)}
                    className="mm-filter-tab" title="Manage tabs"
                    style={{ marginLeft: "auto" }}>
              <Edit2 size={10} />
            </button>
          </div>

          {/* Others RSS input */}
          {isOthersTab && (
            <div className="flex gap-2">
              <input value={customRss} onChange={e => setCustomRss(e.target.value)}
                     placeholder="Paste a custom RSS feed URL…"
                     className="mm-form-input flex-1 text-xs" />
              <button onClick={() => localStorage.setItem("mm_news_custom_url", customRss)}
                      className="mm-btn-gold px-4 text-xs">Save</button>
            </div>
          )}

          {/* News list */}
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

      {showTabModal && (
        <NewsTabModal tabs={newsTabs} onSave={saveNewsTabs} onClose={() => setShowTabModal(false)} />
      )}
    </div>
  );
}
