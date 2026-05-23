import React, { useState, useRef, useEffect } from "react";
import { X, Loader } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import EditablePreview from "@/components/EditablePreview";

const TYPES = ["Task","Routine","Reminder","Note","Transaction"];

export default function QuickAdd({ onClose }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("Task");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const parseEndpoints = {
    Task: "/parse/task", Routine: "/parse/routine",
    Reminder: "/parse/reminder", Note: "/parse/note", Transaction: "/parse/transaction"
  };

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post(parseEndpoints[type], { text });
      setParsed(data);
      const fields = buildFields(type, data);
      setPreview({ fields, data });
    } catch {
      toast.error("Parse failed. Try again.");
    }
    setLoading(false);
  };

  const save = async (values) => {
    setLoading(true);
    try {
      const endpoints = {
        Task: "/tasks", Routine: "/routines", Reminder: "/reminders",
        Note: "/notes", Transaction: "/transactions"
      };
      await api.post(endpoints[type], { ...parsed, ...values });
      toast.success(`✓ ${type} saved`);
      onClose();
    } catch { toast.error("Save failed."); }
    setLoading(false);
  };

  if (preview) {
    return <EditablePreview
      title={`Review ${type}`}
      fields={preview.fields}
      onConfirm={save}
      onDiscard={() => { setPreview(null); setParsed(null); }}
    />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4"
         style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl overflow-hidden animate-slide-up"
           style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
        <div className="flex items-center justify-between px-4 py-3"
             style={{ borderBottom: "1px solid var(--mm-border)" }}>
          <span className="font-semibold text-sm mm-font-display" style={{ color: "var(--mm-text)" }}>Quick Add</span>
          <button onClick={onClose} style={{ color: "var(--mm-muted)" }}><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                      className="px-3 py-1 rounded-full text-xs transition-colors"
                      style={{
                        background: type === t ? "var(--mm-gold)" : "var(--mm-surface-2)",
                        color: type === t ? "#0A0A0A" : "var(--mm-muted)",
                        border: `1px solid ${type === t ? "transparent" : "var(--mm-border)"}`
                      }}>
                {t}
              </button>
            ))}
          </div>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); parse(); } }}
            placeholder={placeholders[type]}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
            style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                     color: "var(--mm-text)" }}
          />
          <button
            onClick={parse}
            disabled={!text.trim() || loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
            {loading ? <Loader size={14} className="animate-spin" /> : null}
            Parse & Review
          </button>
        </div>
      </div>
    </div>
  );
}

const placeholders = {
  Task: 'e.g. "Call Priya about Q2 deck tomorrow #Finance"',
  Routine: 'e.g. "Morning meditation daily personal"',
  Reminder: 'e.g. "Follow up with Rajesh on May 25 at 9am"',
  Note: 'e.g. "Q2 planning — mobile redesign is priority"',
  Transaction: 'e.g. "Paid 85000 rent to Commercial Properties NEFT"',
};

function buildFields(type, data) {
  const conf = data.confidence || "medium";
  if (type === "Task") return [
    { key: "task", label: "Title", value: data.task, confidence: conf },
    { key: "date", label: "Due date", value: data.date, confidence: conf },
    { key: "name", label: "Person", value: data.name, confidence: "medium" },
    { key: "group", label: "Group", value: data.group, confidence: "medium" },
    { key: "status", label: "Status", value: data.status || "Pending", confidence: "high" },
  ];
  if (type === "Routine") return [
    { key: "activity", label: "Activity", value: data.activity, confidence: conf },
    { key: "group", label: "Group", value: data.group, confidence: "medium" },
    { key: "frequency", label: "Frequency", value: data.frequency, confidence: "medium" },
    { key: "priority", label: "Priority", value: data.priority || "Medium", confidence: "high" },
  ];
  if (type === "Reminder") return [
    { key: "title", label: "Title", value: data.title, confidence: conf },
    { key: "fire_at", label: "When", value: data.fire_at, confidence: conf },
    { key: "recurrence", label: "Recurrence", value: data.recurrence || "none", confidence: "medium" },
    { key: "notes", label: "Notes", value: data.notes, confidence: "medium" },
  ];
  if (type === "Note") return [
    { key: "title", label: "Title", value: data.title, confidence: conf },
    { key: "body", label: "Body", value: data.body, confidence: "medium" },
  ];
  if (type === "Transaction") return [
    { key: "vendor", label: "Vendor", value: data.vendor, confidence: conf },
    { key: "amount", label: "Amount", value: data.amount, confidence: conf },
    { key: "category", label: "Category", value: data.category, confidence: "medium" },
    { key: "details", label: "Details", value: data.details, confidence: "medium" },
    { key: "mode", label: "Mode", value: data.mode, confidence: "low" },
  ];
  return [];
}
