import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, RefreshCw, Wallet, FileText,
  Bell, BarChart2, Settings, LogOut,
  ChevronLeft, ChevronRight, Search, Plus, Mic, Zap,
  Download,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { subscribeSync } from "@/lib/syncQueue";
import { api } from "@/lib/api";
import { toast } from "sonner";
import QuickAdd from "@/components/QuickAdd";
import GlobalSearch from "@/components/GlobalSearch";
import AiChat from "@/components/AiChat";
import ProjectSelector from "@/components/ProjectSelector";
import VoiceCapture from "@/components/VoiceCapture";
import QuickNote from "@/components/QuickNote";

const NAV = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard",  key: "1" },
  { to: "/tasks",     icon: CheckSquare,     label: "Tasks",      key: "2" },
  { to: "/routines",  icon: RefreshCw,       label: "Routines",   key: "3" },
  { to: "/cash-flow", icon: Wallet,          label: "Cash Flow",  key: "4" },
  { to: "/notes",     icon: FileText,        label: "Notes",      key: "5" },
  { to: "/reminders", icon: Bell,            label: "Reminders",  key: "6" },
  { to: "/reports",   icon: BarChart2,       label: "Reports",    key: "7" },
  { to: "/settings",  icon: Settings,        label: "Settings",   key: "8" },
];

const BOTTOM_NAV = NAV.slice(0, 5);

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("mm_sidebar_collapsed") === "1");
  const [pendingReview, setPendingReview] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [navBadges, setNavBadges] = useState({ tasks: 0, reminders: 0 });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

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
          {/* Brand logo — object-fit:cover centred at the ring portion of the portrait PNG */}
          <img src="/rkm-logo.png" alt="MM"
               style={{ width: 46, height: 46, objectFit: "cover", objectPosition: "center 35%", flexShrink: 0 }} />
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
              <div className="mm-label" style={{ fontSize: 9, letterSpacing: "0.22em", marginTop: 2 }}>
                Personal OS
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => {
            const badgeCount = label === "Reports"   ? (pendingReview > 0 ? pendingReview : 0)
                             : label === "Tasks"     ? navBadges.tasks
                             : label === "Reminders" ? navBadges.reminders
                             : 0;
            const hasBadge = badgeCount > 0;
            return (
              <NavLink
                key={to} to={to} end={to === "/"}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 px-3 py-2 transition-all duration-200 relative"
                style={({ isActive }) => ({
                  borderRadius: 14,
                  color: isActive ? "var(--mm-gold)" : "var(--mm-muted)",
                  background: isActive
                    ? "rgba(212,175,55,0.1)"
                    : "transparent",
                  boxShadow: isActive ? "0 2px 12px rgba(212,175,55,0.12)" : "none",
                })}
              >
                <Icon size={15} className="flex-shrink-0" />
                {!collapsed && (
                  <>
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
                  </>
                )}
                {collapsed && hasBadge && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5"
                        style={{ background: "var(--mm-gold)", borderRadius: "50%" }} />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 py-3 px-2" style={{ borderTop: "1px solid var(--mm-border)" }}>
          {collapsed ? (
            /* ── Collapsed: vertical column of icons + sign-out at bottom ── */
            <div className="flex flex-col items-center gap-1">
              <SidebarBtn icon={Plus}   label="Quick Add"  onClick={() => setShowQuickAdd(true)} />
              <SidebarBtn icon={Search} label="Search"     onClick={() => setShowSearch(true)} />
              <SidebarBtn icon={Zap}    label="AI Chat"    onClick={() => setShowAi(true)} />
              <SyncBtn />
              <button onClick={toggleCollapse}
                      className="relative flex items-center justify-center p-2 transition-all group"
                      style={{ color: "var(--mm-muted)", opacity: 0.5, borderRadius: 10 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                <ChevronRight size={14} />
                <Tooltip label="Expand" />
              </button>
              {/* Sign-out always visible in collapsed mode */}
              <div className="w-full mt-1 pt-1" style={{ borderTop: "1px solid var(--mm-border)" }}>
                <button onClick={logout}
                        className="relative w-full flex items-center justify-center p-2 transition-all group"
                        style={{ color: "var(--mm-muted)", opacity: 0.5, borderRadius: 10 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                  <LogOut size={13} />
                  <Tooltip label="Sign out" />
                </button>
              </div>
            </div>
          ) : (
            /* ── Expanded: row of icons + user info ── */
            <>
              <div className="flex items-center justify-between px-1 mb-3">
                <SidebarBtn icon={Plus}   label="Quick Add"  onClick={() => setShowQuickAdd(true)} />
                <SidebarBtn icon={Search} label="Search"     onClick={() => setShowSearch(true)} />
                <SidebarBtn icon={Mic}    label="Voice Note" onClick={() => setShowVoice(true)} />
                <SidebarBtn icon={Zap}    label="AI Chat"    onClick={() => setShowAi(true)} />
                <SyncBtn />
                <button onClick={toggleCollapse}
                        className="relative flex items-center justify-center p-2 transition-all group"
                        style={{ color: "var(--mm-muted)", opacity: 0.5, borderRadius: 10 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                  <ChevronLeft size={14} />
                  <Tooltip label="Collapse" />
                </button>
              </div>
              {/* Name · email · sign-out (no avatar) */}
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
                  <Tooltip label="Sign out" />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Project selector floats at top-right over the page content */}
        <div className="absolute top-4 right-5 z-20 pointer-events-auto">
          <ProjectSelector />
        </div>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex items-center justify-around px-2 py-2 mm-bottom-nav flex-shrink-0"
             style={{
               background: "rgba(17,17,20,0.95)",
               backdropFilter: "blur(12px)",
               borderTop: "1px solid var(--mm-border)",
             }}>
          {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"}
                     className="flex flex-col items-center gap-0.5 p-2"
                     style={({ isActive }) => ({ color: isActive ? "var(--mm-gold)" : "var(--mm-muted)" })}>
              <Icon size={18} />
              <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                             fontFamily: "'Outfit', sans-serif" }}>{label}</span>
            </NavLink>
          ))}
          <button onClick={() => setShowQuickAdd(true)}
                  className="flex flex-col items-center gap-0.5 p-2"
                  style={{ color: "var(--mm-gold)" }}>
            <Plus size={18} />
            <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                           fontFamily: "'Outfit', sans-serif" }}>Add</span>
          </button>
        </nav>
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
  );
}

/* ── Shared tooltip ───────────────────────────────────────────── */
function Tooltip({ label }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1
                     opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50"
          style={{
            background: "rgba(12,12,15,0.92)",
            border: "1px solid var(--mm-border-gold)",
            borderRadius: 8,
            color: "var(--mm-text)",
            fontSize: 10,
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: "0.06em",
            backdropFilter: "blur(8px)",
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
    if (!date) return "just now";
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 10)  return "just now";
    if (s < 60)  return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  };

  const tooltipLabel = !state.online
    ? "Offline"
    : state.pending > 0
    ? `Syncing — ${state.pending} pending`
    : `Last synced: ${timeAgoStr(lastSync)}`;

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
