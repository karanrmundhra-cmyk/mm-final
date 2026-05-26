import React, { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, RefreshCw, Wallet, FileText,
  Bell, BarChart2, Settings, LogOut,
  ChevronLeft, ChevronRight, Search, Plus, Mic, Zap,
  Download, LayoutGrid, X, Sun, Moon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { subscribeSync } from "@/lib/syncQueue";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import QuickAdd from "@/components/QuickAdd";
import GlobalSearch from "@/components/GlobalSearch";
import AiChat from "@/components/AiChat";
import ProjectSelector from "@/components/ProjectSelector";
import VoiceCapture from "@/components/VoiceCapture";
import QuickNote from "@/components/QuickNote";

/* ── BMP-only weather symbols (no supplementary-plane emoji) ── */
function wxEmoji(code) {
  const c = parseInt(code, 10);
  if (c === 113) return "☀";
  if ([116, 119, 122].includes(c)) return "⛅";
  if ([143, 248, 260].includes(c)) return "☁";
  if ([200, 386, 389, 392, 395].includes(c)) return "⚡";
  if ([227, 230, 335, 338, 371, 374].includes(c)) return "❄";
  if (c >= 176) return "☂";
  return "⛅";
}

const NAV = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard",  key: "1" },
  { to: "/tasks",     icon: CheckSquare,     label: "Tasks",      key: "2" },
  { to: "/routines",  icon: RefreshCw,       label: "Routines",   key: "3" },
  { to: "/cash-flow", icon: Wallet,          label: "Finances",   key: "4" },
  { to: "/notes",     icon: FileText,        label: "Notes",      key: "5" },
  { to: "/reminders", icon: Bell,            label: "Reminders",  key: "6" },
  { to: "/reports",   icon: BarChart2,       label: "Reports",    key: "7" },
  { to: "/settings",  icon: Settings,        label: "Settings",   key: "8" },
];

