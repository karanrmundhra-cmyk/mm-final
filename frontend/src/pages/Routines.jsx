import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Trash2, Flag, Paperclip, Check, Loader, GripVertical,
  ChevronRight, ChevronDown, MessageSquare, ArrowUp, ArrowDown,
  Send, X, Copy, Mic, Bell, FolderOpen, Zap, Timer, Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import Skeleton from "@/components/Skeleton";
import OnboardingTip from "@/components/OnboardingTip";

const STATUSES   = ["Active", "Paused", "Done", "Completed"];
const PRIORITIES = ["", "P1", "P2", "P3", "P4"];
const FREQS = [
  "Daily", "Weekly", "Monthly", "Weekdays", "Weekends", "Bi-weekly",
  "Every Monday", "Every Tuesday", "Every Wednesday", "Every Thursday", "Every Friday",
  "Quarterly", "Half-Yearly", "Yearly",
];

const EMPTY = {
  activity: "", name: "", group: "", details: "",
  frequency: "Daily", priority: "", status: "Active",
};

const STATUS_COLORS = {
  "Active":    "var(--mm-gold)",
  "Paused":    "var(--mm-muted)",
  "Done":      "#22C55E",
  "Completed": "#22C55E",
};

/* ── column layout
   checkbox | done-tick | group | to | activity | frequency | status | icons */
const COLS = "20px 30px 100px 120px 1fr 110px 120px 240px";

