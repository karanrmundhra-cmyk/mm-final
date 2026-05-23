import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Flag, Paperclip, Bell, Check, Loader, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { isOverdue, formatDate } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";

const STATUSES = ["Pending","In Progress","Completed","Follow-Up","Delegate","On Hold"];
const FREQS = ["Daily","Weekly","Monthly","Weekdays","Weekends","Bi-weekly","Quarterly","Half-Yearly","Yearly","Every Monday","Every Tuesday","Every Wednesday","Every Thursday","Every Friday"];
const EMPTY = { task:"", name:"", date:"", status:"Pending", group:"", details:"", flagged: false };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newRow, setNewRow] = useState({ ...EMPTY });
  const [filter, setFilter] = useState({ status: "", group: "", name: "" });
  const [groups, setGroups] = useState([]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/tasks");
      setTasks(data);
      const gs = [...new Set(data.map(t => t.group).filter(Boolean))];
      setGroups(gs);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/task", { text: aiText });
      const fields = [
        { key:"task", label:"Title", value: data.task, confidence: data.confidence },
        { key:"date", label:"Due date", value: data.date, confidence: data.confidence },
        { key:"name", label:"Person", value: data.name, confidence: "medium" },
        { key:"group", label:"Group", value: data.group, confidence: "medium" },
        { key:"status", label:"Status", value: data.status || "Pending", confidence: "high" },
        { key:"details", label:"Details", value: data.details, confidence: "medium" },
      ];
      setPreview({ fields, raw: data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/tasks", { ...preview.raw, ...values });
      toast.success("✓ Task added");
      setPreview(null); setAiText("");
      load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.task.trim()) return;
    try {
      await api.post("/tasks", newRow);
      toast.success("✓ Task added");
      setNewRow({ ...EMPTY });
      load();
    } catch { toast.error("Save failed"); }
  };

  const update = async (id, patch) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
    try { await api.patch(`/tasks/${id}`, patch); } catch {}
  };

  const toggle = async (task) => {
    const next = ["Completed","Done"].includes(task.status) ? "Pending" : "Completed";
    await update(task.id, { status: next });
  };

  const del = async (id) => {
    try { await api.delete(`/tasks/${id}`); toast.success("✓ Moved to trash"); load(); } catch {}
  };

  const visible = tasks.filter(t => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.group && t.group !== filter.group) return false;
    if (filter.name && !t.name?.toLowerCase().includes(filter.name.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (a.flagged !== b.flagged) return b.flagged ? 1 : -1;
    const aD = ["Completed","Done"].includes(a.status);
    const bD = ["Completed","Done"].includes(b.status);
    if (aD !== bD) return aD ? 1 : -1;
    return (a.order_index || 0) - (b.order_index || 0);
  });

  if (loading) return <LoadingPage />;

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Tasks</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>
            {visible.filter(t => !["Completed","Done"].includes(t.status)).length} pending
          </p>
        </div>
        <div className="flex gap-2">
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
                  className="text-xs rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                           color: "var(--mm-muted)" }}>
            <option value="">All status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filter.group} onChange={e => setFilter(f => ({ ...f, group: e.target.value }))}
                  className="text-xs rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                           color: "var(--mm-muted)" }}>
            <option value="">All groups</option>
            {groups.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* AI bar */}
      <div className="flex gap-2 mb-4">
        <input value={aiText} onChange={e => setAiText(e.target.value)}
               onKeyDown={e => e.key === "Enter" && parseAi()}
               placeholder='e.g. "Call Priya about Q2 deck tomorrow #Finance"'
               className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)",
                        color: "var(--mm-text)" }} />
        <button onClick={parseAi} disabled={!aiText.trim() || aiLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
          {aiLoading ? <Loader size={14} className="animate-spin" /> : null}
          Parse
        </button>
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <EmptyState
          icon="📋" title="No tasks yet"
          desc="Add your first task to get started."
          example='"Call Priya about Q2 deck revision"'
          cta="+ Add Task" onCta={() => setNewRow({ ...EMPTY, date: new Date().toISOString().slice(0,10) })}
        />
      )}

      {/* Table */}
      {visible.length > 0 && (
        <div className="mm-card overflow-hidden">
          <div className="mm-table-wrap">
            {/* Header */}
            <div className="hidden md:grid px-3 py-2 text-xs font-medium uppercase tracking-wide"
                 style={{ gridTemplateColumns: "44px 1fr 130px 120px 100px 90px 80px",
                          color: "var(--mm-muted)", borderBottom: "1px solid var(--mm-border)" }}>
              <span className="mm-frozen-col">#</span>
              <span>Task</span><span>Due</span><span>Person</span>
              <span>Group</span><span>Status</span><span></span>
            </div>
            {visible.map((t, idx) => {
              const done = ["Completed","Done"].includes(t.status);
              const over = isOverdue(t.date, t.status);
              return (
                <div key={t.id}
                     className={`grid items-center px-3 py-2 border-b hover:bg-white/3 transition-colors ${done ? "mm-row-completed" : ""}`}
                     style={{ gridTemplateColumns: "44px 1fr 130px 120px 100px 90px 80px",
                              borderColor: "var(--mm-border)", minWidth: 720 }}>
                  {/* SR + check */}
                  <div className="flex items-center gap-1.5 mm-frozen-col">
                    <button onClick={() => toggle(t)}
                            className="w-5 h-5 rounded flex items-center justify-center border flex-shrink-0"
                            style={{ borderColor: done ? "#52C77A" : "var(--mm-border)",
                                     background: done ? "#52C77A22" : "transparent" }}>
                      {done && <Check size={10} style={{ color: "#52C77A" }} />}
                    </button>
                    <span className="text-xs" style={{ color: "var(--mm-muted)" }}>{idx + 1}</span>
                  </div>
                  {/* Title */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {t.flagged && <Flag size={12} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />}
                    <input value={t.task} onChange={e => update(t.id, { task: e.target.value })}
                           className="mm-input-ghost text-sm min-w-0 flex-1"
                           style={{ textDecoration: "none" }} />
                    {t.confidence && t.confidence !== "high" && (
                      <ConfidenceBadge level={t.confidence} size="xs" />
                    )}
                    {t.attachments?.length > 0 && (
                      <span className="text-xs" style={{ color: "var(--mm-muted)" }}>
                        <Paperclip size={10} />
                      </span>
                    )}
                  </div>
                  {/* Date */}
                  <input type="date" value={t.date || ""}
                         onChange={e => update(t.id, { date: e.target.value })}
                         className="mm-input-ghost text-xs"
                         style={{ color: over ? "#E05252" : "var(--mm-text)" }} />
                  {/* Person */}
                  <input value={t.name || ""} onChange={e => update(t.id, { name: e.target.value })}
                         className="mm-input-ghost text-xs" placeholder="—" />
                  {/* Group */}
                  <input value={t.group || ""} onChange={e => update(t.id, { group: e.target.value })}
                         className="mm-input-ghost text-xs" placeholder="—" />
                  {/* Status */}
                  <select value={t.status} onChange={e => update(t.id, { status: e.target.value })}
                          className="mm-input-ghost text-xs">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => update(t.id, { flagged: !t.flagged })}
                            className="p-1 rounded hover:bg-white/10"
                            style={{ color: t.flagged ? "var(--mm-gold)" : "var(--mm-muted)" }}>
                      <Flag size={12} />
                    </button>
                    <button onClick={() => del(t.id)} className="p-1 rounded hover:bg-white/10"
                            style={{ color: "#E05252" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New row */}
      <div className="mt-3 mm-card p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <input value={newRow.task} onChange={e => setNewRow(r => ({ ...r, task: e.target.value }))}
                 onKeyDown={e => e.key === "Enter" && addManual()}
                 placeholder="Task title"
                 className="rounded-lg px-3 py-2 text-sm outline-none md:col-span-2"
                 style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                          color: "var(--mm-text)" }} />
          <input type="date" value={newRow.date} onChange={e => setNewRow(r => ({ ...r, date: e.target.value }))}
                 className="rounded-lg px-3 py-2 text-sm outline-none"
                 style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                          color: "var(--mm-text)" }} />
          <button onClick={addManual} className="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium"
                  style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
            <Plus size={14} /> Add Task
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

function EmptyState({ icon, title, desc, example, cta, onCta }) {
  return (
    <div className="flex flex-col items-center py-20 gap-4 text-center">
      <span style={{ fontSize: 48 }}>{icon}</span>
      <h2 className="text-lg font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>{title}</h2>
      <p className="text-sm max-w-xs" style={{ color: "var(--mm-muted)" }}>{desc}</p>
      {example && <p className="text-xs italic" style={{ color: "var(--mm-muted)" }}>Example: {example}</p>}
      {cta && (
        <button onClick={onCta} className="mt-2 px-5 py-2.5 rounded-xl font-medium text-sm"
                style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
          {cta}
        </button>
      )}
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader size={24} className="animate-spin" style={{ color: "var(--mm-gold)" }} />
    </div>
  );
}
