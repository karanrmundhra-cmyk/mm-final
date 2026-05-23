import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, Loader, Flag } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";

const STATUSES   = ["Active","Paused","Done","Completed"];
const PRIORITIES = ["Low","Medium","High"];
const FREQS = [
  "Daily","Weekly","Monthly","Weekdays","Weekends","Bi-weekly",
  "Every Monday","Every Tuesday","Every Wednesday","Every Thursday","Every Friday",
  "Quarterly","Half-Yearly","Yearly",
];
const EMPTY = { activity:"", name:"", group:"", details:"", frequency:"Daily", priority:"Medium", status:"Active" };

const PRIORITY_COLORS = { High:"#E05252", Medium:"#D4AF37", Low:"#52C77A" };
const STATUS_COLORS   = { Active:"#52C77A", Paused:"#E0A052", Done:"var(--mm-muted)", Completed:"var(--mm-muted)" };

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [logs, setLogs]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [aiText, setAiText]     = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview]   = useState(null);
  const [newRow, setNewRow]     = useState({ ...EMPTY });
  const [filter, setFilter]     = useState({ group:"", status:"" });
  const [groups, setGroups]     = useState([]);
  const [selected, setSelected] = useState(new Set());

  const today = new Date().toISOString().slice(0,10);

  const load = useCallback(async () => {
    try {
      const [routRes, logRes] = await Promise.all([
        api.get("/routines"),
        api.get("/routines/logs", { params:{ date:today } })
      ]);
      setRoutines(routRes.data);
      const lg = {};
      (logRes.data||[]).forEach(l => { lg[l.routine_id] = l.done; });
      setLogs(lg);
      setGroups([...new Set(routRes.data.map(r=>r.group).filter(Boolean))]);
    } catch {}
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/routine",{ text:aiText });
      setPreview({ fields:[
        { key:"activity",  label:"Activity",  value:data.activity,            confidence:data.confidence },
        { key:"group",     label:"Group",     value:data.group,               confidence:"medium" },
        { key:"frequency", label:"Frequency", value:data.frequency,           confidence:"medium" },
        { key:"priority",  label:"Priority",  value:data.priority||"Medium",  confidence:"high" },
        { key:"name",      label:"Name",      value:data.name,                confidence:"medium" },
        { key:"details",   label:"Details",   value:data.details,             confidence:"medium" },
      ], raw:data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/routines",{ ...preview.raw,...values });
      toast.success("Routine added");
      setPreview(null); setAiText(""); load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.activity.trim()) return;
    try { await api.post("/routines",newRow); toast.success("Routine added"); setNewRow({...EMPTY}); load(); } catch {}
  };

  const update = async (id, patch) => {
    setRoutines(rs => rs.map(r => r.id===id ? {...r,...patch} : r));
    try { await api.patch(`/routines/${id}`,patch); } catch {}
  };

  const logDone = async (id, done) => {
    setLogs(l => ({...l,[id]:done}));
    try { await api.post(`/routines/${id}/log`,{ date:today,done }); } catch {}
  };

  const del = async (id) => {
    try { await api.delete(`/routines/${id}`); toast.success("Moved to trash"); load(); } catch {}
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    const ids = [...selected];
    await Promise.all(ids.map(id => api.delete(`/routines/${id}`).catch(()=>{})));
    toast.success(`Deleted ${ids.length} routines`);
    setSelected(new Set()); load();
  };

  const toggleSelect = (id) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const visible = routines.filter(r => {
    if (filter.group  && r.group  !== filter.group)  return false;
    if (filter.status && r.status !== filter.status) return false;
    return true;
  });

  const doneToday = Object.values(logs).filter(Boolean).length;

  if (loading) return <LoadingPage />;

  return (
    <div className="px-5 py-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="mm-page-title">Routines</h1>
          <p className="mm-page-sub">{visible.length} routines · {doneToday} done today</p>
        </div>
        <div className="flex gap-2 items-center">
          {selected.size > 0 && (
            <button onClick={bulkDelete} title="Delete selected"
                    className="mm-filter-select"
                    style={{ color:"#E05252", borderColor:"#E0505033" }}>
              Delete {selected.size}
            </button>
          )}
          <select value={filter.group}
                  onChange={e => setFilter(f=>({...f,group:e.target.value}))}
                  className="mm-filter-select">
            <option value="">All Groups</option>
            {groups.map(g => <option key={g}>{g}</option>)}
          </select>
          <select value={filter.status}
                  onChange={e => setFilter(f=>({...f,status:e.target.value}))}
                  className="mm-filter-select">
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── AI bar ── */}
      <div className="flex gap-0 mb-5">
        <input value={aiText} onChange={e => setAiText(e.target.value)}
               onKeyDown={e => e.key==="Enter" && parseAi()}
               placeholder='Describe a routine — "Morning meditation daily personal"'
               className="mm-ai-input" />
        <button onClick={parseAi} disabled={!aiText.trim()||aiLoading}
                className="mm-btn-gold px-5 disabled:opacity-40 flex items-center gap-2">
          {aiLoading ? <Loader size={13} className="animate-spin" /> : null}
          {aiLoading ? "Parsing…" : "Parse"}
        </button>
      </div>

      {/* ── Empty ── */}
      {visible.length === 0 && (
        <div className="mm-empty">
          <div className="mm-divider" style={{ width:48 }} />
          <p className="mm-empty-title">No routines</p>
          <p className="mm-empty-desc">Build consistent habits. Add your first routine above.</p>
        </div>
      )}

      {/* ── Table ── */}
      {visible.length > 0 && (
        <div className="mm-card overflow-hidden mb-3">
          <div className="mm-table-wrap">
            <div className="hidden md:grid px-3 py-2 mm-label"
                 style={{ gridTemplateColumns:"48px 1fr 110px 120px 90px 90px 72px",
                          borderBottom:"1px solid var(--mm-border)" }}>
              <span></span><span>Activity</span><span>Group</span>
              <span>Frequency</span><span>Priority</span><span>Status</span><span></span>
            </div>
            {visible.map(r => {
              const done = logs[r.id];
              return (
                <div key={r.id}
                     className="mm-row grid items-center px-3 py-2 border-b"
                     style={{ gridTemplateColumns:"48px 1fr 110px 120px 90px 90px 72px",
                              borderColor:"var(--mm-border)", minWidth:680,
                              opacity: r.status==="Paused" ? 0.6 : 1 }}>

                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={selected.has(r.id)}
                           onChange={() => toggleSelect(r.id)}
                           title="Select"
                           style={{ width:13, height:13, accentColor:"var(--mm-gold)", cursor:"pointer", borderRadius:0 }} />
                    <button onClick={() => logDone(r.id,!done)}
                            title={done ? "Mark undone" : "Mark done today"}
                            className={`mm-check ${done ? "done" : ""}`}>
                      {done && <Check size={9} style={{ color:"#52C77A" }} />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    {r.flagged && <Flag size={11} style={{ color:"var(--mm-gold)", flexShrink:0 }} />}
                    <input value={r.activity} onChange={e => update(r.id,{activity:e.target.value})}
                           className="mm-input-ghost text-sm min-w-0 flex-1" />
                    {r.confidence && r.confidence !== "high" &&
                      <ConfidenceBadge level={r.confidence} size="xs" />}
                  </div>

                  <input value={r.group||""} onChange={e => update(r.id,{group:e.target.value})}
                         className="mm-input-ghost text-xs" placeholder="—" />

                  <select value={r.frequency} onChange={e => update(r.id,{frequency:e.target.value})}
                          className="mm-input-ghost text-xs mm-status-select"
                          style={{ color:"var(--mm-muted)" }}>
                    {FREQS.map(f => <option key={f}>{f}</option>)}
                  </select>

                  <select value={r.priority} onChange={e => update(r.id,{priority:e.target.value})}
                          className="mm-input-ghost text-xs mm-status-select"
                          style={{ color: PRIORITY_COLORS[r.priority]||"var(--mm-muted)" }}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>

                  <select value={r.status} onChange={e => update(r.id,{status:e.target.value})}
                          className="mm-input-ghost text-xs mm-status-select"
                          style={{ color: STATUS_COLORS[r.status]||"var(--mm-muted)" }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>

                  <div className="flex items-center gap-0.5 justify-end">
                    <button onClick={() => update(r.id,{flagged:!r.flagged})}
                            title={r.flagged ? "Unflag" : "Flag priority"}
                            className={`mm-icon-btn ${r.flagged ? "active" : ""}`}>
                      <Flag size={12} />
                    </button>
                    <button onClick={() => del(r.id)}
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
          <input value={newRow.activity}
                 onChange={e => setNewRow(r=>({...r,activity:e.target.value}))}
                 onKeyDown={e => e.key==="Enter" && addManual()}
                 placeholder="Activity name" className="mm-form-input md:col-span-2" />
          <select value={newRow.frequency}
                  onChange={e => setNewRow(r=>({...r,frequency:e.target.value}))}
                  className="mm-form-input">
            {FREQS.map(f => <option key={f}>{f}</option>)}
          </select>
          <button onClick={addManual}
                  className="mm-btn-gold flex items-center justify-center gap-2">
            <Plus size={13} /> Add Routine
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

function LoadingPage() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader size={18} className="animate-spin" style={{ color:"var(--mm-gold)" }} />
    </div>
  );
}
