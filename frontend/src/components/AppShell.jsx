import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, RefreshCw, DollarSign, FileText,
  Bell, BarChart2, Settings, Users, Vault, Trash2, LogOut,
  ChevronLeft, ChevronRight, Search, Plus, Mic, Zap, Wifi, WifiOff
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/projects";
import { subscribeSync } from "@/lib/syncQueue";
import { api } from "@/lib/api";
import QuickAdd from "@/components/QuickAdd";
import GlobalSearch from "@/components/GlobalSearch";
import AiChat from "@/components/AiChat";
import ProjectSelector from "@/components/ProjectSelector";
import VoiceCapture from "@/components/VoiceCapture";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/routines", icon: RefreshCw, label: "Routines" },
  { to: "/cash-flow", icon: DollarSign, label: "Cash Flow" },
  { to: "/notes", icon: FileText, label: "Notes" },
  { to: "/reminders", icon: Bell, label: "Reminders" },
  { to: "/people", icon: Users, label: "People" },
  { to: "/vault", icon: Vault, label: "Vault" },
  { to: "/reports", icon: BarChart2, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/trash", icon: Trash2, label: "Trash" },
];

const BOTTOM_NAV = NAV.slice(0, 6);

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("mm_sidebar_collapsed") === "1");
  const [syncState, setSyncState] = useState({ online: true, pending: 0 });
  const [pendingReview, setPendingReview] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("mm_theme") || "dark");

  useEffect(() => subscribeSync(setSyncState), []);

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

  const SyncDot = () => {
    const color = !syncState.online ? "#E05252" : syncState.pending > 0 ? "#E0A052" : "#52C77A";
    const title = !syncState.online ? "Offline" : syncState.pending > 0 ? `${syncState.pending} pending` : "Synced";
    return (
      <div title={title} style={{ width: 8, height: 8, borderRadius: "50%", background: color,
                                  boxShadow: `0 0 0 2px ${color}33` }} />
    );
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--mm-bg)" }}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-full transition-all duration-200"
        style={{
          width: collapsed ? 56 : 220,
          background: "var(--mm-surface)",
          borderRight: "1px solid var(--mm-border)"
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 py-4" style={{ minHeight: 64 }}>
          <div className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center"
               style={{ background: "linear-gradient(135deg,#C9A961,#8A6030)" }}>
            <span className="text-black font-bold text-sm mm-font-display">M</span>
          </div>
          {!collapsed && (
            <div>
              <div className="mm-gold-text font-semibold text-sm mm-font-display tracking-wide">Mind Matters</div>
              <div className="text-xs" style={{ color: "var(--mm-muted)" }}>Personal OS</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {NAV.map(({ to, icon: Icon, label }) => {
            const badge = label === "Reports" && pendingReview > 0 ? pendingReview : null;
            return (
              <NavLink
                key={to} to={to} end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-2 py-2 mb-0.5 text-sm transition-colors ${
                    isActive
                      ? "text-yellow-400 bg-yellow-900/20"
                      : "hover:bg-white/5"
                  }`
                }
                style={({ isActive }) => ({ color: isActive ? "var(--mm-gold)" : "var(--mm-muted)" })}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="flex-1 mm-font-display" style={{ color: "var(--mm-text)" }}>
                    {label}
                  </span>
                )}
                {!collapsed && badge && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: "#E0505033", color: "#E05252" }}>
                    {badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t" style={{ borderColor: "var(--mm-border)" }}>
          {!collapsed && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
                <span className="text-xs font-semibold">{user?.first_name?.[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: "var(--mm-text)" }}>
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-xs truncate" style={{ color: "var(--mm-muted)" }}>{user?.email}</div>
              </div>
              <button onClick={logout} title="Logout" className="p-1 rounded hover:bg-white/10"
                      style={{ color: "var(--mm-muted)" }}>
                <LogOut size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <SyncDot />
            <button onClick={toggleCollapse} className="p-1 rounded hover:bg-white/10"
                    style={{ color: "var(--mm-muted)" }}>
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
                style={{ background: "var(--mm-surface)", borderBottom: "1px solid var(--mm-border)", height: 56 }}>
          <ProjectSelector />
          <div className="flex-1" />
          <button onClick={() => setShowSearch(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
                  style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
            <Search size={14} />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline text-xs px-1 rounded"
                 style={{ background: "var(--mm-border)", color: "var(--mm-muted)" }}>⌘K</kbd>
          </button>
          <button onClick={() => setShowVoice(true)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  title="Voice input" style={{ color: "var(--mm-muted)" }}>
            <Mic size={16} />
          </button>
          <button onClick={() => setShowAi(true)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  title="AI assistant" style={{ color: "var(--mm-gold)" }}>
            <Zap size={16} />
          </button>
          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors text-xs"
                  style={{ color: "var(--mm-muted)" }}>
            {theme === "dark" ? "☀" : "🌙"}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex items-center justify-around px-2 py-2 mm-bottom-nav"
             style={{ background: "var(--mm-surface)", borderTop: "1px solid var(--mm-border)" }}>
          {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"}
                     className={({ isActive }) => `flex flex-col items-center gap-0.5 p-2 rounded-lg`}
                     style={({ isActive }) => ({ color: isActive ? "var(--mm-gold)" : "var(--mm-muted)" })}>
              <Icon size={18} />
              <span className="text-xs">{label}</span>
            </NavLink>
          ))}
          <button onClick={() => setShowQuickAdd(true)}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-lg"
                  style={{ color: "var(--mm-gold)" }}>
            <Plus size={18} />
            <span className="text-xs">Add</span>
          </button>
        </nav>
      </div>

      {/* Floating dock (desktop) */}
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 items-center gap-1 px-3 py-2 rounded-full z-50"
           style={{ background: "rgba(17,17,17,0.95)", border: "1px solid var(--mm-border)",
                    backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        <DockBtn icon={Plus} label="Quick Add" onClick={() => setShowQuickAdd(true)} gold />
        <DockBtn icon={Search} label="Search" onClick={() => setShowSearch(true)} />
        <DockBtn icon={Mic} label="Voice" onClick={() => setShowVoice(true)} />
        <DockBtn icon={Zap} label="AI" onClick={() => setShowAi(true)} gold />
        <div className="w-px h-4 mx-1" style={{ background: "var(--mm-border)" }} />
        <div className="flex items-center gap-1.5 px-2">
          <SyncDot />
          {syncState.pending > 0 && (
            <span className="text-xs" style={{ color: "#E0A052" }}>{syncState.pending}</span>
          )}
        </div>
      </div>

      {/* Modals */}
      {showQuickAdd && <QuickAdd onClose={() => setShowQuickAdd(false)} />}
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
      {showAi && <AiChat onClose={() => setShowAi(false)} />}
      {showVoice && <VoiceCapture onClose={() => setShowVoice(false)} />}
    </div>
  );
}

function SyncDot() {
  const [state, setState] = useState({ online: true, pending: 0 });
  useEffect(() => subscribeSync(setState), []);
  const color = !state.online ? "#E05252" : state.pending > 0 ? "#E0A052" : "#52C77A";
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: color,
                        boxShadow: `0 0 0 2px ${color}33` }} />;
}

function DockBtn({ icon: Icon, label, onClick, gold }) {
  return (
    <button onClick={onClick} title={label}
            className="p-2 rounded-full transition-colors hover:bg-white/10"
            style={{ color: gold ? "var(--mm-gold)" : "var(--mm-muted)" }}>
      <Icon size={16} />
    </button>
  );
}
