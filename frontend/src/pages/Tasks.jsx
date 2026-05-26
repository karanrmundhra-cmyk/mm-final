import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, Trash2, Flag, Paperclip, Check, Loader, GripVertical,
  ChevronRight, ChevronDown, MessageSquare, ArrowUp, ArrowDown,
  Send, X, Copy, Upload, Download, Mic,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { isOverdue } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import Skeleton from "@/components/Skeleton";
import SwipeRow from "@/components/SwipeRow";
import OnboardingTip from "@/components/OnboardingTip";

const STATUSES   = ["Pending","In Progress","Completed","Follow-Up","Delegate","On Hold"];
const PRIORITIES = ["", "P1", "P2", "P3", "P4"];
const ESTIMATES  = ["", "15m", "30m", "1h", "2h", "4h", "1d"];
const EMPTY      = { task:"", name:"", date:"", status:"Pending", group:"", details:"", flagged:false, priority:"", estimate:"" };

const STATUS_COLORS = {
  "Pending":     "var(--mm-muted)",
  "In Progress": "var(--mm-gold)",
  "Completed":   "var(--mm-gold)",
  "Done":        "var(--mm-gold)",
  "Follow-Up":   "var(--mm-gold)",
  "Delegate":    "var(--mm-muted)",
  "On Hold":     "var(--mm-muted)",
};

