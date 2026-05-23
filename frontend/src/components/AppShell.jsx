import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, RefreshCw, DollarSign, FileText,
  Bell, BarChart2, Settings, Users, Vault, Trash2, LogOut,
  ChevronLeft, ChevronRight, Search, Plus, Mic, Zap
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { subscribeSync } from "@/lib/syncQueue";
import { api } from "@/lib/api";
import QuickAdd from "@/components/QuickAdd";
import GlobalSearch from "@/components/GlobalSearch";
import AiChat from "@/components/AiChat";
import ProjectSelector from "@/components/ProjectSelector";
import VoiceCapture from "@/components/VoiceCapture";

const NAV = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard" },
  { to: "/tasks",     icon: CheckSquare,     label: "Tasks" },
  { to: "/routines",  icon: RefreshCw,       label: "Routines" },
  { to: "/cash-flow", icon: DollarSign,      label: "Cash Flow" },
  { to: "/notes",     icon: FileText,        label: "Notes" },
  { to: "/reminders", icon: Bell,            label: "Reminders" },
  { to: "/people",    icon: Users,           label: "People" },
  { to: "/vault",     icon: Vault,           label: "Vault" },
  { to: "/reports",   icon: BarChart2,       label: "Reports" },
  { to: "/settings",  icon: Settings,        label: "Settings" },
  { to: "/trash",     icon: Trash2,          label: "Trash" },
];

const BOTTOM_NAV = NAV.slice(0, 5);