/* ─── Column-header filter dropdown ─────────────────────────── */
function ColFilter({ label, col, filter, setFilter, values, open, setOpen }) {
  const active = !!filter[col];
  return (
    <div className="relative inline-flex items-center gap-0.5 select-none">
      <button
        onClick={() => setOpen(open === col ? null : col)}
        className="flex items-center gap-0.5 hover:opacity-100 transition-opacity"
        style={{ color: active ? "var(--mm-gold)" : "inherit", opacity: active ? 1 : 0.7 }}>
        {label}
        {active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-0.5"
                         style={{ background: "var(--mm-gold)" }} />}
        <ChevronDown size={8} style={{ opacity: 0.5 }} />
      </button>
      {open === col && (
        <div className="absolute top-full left-0 z-50 mt-1 py-1 rounded-xl shadow-2xl"
             style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", minWidth: 130 }}>
          <button className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                  style={{ color: "var(--mm-muted)" }}
                  onClick={() => { setFilter(f => ({ ...f, [col]: "" })); setOpen(null); }}>
            All {label}
          </button>
          {values.map(v => (
            <button key={v} className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: filter[col] === v ? "var(--mm-gold)" : "var(--mm-text)" }}
                    onClick={() => { setFilter(f => ({ ...f, [col]: v })); setOpen(null); }}>
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Person picker (typeahead) ──────────────────────────────── */
function PersonCell({ routine, people, update }) {
  const [open, setOpen] = useState(false);
  const filtered = people.filter(p =>
    !routine.name || p.name.toLowerCase().includes(routine.name.toLowerCase())
  ).slice(0, 6);
  return (
    <div className="relative">
      <input value={routine.name || ""}
             onChange={e => { update(routine.id, { name: e.target.value }); setOpen(true); }}
             onFocus={() => setOpen(true)}
             onBlur={() => setTimeout(() => setOpen(false), 160)}
             className="mm-input-ghost text-xs w-full" placeholder="—" />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-0.5 py-1 rounded-xl shadow-2xl"
             style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                      minWidth: 150, maxHeight: 160, overflowY: "auto" }}>
          {filtered.map(p => (
            <button key={p.id} className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: "var(--mm-text)" }}
                    onMouseDown={() => { update(routine.id, { name: p.name }); setOpen(false); }}>
              {p.name}
              {p.company && <span className="ml-1 text-xs" style={{ color: "var(--mm-muted)" }}>{p.company}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Excel-style dropdown cell ─────────────────────────────── */
function DropCell({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter(o => !value || o.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        className="mm-input-ghost text-xs w-full"
        placeholder={placeholder || "—"} />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-0.5 py-1 rounded-xl shadow-2xl"
             style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border-gold)",
                      minWidth: 140, maxHeight: 160, overflowY: "auto" }}>
          {filtered.map(o => (
            <button key={o} className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: value === o ? "var(--mm-gold)" : "var(--mm-text)" }}
                    onMouseDown={() => { onChange(o); setOpen(false); }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Move Group dropdown ────────────────────────────────────── */
function MoveGroupMenu({ routine, allGroups, update, onClose }) {
  return (
    <div className="absolute right-0 top-6 z-[200] py-1 rounded-xl shadow-2xl"
         style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border-gold)", minWidth: 150 }}>
      <p className="px-3 py-1 text-xs" style={{ color: "var(--mm-gold)", letterSpacing: "0.05em" }}>Move to…</p>
      {allGroups.map(g => (
        <button key={g}
                className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
                style={{ color: g === routine.group ? "var(--mm-gold)" : "var(--mm-text)" }}
                onMouseDown={() => { update(routine.id, { group: g }); onClose(); }}>
          {g}
        </button>
      ))}
      <button
        className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
        style={{ color: "var(--mm-muted)" }}
        onMouseDown={() => { update(routine.id, { group: "" }); onClose(); }}>
        — No Section
      </button>
    </div>
  );
}

/* ─── Compact heatmap cell ───────────────────────────────────── */
function HeatCell({ day }) {
  const pct = day.total > 0 ? day.done / day.total : 0;
  const bg = day.total === 0
    ? "var(--mm-surface-3)"
    : pct === 0   ? "rgba(201,169,97,0.08)"
    : pct < 0.5   ? "rgba(201,169,97,0.25)"
    : pct < 1     ? "rgba(201,169,97,0.55)"
    : "var(--mm-gold)";
  return (
    <div title={`${day.date}: ${day.done}/${day.total} done`}
         style={{ width: 8, height: 8, borderRadius: 2, background: bg, flexShrink: 0 }} />
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function Routines() {
  const [routines,      setRoutines]      = useState([]);
  const [logs,          setLogs]          = useState({});
  const [loading,       setLoading]       = useState(true);
  const [aiText,        setAiText]        = useState("");
  const [aiLoading,     setAiLoading]     = useState(false);
  const [preview,       setPreview]       = useState(null);
  const [newRow,        setNewRow]        = useState({ ...EMPTY });
  const [filter,        setFilter]        = useState({ status: "", group: "", frequency: "", name: "" });
  const [activeGroup,   setActiveGroup]   = useState("");
  const [groups,        setGroups]        = useState([]);
  const [selected,      setSelected]      = useState(new Set());
  const [dragId,        setDragId]        = useState(null);
  const [dragOverId,    setDragOverId]    = useState(null);
  const [people,        setPeople]        = useState([]);
  const [expanded,      setExpanded]      = useState(new Set());
  const [commentOpen,   setCommentOpen]   = useState(null);
  const [newComment,    setNewComment]    = useState("");
  const [newSubtask,    setNewSubtask]    = useState({});
  const [collapsedSecs, setCollapsedSecs] = useState(new Set());
  const [userSections,  setUserSections]  = useState([]);
  const [colFilter,     setColFilter]     = useState(null);
  const [newGroupName,  setNewGroupName]  = useState("");
  const [addingGroup,   setAddingGroup]   = useState(false);
  const [voiceActive,   setVoiceActive]   = useState(false);
  const [moveGroupOpen, setMoveGroupOpen] = useState(null);
  const [heatmap,       setHeatmap]       = useState([]);
  const [showHeat,      setShowHeat]      = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const [routRes, logRes] = await Promise.all([
        api.get("/routines"),
        api.get("/routines/logs", { params: { date: today } }),
      ]);
      setRoutines(routRes.data);
      const lg = {};
      (logRes.data || []).forEach(l => { lg[l.routine_id] = l.done; });
      setLogs(lg);
      setGroups([...new Set(routRes.data.map(r => r.group).filter(Boolean))]);
    } catch {}
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get("/people").then(r => setPeople(r.data || [])).catch(() => {});
  }, []);

  /* 90-day heatmap */
  useEffect(() => {
    const end   = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
    api.get("/routines/logs", { params: { start_date: start, end_date: end } })
      .then(r => {
        if (!Array.isArray(r.data) || r.data.length === 0) return;
        const map = {};
        r.data.forEach(entry => {
          const d = entry.date || today;
          if (!map[d]) map[d] = { done: 0, total: 0 };
          map[d].total++;
          if (entry.done) map[d].done++;
        });
        const days = Array.from({ length: 90 }, (_, i) => {
          const d = new Date(Date.now() - (89 - i) * 86400000).toISOString().slice(0, 10);
          return { date: d, ...(map[d] || { done: 0, total: 0 }) };
        });
        setHeatmap(days);
        setShowHeat(true);
      })
      .catch(() => {});
  }, [today]); // eslint-disable-line

  const allGroups = useMemo(
    () => [...new Set([...userSections, ...groups])],
    [userSections, groups]
  );

  /* ── AI parse ── */
  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/routine", { text: aiText });
      setPreview({
        fields: [
          { key: "activity",  label: "Activity",  value: data.activity,           confidence: data.confidence },
          { key: "name",      label: "Person",    value: data.name,               confidence: "medium" },
          { key: "group",     label: "Group",     value: data.group,              confidence: "medium" },
          { key: "frequency", label: "Frequency", value: data.frequency,          confidence: "medium" },
          { key: "status",    label: "Status",    value: data.status || "Active", confidence: "high" },
          { key: "details",   label: "Details",   value: data.details,            confidence: "medium" },
        ],
        raw: data,
      });
    } catch { toast.error("Parse failed — try rephrasing"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/routines", { ...preview.raw, ...values });
      toast.success("Routine added");
      setPreview(null); setAiText(""); load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.activity.trim()) return;
    try {
      await api.post("/routines", newRow);
      toast.success("Routine added");
      setNewRow({ ...EMPTY }); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to add routine"); }
  };

  /* ── Voice ── */
  const handleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported"); return; }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.onstart  = () => setVoiceActive(true);
    rec.onresult = (e) => { setAiText(e.results[0][0].transcript); setVoiceActive(false); };
    rec.onerror  = () => setVoiceActive(false);
    rec.onend    = () => setVoiceActive(false);
    rec.start();
  };

  /* ── Groups ── */
  const createGroup = (name) => {
    const n = (name || newGroupName).trim();
    if (!n) return;
    setUserSections(s => [...new Set([...s, n])]);
    setNewRow(r => ({ ...r, group: n }));
    setNewGroupName(""); setAddingGroup(false);
  };

  /* ── Core CRUD ── */
  const update = async (id, patch) => {
    setRoutines(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
    try { await api.patch(`/routines/${id}`, patch); } catch {}
  };

  const STREAK_MILESTONES = [7, 14, 21, 30, 60, 90, 100, 180, 365];
  const logDone = async (id, done) => {
    setLogs(l => ({ ...l, [id]: done }));
    try {
      await api.post(`/routines/${id}/log`, { date: today, done });
      if (done) {
        const routine = routines.find(r => r.id === id);
        const newStreak = (routine?.streak || 0) + 1;
        if (STREAK_MILESTONES.includes(newStreak)) {
          toast(`🔥 ${newStreak}-day streak on "${routine?.activity}"!`, {
            description: newStreak >= 30 ? "Incredible consistency." : "Keep it up!",
            duration: 5000,
          });
          setRoutines(rs => rs.map(r => r.id === id ? { ...r, streak: newStreak } : r));
        }
      }
    } catch { toast.error("Failed to save log"); }
  };

  const del = (id) => {
    const routine = routines.find(r => r.id === id);
    setRoutines(rs => rs.filter(r => r.id !== id));
    let undid = false;
    toast("Moved to trash", {
      action: {
        label: "Undo", onClick: () => {
          undid = true;
          setRoutines(rs => [...rs, routine].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
        }
      },
      duration: 4000,
    });
    setTimeout(() => { if (!undid) api.delete(`/routines/${id}`).catch(() => load()); }, 4500);
  };

  const duplicate = async (routine) => {
    try {
      const { id, ...rest } = routine;
      await api.post("/routines", { ...rest, activity: `${routine.activity} (copy)` });
      toast.success("Routine duplicated"); load();
    } catch { toast.error("Failed to duplicate"); }
  };

  /* ── Reorder ── */
  const applyReorder = async (reordered) => {
    setRoutines(rs => {
      const ids = new Set(reordered.map(r => r.id));
      return [...reordered, ...rs.filter(r => !ids.has(r.id))];
    });
    try {
      await api.post("/routines/reorder", reordered.map((r, i) => ({ id: r.id, order_index: i + 1 })));
    } catch {}
  };

  const moveUp = (routineId) => {
    const idx = visible.findIndex(r => r.id === routineId);
    if (idx <= 0) return;
    const arr = [...visible]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; applyReorder(arr);
  };
  const moveDown = (routineId) => {
    const idx = visible.findIndex(r => r.id === routineId);
    if (idx >= visible.length - 1) return;
    const arr = [...visible]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; applyReorder(arr);
  };

  /* ── Drag ── */
  const onDragStart = (id) => setDragId(id);
  const onDragOver  = (e, id) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = async (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const from = visible.findIndex(r => r.id === dragId);
    const to   = visible.findIndex(r => r.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); setDragOverId(null); return; }
    const arr = [...visible];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setDragId(null); setDragOverId(null);
    applyReorder(arr);
  };

  /* ── Bulk ── */
  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll    = () => setSelected(new Set(visible.map(r => r.id)));
  const clearSel     = () => setSelected(new Set());
  const bulkDelete   = async () => {
    const ids = [...selected];
    await Promise.all(ids.map(id => api.delete(`/routines/${id}`).catch(() => {})));
    toast.success(`${ids.length} routines deleted`); clearSel(); load();
  };

  /* ── Sub-tasks ── */
  const addSubtask = async (routineId, text) => {
    if (!text?.trim()) return;
    const routine = routines.find(r => r.id === routineId);
    const subtasks = [...(routine?.subtasks || []), { id: `${Date.now()}`, text: text.trim(), done: false }];
    await update(routineId, { subtasks });
    setNewSubtask(s => ({ ...s, [routineId]: "" }));
  };
  const toggleSubtask = async (routineId, subId) => {
    const routine = routines.find(r => r.id === routineId);
    const subtasks = (routine?.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s);
    await update(routineId, { subtasks });
  };
  const deleteSubtask = async (routineId, subId) => {
    const routine = routines.find(r => r.id === routineId);
    const subtasks = (routine?.subtasks || []).filter(s => s.id !== subId);
    await update(routineId, { subtasks });
  };

  /* ── Comments ── */
  const addComment = async (routineId) => {
    if (!newComment.trim()) return;
    const routine = routines.find(r => r.id === routineId);
    const comments = [
      ...(routine?.comments || []),
      { id: `${Date.now()}`, text: newComment.trim(), at: new Date().toISOString() },
    ];
    await update(routineId, { comments });
    setNewComment("");
  };

  /* ── Section collapse ── */
  const toggleSection = (sec) => setCollapsedSecs(s => {
    const n = new Set(s); n.has(sec) ? n.delete(sec) : n.add(sec); return n;
  });

  /* ── Derived ── */
  const visible = routines.filter(r => {
    if (filter.status    && r.status    !== filter.status)    return false;
    if (filter.frequency && r.frequency !== filter.frequency) return false;
    if (activeGroup      && r.group     !== activeGroup)      return false;
    if (filter.name      && !r.name?.toLowerCase().includes(filter.name.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (a.flagged !== b.flagged) return b.flagged ? 1 : -1;
    return (a.order_index || 0) - (b.order_index || 0);
  });

  const sectioned = useMemo(() => {
    const result = {};
    const allSecs = [
      ...userSections,
      ...groups,
      ...visible.filter(r => !r.group).map(() => "No Section"),
    ];
    [...new Set(allSecs)].forEach(sec => {
      const list = sec === "No Section"
        ? visible.filter(r => !r.group)
        : visible.filter(r => r.group === sec);
      if (list.length > 0 || userSections.includes(sec)) result[sec] = list;
    });
    return result;
  }, [visible, groups, userSections]);

  const doneToday    = Object.values(logs).filter(Boolean).length;
  const totalToday   = visible.filter(r => r.status === "Active").length;
  const completionPct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
  const activeCount  = visible.filter(r => !["Done","Completed"].includes(r.status)).length;

  if (loading) return <Skeleton.Page rows={7} />;

  /* ── Column header row ── */
  const ColHeaders = ({ secRoutines }) => (
    <div className="hidden md:grid px-3 py-2 mm-label"
         style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--mm-border)" }}>
      {/* Multi-select header checkbox */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => selected.size === visible.length ? clearSel() : selectAll()}
          className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            borderColor: selected.size > 0 ? "var(--mm-gold)" : "var(--mm-border)",
            background:  selected.size === visible.length ? "var(--mm-gold)" : "transparent",
          }}>
          {selected.size === visible.length && <Check size={8} style={{ color: "#0a0a0a" }} />}
        </button>
      </div>
      <span></span>
      {/* Group */}
      <ColFilter label="Group"     col="group"     filter={filter} setFilter={setFilter}
                 values={allGroups} open={colFilter} setOpen={setColFilter} />
      {/* To (person) */}
      <ColFilter label="To"        col="name"      filter={filter} setFilter={setFilter}
                 values={[...new Set(secRoutines.map(r => r.name).filter(Boolean))]}
                 open={colFilter} setOpen={setColFilter} />
      {/* Activity */}
      <span>Routine</span>
      {/* Frequency */}
      <ColFilter label="Frequency" col="frequency" filter={filter} setFilter={setFilter}
                 values={FREQS} open={colFilter} setOpen={setColFilter} />
      {/* Status */}
      <ColFilter label="Status"    col="status"    filter={filter} setFilter={setFilter}
                 values={STATUSES} open={colFilter} setOpen={setColFilter} />
      <span></span>
    </div>
  );

  return (
    <div className="px-5 py-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="mm-page-title">Routines</h1>
          <p className="mm-page-sub">{activeCount} Active · {doneToday}/{totalToday} done today</p>
        </div>
      </div>

      {/* ── Today's Progress + 90-day Heatmap (compact, side-by-side) ── */}
      {(totalToday > 0 || showHeat) && (
        <div className="flex gap-3 mb-4">

          {/* Left — Today's Progress */}
          {totalToday > 0 && (
            <div className="mm-card px-4 py-3 flex items-center gap-3"
                 style={{ minWidth: 220, flex: "0 0 auto" }}>
              {completionPct === 100
                ? <span style={{ fontSize: 20 }}>🔥</span>
                : (
                  <svg width={36} height={36} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--mm-surface-3)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none"
                            stroke="var(--mm-gold)" strokeWidth="3"
                            strokeDasharray={`${(completionPct / 100) * 94.2} 94.2`}
                            strokeLinecap="round"
                            transform="rotate(-90 18 18)"
                            style={{ transition: "stroke-dasharray 0.7s ease" }} />
                    <text x="18" y="22" textAnchor="middle" fontSize="9"
                          fill="var(--mm-gold)" fontFamily="'Outfit',sans-serif" fontWeight="700">
                      {completionPct}%
                    </text>
                  </svg>
                )}
              <div className="min-w-0">
                <p className="mm-label mb-0.5">Today's Progress</p>
                <p className="text-sm font-semibold" style={{ color: "var(--mm-gold)", fontFamily: "'Outfit',sans-serif" }}>
                  {completionPct === 100 ? "All done!" : `${doneToday} / ${totalToday}`}
                </p>
              </div>
            </div>
          )}

          {/* Right — 90-day Heatmap */}
          {showHeat && heatmap.length > 0 && (
            <div className="mm-card px-4 py-3 flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} style={{ color: "var(--mm-muted)" }} />
                  <span className="mm-label" style={{ fontSize: 10 }}>90-day habit history</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: "var(--mm-surface-3)" }} />
                  <span style={{ fontSize: 9, color: "var(--mm-muted)" }}>none</span>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: "rgba(201,169,97,0.35)" }} />
                  <span style={{ fontSize: 9, color: "var(--mm-muted)" }}>partial</span>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: "var(--mm-gold)" }} />
                  <span style={{ fontSize: 9, color: "var(--mm-muted)" }}>all done</span>
                </div>
              </div>
              <div className="flex gap-0.5 flex-wrap" style={{ maxHeight: 56, overflow: "hidden" }}>
                {heatmap.map(day => <HeatCell key={day.date} day={day} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SECTION 1 — AI PARSE BAR
          ═══════════════════════════════════════════ */}
      <div className="mb-3 rounded-2xl overflow-hidden"
           style={{ border: "1px solid var(--mm-border-gold)", background: "var(--mm-surface)" }}>

        {/* Label row */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2"
             style={{ borderBottom: "1px solid var(--mm-border)" }}>
          <Zap size={13} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, letterSpacing: "0.07em", color: "var(--mm-gold)",
                         fontFamily: "'Outfit',sans-serif", fontWeight: 600 }}>
            Chief Of Staff — AI Routine Parser
          </span>
          <span style={{ fontSize: 10, color: "var(--mm-muted)", fontFamily: "'Outfit',sans-serif", marginLeft: 4 }}>
            e.g.&nbsp;<em>Morning meditation daily personal</em>
          </span>
        </div>

        {/* Input + Voice + Parse */}
        <div className="flex items-center gap-0">
          <input
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && parseAi()}
            placeholder="Describe a routine naturally — AI will extract activity, frequency, group, person…"
            className="flex-1 bg-transparent outline-none px-4 py-3 text-sm"
            style={{ color: "var(--mm-text)", fontFamily: "'Outfit',sans-serif" }} />
          <button
            onClick={handleVoice}
            title="Voice input"
            style={{
              padding: "0 16px", height: 48,
              background: voiceActive ? "rgba(201,169,97,0.15)" : "transparent",
              border: "none", borderLeft: "1px solid var(--mm-border)",
              color: voiceActive ? "var(--mm-gold)" : "var(--mm-muted)",
              cursor: "pointer", display: "flex", alignItems: "center",
            }}>
            <Mic size={16} style={{ animation: voiceActive ? "pulse 1s infinite" : "none" }} />
          </button>
          <button
            onClick={parseAi}
            disabled={!aiText.trim() || aiLoading}
            style={{
              padding: "0 28px", height: 48,
              background: "var(--mm-gold)", border: "none",
              borderLeft: "1px solid rgba(201,169,97,0.3)",
              color: "#0a0a0a", fontFamily: "'Outfit',sans-serif",
              fontWeight: 600, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              opacity: (!aiText.trim() || aiLoading) ? 0.5 : 1,
            }}>
            {aiLoading ? <Loader size={13} className="animate-spin" /> : null}
            {aiLoading ? "Parsing…" : "Parse →"}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 2 — PARSE RESULT PREVIEW
          ═══════════════════════════════════════════ */}
      {preview && (
        <div className="mb-4">
          <EditablePreview title="Review Routine" fields={preview.fields}
                           onConfirm={saveFromPreview} onDiscard={() => setPreview(null)} />
        </div>
      )}

      {/* ── Group filter pills ── */}
      {allGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => setActiveGroup("")}
                  className="px-3 py-1 rounded-full text-xs transition-all"
                  style={{
                    background: !activeGroup ? "var(--mm-gold)" : "var(--mm-surface-2)",
                    color:      !activeGroup ? "#0a0a0a" : "var(--mm-muted)",
                    border:     !activeGroup ? "none" : "1px solid var(--mm-border)",
                    fontFamily: "'Outfit',sans-serif", fontWeight: !activeGroup ? 600 : 400,
                  }}>
            All
          </button>
          {allGroups.map(g => (
            <button key={g} onClick={() => setActiveGroup(activeGroup === g ? "" : g)}
                    className="px-3 py-1 rounded-full text-xs transition-all"
                    style={{
                      background: activeGroup === g ? "var(--mm-gold)" : "var(--mm-surface-2)",
                      color:      activeGroup === g ? "#0a0a0a" : "var(--mm-muted)",
                      border:     activeGroup === g ? "none" : "1px solid var(--mm-border)",
                      fontFamily: "'Outfit',sans-serif", fontWeight: activeGroup === g ? 600 : 400,
                    }}>
              {g}
            </button>
          ))}
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 animate-slide-up"
             style={{ background: "rgba(201,169,97,0.08)", border: "1px solid var(--mm-border-gold)", borderRadius: 16 }}>
          <span className="text-sm font-medium" style={{ color: "var(--mm-gold)" }}>
            {selected.size} selected
          </span>
          <button onClick={bulkDelete}
                  className="mm-btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5"
                  style={{ color: "var(--mm-muted)", borderColor: "var(--mm-border)" }}>
            <Trash2 size={11} /> Delete All
          </button>
          <button onClick={selectAll} className="mm-btn-ghost px-3 py-1.5 text-xs">Select All</button>
          <button onClick={clearSel} className="mm-icon-btn ml-auto" style={{ fontSize: 16 }}>×</button>
        </div>
      )}

      <OnboardingTip page="routines" />

      {/* ── Empty ── */}
      {visible.length === 0 && (
        <div className="mm-empty">
          <div className="mm-divider" style={{ width: 48 }} />
          <p className="mm-empty-title">No Routines</p>
          <p className="mm-empty-desc">Use the AI parser above or fill in the row below.</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SECTION 3 — TABLE + SECTIONS
          ═══════════════════════════════════════════ */}
      {Object.entries(sectioned).map(([sec, secRoutines]) => (
        <div key={sec} className="mb-4">

          {/* Section header */}
          <button onClick={() => toggleSection(sec)}
                  className="flex items-center gap-2 w-full mb-1.5 px-1 py-1 group hover:opacity-100 transition-opacity"
                  style={{ opacity: 0.8 }}>
            {collapsedSecs.has(sec)
              ? <ChevronRight size={11} style={{ color: "var(--mm-muted)" }} />
              : <ChevronDown  size={11} style={{ color: "var(--mm-muted)" }} />}
            <span className="text-xs font-semibold"
                  style={{ color: "var(--mm-muted)", fontFamily: "'Outfit',sans-serif", letterSpacing: "0.04em" }}>
              {sec}
            </span>
            <span className="text-xs" style={{ color: "var(--mm-muted)", opacity: 0.5 }}>{secRoutines.length}</span>
            <div className="flex-1 h-px" style={{ background: "var(--mm-border)" }} />
          </button>

          {!collapsedSecs.has(sec) && (
            <div className="mm-card overflow-hidden">
              <ColHeaders secRoutines={secRoutines} />

              {secRoutines.length === 0 && (
                <div className="px-4 py-4 text-xs text-center" style={{ color: "var(--mm-muted)" }}>
                  No routines in this section —{" "}
                  <button onClick={() => setNewRow(r => ({ ...r, group: sec === "No Section" ? "" : sec }))}
                          className="ml-1 underline hover:opacity-80">add one</button>
                </div>
              )}

              {secRoutines.map((r) => {
                const done         = logs[r.id];
                const subtasks     = r.subtasks || [];
                const subtasksDone = subtasks.filter(s => s.done).length;
                const isExpanded   = expanded.has(r.id);
                const commentCount = (r.comments || []).length;
                const isSelected   = selected.has(r.id);

                return (
                  <React.Fragment key={r.id}>
                    <div draggable
                         onDragStart={() => onDragStart(r.id)}
                         onDragOver={e => onDragOver(e, r.id)}
                         onDrop={e => onDrop(e, r.id)}
                         className={`mm-row grid items-center px-3 py-2 border-b`}
                         style={{
                           gridTemplateColumns: COLS,
                           borderColor: "var(--mm-border)", minWidth: 860,
                           opacity: dragId === r.id ? 0.4 : r.status === "Paused" ? 0.6 : 1,
                           borderTop: dragOverId === r.id ? "2px solid var(--mm-gold)" : undefined,
                           background: isSelected ? "rgba(201,169,97,0.04)" : undefined,
                         }}>

                      {/* COL 1: Multi-select checkbox */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => toggleSelect(r.id)}
                          className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            borderColor: isSelected ? "var(--mm-gold)" : "var(--mm-border)",
                            background:  isSelected ? "var(--mm-gold)" : "transparent",
                          }}>
                          {isSelected && <Check size={8} style={{ color: "#0a0a0a" }} />}
                        </button>
                      </div>

                      {/* COL 2: Done-today toggle */}
                      <button onClick={() => logDone(r.id, !done)}
                              title={done ? "Mark undone" : "Mark done today"}
                              className={`mm-check ${done ? "done" : ""}`}>
                        {done && <Check size={10} style={{ color: "var(--mm-gold)" }} />}
                      </button>

                      {/* COL 3: Group */}
                      <input value={r.group || ""} onChange={e => update(r.id, { group: e.target.value })}
                             className="mm-input-ghost text-xs" placeholder="—" />

                      {/* COL 4: To — person picker */}
                      <PersonCell routine={r} people={people} update={update} />

                      {/* COL 5: Activity / routine name + streak */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {r.flagged && <Flag size={11} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />}
                        {r.priority && (
                          <button
                            onClick={() => {
                              const idx = PRIORITIES.indexOf(r.priority);
                              update(r.id, { priority: PRIORITIES[(idx + 1) % PRIORITIES.length] });
                            }}
                            className={`mm-est-pill mm-${r.priority.toLowerCase()} flex-shrink-0`}
                            title="Cycle priority">
                            {r.priority}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <input value={r.activity} onChange={e => update(r.id, { activity: e.target.value })}
                                 className="mm-input-ghost text-sm w-full" />
                          {subtasks.length > 0 && (
                            <div className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>
                              {subtasksDone}/{subtasks.length} subtasks
                            </div>
                          )}
                        </div>
                        {r.streak > 0 && (
                          <span title={`${r.streak}-day streak`}
                                className="text-xs flex-shrink-0 px-1.5 py-0.5"
                                style={{ background: "rgba(201,169,97,0.12)", color: "var(--mm-gold)",
                                         borderRadius: 8, fontSize: 10 }}>
                            🔥{r.streak}
                          </span>
                        )}
                        {r.confidence && r.confidence !== "high" &&
                          <ConfidenceBadge level={r.confidence} size="xs" />}
                      </div>

                      {/* COL 6: Frequency */}
                      <select value={r.frequency} onChange={e => update(r.id, { frequency: e.target.value })}
                              className="mm-input-ghost text-xs mm-status-select"
                              style={{ color: "var(--mm-muted)" }}>
                        {FREQS.map(f => <option key={f}>{f}</option>)}
                      </select>

                      {/* COL 7: Status */}
                      <select value={r.status} onChange={e => update(r.id, { status: e.target.value })}
                              className="mm-input-ghost text-xs mm-status-select"
                              style={{ color: STATUS_COLORS[r.status] || "var(--mm-muted)" }}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>

                      {/* COL 8: Actions — 12 icons */}
                      <div className="relative flex items-center gap-0.5 justify-end">
                        {/* UP */}
                        <button onClick={() => moveUp(r.id)} title="Move Up"
                                className="mm-icon-btn" style={{ color: "var(--mm-muted)" }}>
                          <ArrowUp size={10} />
                        </button>
                        {/* DOWN */}
                        <button onClick={() => moveDown(r.id)} title="Move Down"
                                className="mm-icon-btn" style={{ color: "var(--mm-muted)" }}>
                          <ArrowDown size={10} />
                        </button>
                        {/* ATTACHMENT */}
                        <button title="Attachment"
                                className="mm-icon-btn"
                                style={{ color: r.attachments?.length > 0 ? "var(--mm-gold)" : "var(--mm-muted)" }}
                                onClick={() => toast.info("Attachment upload coming soon")}>
                          <Paperclip size={10} />
                        </button>
                        {/* SUBTASK */}
                        <button
                          onClick={() => setExpanded(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                          title="Sub-tasks"
                          className="mm-icon-btn"
                          style={{
                            color: subtasks.length > 0 ? "var(--mm-gold)" : "var(--mm-muted)",
                            transform: isExpanded ? "rotate(90deg)" : "none",
                            transition: "transform 0.15s",
                          }}>
                          <ChevronRight size={10} />
                        </button>
                        {/* FLAG */}
                        <button onClick={() => update(r.id, { flagged: !r.flagged })}
                                title="Flag"
                                className={`mm-icon-btn ${r.flagged ? "active" : ""}`}
                                style={{ color: r.flagged ? "var(--mm-gold)" : "var(--mm-muted)" }}>
                          <Flag size={10} />
                        </button>
                        {/* REMINDER */}
                        <button title="Set Reminder"
                                className="mm-icon-btn"
                                style={{ color: "var(--mm-muted)" }}
                                onClick={() => toast.info("Reminder — go to Reminders page")}>
                          <Bell size={10} />
                        </button>
                        {/* TIMER */}
                        <button title="Start Timer"
                                className="mm-icon-btn"
                                style={{ color: "var(--mm-muted)" }}
                                onClick={() => toast.info("Timer — coming soon")}>
                          <Timer size={10} />
                        </button>
                        {/* COMMENT */}
                        <button onClick={() => setCommentOpen(r.id === commentOpen ? null : r.id)}
                                title="Comments"
                                className="mm-icon-btn"
                                style={{ color: commentCount > 0 ? "var(--mm-gold)" : "var(--mm-muted)" }}>
                          <MessageSquare size={10} />
                          {commentCount > 0 && (
                            <span style={{ fontSize: 8, color: "var(--mm-gold)", marginLeft: 1 }}>{commentCount}</span>
                          )}
                        </button>
                        {/* MOVE GROUP */}
                        <div className="relative">
                          <button
                            onClick={() => setMoveGroupOpen(moveGroupOpen === r.id ? null : r.id)}
                            title="Move to Group"
                            className="mm-icon-btn"
                            style={{ color: "var(--mm-muted)" }}>
                            <FolderOpen size={10} />
                          </button>
                          {moveGroupOpen === r.id && (
                            <MoveGroupMenu routine={r} allGroups={allGroups} update={update}
                                           onClose={() => setMoveGroupOpen(null)} />
                          )}
                        </div>
                        {/* DUPLICATE */}
                        <button onClick={() => duplicate(r)} title="Duplicate Routine"
                                className="mm-icon-btn" style={{ color: "var(--mm-muted)" }}>
                          <Copy size={10} />
                        </button>
                        {/* DELETE */}
                        <button onClick={() => del(r.id)} title="Delete"
                                className="mm-icon-btn" style={{ color: "var(--mm-muted)" }}>
                          <Trash2 size={10} />
                        </button>
                        {/* PRIORITY (cycles P1→P2→P3→P4→none) */}
                        <button
                          onClick={() => {
                            const idx = PRIORITIES.indexOf(r.priority || "");
                            update(r.id, { priority: PRIORITIES[(idx + 1) % PRIORITIES.length] });
                          }}
                          title={`Priority: ${r.priority || "none"}`}
                          className={`mm-icon-btn mm-${(r.priority || "").toLowerCase()}`}
                          style={{ color: r.priority ? "var(--mm-gold)" : "var(--mm-muted)", minWidth: 18 }}>
                          <span style={{ fontSize: 9, fontFamily: "'Outfit',sans-serif", fontWeight: 700 }}>
                            {r.priority || "—"}
                          </span>
                        </button>
                        {/* DRAG HANDLE */}
                        <GripVertical size={11} style={{ color: "var(--mm-muted)", opacity: 0.3, cursor: "grab" }} />
                      </div>
                    </div>

                    {/* ── Sub-tasks panel ── */}
                    {isExpanded && (
                      <div className="border-b" style={{ borderColor: "var(--mm-border)", background: "var(--mm-surface-2)" }}>
                        {subtasks.map(sub => (
                          <div key={sub.id} className="flex items-center gap-2 pl-12 pr-4 py-1.5">
                            <button onClick={() => toggleSubtask(r.id, sub.id)}
                                    className={`mm-check flex-shrink-0 ${sub.done ? "done" : ""}`}
                                    style={{ width: 14, height: 14 }}>
                              {sub.done && <Check size={8} style={{ color: "var(--mm-gold)" }} />}
                            </button>
                            <span className="text-xs flex-1"
                                  style={{ color: "var(--mm-text)", textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.5 : 1 }}>
                              {sub.text}
                            </span>
                            <button onClick={() => deleteSubtask(r.id, sub.id)}
                                    className="mm-icon-btn" style={{ color: "var(--mm-muted)" }}>
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pl-12 pr-4 py-1.5">
                          <div className="w-3.5 h-3.5 flex-shrink-0 rounded border"
                               style={{ borderColor: "var(--mm-border)" }} />
                          <input value={newSubtask[r.id] || ""}
                                 onChange={e => setNewSubtask(s => ({ ...s, [r.id]: e.target.value }))}
                                 onKeyDown={e => e.key === "Enter" && addSubtask(r.id, newSubtask[r.id])}
                                 placeholder="Add sub-task…"
                                 className="text-xs flex-1 bg-transparent outline-none"
                                 style={{ color: "var(--mm-muted)" }} />
                          <button onClick={() => addSubtask(r.id, newSubtask[r.id])}
                                  className="mm-icon-btn" style={{ color: "var(--mm-gold)" }}>
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Comments panel ── */}
                    {commentOpen === r.id && (
                      <div className="border-b px-4 py-3"
                           style={{ borderColor: "var(--mm-border)", background: "var(--mm-surface-2)" }}>
                        {(r.comments || []).length === 0 && (
                          <p className="text-xs mb-2" style={{ color: "var(--mm-muted)" }}>No comments yet</p>
                        )}
                        {(r.comments || []).map(c => (
                          <div key={c.id} className="flex gap-2 mb-2.5">
                            <div className="w-5 h-5 flex-shrink-0 rounded flex items-center justify-center text-xs font-semibold"
                                 style={{ background: "rgba(201,169,97,0.15)", color: "var(--mm-gold)" }}>
                              {c.text[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs leading-relaxed" style={{ color: "var(--mm-text)" }}>{c.text}</p>
                              <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)", fontSize: 10 }}>
                                {new Date(c.at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <input value={newComment}
                                 onChange={e => setNewComment(e.target.value)}
                                 onKeyDown={e => e.key === "Enter" && addComment(r.id)}
                                 placeholder="Add a comment…"
                                 className="flex-1 text-xs bg-transparent outline-none px-3 py-1.5 rounded-lg"
                                 style={{ border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                          <button onClick={() => addComment(r.id)}
                                  className="mm-btn-gold px-3 py-1.5 text-xs flex items-center gap-1">
                            <Send size={10} /> Post
                          </button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* ─── NEW ROUTINE ROW ─────────────────────────────────────── */}
      <div className="mm-card overflow-hidden mb-3">
        <div className="hidden md:grid px-3 py-1.5 mm-label"
             style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--mm-border)" }}>
          <span></span>
          <span></span>
          <span>Group</span>
          <span>To</span>
          <span style={{ color: "var(--mm-gold)" }}>+ New Routine</span>
          <span>Frequency</span>
          <span>Status</span>
          <span>Priority</span>
        </div>
        <div className="grid items-center px-3 py-2"
             style={{ gridTemplateColumns: COLS, minWidth: 860 }}>
          {/* checkbox placeholder */}
          <div className="flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-sm border" style={{ borderColor: "var(--mm-border)", opacity: 0.3 }} />
          </div>
          {/* done circle placeholder */}
          <div className="flex items-center justify-center">
            <div className="mm-check" style={{ opacity: 0.3 }} />
          </div>
          {/* Group */}
          <DropCell value={newRow.group}    onChange={v => setNewRow(r => ({ ...r, group: v }))}
                    options={allGroups} placeholder="Group" />
          {/* To (person) */}
          <DropCell value={newRow.name}     onChange={v => setNewRow(r => ({ ...r, name: v }))}
                    options={[...new Set(people.map(p => p.name).filter(Boolean))]} placeholder="Person" />
          {/* Activity title */}
          <input value={newRow.activity}
                 onChange={e => setNewRow(r => ({ ...r, activity: e.target.value }))}
                 onKeyDown={e => e.key === "Enter" && addManual()}
                 placeholder="Routine name…  (press Enter to add)"
                 className="mm-input-ghost text-sm" />
          {/* Frequency */}
          <select value={newRow.frequency}
                  onChange={e => setNewRow(r => ({ ...r, frequency: e.target.value }))}
                  className="mm-input-ghost text-xs mm-status-select"
                  style={{ color: "var(--mm-muted)" }}>
            {FREQS.map(f => <option key={f}>{f}</option>)}
          </select>
          {/* Status */}
          <DropCell value={newRow.status}   onChange={v => setNewRow(r => ({ ...r, status: v }))}
                    options={STATUSES} placeholder="Status" />
          {/* Priority + Add button */}
          <div className="flex items-center gap-1">
            <DropCell value={newRow.priority} onChange={v => setNewRow(r => ({ ...r, priority: v }))}
                      options={PRIORITIES.filter(Boolean)} placeholder="P—" />
            <button onClick={addManual}
                    className="mm-btn-gold flex items-center justify-center gap-1 text-xs px-3 py-1.5 flex-shrink-0">
              <Plus size={11} /> Add
            </button>
          </div>
        </div>
      </div>

      {/* ─── ADD SECTION (Todoist-style) ──────────────────────── */}
      <div style={{ borderTop: "1px solid var(--mm-border)", paddingTop: 12 }}>
        {addingGroup ? (
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px" style={{ background: "var(--mm-border)" }} />
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createGroup(); if (e.key === "Escape") setAddingGroup(false); }}
              placeholder="Section name…"
              autoFocus
              className="mm-form-input text-xs"
              style={{ width: 180, padding: "5px 12px" }} />
            <button onClick={() => createGroup()}
                    className="mm-btn-gold text-xs px-4 py-1.5">Add Section</button>
            <button onClick={() => setAddingGroup(false)}
                    className="mm-icon-btn" style={{ fontSize: 15 }}>×</button>
            <div className="flex-1 h-px" style={{ background: "var(--mm-border)" }} />
          </div>
        ) : (
          <button
            onClick={() => setAddingGroup(true)}
            className="flex items-center gap-2 w-full py-2 px-2 transition-opacity hover:opacity-100 group"
            style={{ opacity: 0.45, color: "var(--mm-muted)" }}>
            <div className="flex-1 h-px group-hover:bg-mm-border-gold transition-all"
                 style={{ background: "var(--mm-border)" }} />
            <span className="flex items-center gap-1.5 text-xs whitespace-nowrap"
                  style={{ fontFamily: "'Outfit',sans-serif", letterSpacing: "0.04em" }}>
              <Plus size={11} /> Add Section
            </span>
            <div className="flex-1 h-px group-hover:bg-mm-border-gold transition-all"
                 style={{ background: "var(--mm-border)" }} />
          </button>
        )}
      </div>

    </div>
  );
}
