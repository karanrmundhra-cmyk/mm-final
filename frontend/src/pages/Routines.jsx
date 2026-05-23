import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, Loader, Flag } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";

const STATUSES = ["Active","Paused","Done","Completed"];
const PRIORITIES = ["Low","Medium","High"];
const FREQS = ["Daily","Weekly","Monthly","Weekdays","Weekends","Bi-weekly","Every Monday","Every Tuesday","Every Wednesday","Every Thursday","Every Friday","Quarterly","Half-Yearly","Yearly"];
const EMPTY = { activity:"", name:"", group:"", details:"", frequency:"Daily", priority:"Medium", status:"Active" };

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newRow, setNewRow] = useState({ ...EMPTY });
  const [filter, setFilter] = useState({ group: "", status: "" });
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const [routRes, logRes] = await Promise.all([
        api.get("/routines"),
        api.get("/routines/logs", { params: { date: today } })
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

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/routine", { text: aiText });
      const fields = [
        { key:"activity", label:"Activity", value: data.activity, confidence: data.confidence },
        { key:"group", label:"Group", value: data.group, confidence: "medium" },
        { key:"frequency", label:"Frequency", value: data.frequency, confidence: "medium" },
        { key:"priority", label:"Priority", value: data.priority || "Medium", confidence: "high" },
        { key:"name", label:"Name", value: data.name, confidence: "medium" },
        { key:"details", label:"Details", value: data.details, confidence: "medium" },
      ];
      setPreview({ fields, raw: data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/routines", { ...preview.raw, ...values });
      toast.success("✓ Routine added");
      setPreview(null); setAiText("");
      load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.activity.trim()) return;
    try {
      await api.post("/routines", newRow);
      toast.success("✓ Routine added");
      setNewRow({ ...EMPTY });
      load();
    } catch {}
  };

  const update = async (id, patch) => {
    setRoutines(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
    try { await api.patch(`/routines/${id}`, patch); } catch {}
  };

  const logDone = async (id, done) => {
    setLogs(l => ({ ...l, [id]: done }));
    try { await api.post(`/routines/${id}/log`, { date: today, done }); } catch {}
  };

  const del = async (id) => {
    try { await api.delete(`/routines/${id}`); toast.success("✓ Moved to trash"); load(); } catch {}
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    await Promise.all(ids.map(id => api.delete(`/routines/${id}`).catch(() => {})));
    toast.success(`✓ Deleted ${ids.length} routines`);
    setSelected(new Set());
    load();
  };

  const visible = routines.filter(r => {
    if (filter.group && r.group !== filter.group) return false;
    if (filter.status && r.status !== filter.status) return false;
    return true;
  });

  const toggleSelect = (id) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  if (loading) return <LoadingPage />;

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Routines</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>{visible.length} routines</p>
        </div>
        <div className="flex gap-2 items-center">
          {selected.size > 0 && (
            <button onClick={bulkDelete}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "#E0505022", color: "#E05252", border: "1px solid #E0505033" }}>
              Delete {selected.size} selected
            </button>
          )}
          <select value={filter.group} onChange={e => setFilter(f => ({ ...f, group: e.target.value }))}
                  className="text-xs rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
            <option value="">All groups</option>
            {groups.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* AI bar */}
      <div className="flex gap-2 mb-4">
        <input value={aiText} onChange={e => setAiText(e.target.value)}
               onKeyDown={e => e.key === "Enter" && parseAi()}
               placeholder='e.g. "Morning meditation daily personal"'
               className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
        <button onClick={parseAi} disabled={!aiText.trim() || aiLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
          {aiLoading ? <Loader size={14} className="animate-spin" /> : null} Parse
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🔄" title="No routines yet"
          desc="Build consistent habits. Add your first routine."
          example='"Morning meditation daily personal"'
          cta="+ Add Routine" onCta={() => setNewRow({ ...EMPTY })} />
      ) : (
        <div className="mm-card overflow-hidden">
          <div className="mm-table-wrap">
            <div className="hidden md:grid px-3 py-2 text-xs font-medium uppercase tracking-wide"
                 style={{ gridTemplateColumns: "44px 1fr 120px 110px 90px 90px 80px",
                          color: "var(--mm-muted)", borderBottom: "1px solid var(--mm-border)" }}>
              <span></span><span>Activity</span><span>Group</span>
              <span>Frequency</span><span>Priority</span><span>Status</span><span></span>
            </div>
            {visible.map((r, idx) => {
              const done = logs[r.id];
              return (
                <div key={r.id}
                     className={`grid items-center px-3 py-2 border-b hover:bg-white/3 transition-colors`}
                     style={{ gridTemplateColumns: "44px 1fr 120px 110px 90px 90px 80px",
                              borderColor: "var(--mm-border)", minWidth: 680,
                              opacity: r.status === "Paused" ? 0.6 : 1 }}>
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={selected.has(r.id)}
                           onChange={() => toggleSelect(r.id)}
                           className="w-3.5 h-3.5 accent-amber-500" />
                    <button onClick={() => logDone(r.id, !done)}
                            className="w-5 h-5 rounded flex items-center justify-center border flex-shrink-0"
                            style={{ borderColor: done ? "#52C77A" : "var(--mm-border)",
                                     background: done ? "#52C77A22" : "transparent" }}
                            title="Mark done today">
                      {done && <Check size={10} style={{ color: "#52C77A" }} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {r.flagged && <Flag size={12} style={{ color: "var(--mm-gold)", flexShrink: 0 }} />}
                    <input value={r.activity} onChange={e => update(r.id, { activity: e.target.value })}
                           className="mm-input-ghost text-sm min-w-0 flex-1" />
                    {r.confidence && r.confidence !== "high" && <ConfidenceBadge level={r.confidence} size="xs" />}
                  </div>
                  <input value={r.group || ""} onChange={e => update(r.id, { group: e.target.value })}
                         className="mm-input-ghost text-xs" placeholder="—" />
                  <select value={r.frequency} onChange={e => update(r.id, { frequency: e.target.value })}
                          className="mm-input-ghost text-xs">
                    {FREQS.map(f => <option key={f}>{f}</option>)}
                  </select>
                  <select value={r.priority} onChange={e => update(r.id, { priority: e.target.value })}
                          className="mm-input-ghost text-xs">
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                  <select value={r.status} onChange={e => update(r.id, { status: e.target.value })}
                          className="mm-input-ghost text-xs">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <div className="flex justify-end">
                    <button onClick={() => del(r.id)} className="p-1 rounded hover:bg-white/10"
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
          <input value={newRow.activity} onChange={e => setNewRow(r => ({ ...r, activity: e.target.value }))}
                 onKeyDown={e => e.key === "Enter" && addManual()}
                 placeholder="Activity name"
                 className="rounded-lg px-3 py-2 text-sm outline-none md:col-span-2"
                 style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          <select value={newRow.frequency} onChange={e => setNewRow(r => ({ ...r, frequency: e.target.value }))}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }}>
            {FREQS.map(f => <option key={f}>{f}</option>)}
          </select>
          <button onClick={addManual} className="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium"
                  style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
            <Plus size={14} /> Add Routine
          </button>
        </div>
      </div>

      {preview && (
        <EditablePreview title="Review Routine" fields={preview.fields}
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
      {cta && <button onClick={onCta} className="mt-2 px-5 py-2.5 rounded-xl font-medium text-sm"
                      style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>{cta}</button>}
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