const BOTTOM_NAV = NAV.slice(0, 5);

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("mm_sidebar_collapsed") === "1");
  const [pendingReview, setPendingReview] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [navBadges, setNavBadges] = useState({ tasks: 0, reminders: 0 });
  const [installPrompt,  setInstallPrompt]  = useState(null);
  const [showInstall,    setShowInstall]    = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [weather,        setWeather]        = useState(null);
  const [theme,          setTheme]          = useState(() => localStorage.getItem("mm_theme") || "dark");

  // Allow Settings page to open the shortcuts modal via custom event
  useEffect(() => {
    const handler = () => setShowShortcuts(true);
    window.addEventListener("mm:shortcuts", handler);
    return () => window.removeEventListener("mm:shortcuts", handler);
  }, []);

  useEffect(() => {
    api.get("/pending-review/count").then(r => setPendingReview(r.data.count)).catch(() => {});
  }, []);

  // Nav badge counts — tasks due today + reminders today
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const { data } = await api.get("/dashboard");
        setNavBadges({
          tasks:     (data.due_today?.length || 0) + (data.overdue?.length || 0),
          reminders: data.reminders?.length || 0,
        });
      } catch {}
    };
    fetchBadges();
    const iv = setInterval(fetchBadges, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(iv);
  }, []);

  // Live reminder polling
  useEffect(() => {
    const STORAGE_KEY = "mm_reminded";
    const check = async () => {
      try {
        const { data } = await api.get("/reminders");
        const now = new Date();
        const shown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        const newShown = [...shown];
        data.forEach(r => {
          if (!r.dismissed && r.fire_at && !shown.includes(r.id)) {
            const t = new Date(r.fire_at);
            if (t <= now && t >= new Date(now - 2 * 60000)) { // within last 2 min
              toast(`🔔 ${r.title}`, {
                description: r.notes || "Reminder",
                duration: 8000,
                action: { label: "View", onClick: () => navigate("/reminders") },
              });
              newShown.push(r.id);
            }
          }
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newShown.slice(-50)));
      } catch {}
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Theme — apply class to root element */
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
    localStorage.setItem("mm_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  /* Weather — wttr.in, no API key. Fetches current + 3-day forecast. */
  useEffect(() => {
    fetch("https://wttr.in/?format=j1")
      .then(r => r.json())
      .then(d => {
        const c = d.current_condition?.[0];
        if (!c) return;
        const forecast = (d.weather || []).map(day => ({
          date:  day.date,
          high:  day.maxtempC,
          low:   day.mintempC,
          emoji: wxEmoji(day.hourly?.[4]?.weatherCode || "116"),
          desc:  (day.hourly?.[4]?.weatherDesc?.[0]?.value || "")
                   .split(" ").slice(0, 3).join(" ")
                   .replace(/\b\w/g, ch => ch.toUpperCase()),
        }));
        setWeather({
          temp:     c.temp_C,
          emoji:    wxEmoji(c.weatherCode),
          desc:     (c.weatherDesc?.[0]?.value || "").split(" ").slice(0, 3).join(" ")
                      .replace(/\b\w/g, ch => ch.toUpperCase()),
          forecast,
        });
      })
      .catch(() => {});
  }, []);

  /* PWA install prompt — #7 */
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
    setShowInstall(false);
  };

  /* Keyboard shortcuts — #11 */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      const ctrl = e.metaKey || e.ctrlKey;

      if (ctrl && e.key === "k") { e.preventDefault(); setShowSearch(true); return; }
      if (ctrl && e.key === "n") { e.preventDefault(); setShowQuickAdd(true); return; }
      if (ctrl && e.key === "/") { e.preventDefault(); setShowShortcuts(s => !s); return; }
      if (ctrl && e.shiftKey && e.key === "N") { e.preventDefault(); setShowQuickNote(s => !s); return; }
      if (e.key === "Escape")    { setShowQuickAdd(false); setShowSearch(false); setShowAi(false); setShowVoice(false); setShowShortcuts(false); setShowQuickNote(false); return; }

      /* Cmd/Ctrl + 1-9 → navigate */
      if (ctrl) {
        const idx = parseInt(e.key, 10) - 1;
        const route = NAV.filter(n => n.key)[idx];
        if (route) { e.preventDefault(); navigate(route.to); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("mm_sidebar_collapsed", next ? "1" : "0");
  };

  return (
    <>
      {/* Project selector + weather — rendered OUTSIDE every overflow:hidden container
          so position:fixed is relative to the viewport with no parent interference */}
      <div className="fixed top-4 right-5 z-[100] pointer-events-auto flex flex-col items-center gap-2">
        <ProjectSelector />
        {location.pathname === "/" && weather && <WeatherCompact weather={weather} />}
      </div>

      <div className="flex h-screen overflow-hidden" style={{ background: "var(--mm-bg)" }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-full transition-all duration-300"
        style={{
          width: collapsed ? 64 : 232,
          background: "var(--mm-surface)",
          borderRight: "1px solid var(--mm-border)",
          boxShadow: "4px 0 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 flex-shrink-0"
             style={{ height: 68, borderBottom: "1px solid var(--mm-border)" }}>
          {/* SVG monogram — guaranteed correct regardless of PNG crop */}
          <MMLogo size={46} />
          {!collapsed && (
            <div className="min-w-0">
              <div style={{
                color: "var(--mm-gold)",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 16, fontWeight: 500, letterSpacing: "0.05em",
                lineHeight: 1.2,
              }}>
                Mind Matters
              </div>
              <div className="mm-label" style={{ fontSize: 9, letterSpacing: "0.22em", marginTop: 2, textTransform: "none" }}>
                Personal OS
              </div>
            </div>
          )}
        </div>

        {/* ── COLLAPSED MODE: nav + utility buttons tight together ── */}
        {collapsed ? (
          <>
            {/* Nav — natural height, no flex-1 */}
            <nav className="py-3 px-2 space-y-0.5">
              {NAV.map(({ to, icon: Icon, label }) => {
                const badgeCount = label === "Reports"   ? (pendingReview > 0 ? pendingReview : 0)
                                 : label === "Tasks"     ? navBadges.tasks
                                 : label === "Reminders" ? navBadges.reminders : 0;
                return (
                  <NavLink key={to} to={to} end={to === "/"}
                           className="relative group flex items-center justify-center px-3 py-2 transition-all duration-200"
                           style={({ isActive }) => ({
                             borderRadius: 14,
                             color: isActive ? "var(--mm-gold)" : "var(--mm-muted)",
                             background: isActive ? "rgba(212,175,55,0.1)" : "transparent",
                             boxShadow: isActive ? "0 2px 12px rgba(212,175,55,0.12)" : "none",
                           })}>
                    <Icon size={15} />
                    {badgeCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5"
                            style={{ background: "var(--mm-gold)", borderRadius: "50%" }} />
                    )}
                    <Tooltip label={label} side="right" />
                  </NavLink>
                );
              })}
            </nav>

            {/* Utility buttons + sign-out — right below nav, separated by border */}
            <div className="px-2 py-2 flex-shrink-0" style={{ borderTop: "1px solid var(--mm-border)" }}>
              <div className="flex flex-col items-center gap-1">
                <SidebarBtn icon={Plus}   label="Quick Add"      onClick={() => setShowQuickAdd(true)} />
                <SidebarBtn icon={Search} label="Search"         onClick={() => setShowSearch(true)} />
                <SidebarBtn icon={Mic}    label="Voice Note"     onClick={() => setShowVoice(true)} />
                <SidebarBtn icon={Zap}    label="Chief Of Staff" onClick={() => setShowAi(true)} />
                <SyncBtn />
                <SidebarBtn icon={theme === "dark" ? Sun : Moon}
                            label={theme === "dark" ? "Light Mode" : "Dark Mode"}
                            onClick={toggleTheme} />
                <button onClick={toggleCollapse}
                        className="relative flex items-center justify-center p-2 transition-all group"
                        style={{ color: "var(--mm-muted)", opacity: 0.5, borderRadius: 10 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                  <ChevronRight size={14} />
                  <Tooltip label="Expand" />
                </button>
                {/* Internal divider before sign-out */}
                <div style={{ width: 28, height: 1, background: "var(--mm-border)", margin: "2px 0" }} />
                <button onClick={logout}
                        className="relative w-full flex items-center justify-center p-2 transition-all group"
                        style={{ color: "var(--mm-muted)", opacity: 0.5, borderRadius: 10 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                  <LogOut size={13} />
                  <Tooltip label="Sign Out" side="right" />
                </button>
              </div>
            </div>

            {/* Spacer — nothing pinned below */}
            <div className="flex-1" />
          </>
        ) : (
          /* ── EXPANDED MODE: nav fills space, utility buttons + user at bottom ── */
          <>
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
              {NAV.map(({ to, icon: Icon, label }) => {
                const badgeCount = label === "Reports"   ? (pendingReview > 0 ? pendingReview : 0)
                                 : label === "Tasks"     ? navBadges.tasks
                                 : label === "Reminders" ? navBadges.reminders : 0;
                const hasBadge = badgeCount > 0;
                return (
                  <NavLink key={to} to={to} end={to === "/"}
                           className="flex items-center gap-3 px-3 py-2 transition-all duration-200 relative"
                           style={({ isActive }) => ({
                             borderRadius: 14,
                             color: isActive ? "var(--mm-gold)" : "var(--mm-muted)",
                             background: isActive ? "rgba(212,175,55,0.1)" : "transparent",
                             boxShadow: isActive ? "0 2px 12px rgba(212,175,55,0.12)" : "none",
                           })}>
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="flex-1 text-xs"
                          style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500,
                                   letterSpacing: "0.06em", color: "inherit" }}>
                      {label}
                    </span>
                    {hasBadge && (
                      <span className="text-xs px-1.5 py-0.5"
                            style={{ background: "rgba(212,175,55,0.12)", color: "var(--mm-gold)",
                                     fontSize: 9, borderRadius: 8 }}>
                        {badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Expanded footer */}
            <div className="flex-shrink-0 py-3 px-2" style={{ borderTop: "1px solid var(--mm-border)" }}>
              <div className="flex items-center justify-between px-1 mb-3">
                <SidebarBtn icon={Plus}   label="Quick Add"  onClick={() => setShowQuickAdd(true)} />
                <SidebarBtn icon={Search} label="Search"     onClick={() => setShowSearch(true)} />
                <SidebarBtn icon={Mic}    label="Voice Note" onClick={() => setShowVoice(true)} />
                <SidebarBtn icon={Zap}    label="Chief Of Staff" onClick={() => setShowAi(true)} />
                <SyncBtn />
                <SidebarBtn icon={theme === "dark" ? Sun : Moon}
                            label={theme === "dark" ? "Light Mode" : "Dark Mode"}
                            onClick={toggleTheme} />
                <button onClick={toggleCollapse}
                        className="relative flex items-center justify-center p-2 transition-all group"
                        style={{ color: "var(--mm-muted)", opacity: 0.5, borderRadius: 10 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                  <ChevronLeft size={14} />
                  <Tooltip label="Collapse" />
                </button>
              </div>
              {/* Name · email · sign-out */}
              <div className="flex items-center gap-2 px-1 pt-2.5"
                   style={{ borderTop: "1px solid var(--mm-border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate"
                       style={{ color: "var(--mm-gold)", fontFamily: "'Outfit', sans-serif" }}>
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="truncate" style={{ fontSize: 10, color: "var(--mm-muted)" }}>
                    {user?.email}
                  </div>
                </div>
                <button onClick={logout}
                        className="relative p-1.5 transition-opacity group"
                        style={{ color: "var(--mm-muted)", opacity: 0.5 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                  <LogOut size={13} />
                  <Tooltip label="Sign Out" side="top" />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* ── Mobile bottom bar ── */}
        <nav className="md:hidden flex items-center justify-around px-1 py-2 flex-shrink-0"
             style={{
               background: "rgba(12,12,15,0.97)",
               backdropFilter: "blur(16px)",
               borderTop: "1px solid var(--mm-border)",
             }}>
          {[
            { icon: LayoutGrid, label: "Pages",  action: () => setShowMobileMenu(true) },
            { icon: Plus,       label: "Add",    action: () => setShowQuickAdd(true) },
            { icon: Search,     label: "Search", action: () => setShowSearch(true) },
            { icon: Mic,        label: "Voice",  action: () => setShowVoice(true) },
            { icon: Zap,        label: "COS",    action: () => setShowAi(true) },
            { icon: LogOut,     label: "Out",    action: logout },
          ].map(({ icon: Icon, label, action }) => (
            <button key={label} onClick={action}
                    className="flex flex-col items-center gap-0.5 p-2"
                    style={{ color: "var(--mm-muted)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--mm-gold)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--mm-muted)"}>
              <Icon size={18} />
              <span style={{ fontSize: 9, letterSpacing: "0.04em",
                             fontFamily: "'Outfit', sans-serif" }}>{label}</span>
            </button>
          ))}
        </nav>

        {/* Mobile page-picker overlay */}
        {showMobileMenu && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
               style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
               onClick={() => setShowMobileMenu(false)}>
            <div className="animate-slide-up px-4 pb-6 pt-5"
                 style={{
                   background: "var(--mm-surface)",
                   borderRadius: "24px 24px 0 0",
                   borderTop: "1px solid var(--mm-border-gold)",
                 }}
                 onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18,
                            fontWeight: 400, color: "var(--mm-text)" }}>
                  Go to…
                </p>
                <button onClick={() => setShowMobileMenu(false)} className="mm-icon-btn">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {NAV.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} end={to === "/"}
                           onClick={() => setShowMobileMenu(false)}
                           className="flex flex-col items-center gap-2 p-3"
                           style={({ isActive }) => ({
                             background: isActive ? "rgba(212,175,55,0.1)" : "var(--mm-surface-2)",
                             borderRadius: 16,
                             color: isActive ? "var(--mm-gold)" : "var(--mm-muted)",
                           })}>
                    <Icon size={20} />
                    <span style={{ fontSize: 10, letterSpacing: "0.03em",
                                   fontFamily: "'Outfit', sans-serif" }}>
                      {label}
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ──────────────────────────────────────────────── */}
      {showQuickAdd  && <QuickAdd onClose={() => setShowQuickAdd(false)} />}
      {showSearch    && <GlobalSearch onClose={() => setShowSearch(false)} />}
      {showAi        && <AiChat onClose={() => setShowAi(false)} />}
      {showVoice     && <VoiceCapture onClose={() => setShowVoice(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showQuickNote && <QuickNote onClose={() => setShowQuickNote(false)} />}

      {/* ── PWA Install banner ── */}
      {showInstall && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up"
             style={{ maxWidth: 360, width: "calc(100% - 32px)" }}>
          <div className="flex items-center gap-3 px-4 py-3"
               style={{ background:"var(--mm-surface)", border:"1px solid var(--mm-border-gold)",
                        borderRadius:20, boxShadow:"var(--elev-3)" }}>
            <Download size={16} style={{ color:"var(--mm-gold)", flexShrink:0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color:"var(--mm-text)" }}>Install Mind Matters</p>
              <p className="text-xs" style={{ color:"var(--mm-muted)" }}>Add to home screen for quick access</p>
            </div>
            <button onClick={handleInstall} className="mm-btn-gold px-3 py-1.5 text-xs flex-shrink-0">
              Install
            </button>
            <button onClick={() => setShowInstall(false)}
                    className="mm-icon-btn" style={{ flexShrink:0 }}>
              ×
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

/* MMLogo alias — now delegates to the imported Logo SVG component */
function MMLogo({ size = 46 }) {
  return <Logo size={size} />;
}

/* ── Shared tooltip ─────────────────────────────────────────────
   side="right"  → appears to the RIGHT of the icon (default for
                   left-edge sidebar — never clipped by the screen)
   side="top"    → appears ABOVE (for bottom-row utility buttons)
   ─────────────────────────────────────────────────────────────── */
function Tooltip({ label, side = "right" }) {
  const pos = side === "top"
    ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
    : "left-full top-1/2 -translate-y-1/2 ml-2.5";
  return (
    <span
      className={`pointer-events-none absolute ${pos} px-2.5 py-1.5
                  opacity-0 group-hover:opacity-100 transition-opacity
                  duration-150 whitespace-nowrap z-[200]`}
      style={{
        background: "rgba(10,10,12,0.96)",
        border: "1px solid var(--mm-border-gold)",
        borderRadius: 8,
        color: "var(--mm-text)",
        fontSize: 11,
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: "0.05em",
        backdropFilter: "blur(10px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.55)",
        pointerEvents: "none",
      }}>
      {label}
    </span>
  );
}

/* ── Sync button with "Last synced" tooltip ───────────────────── */
function SyncBtn() {
  const [state, setState]     = useState({ online: true, pending: 0 });
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    const unsub = subscribeSync((s) => {
      setState(s);
      if (s.pending === 0) setLastSync(new Date());
    });
    return unsub;
  }, []);

  const color  = !state.online ? "rgba(240,237,232,0.25)"
               : state.pending > 0 ? "#D4AF37"        /* syncing → gold */
               : "#22C55E";                            /* synced  → green */
  const shadow = !state.online ? "transparent"
               : state.pending > 0 ? "rgba(212,175,55,0.5)"
               : "rgba(34,197,94,0.45)";

  const timeAgoStr = (date) => {
    if (!date) return "Just Now";
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 10)   return "Just Now";
    if (s < 60)   return `${s}s Ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m Ago`;
    return `${Math.floor(s / 3600)}h Ago`;
  };

  const tooltipLabel = !state.online
    ? "Offline"
    : state.pending > 0
    ? `Syncing — ${state.pending} Pending`
    : `Last Synced: ${timeAgoStr(lastSync)}`;

  return (
    <button className="relative flex items-center justify-center p-2 group"
            style={{ borderRadius: 10, cursor: "default" }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: color,
        boxShadow: `0 0 8px ${shadow}`,
        transition: "background 0.3s, box-shadow 0.3s",
      }} />
      <Tooltip label={tooltipLabel} />
    </button>
  );
}

/* ── Sidebar utility button — always grey ────────────────────── */
function SidebarBtn({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick}
            className="relative flex items-center justify-center p-2 transition-all group"
            style={{ color: "var(--mm-muted)", opacity: 0.5, borderRadius: 10 }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.transform = "scale(1)"; }}>
      <Icon size={14} />
      <Tooltip label={label} />
    </button>
  );
}

const SHORTCUTS = [
  { keys: ["⌘", "K"],     desc: "Global search" },
  { keys: ["⌘", "N"],     desc: "Quick add task" },
  { keys: ["⌘", "⇧", "N"],desc: "Scratch pad note" },
  { keys: ["⌘", "1–9"],   desc: "Navigate to section" },
  { keys: ["⌘", "/"],     desc: "Toggle shortcuts" },
  { keys: ["Esc"],         desc: "Close any modal" },
  { keys: ["Enter"],       desc: "Submit / save form" },
];

/* ── Compact weather badge + 3-day forecast popup on click ────── */
function WeatherCompact({ weather }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Badge */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          border: `1.5px solid ${open ? "var(--mm-gold)" : "var(--mm-border-gold)"}`,
          background: open ? "rgba(201,169,97,0.10)" : "rgba(201,169,97,0.04)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 2,
          flexShrink: 0, cursor: "pointer",
          transition: "border-color 0.2s, background 0.2s",
        }}
        title={`${weather.desc} · ${weather.temp}°C — click for forecast`}>
        <span style={{ fontSize: 19, lineHeight: 1 }}>{weather.emoji}</span>
        <span style={{ fontSize: 10, fontFamily: "'Inter','Outfit',sans-serif", color: "var(--mm-text)", fontWeight: 300 }}>
          {weather.temp}°
        </span>
      </button>

      {/* Forecast popup */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 10px)",
          right: 0,
          zIndex: 300,
          background: "var(--mm-surface)",
          border: "1px solid var(--mm-border-gold)",
          borderRadius: 16,
          padding: "14px 16px",
          boxShadow: "var(--elev-3)",
          minWidth: 220,
          animation: "scaleIn 0.18s ease",
        }}>
          {/* Current */}
          <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--mm-border)" }}>
            <div style={{ fontSize: 11, color: "var(--mm-muted)", fontFamily: "'Inter',sans-serif", marginBottom: 4 }}>
              Now
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 28 }}>{weather.emoji}</span>
              <div>
                <div style={{ fontSize: 20, fontFamily: "'Cormorant Garamond',serif", color: "var(--mm-text)", fontWeight: 300 }}>
                  {weather.temp}°C
                </div>
                <div style={{ fontSize: 11, color: "var(--mm-muted)", fontFamily: "'Inter',sans-serif" }}>
                  {weather.desc}
                </div>
              </div>
            </div>
          </div>

          {/* 3-day forecast */}
          {(weather.forecast || []).map((day, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: i < (weather.forecast.length - 1) ? "1px solid var(--mm-border)" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{day.emoji}</span>
                <div>
                  <div style={{ fontSize: 11, color: "var(--mm-text)", fontFamily: "'Inter',sans-serif" }}>
                    {i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmtDate(day.date)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--mm-muted)", fontFamily: "'Inter',sans-serif" }}>
                    {day.desc}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "'Inter',sans-serif" }}>
                <span style={{ fontSize: 12, color: "var(--mm-text)" }}>{day.high}°</span>
                <span style={{ fontSize: 10, color: "var(--mm-muted)", marginLeft: 4 }}>{day.low}°</span>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 8, fontSize: 9, color: "var(--mm-muted-2)", fontFamily: "'Inter',sans-serif", textAlign: "center" }}>
            Powered by wttr.in
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutsModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(12px)" }}
         onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="w-full max-w-sm animate-scale-in"
           style={{ background:"var(--mm-surface)", border:"1px solid var(--mm-border-gold)",
                    borderRadius:28, boxShadow:"var(--elev-modal)", padding:28 }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="mm-font-display text-lg" style={{ color:"var(--mm-text)", fontWeight:400 }}>
            Keyboard Shortcuts
          </h2>
          <button onClick={onClose} className="mm-icon-btn">×</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm" style={{ color:"var(--mm-muted)" }}>{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="text-xs px-2 py-1"
                       style={{ background:"var(--mm-surface-3)", color:"var(--mm-text)",
                                border:"1px solid var(--mm-border)", borderRadius:8,
                                fontFamily:"monospace", minWidth:28, textAlign:"center" }}>
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4" style={{ borderTop:"1px solid var(--mm-border)" }}>
          <p className="text-xs text-center" style={{ color:"var(--mm-muted)" }}>
            Use <kbd className="px-1.5 py-0.5 text-xs"
                     style={{ background:"var(--mm-surface-3)", borderRadius:6, border:"1px solid var(--mm-border)" }}>
              ⌘ /
            </kbd> to toggle anytime
          </p>
        </div>
      </div>
    </div>
  );
}
