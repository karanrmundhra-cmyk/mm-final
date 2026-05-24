import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, RefreshCw, DollarSign, FileText,
  Bell, BarChart2, Settings, LogOut,
  ChevronLeft, ChevronRight, Search, Plus, Mic, Zap,
  Download, Keyboard,
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

const NAV = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard",  key: "1" },
  { to: "/tasks",     icon: CheckSquare,     label: "Tasks",      key: "2" },
  { to: "/routines",  icon: RefreshCw,       label: "Routines",   key: "3" },
  { to: "/cash-flow", icon: DollarSign,      label: "Cash Flow",  key: "4" },
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
  const [theme, setTheme] = useState(() => localStorage.getItem("mm_theme") || "dark");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    document.documentElement.className = theme === "light" ? "light" : "";
    localStorage.setItem("mm_theme", theme);
  }, [theme]);

  useEffect(() => {
    api.get("/pending-review/count").then(r => setPendingReview(r.data.count)).catch(() => {});
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
      if (e.key === "Escape")    { setShowQuickAdd(false); setShowSearch(false); setShowAi(false); setShowVoice(false); setShowShortcuts(false); return; }

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
          {/* Diamond mark */}
          <div className="flex-shrink-0 flex items-center justify-center"
               style={{
                 width: 36, height: 36,
                 background: "linear-gradient(135deg, var(--mm-gold-light) 0%, var(--mm-gold) 60%, var(--mm-gold-dark) 100%)",
                 borderRadius: 10,
                 boxShadow: "0 4px 16px rgba(212,175,55,0.35)",
               }}>
            <span style={{
              color: "#0B0B0C", fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18, fontWeight: 600, lineHeight: 1,
            }}>M</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div style={{
                color: "var(--mm-text)",
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
            const hasBadge = label === "Reports" && pendingReview > 0;
            return (
              <NavLink
                key={to} to={to} end={to === "/"}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 px-3 py-2.5 transition-all duration-200 relative"
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
                            style={{ background: "#E0505022", color: "#E05252",
                                     fontSize: 9, borderRadius: 8 }}>
                        {pendingReview}
                      </span>
                    )}
                  </>
                )}
                {collapsed && hasBadge && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5"
                        style={{ background: "#E05252", borderRadius: "50%" }} />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 py-3" style={{ borderTop: "1px solid var(--mm-border)" }}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                   style={{
                     background: "linear-gradient(135deg, var(--mm-gold-light), var(--mm-gold-dark))",
                     borderRadius: 10, color: "#0B0B0C",
                   }}>
                <span className="text-xs font-semibold">{user?.first_name?.[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: "var(--mm-text)" }}>
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="truncate" style={{ fontSize: 10, color: "var(--mm-muted)" }}>
                  {user?.email}
                </div>
              </div>
              <button onClick={logout} title="Sign out"
                      className="p-1.5 transition-opacity hover:opacity-100"
                      style={{ color: "var(--mm-muted)", opacity: 0.5 }}>
                <LogOut size={13} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between px-1">
            <SyncDot />
            <button onClick={toggleCollapse}
                    className="p-1.5 transition-colors"
                    style={{ color: "var(--mm-muted)" }}>
              {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar — glass */}
        <header className="flex items-center gap-3 px-5 flex-shrink-0"
                style={{
                  height: 60,
                  background: "rgba(17,17,20,0.85)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  borderBottom: "1px solid var(--mm-border)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.04)",
                }}>
          <ProjectSelector />
          <div className="flex-1" />

          {/* Search pill */}
          <button onClick={() => setShowSearch(true)}
                  className="flex items-center gap-2 px-4 py-2 transition-all hover:opacity-80"
                  style={{
                    background: "var(--mm-surface-2)",
                    border: "1px solid var(--mm-border)",
                    borderRadius: 20,
                    color: "var(--mm-muted)",
                    fontSize: 11, letterSpacing: "0.06em",
                  }}>
            <Search size={12} />
            <span className="hidden sm:inline" style={{ fontSize: 11 }}>Search</span>
            <kbd className="hidden sm:inline text-xs px-1.5 py-0.5"
                 style={{ background: "var(--mm-surface-3)", color: "var(--mm-muted)",
                          fontSize: 9, borderRadius: 6 }}>⌘K</kbd>
          </button>

          <button onClick={() => setShowVoice(true)} title="Voice"
                  className="p-2 transition-opacity hover:opacity-100"
                  style={{ color: "var(--mm-muted)", opacity: 0.65 }}>
            <Mic size={15} />
          </button>

          <button onClick={() => setShowAi(true)} title="AI Chat"
                  className="p-2 transition-opacity hover:opacity-100"
                  style={{ color: "var(--mm-gold)", opacity: 0.9 }}>
            <Zap size={15} />
          </button>

          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                  className="p-2 transition-opacity hover:opacity-100"
                  style={{ color: "var(--mm-muted)", opacity: 0.65, fontSize: 15 }}>
            {theme === "dark" ? "☀" : "🌙"}
          </button>

          <button onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (⌘/)"
                  className="p-2 transition-opacity hover:opacity-100"
                  style={{ color: "var(--mm-muted)", opacity: 0.65 }}>
            <Keyboard size={14} />
          </button>
        </header>

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

      {/* ── FLOATING DOCK ────────────────────────────────────────── */}
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 items-center gap-1 px-5 py-2.5 z-50"
           style={{
             background: "rgba(17,17,20,0.96)",
             border: "1px solid var(--mm-border-gold)",
             borderRadius: 32,
             backdropFilter: "blur(24px)",
             WebkitBackdropFilter: "blur(24px)",
             boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.08)",
           }}>
        <DockBtn icon={Plus}   label="Quick Add" onClick={() => setShowQuickAdd(true)} gold />
        <DockBtn icon={Search} label="Search"    onClick={() => setShowSearch(true)} />
        <DockBtn icon={Mic}    label="Voice"     onClick={() => setShowVoice(true)} />
        <DockBtn icon={Zap}    label="AI"        onClick={() => setShowAi(true)} gold />
        <div className="w-px h-4 mx-2" style={{ background: "var(--mm-border)" }} />
        <SyncDot />
      </div>

      {/* ── MODALS ──────────────────────────────────────────────── */}
      {showQuickAdd  && <QuickAdd onClose={() => setShowQuickAdd(false)} />}
      {showSearch    && <GlobalSearch onClose={() => setShowSearch(false)} />}
      {showAi        && <AiChat onClose={() => setShowAi(false)} />}
      {showVoice     && <VoiceCapture onClose={() => setShowVoice(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

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

function SyncDot() {
  const [state, setState] = useState({ online: true, pending: 0 });
  useEffect(() => subscribeSync(setState), []);
  const color = !state.online ? "#E05252" : state.pending > 0 ? "#E0A052" : "#52C77A";
  return (
    <div title={state.pending > 0 ? `${state.pending} pending` : "Synced"}
         style={{
           width: 8, height: 8, borderRadius: "50%",
           background: color,
           boxShadow: `0 0 8px ${color}88`,
         }} />
  );
}

function DockBtn({ icon: Icon, label, onClick, gold }) {
  return (
    <button onClick={onClick} title={label}
            className="p-2.5 transition-all hover:opacity-100 hover:scale-110"
            style={{
              color: gold ? "var(--mm-gold)" : "var(--mm-muted)",
              opacity: gold ? 0.95 : 0.65,
              borderRadius: 12,
              transition: "opacity 0.15s, transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
      <Icon size={15} />
    </button>
  );
}

const SHORTCUTS = [
  { keys: ["⌘", "K"],   desc: "Global search" },
  { keys: ["⌘", "N"],   desc: "Quick add" },
  { keys: ["⌘", "1-9"], desc: "Navigate to section" },
  { keys: ["⌘", "/"],   desc: "Toggle this panel" },
  { keys: ["Esc"],       desc: "Close any modal" },
  { keys: ["Enter"],     desc: "Submit / save form" },
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
