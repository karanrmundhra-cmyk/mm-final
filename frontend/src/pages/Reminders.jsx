import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Bell, Check, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import Skeleton from "@/components/Skeleton";

const RECURRENCES = [
  "None","Daily","Weekly","Monthly","Weekdays","Weekends","Bi-weekly",
  "Every Monday","Every Tuesday","Every Wednesday","Every Thursday","Every Friday",
  "Quarterly","Half-Yearly","Yearly",
];
const EMPTY = { title:"", notes:"", fire_at:"", recurrence:"None" };

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [aiText,    setAiText]    = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview,   setPreview]   = useState(null);
  const [newRow,    setNewRow]    = useState({ ...EMPTY });
  const [filter,    setFilter]    = useState({ status:"" });

  const load = useCallback(async () => {
    try { const { data } = await api.get("/reminders"); setReminders(data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/reminder",{ text:aiText });
      setPreview({ fields:[
        { key:"title",      label:"Title",      value:data.title,              confidence:data.confidence },
        { key:"fire_at",    label:"Date & Time", value:data.fire_at,           confidence:data.confidence },
        { key:"recurrence", label:"Recurrence", value:data.recurrence||"None", confidence:"medium" },
        { key:"notes",      label:"Notes",      value:data.notes,              confidence:"low" },
      ], raw:data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/reminders",{ ...preview.raw,...values });
      toast.success("Reminder set");
      setPreview(null); setAiText(""); load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.title.trim() || !newRow.fire_at) return;
    try { await api.post("/reminders",{ ...newRow }); toast.success("Reminder set"); setNewRow({...EMPTY}); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed to set reminder"); }
  };

  const dismiss = async (id) => {
    try { await api.patch(`/reminders/${id}`,{ dismissed:true }); toast.success("Dismissed"); load(); }
    catch { toast.error("Failed to dismiss"); }
  };

  const del = async (id) => {
    try { await api.delete(`/reminders/${id}`); toast.success("Moved to trash"); load(); }
    catch { toast.error("Failed to delete reminder"); }
  };

  const visible = reminders.filter(r => {
    if (filter.status==="upcoming")  return !r.dismissed;
    if (filter.status==="dismissed") return r.dismissed;
    return true;
  }).sort((a,b) => {
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    return new Date(a.fire_at||0) - new Date(b.fire_at||0);
  });

  const upcoming = reminders.filter(r => !r.dismissed && new Date(r.fire_at) > new Date()).length;
  const overdue  = reminders.filter(r => !r.dismissed && new Date(r.fire_at) <= new Date()).length;

  if (loading) return <Skeleton.Page rows={5} />;

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="mm-page-title">Reminders</h1>
          <p className="mm-page-sub">
            {upcoming} upcoming
            {overdue > 0 && <span style={{ color:"#E0A052" }}> · {overdue} due</span>}
          </p>
        </div>
        <div className="flex gap-1">
          {["","upcoming","dismissed"].map(s => (
            <button key={s||"all"} onClick={() => setFilter({ status:s })}
                    className={`mm-filter-tab capitalize ${filter.status===s ? "active" : ""}`}>
              {s||"All"}
            </button>
          ))}
        </div>
      </div>

      {/* ── AI bar ── */}
      <div className="flex gap-0 mb-5">
        <input value={aiText} onChange={e => setAiText(e.target.value)}
               onKeyDown={e => e.key==="Enter" && parseAi()}
               placeholder='"Remind me to call Priya tomorrow at 10am"'
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
          <p className="mm-empty-title">No reminders</p>
          <p className="mm-empty-desc">Set reminders for important events and follow-ups.</p>
        </div>
      )}

      {/* ── List ── */}
      <div className="space-y-0 mb-5">
        {visible.map(r => {
          const due      = r.fire_at && new Date(r.fire_at) <= new Date() && !r.dismissed;
          const fireDate = r.fire_at ? new Date(r.fire_at) : null;
          return (
            <div key={r.id}
                 className="mm-row flex items-start gap-3 px-4 py-3 border-b"
                 style={{
                   borderColor:"var(--mm-border)",
                   opacity: r.dismissed ? 0.5 : 1,
                   borderLeft: due ? "2px solid #E0A052" : "2px solid transparent",
                 }}>

              {/* Dismiss toggle */}
              <button onClick={() => dismiss(r.id)}
                      title={r.dismissed ? "Already dismissed" : "Dismiss"}
                      className={`mm-check mt-0.5 ${r.dismissed ? "done" : ""}`}
                      style={{
                        borderColor: r.dismissed ? "#52C77A" : due ? "#E0A052" : "var(--mm-border)",
                      }}>
                {r.dismissed && <Check size={10} style={{ color:"#52C77A" }} />}
                {!r.dismissed && due && <Bell size={10} style={{ color:"#E0A052" }} />}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium"
                        style={{ color:"var(--mm-text)",
                                 textDecoration:r.dismissed?"line-through":"none" }}>
                    {r.title}
                  </span>
                  {r.confidence && r.confidence !== "high" &&
                    <ConfidenceBadge level={r.confidence} size="xs" />}
                  {r.recurrence && r.recurrence !== "None" && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 mm-label"
                          style={{ background:"var(--mm-surface-2)" }}>
                      <RefreshCw size={8} style={{ marginRight:2 }} /> {r.recurrence}
                    </span>
                  )}
                </div>
                {r.notes && (
                  <p className="text-xs mt-0.5" style={{ color:"var(--mm-muted)" }}>{r.notes}</p>
                )}
                {r.source_info && (
                  <p className="text-xs mt-0.5" style={{ color:"var(--mm-muted)" }}>
                    Linked: {r.source_info.type} — {r.source_info.label}
                  </p>
                )}
              </div>

              {/* Date + delete */}
              <div className="text-right flex-shrink-0">
                {fireDate && (
                  <>
                    <div className="text-xs font-medium"
                         style={{ color:due ? "#E0A052" : "var(--mm-muted)" }}>
                      {fireDate.toLocaleDateString("en-IN",{ day:"numeric", month:"short" })}
                    </div>
                    <div className="text-xs" style={{ color:"var(--mm-muted)" }}>
                      {fireDate.toLocaleTimeString("en-IN",{ hour:"2-digit", minute:"2-digit" })}
                    </div>
                  </>
                )}
                <button onClick={() => del(r.id)} title="Move to trash"
                        className="mm-icon-btn danger mt-1">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── New row ── */}
      <div className="mm-card p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <input value={newRow.title}
                 onChange={e => setNewRow(r=>({...r,title:e.target.value}))}
                 placeholder="Reminder title" className="mm-form-input" />
          <input type="datetime-local" value={newRow.fire_at}
                 onChange={e => setNewRow(r=>({...r,fire_at:e.target.value}))}
                 className="mm-form-input" />
          <select value={newRow.recurrence}
                  onChange={e => setNewRow(r=>({...r,recurrence:e.target.value}))}
                  className="mm-form-input">
            {RECURRENCES.map(rc => <option key={rc}>{rc}</option>)}
          </select>
          <button onClick={addManual}
                  className="mm-btn-gold flex items-center justify-center gap-2">
            <Plus size={13} /> Add Reminder
          </button>
        </div>
      </div>

      {preview && (
        <EditablePreview title="Review Reminder" fields={preview.fields}
                         onConfirm={saveFromPreview} onDiscard={() => setPreview(null)} />
      )}
    </div>
  );
}
