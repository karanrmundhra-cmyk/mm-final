import React, { useState } from "react";
import { X, Check, Edit3, Trash2 } from "lucide-react";
import ConfidenceBadge from "@/components/ConfidenceBadge";

/**
 * Modal shown before saving any AI-parsed item.
 * Props:
 *   fields: [{key, label, value, confidence, type}]
 *   title: string
 *   onConfirm(data): called with edited field values
 *   onDiscard(): called when user discards
 */
export default function EditablePreview({ title = "Review before saving", fields, onConfirm, onDiscard }) {
  const [values, setValues] = useState(() => {
    const v = {};
    fields.forEach(f => { v[f.key] = f.value || ""; });
    return v;
  });
  const [editing, setEditing] = useState(null);
  const [showDiscard, setShowDiscard] = useState(false);

  const hasLow = fields.some(f => f.confidence === "low");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-xl overflow-hidden animate-slide-up"
           style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: "1px solid var(--mm-border)" }}>
          <div>
            <h2 className="font-semibold text-sm mm-font-display" style={{ color: "var(--mm-text)" }}>
              {title}
            </h2>
            {hasLow && (
              <p className="text-xs mt-0.5" style={{ color: "#E05252" }}>
                Some fields have low confidence — please review
              </p>
            )}
          </div>
          <button onClick={() => setShowDiscard(true)} style={{ color: "var(--mm-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-3 max-h-96 overflow-y-auto">
          {fields.map(f => (
            <div key={f.key} className="flex items-start gap-3">
              <span className="text-xs w-28 flex-shrink-0 pt-1" style={{ color: "var(--mm-muted)" }}>
                {f.label}
              </span>
              <div className="flex-1">
                {editing === f.key ? (
                  <input
                    autoFocus
                    value={values[f.key]}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    onBlur={() => setEditing(null)}
                    onKeyDown={e => e.key === "Enter" && setEditing(null)}
                    className="w-full rounded px-2 py-1 text-sm"
                    style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-gold)",
                             color: "var(--mm-text)", outline: "none" }}
                  />
                ) : (
                  <button
                    onClick={() => setEditing(f.key)}
                    className="w-full text-left text-sm px-2 py-1 rounded hover:bg-white/5"
                    style={{ color: "var(--mm-text)", minHeight: 28 }}
                  >
                    {values[f.key] || <span style={{ color: "var(--mm-muted)" }}>—</span>}
                  </button>
                )}
              </div>
              <ConfidenceBadge level={f.confidence} />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-4"
             style={{ borderTop: "1px solid var(--mm-border)" }}>
          <button
            onClick={() => onConfirm(values)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
            <Check size={14} />
            Confirm
          </button>
          <button
            onClick={() => setEditing(null)}
            className="px-4 py-2.5 rounded-lg text-sm"
            style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)",
                     border: "1px solid var(--mm-border)" }}>
            <Edit3 size={14} />
          </button>
          <button
            onClick={() => setShowDiscard(true)}
            className="px-4 py-2.5 rounded-lg text-sm"
            style={{ color: "#E05252", border: "1px solid #E0505033" }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Discard confirm */}
      {showDiscard && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-xl p-6 max-w-sm w-full"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
            <p className="text-sm mb-4" style={{ color: "var(--mm-text)" }}>
              Discard this item? The original text will be lost.
            </p>
            <div className="flex gap-2">
              <button onClick={onDiscard}
                      className="flex-1 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "#E0505022", color: "#E05252", border: "1px solid #E0505033" }}>
                Yes, discard
              </button>
              <button onClick={() => setShowDiscard(false)}
                      className="flex-1 py-2 rounded-lg text-sm"
                      style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)" }}>
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
