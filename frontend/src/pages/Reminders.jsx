import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Bell, Check, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDate, isOverdue } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";

const RECURRENCES = ["None","Daily","Weekly","Monthly","Weekdays","Weekends","Bi-weekly","Every Monday","Every Tuesday","Every Wednesday","Every Thursday","Every Friday","Quarterly","Half-Yearly","Yearly"];
const EMPTY = { title: "", notes: "", fire_at: "", recurrence: "None" };

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newRow, setNewRow] = useState({ ...EMPTY });
  const [filter, setFilter] = useState({ status: "" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/reminders");
      setReminders(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/reminder", { text: aiText });
      const fields = [
        { key: "title", label: "Title", value: data.title, confidence: data.confidence },
        { key: "fire_at", label: "Date & Time", value: data.fire_at, confidence: data.confidence },
        { key: "recurrence", label: "Recurrence", value: data.recurrence || "None", confidence: "medium" },
        { key: "notes", label: "Notes", value: data.notes, confidence: "low" },
      ];
      setPreview({ fields, raw: data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/reminders", { ...preview.raw, ...values });
      toast.success("✓ Reminder set");
      setPreview(null); setAiText("");
      load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.title.trim() || !newRow.fire_at) return;
    try {
      await api.post("/reminders", { ...newRow });
      toast.success("✓ Reminder set");
      setNewRow({ ...EMPTY });
      load();
    } catch {}
  };

  const update = async (id, patch) => {
    setReminders(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
    try { await api.patch(`/reminders/${id}`, patch); } catch {}
  };

  const dismiss = async (id) => {
    try {
      await api.patch(`/reminders/${id}`, { dismissed: true });
      toast.success("✓ Dismissed");
      load();
    } catch {}
  };

  const del = async (id) => {
    try { await api.delete(`/reminders/${id}`); toast.success("✓ Moved to trash"); load(); } catch {}
  };

  const visible = reminders.filter(r => {
    if (filter.status === "upcoming") return !r.dismissed;
    if (filter.status === "dismissed") return r.dismissed;
    return true;
  }).sort((a, b) => {
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    return new Date(a.fire_at || 0) - new Date(b.fire_at || 0);
  });

  if (loading) return <LoadingPage />;

  const upcoming = reminders.filter(r => !r.dismissed && new Date(r.fire_at) > new Date()).length;
  const overdue = reminders.filter(r => !r.dismissed && new Date(r.fire_at) <= new Date()).length;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Reminders</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>
            {upcoming} upcoming{overdue > 0 ? ` · ${overdue} due` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {["", "upcoming", "dismissed"].map(s => (
            <button key={s || "all"} onClick={() => setFilter({ status: s })}
                    className="px-3 py-1.5 rounded-lg text-xs capitalize"
                    style={{
                      background: filter.status === s ? "var(--mm-gold)" : "var(--mm-surface-2)",
                      color: filter.status === s ? "#0A0A0A" : "var(--mm-muted)",
                      border: "1px solid var(--mm-border)"
                    }}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* AI bar */}
      <div className="flex gap-2 mb-4">
        <input value={aiText} onChange={e => setAiText(e.target.value)}
               onKeyDown={e => e.key === "Enter" && parseAi()}
               placeholder='e.g. "Remind me to call Priya tomorrow at 10am"'
               className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
        <button onClick={parseAi} disabled={!aiText.trim() || aiLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
          {aiLoading ? <Loader size={14} className="animate-spin" /> : null} Parse
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🔔" title="No reminders"
          desc="Set reminders for important events and follow-ups."
          example='"Remind me to file GST returns on the 20th every month"' />
      ) : (
        <div className="space-y-2 mb-4">
          {visible.map(r => {
            const due = r.fire_at && new Date(r.fire_at) <= new Date() && !r.dismissed;
            const fireDate = r.fire_at ? new Date(r.fire_at) : null;
            return (
              <div key={r.id}
                   className="mm-card px-4 py-3 flex items-start gap-3"
                   style={{ opacity: r.dismissed ? 0.5 : 1, borderColor: due ? "#E0A05244" : "var(--mm-border)" }}>
                <button onClick={() => dismiss(r.id)}
                        className="w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ borderColor: r.dismissed ? "#52C77A" : due ? "#E0A052" : "var(--mm-border)",
                                 background: r.dismissed ? "#52C77A22" : "transparent" }}
                        title="Dismiss">
                  {r.dismissed && <Check size={12} style={{ color: "#52C77A" }} />}
                  {!r.dismissed && due && <Bell size={12} style={{ color: "#E0A052" }} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--mm-text)", textDecoration: r.dismissed ? "line-through" : "none" }}>
                      {r.title}
                    </span>
                    {r.confidence && r.confidence !== "high" && <ConfidenceBadge level={r.confidence} size="xs" />}
                    {r.recurrence && r.recurrence !== "None" && (
                      <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)" }}>
                        <RefreshCw size={9} /> {r.recurrence}
                      </span>
                    )}
                  </div>
                  {r.notes && <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>{r.notes}</p>}
                  {r.source_info && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>
                      Linked: {r.source_info.type} — {r.source_info.label}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {fireDate && (
                    <div className="text-xs font-medium" style={{ color: due ? "#E0A052" : "var(--mm-muted)" }}>
                      {fireDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  )}
                  {fireDate && (
                    <div className="text-xs" style={{ color: "var(--mm-muted)" }}>
                      {fireDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  <button onClick={() => del(r.id)} className="mt-1 p-1 rounded hover:bg-white/10"
                          style={{ color: "#E05252" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New row */}
      <div className="mm-card p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <input value={newRow.title} onChange={e => setNewRow(r => ({ ...r, title: e.target.value }))}
                 placeholder="Reminder title"
                 className="rounded-lg px-3 py-2 text-sm outline-none md:col-span-1"
                 style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          <input type="datetime-local" value={newRow.fire_at} onChange={e => setNewRow(r => ({ ...r, fire_at: e.target.value }))}
                 className="rounded-lg px-3 py-2 text-sm outline-none"
                 style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          <select value={newRow.recurrence} onChange={e => setNewRow(r => ({ ...r, recurrence: e.target.value }))}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }}>
            {RECURRENCES.map(rc => <option key={rc}>{rc}</option>)}
          </select>
          <button onClick={addManual}
                  className="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium"
                  style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
            <Plus size={14} /> Add Reminder
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

function EmptyState({ icon, title, desc, example }) {
  return (
    <div className="flex flex-col items-center py-20 gap-4 text-center">
      <span style={{ fontSize: 48 }}>{icon}</span>
      <h2 className="text-lg font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>{title}</h2>
      <p className="text-sm max-w-xs" style={{ color: "var(--mm-muted)" }}>{desc}</p>
      {example && <p className="text-xs italic" style={{ color: "var(--mm-muted)" }}>Example: {example}</p>}
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