export default function AppShell() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("mm_sidebar_collapsed") === "1");
  const [pendingReview, setPendingReview] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("mm_theme") || "dark");

  useEffect(() => {
    document.documentElement.className = theme === "light" ? "light" : "";
    localStorage.setItem("mm_theme", theme);
  }, [theme]);

  useEffect(() => {
    api.get("/pending-review/count").then(r => setPendingReview(r.data.count)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("mm_sidebar_collapsed", next ? "1" : "0");
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--mm-bg)" }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-full transition-all duration-300"
        style={{
          width: collapsed ? 56 : 224,
          background: "var(--mm-surface)",
          borderRight: "1px solid var(--mm-border)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 flex-shrink-0"
             style={{ height: 64, borderBottom: "1px solid var(--mm-border)" }}>
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center"
               style={{ border: "1px solid var(--mm-border-gold)" }}>
            <span className="text-xs font-semibold tracking-widest"
                  style={{ color: "var(--mm-gold)", fontFamily: "'EB Garamond', serif" }}>M</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm tracking-[0.15em] uppercase"
                   style={{ color: "var(--mm-gold)", fontFamily: "'EB Garamond', serif", letterSpacing: "0.2em" }}>
                Mind Matters
              </div>
              <div className="mm-label" style={{ fontSize: 9, letterSpacing: "0.25em" }}>
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
                className="flex items-center gap-3 px-2 py-2 transition-all duration-150 group relative"
                style={({ isActive }) => ({
                  color: isActive ? "var(--mm-gold)" : "var(--mm-muted)",
                  background: isActive ? "rgba(230,196,121,0.06)" : "transparent",
                  borderLeft: isActive ? "2px solid var(--mm-gold)" : "2px solid transparent",
                })}
              >
                <Icon size={15} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-xs tracking-[0.12em] uppercase"
                          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500,
                                   color: "inherit" }}>
                      {label}
                    </span>
                    {hasBadge && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: "#E0505022", color: "#E05252", fontSize: 10 }}>
                        {pendingReview}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 p-3" style={{ borderTop: "1px solid var(--mm-border)" }}>
          {!collapsed && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                   style={{ background: "var(--mm-gold)", color: "#131313" }}>
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
                      className="p-1 transition-colors hover:opacity-100"
                      style={{ color: "var(--mm-muted)", opacity: 0.6 }}>
                <LogOut size={13} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <SyncDot />
            <button onClick={toggleCollapse}
                    className="p-1 transition-colors"
                    style={{ color: "var(--mm-muted)" }}>
              {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center gap-3 px-5 flex-shrink-0"
                style={{ height: 56, background: "var(--mm-surface)",
                         borderBottom: "1px solid var(--mm-border)" }}>
          <ProjectSelector />
          <div className="flex-1" />

          {/* Search */}
          <button onClick={() => setShowSearch(true)}
                  className="flex items-center gap-2 px-3 py-1.5 transition-all hover:opacity-80"
                  style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)",
                           fontSize: 11, letterSpacing: "0.1em" }}>
            <Search size={12} />
            <span className="hidden sm:inline uppercase tracking-widest" style={{ fontSize: 10 }}>Search</span>
            <kbd className="hidden sm:inline text-xs px-1"
                 style={{ background: "var(--mm-border)", color: "var(--mm-muted)", fontSize: 9 }}>⌘K</kbd>
          </button>

          <button onClick={() => setShowVoice(true)} title="Voice"
                  className="p-2 transition-colors hover:opacity-80"
                  style={{ color: "var(--mm-muted)" }}>
            <Mic size={15} />
          </button>

          <button onClick={() => setShowAi(true)} title="AI"
                  className="p-2 transition-colors hover:opacity-80"
                  style={{ color: "var(--mm-gold)" }}>
            <Zap size={15} />
          </button>

          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                  className="p-2 transition-colors hover:opacity-80 text-xs"
                  style={{ color: "var(--mm-muted)" }}>
            {theme === "dark" ? "☀" : "🌙"}
          </button>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex items-center justify-around px-2 py-2 mm-bottom-nav flex-shrink-0"
             style={{ background: "var(--mm-surface)", borderTop: "1px solid var(--mm-border)" }}>
          {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"}
                     className="flex flex-col items-center gap-0.5 p-2"
                     style={({ isActive }) => ({ color: isActive ? "var(--mm-gold)" : "var(--mm-muted)" })}>
              <Icon size={17} />
              <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</span>
            </NavLink>
          ))}
          <button onClick={() => setShowQuickAdd(true)}
                  className="flex flex-col items-center gap-0.5 p-2"
                  style={{ color: "var(--mm-gold)" }}>
            <Plus size={17} />
            <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>Add</span>
          </button>
        </nav>
      </div>

      {/* ── FLOATING DOCK ───────────────────────────────────────────────── */}
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 items-center gap-1 px-4 py-2 z-50"
           style={{ background: "rgba(19,19,19,0.97)", border: "1px solid var(--mm-border-gold)",
                    backdropFilter: "blur(24px)", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
        <DockBtn icon={Plus} label="Quick Add" onClick={() => setShowQuickAdd(true)} gold />
        <DockBtn icon={Search} label="Search" onClick={() => setShowSearch(true)} />
        <DockBtn icon={Mic} label="Voice" onClick={() => setShowVoice(true)} />
        <DockBtn icon={Zap} label="AI" onClick={() => setShowAi(true)} gold />
        <div className="w-px h-4 mx-2" style={{ background: "var(--mm-border)" }} />
        <SyncDot />
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      {showQuickAdd && <QuickAdd onClose={() => setShowQuickAdd(false)} />}
      {showSearch   && <GlobalSearch onClose={() => setShowSearch(false)} />}
      {showAi       && <AiChat onClose={() => setShowAi(false)} />}
      {showVoice    && <VoiceCapture onClose={() => setShowVoice(false)} />}
    </div>
  );
}

function SyncDot() {
  const [state, setState] = useState({ online: true, pending: 0 });
  useEffect(() => subscribeSync(setState), []);
  const color = !state.online ? "#E05252" : state.pending > 0 ? "#E0A052" : "#52C77A";
  return (
    <div title={state.pending > 0 ? `${state.pending} pending` : "Synced"}
         style={{ width: 7, height: 7, background: color,
                  boxShadow: `0 0 6px ${color}66` }} />
  );
}

function DockBtn({ icon: Icon, label, onClick, gold }) {
  return (
    <button onClick={onClick} title={label}
            className="p-2 transition-colors hover:opacity-80"
            style={{ color: gold ? "var(--mm-gold)" : "var(--mm-muted)" }}>
      <Icon size={15} />
    </button>
  );
}
