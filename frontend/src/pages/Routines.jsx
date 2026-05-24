import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Trash2, Check, Loader, Flag, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import Skeleton from "@/components/Skeleton";

const STATUSES   = ["Active","Paused","Done","Completed"];
const PRIORITIES = ["Low","Medium","High"];
const FREQS = [
  "Daily","Weekly","Monthly","Weekdays","Weekends","Bi-weekly",
  "Every Monday","Every Tuesday","Every Wednesday","Every Thursday","Every Friday",
  "Quarterly","Half-Yearly","Yearly",
];
const EMPTY = { activity:"", group:"", details:"", frequency:"Daily", priority:"Medium", status:"Active" };

const PRIORITY_COLORS = { High:"var(--mm-text)", Medium:"var(--mm-gold)", Low:"var(--mm-muted)" };
const STATUS_COLORS   = { Active:"var(--mm-gold)", Paused:"var(--mm-muted)", Done:"var(--mm-muted)", Completed:"var(--mm-muted)" };

const COLS = "48px 1fr 110px 130px 90px 90px 100px";
// check | activity | group | frequency | priority | status | actions

/* ── Column filter ── */
function ColFilter({ label, col, filter, setFilter, values, open, setOpen }) {
  const active = !!filter[col];
  const ref = useRef(null);

  useEffect(() => {
    if (open !== col) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, col, setOpen]);

  return (
    <div ref={ref} className="relative inline-flex items-center gap-0.5 select-none cursor-pointer">
      <button
        onClick={() => setOpen(open === col ? null : col)}
        className="flex items-center gap-1"
        style={{ color: active ? "var(--mm-gold)" : "inherit" }}
      >
        {label}
        {active && <span className="inline-block w-1.5 h-1.5 rounded-full ml-0.5" style={{ background:"var(--mm-gold)" }} />}
        <ChevronDown size={8} />
      </button>
      {open === col && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-lg overflow-hidden shadow-xl"
             style={{ minWidth:140, background:"var(--mm-surface-2)", border:"1px solid var(--mm-border-gold)" }}>
          <button
            className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
            style={{ color:"var(--mm-gold)", borderBottom:"1px solid var(--mm-border)" }}
            onClick={() => { setFilter(f => ({...f,[col]:""})); setOpen(null); }}
          >
            All {label}
          </button>
          {values.map(v => (
            <button
              key={v}
              className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
              style={{ color: filter[col]===v ? "var(--mm-gold)" : "var(--mm-muted)" }}
              onClick={() => { setFilter(f => ({...f,[col]:v})); setOpen(null); }}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [logs, setLogs]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [aiText, setAiText]     = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview]   = useState(null);
  const [newRow, setNewRow]     = useState({ ...EMPTY });
  const [colFilter, setColFilter] = useState({ group:"", frequency:"", priority:"", status:"" });
  const [filterOpen, setFilterOpen] = useState(null);
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
    try { await api.post("/routines",newRow); toast.success("Routine added"); setNewRow({...EMPTY}); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed to add routine"); }
  };

  const update = async (id, patch) => {
    setRoutines(rs => rs.map(r => r.id===id ? {...r,...patch} : r));
    try { await api.patch(`/routines/${id}`,patch); }
    catch { /* optimistic */ }
  };

  const logDone = async (id, done) => {
    setLogs(l => ({...l,[id]:done}));
    try { await api.post(`/routines/${id}/log`,{ date:today,done }); }
    catch { toast.error("Failed to save log"); }
  };

  const del = async (id) => {
    try { await api.delete(`/routines/${id}`); toast.success("Moved to trash"); load(); }
    catch { toast.error("Failed to delete routine"); }
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

  // Reorder helpers
  const applyReorder = async (reordered) => {
    setRoutines(rs => {
      const ids = new Set(reordered.map(r => r.id));
      return [...reordered, ...rs.filter(r => !ids.has(r.id))];
    });
    try {
      await api.post("/routines/reorder", reordered.map((r,i) => ({ id:r.id, order_index:i+1 })));
    } catch {}
  };

  const moveUp = (id) => {
    const idx = visible.findIndex(r => r.id === id);
    if (idx <= 0) return;
    const r = [...visible]; [r[idx-1], r[idx]] = [r[idx], r[idx-1]]; applyReorder(r);
  };
  const moveDown = (id) => {
    const idx = visible.findIndex(r => r.id === id);
    if (idx < 0 || idx >= visible.length - 1) return;
    const r = [...visible]; [r[idx], r[idx+1]] = [r[idx+1], r[idx]]; applyReorder(r);
  };

  const visible = useMemo(() => routines.filter(r => {
    if (colFilter.group     && r.group     !== colFilter.group)     return false;
    if (colFilter.frequency && r.frequency !== colFilter.frequency) return false;
    if (colFilter.priority  && r.priority  !== colFilter.priority)  return false;
    if (colFilter.status    && r.status    !== colFilter.status)    return false;
    return true;
  }), [routines, colFilter]);

  // Unique values for filter dropdowns
  const allGroups     = useMemo(() => [...new Set(routines.map(r=>r.group).filter(Boolean))],   [routines]);
  const allFreqs      = useMemo(() => [...new Set(routines.map(r=>r.frequency).filter(Boolean))], [routines]);
  const allPriorities = useMemo(() => [...new Set(routines.map(r=>r.priority).filter(Boolean))], [routines]);
  const allStatuses   = useMemo(() => [...new Set(routines.map(r=>r.status).filter(Boolean))],  [routines]);

  const doneToday = Object.values(logs).filter(Boolean).length;
  const totalToday = visible.filter(r => r.status === "Active").length;
  const completionPct = totalToday > 0 ? Math.round((doneToday/totalToday)*100) : 0;

  if (loading) return <Skeleton.Page rows={6} />;

  return (
    <div className="px-5 py-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="mm-page-title">Routines</h1>
          <p className="mm-page-sub">{visible.length} routines · {doneToday}/{totalToday} done today</p>
        </div>
        <div className="flex gap-2 items-center">
          {selected.size > 0 && (
            <button onClick={bulkDelete}
                    className="mm-filter-select"
                    style={{ color:"var(--mm-muted)", borderColor:"var(--mm-border)" }}>
              Delete {selected.size}
            </button>
          )}
        </div>
      </div>

      {/* ── Today's progress bar ── */}
      {totalToday > 0 && (
        <div className="mm-card p-4 mb-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="mm-label">Today's Progress</span>
              <span className="text-sm font-medium" style={{ color:"var(--mm-gold)" }}>
                {completionPct === 100 ? "🔥 Complete!" : `${doneToday} / ${totalToday}`}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"var(--mm-surface-3)" }}>
              <div className="h-full transition-all duration-700"
                   style={{
                     width:`${completionPct}%`,
                     background:"linear-gradient(90deg,var(--mm-gold-dark),var(--mm-gold))",
                     borderRadius:"inherit",
                     boxShadow:"0 0 8px rgba(212,175,55,0.3)",
                   }} />
            </div>
          </div>
          {completionPct === 100 && <span style={{ fontSize:28 }}>🔥</span>}
        </div>
      )}

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
          <p className="mm-empty-desc">Build consistent habits. Add your first routine below.</p>
        </div>
      )}

      {/* ── Table ── */}
      {visible.length > 0 && (
        <div className="mm-card overflow-hidden mb-3">
          <div className="mm-table-wrap">
            {/* Column headers with filters */}
            <div className="hidden md:grid px-3 py-2 mm-label"
                 style={{ gridTemplateColumns:COLS, borderBottom:"1px solid var(--mm-border)" }}>
              <span></span>
              <span style={{ color:"var(--mm-muted)" }}>Activity</span>
              <ColFilter label="Group"     col="group"     filter={colFilter} setFilter={setColFilter}
                         values={allGroups}     open={filterOpen} setOpen={setFilterOpen} />
              <ColFilter label="Frequency" col="frequency" filter={colFilter} setFilter={setColFilter}
                         values={allFreqs}      open={filterOpen} setOpen={setFilterOpen} />
              <ColFilter label="Priority"  col="priority"  filter={colFilter} setFilter={setColFilter}
                         values={allPriorities} open={filterOpen} setOpen={setFilterOpen} />
              <ColFilter label="Status"    col="status"    filter={colFilter} setFilter={setColFilter}
                         values={allStatuses}   open={filterOpen} setOpen={setFilterOpen} />
              <span></span>
            </div>

            {visible.map((r, idx) => {
              const done = logs[r.id];
              return (
                <div key={r.id}
                     className="mm-row grid items-center px-3 py-2 border-b"
                     style={{ gridTemplateColumns:COLS, borderColor:"var(--mm-border)", minWidth:700,
                              opacity: r.status==="Paused" ? 0.6 : 1 }}>

                  {/* Check + select */}
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={selected.has(r.id)}
                           onChange={() => toggleSelect(r.id)}
                           style={{ width:13, height:13, accentColor:"var(--mm-gold)", cursor:"pointer", borderRadius:0 }} />
                    <button onClick={() => logDone(r.id,!done)}
                            title={done ? "Mark undone" : "Mark done today"}
                            className={`mm-check ${done ? "done" : ""}`}>
                      {done && <Check size={9} style={{ color:"var(--mm-gold)" }} />}
                    </button>
                  </div>

                  {/* Activity */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {r.flagged && <Flag size={11} style={{ color:"var(--mm-gold)", flexShrink:0 }} />}
                    <input value={r.activity} onChange={e => update(r.id,{activity:e.target.value})}
                           className="mm-input-ghost text-sm min-w-0 flex-1" />
                    {r.streak > 0 && (
                      <span title={`${r.streak}-day streak`}
                            className="text-xs flex-shrink-0 px-1.5 py-0.5"
                            style={{ background:"rgba(212,175,55,0.12)", color:"var(--mm-gold)",
                                     borderRadius:8, fontSize:10 }}>
                        🔥{r.streak}
                      </span>
                    )}
                    {r.confidence && r.confidence !== "high" &&
                      <ConfidenceBadge level={r.confidence} size="xs" />}
                  </div>

                  {/* Group */}
                  <input value={r.group||""} onChange={e => update(r.id,{group:e.target.value})}
                         list="r-group-list"
                         className="mm-input-ghost text-xs" placeholder="—" />

                  {/* Frequency */}
                  <select value={r.frequency} onChange={e => update(r.id,{frequency:e.target.value})}
                          className="mm-input-ghost text-xs mm-status-select"
                          style={{ color:"var(--mm-muted)" }}>
                    {FREQS.map(f => <option key={f}>{f}</option>)}
                  </select>

                  {/* Priority */}
                  <select value={r.priority} onChange={e => update(r.id,{priority:e.target.value})}
                          className="mm-input-ghost text-xs mm-status-select"
                          style={{ color:PRIORITY_COLORS[r.priority]||"var(--mm-muted)" }}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>

                  {/* Status */}
                  <select value={r.status} onChange={e => update(r.id,{status:e.target.value})}
                          className="mm-input-ghost text-xs mm-status-select"
                          style={{ color:STATUS_COLORS[r.status]||"var(--mm-muted)" }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 justify-end">
                    <button onClick={() => moveUp(r.id)} title="Move up"
                            className="mm-icon-btn" disabled={idx === 0}
                            style={{ opacity: idx === 0 ? 0.3 : 1 }}>
                      <ArrowUp size={11} />
                    </button>
                    <button onClick={() => moveDown(r.id)} title="Move down"
                            className="mm-icon-btn" disabled={idx === visible.length - 1}
                            style={{ opacity: idx === visible.length - 1 ? 0.3 : 1 }}>
                      <ArrowDown size={11} />
                    </button>
                    <button onClick={() => update(r.id,{flagged:!r.flagged})}
                            title={r.flagged ? "Unflag" : "Flag priority"}
                            className={`mm-icon-btn ${r.flagged ? "active" : ""}`}>
                      <Flag size={12} />
                    </button>
                    <button onClick={() => del(r.id)} title="Move to trash"
                            className="mm-icon-btn" style={{ color:"var(--mm-muted)" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── New row — matches table columns exactly ── */}
      <div className="mm-card overflow-hidden">
        <div className="hidden md:grid px-3 py-1.5 mm-label"
             style={{ gridTemplateColumns:COLS, borderBottom:"1px solid var(--mm-border)" }}>
          <span></span>
          <span style={{ color:"var(--mm-gold)" }}>New routine</span>
          <span>Group</span><span>Frequency</span><span>Priority</span><span>Status</span><span></span>
        </div>
        <div className="grid items-center px-3 py-2 gap-1"
             style={{ gridTemplateColumns:COLS, minWidth:700 }}>
          {/* placeholder for check column */}
          <span />

          {/* Activity */}
          <input value={newRow.activity}
                 onChange={e => setNewRow(r=>({...r,activity:e.target.value}))}
                 onKeyDown={e => e.key==="Enter" && addManual()}
                 placeholder="Activity name"
                 className="mm-form-input text-sm" />

          {/* Group */}
          <input value={newRow.group}
                 onChange={e => setNewRow(r=>({...r,group:e.target.value}))}
                 list="r-group-list"
                 placeholder="Group"
                 className="mm-form-input text-xs" />

          {/* Frequency */}
          <select value={newRow.frequency}
                  onChange={e => setNewRow(r=>({...r,frequency:e.target.value}))}
                  className="mm-form-input text-xs">
            {FREQS.map(f => <option key={f}>{f}</option>)}
          </select>

          {/* Priority */}
          <select value={newRow.priority}
                  onChange={e => setNewRow(r=>({...r,priority:e.target.value}))}
                  className="mm-form-input text-xs"
                  style={{ color:PRIORITY_COLORS[newRow.priority] }}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>

          {/* Status */}
          <select value={newRow.status}
                  onChange={e => setNewRow(r=>({...r,status:e.target.value}))}
                  className="mm-form-input text-xs"
                  style={{ color:STATUS_COLORS[newRow.status] }}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>

          {/* Add button */}
          <button onClick={addManual}
                  className="mm-btn-gold flex items-center justify-center gap-1.5 text-xs px-2 py-1.5">
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {/* Group datalist */}
      <datalist id="r-group-list">
        {groups.map(g => <option key={g} value={g} />)}
      </datalist>

      {preview && (
        <EditablePreview title="Review Routine" fields={preview.fields}
                         onConfirm={saveFromPreview} onDiscard={() => setPreview(null)} />
      )}
    </div>
  );
}
