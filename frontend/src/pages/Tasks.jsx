import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Flag, Paperclip, Check, Loader } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { isOverdue } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";

const STATUSES = ["Pending","In Progress","Completed","Follow-Up","Delegate","On Hold"];
const EMPTY = { task:"", name:"", date:"", status:"Pending", group:"", details:"", flagged: false };

const STATUS_COLORS = {
  "Pending":     "var(--mm-muted)",
  "In Progress": "#4F8EF7",
  "Completed":   "#52C77A",
  "Done":        "#52C77A",
  "Follow-Up":   "#D4AF37",
  "Delegate":    "#A855F7",
  "On Hold":     "#E0A052",
};

export default function Tasks() {
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newRow, setNewRow] = useState({ ...EMPTY });
  const [filter, setFilter] = useState({ status: "", group: "" });
  const [groups, setGroups] = useState([]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/tasks");
      setTasks(data);
      setGroups([...new Set(data.map(t => t.group).filter(Boolean))]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/task", { text: aiText });
      setPreview({ fields: [
        { key:"task",    label:"Title",   value: data.task,               confidence: data.confidence },
        { key:"date",    label:"Due date",value: data.date,               confidence: data.confidence },
        { key:"name",    label:"Person",  value: data.name,               confidence: "medium" },
        { key:"group",   label:"Group",   value: data.group,              confidence: "medium" },
        { key:"status",  label:"Status",  value: data.status || "Pending",confidence: "high" },
        { key:"details", label:"Details", value: data.details,            confidence: "medium" },
      ], raw: data });
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
    } catch {}
  };

  const update = async (id, patch) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
    try { await api.patch(`/tasks/${id}`, patch); } catch {}
  };

  const toggle = (task) => {
    const next = ["Completed","Done"].includes(task.status) ? "Pending" : "Completed";
    update(task.id, { status: next });
  };

  const del = async (id) => {
    try { await api.delete(`/tasks/${id}`); toast.success("Moved to trash"); load(); } catch {}
  };

  const visible = tasks.filter(t => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.group  && t.group  !== filter.group)  return false;
    return true;
  }).sort((a, b) => {
    if (a.flagged !== b.flagged) return b.flagged ? 1 : -1;
    const aD = ["Completed","Done"].includes(a.status);
    const bD = ["Completed","Done"].includes(b.status);
    if (aD !== bD) return aD ? 1 : -1;
    return (a.order_index||0) - (b.order_index||0);
  });

  const pending = visible.filter(t => !["Completed","Done"].includes(t.status)).length;

  if (loading) return <LoadingPage />;

  return (
    <div className="px-5 py-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="mm-page-title">Tasks</h1>
          <p className="mm-page-sub">{pending} pending · {visible.length} total</p>
        </div>
        <div className="flex gap-2">
          <select value={filter.status}
                  onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
                  className="mm-filter-select">
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filter.group}
                  onChange={e => setFilter(f => ({ ...f, group: e.target.value }))}
                  className="mm-filter-select">
            <option value="">All Groups</option>
            {groups.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* ── AI bar ── */}
      <div className="flex gap-0 mb-5">
        <input value={aiText} onChange={e => setAiText(e.target.value)}
               onKeyDown={e => e.key === "Enter" && parseAi()}
               placeholder='Describe a task — "Call Priya about Q2 deck tomorrow #Finance"'
               className="mm-ai-input" />
        <button onClick={parseAi} disabled={!aiText.trim() || aiLoading}
                className="mm-btn-gold px-5 disabled:opacity-40 flex items-center gap-2">
          {aiLoading ? <Loader size={13} className="animate-spin" /> : null}
          {aiLoading ? "Parsing…" : "Parse"}
        </button>
      </div>

      {/* ── Empty ── */}
      {visible.length === 0 && (
        <div className="mm-empty">
          <div className="mm-divider" style={{ width: 48 }} />
          <p className="mm-empty-title">No tasks</p>
          <p className="mm-empty-desc">Use the bar above to add a task with natural language, or fill in the form below.</p>
        </div>
      )}

      {/* ── Table ── */}
      {visible.length > 0 && (
        <div className="mm-card overflow-hidden mb-3">
          <div className="mm-table-wrap">
            <div className="hidden md:grid px-3 py-2 mm-label"
                 style={{ gridTemplateColumns:"44px 1fr 130px 120px 100px 110px 72px",
                          borderBottom:"1px solid var(--mm-border)" }}>
              <span>#</span><span>Task</span><span>Due</span>
              <span>Person</span><span>Group</span><span>Status</span><span></span>
            </div>
            {visible.map((t, idx) => {
              const done = ["Completed","Done"].includes(t.status);
              const over = isOverdue(t.date, t.status);
              return (
                <div key={t.id}
                     className={`mm-row grid items-center px-3 py-2 border-b ${done ? "mm-row-completed" : ""}`}
                     style={{ gridTemplateColumns:"44px 1fr 130px 120px 100px 110px 72px",
                              borderColor:"var(--mm-border)", minWidth:720 }}>

                  <div className="flex items-center gap-1.5">
                    <button onClick={() => toggle(t)}
                            title={done ? "Mark pending" : "Mark complete"}
                            className={`mm-check ${done ? "done" : ""}`}>
                      {done && <Check size={10} style={{ color:"#52C77A" }} />}
                    </button>
                    <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{idx+1}</span>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    {t.flagged && <Flag size={11} style={{ color:"var(--mm-gold)", flexShrink:0 }} />}
                    <input value={t.task} onChange={e => update(t.id,{task:e.target.value})}
                           className="mm-input-ghost text-sm min-w-0 flex-1" />
                    {t.confidence && t.confidence !== "high" &&
                      <ConfidenceBadge level={t.confidence} size="xs" />}
                    {t.attachments?.length > 0 &&
                      <Paperclip size={10} style={{ color:"var(--mm-muted)" }} />}
                  </div>

                  <input type="date" value={t.date||""}
                         onChange={e => update(t.id,{date:e.target.value})}
                         className="mm-input-ghost text-xs"
                         style={{ color: over ? "#E05252" : "var(--mm-text)" }} />

                  <input value={t.name||""} onChange={e => update(t.id,{name:e.target.value})}
                         className="mm-input-ghost text-xs" placeholder="—" />

                  <input value={t.group||""} onChange={e => update(t.id,{group:e.target.value})}
                         className="mm-input-ghost text-xs" placeholder="—" />

                  <select value={t.status} onChange={e => update(t.id,{status:e.target.value})}
                          className="mm-input-ghost mm-status-select"
                          style={{ color: STATUS_COLORS[t.status] || "var(--mm-muted)" }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>

                  <div className="flex items-center gap-0.5 justify-end">
                    <button onClick={() => update(t.id,{flagged:!t.flagged})}
                            title={t.flagged ? "Unflag" : "Flag priority"}
                            className={`mm-icon-btn ${t.flagged ? "active" : ""}`}>
                      <Flag size={12} />
                    </button>
                    <button onClick={() => del(t.id)}
                            title="Move to trash"
                            className="mm-icon-btn danger">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── New row ── */}
      <div className="mm-card p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <input value={newRow.task} onChange={e => setNewRow(r=>({...r,task:e.target.value}))}
                 onKeyDown={e => e.key==="Enter" && addManual()}
                 placeholder="Task title" className="mm-form-input md:col-span-2" />
          <input type="date" value={newRow.date}
                 onChange={e => setNewRow(r=>({...r,date:e.target.value}))}
                 className="mm-form-input" />
          <button onClick={addManual}
                  className="mm-btn-gold flex items-center justify-center gap-2">
            <Plus size={13} /> Add Task
          </button>
        </div>
      </div>

      {preview && (
        <EditablePreview title="Review Task" fields={preview.fields}
                         onConfirm={saveFromPreview} onDiscard={() => setPreview(null)} />
      )}
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader size={18} className="animate-spin" style={{ color:"var(--mm-gold)" }} />
    </div>
  );
}
