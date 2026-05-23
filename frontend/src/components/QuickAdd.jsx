import React, { useState, useRef, useEffect } from "react";
import { X, Loader } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import EditablePreview from "@/components/EditablePreview";

const TYPES = ["Task","Routine","Reminder","Note","Transaction"];

const PLACEHOLDERS = {
  Task:        '"Call Priya about Q2 deck tomorrow #Finance"',
  Routine:     '"Morning meditation daily personal"',
  Reminder:    '"Follow up with Rajesh on May 25 at 9am"',
  Note:        '"Q2 planning — mobile redesign is priority"',
  Transaction: '"Paid 85000 rent to Commercial Properties NEFT"',
};

export default function QuickAdd({ onClose }) {
  const [text,    setText]    = useState("");
  const [type,    setType]    = useState("Task");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [parsed,  setParsed]  = useState(null);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const ENDPOINTS = {
    Task:"/parse/task", Routine:"/parse/routine",
    Reminder:"/parse/reminder", Note:"/parse/note", Transaction:"/parse/transaction",
  };

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post(ENDPOINTS[type],{ text });
      setParsed(data);
      setPreview({ fields:buildFields(type,data), data });
    } catch { toast.error("Parse failed. Try again."); }
    setLoading(false);
  };

  const save = async (values) => {
    setLoading(true);
    try {
      const SAVE = { Task:"/tasks", Routine:"/routines", Reminder:"/reminders", Note:"/notes", Transaction:"/transactions" };
      await api.post(SAVE[type],{ ...parsed,...values });
      toast.success(`${type} saved`);
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 p-4"
         style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)" }}
         onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-md overflow-hidden animate-scale-in"
           style={{ background:"var(--mm-surface)", border:"1px solid var(--mm-border-gold)",
                    borderRadius:32, boxShadow:"0 24px 80px rgba(0,0,0,0.8)" }}>

        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom:"1px solid var(--mm-border)" }}>
          <span className="mm-font-display text-base"
                style={{ color:"var(--mm-text)", fontWeight:400 }}>
            Quick Add
          </span>
          <button onClick={onClose} title="Close" className="mm-icon-btn">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type selector */}
          <div className="flex gap-1">
            {TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                      className={`mm-filter-tab flex-1 text-center ${type===t ? "active" : ""}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); parse(); } }}
            placeholder={PLACEHOLDERS[type]}
            rows={3}
            className="mm-form-input resize-none"
            style={{ fontFamily:"'Inter', sans-serif" }}
          />

          <button onClick={parse} disabled={!text.trim()||loading}
                  className="mm-btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-40">
            {loading ? <Loader size={13} className="animate-spin" /> : null}
            {loading ? "Parsing…" : "Parse & Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildFields(type, data) {
  const conf = data.confidence || "medium";
  if (type === "Task") return [
    { key:"task",    label:"Title",   value:data.task,               confidence:conf },
    { key:"date",    label:"Due date",value:data.date,               confidence:conf },
    { key:"name",    label:"Person",  value:data.name,               confidence:"medium" },
    { key:"group",   label:"Group",   value:data.group,              confidence:"medium" },
    { key:"status",  label:"Status",  value:data.status||"Pending",  confidence:"high" },
  ];
  if (type === "Routine") return [
    { key:"activity",  label:"Activity",  value:data.activity,           confidence:conf },
    { key:"group",     label:"Group",     value:data.group,              confidence:"medium" },
    { key:"frequency", label:"Frequency", value:data.frequency,          confidence:"medium" },
    { key:"priority",  label:"Priority",  value:data.priority||"Medium", confidence:"high" },
  ];
  if (type === "Reminder") return [
    { key:"title",      label:"Title",      value:data.title,              confidence:conf },
    { key:"fire_at",    label:"When",       value:data.fire_at,            confidence:conf },
    { key:"recurrence", label:"Recurrence", value:data.recurrence||"None", confidence:"medium" },
    { key:"notes",      label:"Notes",      value:data.notes,              confidence:"medium" },
  ];
  if (type === "Note") return [
    { key:"title", label:"Title", value:data.title, confidence:conf },
    { key:"body",  label:"Body",  value:data.body,  confidence:"medium" },
  ];
  if (type === "Transaction") return [
    { key:"vendor",   label:"Vendor",   value:data.vendor,   confidence:conf },
    { key:"amount",   label:"Amount",   value:data.amount,   confidence:conf },
    { key:"category", label:"Category", value:data.category, confidence:"medium" },
    { key:"details",  label:"Details",  value:data.details,  confidence:"medium" },
    { key:"mode",     label:"Mode",     value:data.mode,     confidence:"low" },
  ];
  return [];
}