/* column grid — no leading checkbox col, just the check circle */
const COLS = "28px 28px 1fr 110px 120px 90px 100px 108px";

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
                         style={{ background:"var(--mm-gold)" }} />}
        <ChevronDown size={8} style={{ opacity:0.5 }} />
      </button>
      {open === col && (
        <div className="absolute top-full left-0 z-50 mt-1 py-1 rounded-xl shadow-2xl"
             style={{ background:"var(--mm-surface-2)", border:"1px solid var(--mm-border)", minWidth:130 }}>
          <button className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                  style={{ color:"var(--mm-muted)" }}
                  onClick={() => { setFilter(f => ({...f,[col]:""})); setOpen(null); }}>
            All {label}
          </button>
          {values.map(v => (
            <button key={v} className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: filter[col]===v ? "var(--mm-gold)" : "var(--mm-text)" }}
                    onClick={() => { setFilter(f => ({...f,[col]:v})); setOpen(null); }}>
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Person picker (typeahead) ──────────────────────────────── */
function PersonCell({ task, people, update }) {
  const [open, setOpen] = useState(false);
  const filtered = people.filter(p =>
    !task.name || p.name.toLowerCase().includes(task.name.toLowerCase())
  ).slice(0, 6);
  return (
    <div className="relative">
      <input value={task.name || ""}
             onChange={e => { update(task.id, {name:e.target.value}); setOpen(true); }}
             onFocus={() => setOpen(true)}
             onBlur={() => setTimeout(() => setOpen(false), 160)}
             className="mm-input-ghost text-xs w-full" placeholder="—" />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-0.5 py-1 rounded-xl shadow-2xl"
             style={{ background:"var(--mm-surface-2)", border:"1px solid var(--mm-border)",
                      minWidth:150, maxHeight:160, overflowY:"auto" }}>
          {filtered.map(p => (
            <button key={p.id} className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color:"var(--mm-text)" }}
                    onMouseDown={() => { update(task.id, {name:p.name}); setOpen(false); }}>
              {p.name}
              {p.company && <span className="ml-1 text-xs" style={{ color:"var(--mm-muted)" }}>{p.company}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Excel-style dropdown cell for new-row ─────────────────── */
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
             style={{ background:"var(--mm-surface-2)", border:"1px solid var(--mm-border-gold)",
                      minWidth:140, maxHeight:160, overflowY:"auto" }}>
          {filtered.map(o => (
            <button key={o} className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: value===o ? "var(--mm-gold)" : "var(--mm-text)" }}
                    onMouseDown={() => { onChange(o); setOpen(false); }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function Tasks() {
  const [tasks,        setTasks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [aiText,       setAiText]       = useState("");
  const [aiLoading,    setAiLoading]    = useState(false);
  const [preview,      setPreview]      = useState(null);
  const [newRow,       setNewRow]       = useState({ ...EMPTY });
  const [filter,       setFilter]       = useState({ status:"", name:"" });
  const [activeGroup,  setActiveGroup]  = useState(""); // group pill filter
  const [groups,       setGroups]       = useState([]);
  const [selected,     setSelected]     = useState(new Set());
  const [dragId,       setDragId]       = useState(null);
  const [dragOverId,   setDragOverId]   = useState(null);
  const [people,       setPeople]       = useState([]);
  const [expanded,     setExpanded]     = useState(new Set());
  const [commentOpen,  setCommentOpen]  = useState(null);
  const [newComment,   setNewComment]   = useState("");
  const [newSubtask,   setNewSubtask]   = useState({});
  const [collapsedSecs,setCollapsedSecs]= useState(new Set());
  const [userSections, setUserSections] = useState([]);
  const [colFilter,    setColFilter]    = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup,  setAddingGroup]  = useState(false);
  const [voiceActive,  setVoiceActive]  = useState(false);
  const importRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/tasks");
      setTasks(data);
      setGroups([...new Set(data.map(t => t.group).filter(Boolean))]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/people").then(r => setPeople(r.data || [])).catch(() => {});
  }, []);

  /* ── All groups (from tasks + user-created) ── */
  const allGroups = useMemo(
    () => [...new Set([...userSections, ...groups])],
    [userSections, groups]
  );

  /* ── AI parse ── */
  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/task", { text:aiText });
      setPreview({ fields:[
        { key:"task",    label:"Title",    value:data.task,              confidence:data.confidence },
        { key:"date",    label:"Due date", value:data.date,              confidence:data.confidence },
        { key:"name",    label:"Person",   value:data.name,              confidence:"medium" },
        { key:"group",   label:"Group",    value:data.group,             confidence:"medium" },
        { key:"status",  label:"Status",   value:data.status||"Pending", confidence:"high" },
        { key:"details", label:"Details",  value:data.details,           confidence:"medium" },
      ], raw:data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/tasks", { ...preview.raw, ...values });
      toast.success("Task added");
      setPreview(null); setAiText(""); load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.task.trim()) return;
    try {
      await api.post("/tasks", newRow);
      toast.success("Task added");
      setNewRow({ ...EMPTY }); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to add task"); }
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

  /* ── Import / Export ── */
  const exportCsv = () => window.open(`${api.defaults.baseURL}/export/tasks.csv`, "_blank");
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/import/tasks", fd);
      toast.success("Tasks imported");
      load();
    } catch { toast.error("Import failed"); }
    e.target.value = "";
  };

  /* ── Groups ── */
  const createGroup = () => {
    if (!newGroupName.trim()) return;
    setUserSections(s => [...new Set([...s, newGroupName.trim()])]);
    setNewRow(r => ({...r, group:newGroupName.trim()}));
    setNewGroupName(""); setAddingGroup(false);
  };

  /* ── Core ── */
  const update = async (id, patch) => {
    setTasks(ts => ts.map(t => t.id === id ? {...t,...patch} : t));
    try { await api.patch(`/tasks/${id}`, patch); } catch {}
  };

  const toggle = (task) => {
    update(task.id, { status: ["Completed","Done"].includes(task.status) ? "Pending" : "Completed" });
  };

  const del = (id) => {
    const task = tasks.find(t => t.id === id);
    setTasks(ts => ts.filter(t => t.id !== id));
    let undid = false;
    toast("Moved to trash", {
      action: { label:"Undo", onClick:() => {
        undid = true;
        setTasks(ts => [...ts, task].sort((a,b) => (a.order_index||0) - (b.order_index||0)));
      }},
      duration: 4000,
    });
    setTimeout(() => { if (!undid) api.delete(`/tasks/${id}`).catch(() => load()); }, 4500);
  };

  const duplicate = async (task) => {
    try {
      const { id, ...rest } = task;
      await api.post("/tasks", { ...rest, task:`${task.task} (copy)` });
      toast.success("Task duplicated"); load();
    } catch { toast.error("Failed to duplicate"); }
  };

  /* ── Reorder ── */
  const applyReorder = async (reordered) => {
    setTasks(ts => {
      const ids = new Set(reordered.map(t => t.id));
      return [...reordered, ...ts.filter(t => !ids.has(t.id))];
    });
    try { await api.post("/tasks/reorder", reordered.map((t,i) => ({ id:t.id, order_index:i+1 }))); }
    catch {}
  };

  const moveUp = (taskId) => {
    const idx = visible.findIndex(t => t.id === taskId);
    if (idx <= 0) return;
    const r = [...visible]; [r[idx-1],r[idx]] = [r[idx],r[idx-1]]; applyReorder(r);
  };
  const moveDown = (taskId) => {
    const idx = visible.findIndex(t => t.id === taskId);
    if (idx >= visible.length - 1) return;
    const r = [...visible]; [r[idx],r[idx+1]] = [r[idx+1],r[idx]]; applyReorder(r);
  };

  /* ── Drag ── */
  const onDragStart = (id) => setDragId(id);
  const onDragOver  = (e, id) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = async (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const from = visible.findIndex(t => t.id === dragId);
    const to   = visible.findIndex(t => t.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); setDragOverId(null); return; }
    const r = [...visible];
    const [moved] = r.splice(from, 1);
    r.splice(to, 0, moved);
    setDragId(null); setDragOverId(null);
    applyReorder(r);
  };

  /* ── Bulk ── */
  const toggleSelect = (id) => setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const selectAll    = () => setSelected(new Set(visible.map(t => t.id)));
  const clearSel     = () => setSelected(new Set());
  const bulkComplete = async () => {
    const ids = [...selected];
    await Promise.all(ids.map(id => api.patch(`/tasks/${id}`, {status:"Completed"}).catch(()=>{})));
    toast.success(`${ids.length} tasks completed`); clearSel(); load();
  };
  const bulkDelete = async () => {
    const ids = [...selected];
    await Promise.all(ids.map(id => api.delete(`/tasks/${id}`).catch(()=>{})));
    toast.success(`${ids.length} tasks deleted`); clearSel(); load();
  };

  /* ── Sub-tasks ── */
  const addSubtask = async (taskId, text) => {
    if (!text?.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    const subtasks = [...(task?.subtasks||[]), { id:`${Date.now()}`, text:text.trim(), done:false }];
    await update(taskId, { subtasks });
    setNewSubtask(s => ({...s,[taskId]:""}));
  };
  const toggleSubtask = async (taskId, subId) => {
    const task = tasks.find(t => t.id === taskId);
    const subtasks = (task?.subtasks||[]).map(s => s.id===subId ? {...s,done:!s.done} : s);
    await update(taskId, { subtasks });
  };
  const deleteSubtask = async (taskId, subId) => {
    const task = tasks.find(t => t.id === taskId);
    const subtasks = (task?.subtasks||[]).filter(s => s.id !== subId);
    await update(taskId, { subtasks });
  };

  /* ── Comments ── */
  const addComment = async (taskId) => {
    if (!newComment.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    const comments = [...(task?.comments||[]), { id:`${Date.now()}`, text:newComment.trim(), at:new Date().toISOString() }];
    await update(taskId, { comments });
    setNewComment("");
  };

  /* ── Section collapse ── */
  const toggleSection = (sec) => setCollapsedSecs(s => {
    const n = new Set(s); n.has(sec) ? n.delete(sec) : n.add(sec); return n;
  });

  /* ── Derived ── */
  const visible = tasks.filter(t => {
    if (filter.status && t.status !== filter.status) return false;
    if (activeGroup   && t.group  !== activeGroup)   return false;
    if (filter.name   && !t.name?.toLowerCase().includes(filter.name.toLowerCase())) return false;
    return true;
  }).sort((a,b) => {
    if (a.flagged !== b.flagged) return b.flagged ? 1 : -1;
    const aD = ["Completed","Done"].includes(a.status);
    const bD = ["Completed","Done"].includes(b.status);
    if (aD !== bD) return aD ? 1 : -1;
    return (a.order_index||0) - (b.order_index||0);
  });

  const sectioned = useMemo(() => {
    const result = {};
    const allSecs = [
      ...userSections,
      ...groups,
      ...visible.filter(t => !t.group).map(() => "No Section"),
    ];
    [...new Set(allSecs)].forEach(sec => {
      const list = sec === "No Section"
        ? visible.filter(t => !t.group)
        : visible.filter(t => t.group === sec);
      if (list.length > 0 || userSections.includes(sec)) result[sec] = list;
    });
    return result;
  }, [visible, groups, userSections]);

  const pending = visible.filter(t => !["Completed","Done"].includes(t.status)).length;

  if (loading) return <Skeleton.Page rows={7} />;

  return (
    <div className="px-5 py-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="mm-page-title">Tasks</h1>
          <p className="mm-page-sub">{pending} pending · {visible.length} total</p>
        </div>
        <div className="flex gap-2">
          <label className="mm-btn-ghost flex items-center gap-1.5 cursor-pointer" title="Import CSV">
            <Upload size={12} /> Import
            <input ref={importRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={exportCsv} className="mm-btn-ghost flex items-center gap-1.5" title="Export CSV">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* ── Chief Of Staff bar ── */}
      <div className="mb-4 rounded-2xl overflow-hidden"
           style={{ border:"1px solid var(--mm-border-gold)", background:"var(--mm-surface)" }}>

        {/* Group chips row */}
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2"
             style={{ borderBottom:"1px solid var(--mm-border)" }}>
          {allGroups.map(g => (
            <span key={g}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                  style={{
                    background: "rgba(212,175,55,0.10)",
                    border: "1px solid var(--mm-border-gold)",
                    color: "var(--mm-gold)",
                    fontFamily: "'Outfit',sans-serif",
                  }}>
              Group: {g}
              <button
                onClick={() => {
                  setUserSections(s => s.filter(x => x !== g));
                  setGroups(s => s.filter(x => x !== g));
                  if (activeGroup === g) setActiveGroup("");
                }}
                style={{ color:"var(--mm-muted)", lineHeight:1 }}>
                <X size={9} />
              </button>
            </span>
          ))}

          {/* New group inline */}
          {addingGroup ? (
            <div className="flex items-center gap-1">
              <input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") createGroup(); if (e.key==="Escape") setAddingGroup(false); }}
                placeholder="Group name…"
                autoFocus
                className="mm-form-input text-xs"
                style={{ width:130, padding:"4px 10px" }} />
              <button onClick={createGroup} className="mm-btn-gold text-xs px-3 py-1">Add</button>
              <button onClick={() => setAddingGroup(false)} className="mm-icon-btn" style={{ fontSize:14 }}>×</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingGroup(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-opacity hover:opacity-100"
              style={{
                border: "1px dashed var(--mm-border-gold)",
                color: "var(--mm-muted)",
                fontFamily: "'Outfit',sans-serif",
                opacity: 0.6,
              }}>
              <Plus size={10} /> New group
            </button>
          )}
        </div>

        {/* Input + Voice + Parse */}
        <div className="flex items-center gap-0">
          <input
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            onKeyDown={e => e.key==="Enter" && parseAi()}
            placeholder='e.g. #Work Call Brinda for revising the invoice'
            className="flex-1 bg-transparent outline-none px-4 py-3 text-sm"
            style={{ color:"var(--mm-text)", fontFamily:"'Outfit',sans-serif" }} />
          <button
            onClick={handleVoice}
            title="Voice input"
            style={{
              padding:"0 16px",
              height:48,
              background: voiceActive ? "rgba(212,175,55,0.15)" : "transparent",
              border:"none",
              borderLeft:"1px solid var(--mm-border)",
              color: voiceActive ? "var(--mm-gold)" : "var(--mm-muted)",
              cursor:"pointer",
              display:"flex", alignItems:"center",
            }}>
            <Mic size={16} style={{ animation: voiceActive ? "pulse 1s infinite" : "none" }} />
          </button>
          <button
            onClick={parseAi}
            disabled={!aiText.trim() || aiLoading}
            style={{
              padding:"0 24px",
              height:48,
              background:"var(--mm-gold)",
              border:"none",
              borderLeft:"1px solid rgba(212,175,55,0.3)",
              color:"#0a0a0a",
              fontFamily:"'Outfit',sans-serif",
              fontWeight:600,
              fontSize:14,
              cursor:"pointer",
              display:"flex", alignItems:"center", gap:6,
              opacity: (!aiText.trim() || aiLoading) ? 0.5 : 1,
            }}>
            {aiLoading ? <Loader size={13} className="animate-spin" /> : null}
            {aiLoading ? "Parsing…" : "Parse"}
          </button>
        </div>
      </div>

      {/* ── Group filter pills ── */}
      {allGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button
            onClick={() => setActiveGroup("")}
            className="px-3 py-1 rounded-full text-xs transition-all"
            style={{
              background: !activeGroup ? "var(--mm-gold)" : "var(--mm-surface-2)",
              color:      !activeGroup ? "#0a0a0a" : "var(--mm-muted)",
              border:     !activeGroup ? "none" : "1px solid var(--mm-border)",
              fontFamily: "'Outfit',sans-serif",
              fontWeight: !activeGroup ? 600 : 400,
            }}>
            All
          </button>
          {allGroups.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(activeGroup === g ? "" : g)}
              className="px-3 py-1 rounded-full text-xs transition-all"
              style={{
                background: activeGroup===g ? "var(--mm-gold)" : "var(--mm-surface-2)",
                color:      activeGroup===g ? "#0a0a0a" : "var(--mm-muted)",
                border:     activeGroup===g ? "none" : "1px solid var(--mm-border)",
                fontFamily: "'Outfit',sans-serif",
                fontWeight: activeGroup===g ? 600 : 400,
              }}>
              {g}
            </button>
          ))}
          <button
            onClick={() => setAddingGroup(true)}
            className="px-3 py-1 rounded-full text-xs transition-opacity hover:opacity-100"
            style={{
              border:"1px dashed var(--mm-border)",
              color:"var(--mm-muted)",
              fontFamily:"'Outfit',sans-serif",
              background:"transparent",
              opacity:0.5,
            }}>
            + New group
          </button>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 animate-slide-up"
             style={{ background:"rgba(212,175,55,0.08)", border:"1px solid var(--mm-border-gold)", borderRadius:16 }}>
          <span className="text-sm font-medium" style={{ color:"var(--mm-gold)" }}>
            {selected.size} selected
          </span>
          <button onClick={bulkComplete} className="mm-btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
            <Check size={11} /> Mark complete
          </button>
          <button onClick={bulkDelete}
                  className="mm-btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5"
                  style={{ color:"var(--mm-muted)", borderColor:"var(--mm-border)" }}>
            <Trash2 size={11} /> Delete all
          </button>
          <button onClick={selectAll} className="mm-btn-ghost px-3 py-1.5 text-xs">Select all</button>
          <button onClick={clearSel} className="mm-icon-btn ml-auto" style={{ fontSize:16 }}>×</button>
        </div>
      )}

      {/* ── Onboarding tip ── */}
      <OnboardingTip page="tasks" />

      {/* ── Empty ── */}
      {visible.length === 0 && (
        <div className="mm-empty">
          <div className="mm-divider" style={{ width:48 }} />
          <p className="mm-empty-title">No tasks</p>
          <p className="mm-empty-desc">Use Chief Of Staff above or fill in the row below.</p>
        </div>
      )}

      {/* ── Sections ── */}
      {Object.entries(sectioned).map(([sec, secTasks]) => (
        <div key={sec} className="mb-4">

          {/* Section header */}
          <button onClick={() => toggleSection(sec)}
                  className="flex items-center gap-2 w-full mb-1.5 px-1 py-1 group hover:opacity-100 transition-opacity"
                  style={{ opacity:0.8 }}>
            {collapsedSecs.has(sec)
              ? <ChevronRight size={11} style={{ color:"var(--mm-muted)" }} />
              : <ChevronDown  size={11} style={{ color:"var(--mm-muted)" }} />}
            <span className="text-xs font-semibold"
                  style={{ color:"var(--mm-muted)", fontFamily:"'Outfit',sans-serif", letterSpacing:"0.04em" }}>
              {sec}
            </span>
            <span className="text-xs" style={{ color:"var(--mm-muted)", opacity:0.5 }}>{secTasks.length}</span>
            <div className="flex-1 h-px" style={{ background:"var(--mm-border)" }} />
          </button>

          {!collapsedSecs.has(sec) && (
            <div className="mm-card overflow-hidden">
              {/* Column headers with filter dropdowns */}
              <div className="hidden md:grid px-3 py-2 mm-label"
                   style={{ gridTemplateColumns:COLS, borderBottom:"1px solid var(--mm-border)" }}>
                <span></span>
                <span></span>
                <span>Task</span>
                <ColFilter label="Due"    col="date"   filter={filter} setFilter={setFilter}
                           values={[...new Set(secTasks.map(t=>t.date).filter(Boolean))].sort()}
                           open={colFilter} setOpen={setColFilter} />
                <ColFilter label="Person" col="name"   filter={filter} setFilter={setFilter}
                           values={[...new Set(secTasks.map(t=>t.name).filter(Boolean))]}
                           open={colFilter} setOpen={setColFilter} />
                <ColFilter label="Group"  col="group"  filter={filter} setFilter={setFilter}
                           values={allGroups}
                           open={colFilter} setOpen={setColFilter} />
                <ColFilter label="Status" col="status" filter={filter} setFilter={setFilter}
                           values={STATUSES}
                           open={colFilter} setOpen={setColFilter} />
                <span></span>
              </div>

              {secTasks.length === 0 && (
                <div className="px-4 py-4 text-xs text-center" style={{ color:"var(--mm-muted)" }}>
                  No tasks in this section —{" "}
                  <button onClick={() => setNewRow(r => ({...r, group:sec==="No Section"?"":sec}))}
                          className="ml-1 underline hover:opacity-80">add one</button>
                </div>
              )}

              {secTasks.map((t) => {
                const done         = ["Completed","Done"].includes(t.status);
                const over         = isOverdue(t.date, t.status);
                const subtasks     = t.subtasks || [];
                const subtasksDone = subtasks.filter(s => s.done).length;
                const isExpanded   = expanded.has(t.id);
                const commentCount = (t.comments||[]).length;

                return (
                  <React.Fragment key={t.id}>
                    <SwipeRow onDelete={() => del(t.id)} onComplete={() => toggle(t)}>
                    <div draggable
                         onDragStart={() => onDragStart(t.id)}
                         onDragOver={e => onDragOver(e, t.id)}
                         onDrop={e => onDrop(e, t.id)}
                         className={`mm-row grid items-center px-3 py-2 border-b ${done?"mm-row-completed":""}`}
                         style={{
                           gridTemplateColumns:COLS,
                           borderColor:"var(--mm-border)", minWidth:740,
                           opacity: dragId===t.id ? 0.4 : 1,
                           borderTop: dragOverId===t.id ? "2px solid var(--mm-gold)" : undefined,
                         }}>

                      {/* Check circle only — no white checkbox */}
                      <button onClick={() => toggle(t)} className={`mm-check ${done?"done":""}`}>
                        {done && <Check size={10} style={{ color:"var(--mm-gold)" }} />}
                      </button>

                      {/* Subtask expand chevron */}
                      <button
                        onClick={() => setExpanded(s => { const n=new Set(s); n.has(t.id)?n.delete(t.id):n.add(t.id); return n; })}
                        title="Expand sub-tasks"
                        className="flex items-center justify-center transition-transform"
                        style={{ color:"var(--mm-muted)", transform:isExpanded?"rotate(90deg)":"none" }}>
                        <ChevronRight size={11} />
                      </button>

                      {/* Task title + badges */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {t.flagged && <Flag size={11} style={{ color:"var(--mm-gold)",flexShrink:0 }} />}
                        {t.priority && (
                          <button
                            onClick={() => {
                              const idx = PRIORITIES.indexOf(t.priority);
                              update(t.id, { priority: PRIORITIES[(idx+1) % PRIORITIES.length] });
                            }}
                            className={`mm-est-pill mm-${t.priority.toLowerCase()} flex-shrink-0`}
                            title="Cycle priority">
                            {t.priority}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <input value={t.task} onChange={e => update(t.id,{task:e.target.value})}
                                 className="mm-input-ghost text-sm w-full" />
                          {subtasks.length > 0 && (
                            <div className="text-xs mt-0.5" style={{ color:"var(--mm-muted)" }}>
                              {subtasksDone}/{subtasks.length} subtasks
                            </div>
                          )}
                        </div>
                        {t.estimate && (
                          <button
                            onClick={() => {
                              const idx = ESTIMATES.indexOf(t.estimate);
                              update(t.id, { estimate: ESTIMATES[(idx+1) % ESTIMATES.length] });
                            }}
                            className="mm-est-pill flex-shrink-0"
                            title="Cycle time estimate">
                            {t.estimate}
                          </button>
                        )}
                        {t.confidence && t.confidence!=="high" &&
                          <ConfidenceBadge level={t.confidence} size="xs" />}
                        {t.attachments?.length > 0 &&
                          <Paperclip size={10} style={{ color:"var(--mm-muted)" }} />}
                        {commentCount > 0 && (
                          <button onClick={() => setCommentOpen(t.id===commentOpen?null:t.id)}
                                  className="flex items-center gap-0.5 text-xs flex-shrink-0"
                                  style={{ color:"var(--mm-gold)" }}>
                            <MessageSquare size={10} /> {commentCount}
                          </button>
                        )}
                      </div>

                      {/* Due date — gold calendar icon via colorScheme + filter */}
                      <input
                        type="date"
                        value={t.date||""}
                        onChange={e => update(t.id,{date:e.target.value})}
                        className="mm-input-ghost text-xs mm-date-gold"
                        style={{ color: over?"var(--mm-muted)":"var(--mm-text)" }} />

                      {/* Person picker */}
                      <PersonCell task={t} people={people} update={update} />

                      {/* Group */}
                      <input value={t.group||""} onChange={e => update(t.id,{group:e.target.value})}
                             className="mm-input-ghost text-xs" placeholder="—" />

                      {/* Status */}
                      <select value={t.status} onChange={e => update(t.id,{status:e.target.value})}
                              className="mm-input-ghost text-xs mm-status-select"
                              style={{ color:STATUS_COLORS[t.status]||"var(--mm-muted)" }}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 justify-end">
                        <button onClick={() => moveUp(t.id)}   title="Move up"   className="mm-icon-btn" style={{ color:"var(--mm-muted)" }}><ArrowUp   size={10} /></button>
                        <button onClick={() => moveDown(t.id)} title="Move down" className="mm-icon-btn" style={{ color:"var(--mm-muted)" }}><ArrowDown size={10} /></button>
                        <button
                          onClick={() => {
                            const idx = PRIORITIES.indexOf(t.priority || "");
                            update(t.id, { priority: PRIORITIES[(idx+1) % PRIORITIES.length] });
                          }}
                          title={`Priority: ${t.priority || "none"}`}
                          className={`mm-icon-btn mm-${(t.priority||"").toLowerCase()}`}>
                          <span style={{ fontSize:9, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
                            {t.priority || "P—"}
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            const idx = ESTIMATES.indexOf(t.estimate || "");
                            update(t.id, { estimate: ESTIMATES[(idx+1) % ESTIMATES.length] });
                          }}
                          title={`Estimate: ${t.estimate || "none"}`}
                          className="mm-icon-btn" style={{ color:"var(--mm-muted)", fontSize:9 }}>
                          <span style={{ fontSize:8, fontFamily:"'Outfit',sans-serif" }}>
                            {t.estimate || "⏱"}
                          </span>
                        </button>
                        <button onClick={() => update(t.id,{flagged:!t.flagged})}
                                className={`mm-icon-btn ${t.flagged?"active":""}`}>
                          <Flag size={11} />
                        </button>
                        <button onClick={() => setCommentOpen(t.id===commentOpen?null:t.id)}
                                title="Comments"
                                className="mm-icon-btn"
                                style={{ color:commentCount>0?"var(--mm-gold)":"var(--mm-muted)" }}>
                          <MessageSquare size={11} />
                        </button>
                        <button onClick={() => duplicate(t)} title="Duplicate task"
                                className="mm-icon-btn" style={{ color:"var(--mm-muted)" }}>
                          <Copy size={10} />
                        </button>
                        <button onClick={() => del(t.id)} className="mm-icon-btn" style={{ color:"var(--mm-muted)" }}>
                          <Trash2 size={11} />
                        </button>
                        <GripVertical size={11} style={{ color:"var(--mm-muted)",opacity:0.3,cursor:"grab" }} />
                      </div>
                    </div>
                    </SwipeRow>

                    {/* ── Sub-tasks panel ── */}
                    {isExpanded && (
                      <div className="border-b" style={{ borderColor:"var(--mm-border)", background:"var(--mm-surface-2)" }}>
                        {subtasks.map(sub => (
                          <div key={sub.id} className="flex items-center gap-2 pl-12 pr-4 py-1.5">
                            <button onClick={() => toggleSubtask(t.id, sub.id)}
                                    className={`mm-check flex-shrink-0 ${sub.done?"done":""}`}
                                    style={{ width:14,height:14 }}>
                              {sub.done && <Check size={8} style={{ color:"var(--mm-gold)" }} />}
                            </button>
                            <span className="text-xs flex-1"
                                  style={{ color:"var(--mm-text)", textDecoration:sub.done?"line-through":"none", opacity:sub.done?0.5:1 }}>
                              {sub.text}
                            </span>
                            <button onClick={() => deleteSubtask(t.id, sub.id)}
                                    className="mm-icon-btn" style={{ color:"var(--mm-muted)" }}>
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pl-12 pr-4 py-1.5">
                          <div className="w-3.5 h-3.5 flex-shrink-0 rounded border"
                               style={{ borderColor:"var(--mm-border)" }} />
                          <input value={newSubtask[t.id]||""}
                                 onChange={e => setNewSubtask(s => ({...s,[t.id]:e.target.value}))}
                                 onKeyDown={e => e.key==="Enter" && addSubtask(t.id, newSubtask[t.id])}
                                 placeholder="Add sub-task…"
                                 className="text-xs flex-1 bg-transparent outline-none"
                                 style={{ color:"var(--mm-muted)" }} />
                          <button onClick={() => addSubtask(t.id, newSubtask[t.id])}
                                  className="mm-icon-btn" style={{ color:"var(--mm-gold)" }}>
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Comments panel ── */}
                    {commentOpen === t.id && (
                      <div className="border-b px-4 py-3"
                           style={{ borderColor:"var(--mm-border)", background:"var(--mm-surface-2)" }}>
                        {(t.comments||[]).length === 0 && (
                          <p className="text-xs mb-2" style={{ color:"var(--mm-muted)" }}>No comments yet</p>
                        )}
                        {(t.comments||[]).map(c => (
                          <div key={c.id} className="flex gap-2 mb-2.5">
                            <div className="w-5 h-5 flex-shrink-0 rounded flex items-center justify-center text-xs font-semibold"
                                 style={{ background:"rgba(212,175,55,0.15)", color:"var(--mm-gold)" }}>
                              {c.text[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs leading-relaxed" style={{ color:"var(--mm-text)" }}>{c.text}</p>
                              <p className="text-xs mt-0.5" style={{ color:"var(--mm-muted)", fontSize:10 }}>
                                {new Date(c.at).toLocaleString("en-IN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <input value={newComment}
                                 onChange={e => setNewComment(e.target.value)}
                                 onKeyDown={e => e.key==="Enter" && addComment(t.id)}
                                 placeholder="Add a comment…"
                                 className="flex-1 text-xs bg-transparent outline-none px-3 py-1.5 rounded-lg"
                                 style={{ border:"1px solid var(--mm-border)", color:"var(--mm-text)" }} />
                          <button onClick={() => addComment(t.id)}
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

      {/* ── New row — part of the table ── */}
      <div className="mm-card overflow-hidden mb-4">
        {/* New row header */}
        <div className="hidden md:grid px-3 py-1.5 mm-label"
             style={{ gridTemplateColumns:COLS, borderBottom:"1px solid var(--mm-border)" }}>
          <span></span>
          <span></span>
          <span style={{ color:"var(--mm-gold)" }}>New Task</span>
          <span>Due</span>
          <span>Person</span>
          <span>Group</span>
          <span>Status</span>
          <span>Priority</span>
        </div>
        <div className="grid items-center px-3 py-2"
             style={{ gridTemplateColumns:COLS, minWidth:740 }}>
          {/* Check circle placeholder */}
          <div className="flex items-center justify-center">
            <div className="mm-check" style={{ opacity:0.3 }} />
          </div>
          <span />
          {/* Task title */}
          <input value={newRow.task}
                 onChange={e => setNewRow(r=>({...r,task:e.target.value}))}
                 onKeyDown={e => e.key==="Enter" && addManual()}
                 placeholder="Task title…"
                 className="mm-input-ghost text-sm" />
          {/* Due date — gold calendar icon */}
          <input
            type="date"
            value={newRow.date}
            onChange={e => setNewRow(r=>({...r,date:e.target.value}))}
            className="mm-input-ghost text-xs w-full mm-date-gold"
            style={{ colorScheme:"dark" }} />
          {/* Person — Excel dropdown */}
          <DropCell
            value={newRow.name}
            onChange={v => setNewRow(r=>({...r,name:v}))}
            options={[...new Set(people.map(p=>p.name).filter(Boolean))]}
            placeholder="Person" />
          {/* Group — Excel dropdown */}
          <DropCell
            value={newRow.group}
            onChange={v => setNewRow(r=>({...r,group:v}))}
            options={allGroups}
            placeholder="Group" />
          {/* Status — Excel dropdown */}
          <DropCell
            value={newRow.status}
            onChange={v => setNewRow(r=>({...r,status:v}))}
            options={STATUSES}
            placeholder="Status" />
          {/* Priority + Add button */}
          <div className="flex items-center gap-1">
            <DropCell
              value={newRow.priority}
              onChange={v => setNewRow(r=>({...r,priority:v}))}
              options={PRIORITIES.filter(Boolean)}
              placeholder="P—" />
            <button onClick={addManual}
                    className="mm-btn-gold flex items-center justify-center gap-1 text-xs px-3 py-1.5 flex-shrink-0">
              <Plus size={11} /> Add
            </button>
          </div>
        </div>
      </div>

      {preview && (
        <EditablePreview title="Review Task" fields={preview.fields}
                         onConfirm={saveFromPreview} onDiscard={() => setPreview(null)} />
      )}
    </div>
  );
}
