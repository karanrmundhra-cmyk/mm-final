import React, { useState, useEffect, useRef } from "react";
import { Save, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function QuickNote({ onClose }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    // Restore draft
    const draft = sessionStorage.getItem("mm_quicknote_draft");
    if (draft) setText(draft);
  }, []);

  // Persist draft on every keystroke
  const handleChange = (e) => {
    setText(e.target.value);
    sessionStorage.setItem("mm_quicknote_draft", e.target.value);
  };

  const save = async () => {
    if (!text.trim()) { onClose(); return; }
    setSaving(true);
    try {
      const title = text.split("\n")[0].slice(0, 80) || "Quick note";
      await api.post("/notes", { title, content: text });
      sessionStorage.removeItem("mm_quicknote_draft");
      toast.success("Note saved to Notes");
      onClose();
    } catch {
      toast.error("Failed to save note");
    }
    setSaving(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape")                        { save(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)" }}
      onClick={e => e.target === e.currentTarget && save()}
    >
      <div
        className="w-full max-w-lg animate-scale-in"
        style={{
          background: "var(--mm-surface)",
          border: "1px solid var(--mm-border-gold)",
          borderRadius: 28,
          boxShadow: "var(--elev-modal)",
          padding: 24,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="mm-label">Scratch Pad</span>
            <kbd className="text-xs px-1.5 py-0.5"
                 style={{ background: "var(--mm-surface-3)", color: "var(--mm-muted)",
                          border: "1px solid var(--mm-border)", borderRadius: 6, fontSize: 9 }}>
              ⌘⇧N
            </kbd>
          </div>
          <button onClick={save} className="mm-icon-btn"><X size={14} /></button>
        </div>

        {/* Editor */}
        <div className="mm-quick-note">
          <textarea
            ref={ref}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Capture a thought, idea, or quick note…"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3"
             style={{ borderTop: "1px solid var(--mm-border)" }}>
          <span className="text-xs" style={{ color: "var(--mm-muted)" }}>
            {text.length > 0 ? `${text.length} chars · ` : ""}⌘S to save
          </span>
          <button onClick={save} disabled={saving}
                  className="mm-btn-gold flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50">
            <Save size={11} />
            {saving ? "Saving…" : "Save to Notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
