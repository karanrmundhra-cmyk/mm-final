import React, { useState } from "react";
import { X, Check, Edit3, Trash2 } from "lucide-react";
import ConfidenceBadge from "@/components/ConfidenceBadge";

/**
 * Modal shown before saving any AI-parsed item.
 * Props:
 *   fields: [{key, label, value, confidence}]
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
         style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" }}>

      <div className="w-full max-w-md overflow-hidden animate-scale-in"
           style={{
             background:"var(--mm-surface)",
             border:"1px solid var(--mm-border-gold)",
             borderRadius: 32,
             boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,175,55,0.08)",
           }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
             style={{ borderBottom:"1px solid var(--mm-border)" }}>
          <div>
            <h2 className="mm-font-display text-lg" style={{ color:"var(--mm-text)", fontWeight:400, letterSpacing:"-0.01em" }}>
              {title}
            </h2>
            {hasLow && (
              <p className="mm-label mt-1" style={{ color:"#E05252" }}>
                Low confidence — please review
              </p>
            )}
          </div>
          <button onClick={() => setShowDiscard(true)} title="Discard"
                  className="mm-icon-btn">
            <X size={15} />
          </button>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-4 max-h-96 overflow-y-auto">
          {fields.map(f => (
            <div key={f.key} className="flex items-start gap-3">
              <span className="text-xs w-24 flex-shrink-0 pt-2 mm-label">
                {f.label}
              </span>
              <div className="flex-1">
                {editing === f.key ? (
                  <input
                    autoFocus
                    value={values[f.key]}
                    onChange={e => setValues(v => ({ ...v, [f.key]:e.target.value }))}
                    onBlur={() => setEditing(null)}
                    onKeyDown={e => e.key === "Enter" && setEditing(null)}
                    className="mm-form-input text-sm"
                    style={{ border:"1px solid var(--mm-gold)" }}
                  />
                ) : (
                  <button onClick={() => setEditing(f.key)}
                          className="w-full text-left text-sm px-3 py-2 transition-colors"
                          style={{
                            color:"var(--mm-text)", minHeight:32, borderRadius:12,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.06)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    {values[f.key] || <span style={{ color:"var(--mm-muted)" }}>—</span>}
                  </button>
                )}
              </div>
              <ConfidenceBadge level={f.confidence} />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-6 py-5"
             style={{ borderTop:"1px solid var(--mm-border)" }}>
          <button onClick={() => onConfirm(values)}
                  className="mm-btn-gold flex-1 flex items-center justify-center gap-2">
            <Check size={13} /> Confirm &amp; Save
          </button>
          <button onClick={() => setEditing(null)} title="Edit fields"
                  className="mm-btn-ghost px-4">
            <Edit3 size={13} />
          </button>
          <button onClick={() => setShowDiscard(true)} title="Discard"
                  className="mm-icon-btn danger"
                  style={{ padding:"10px 14px" }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Discard confirm */}
      {showDiscard && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4"
             style={{ background:"rgba(0,0,0,0.6)" }}>
          <div className="p-6 max-w-sm w-full animate-scale-in"
               style={{
                 background:"var(--mm-surface-2)",
                 border:"1px solid var(--mm-border)",
                 borderRadius: 24,
                 boxShadow:"var(--elev-4)",
               }}>
            <p className="text-sm mb-5 leading-relaxed" style={{ color:"var(--mm-text)" }}>
              Discard this item? The parsed data will be lost.
            </p>
            <div className="flex gap-2">
              <button onClick={onDiscard}
                      className="flex-1 py-2.5 text-sm font-medium"
                      style={{ background:"#E0505018", color:"#E05252",
                               border:"1px solid #E0505033", cursor:"pointer", borderRadius:20 }}>
                Yes, discard
              </button>
              <button onClick={() => setShowDiscard(false)}
                      className="flex-1 py-2.5 text-sm mm-btn-ghost">
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
