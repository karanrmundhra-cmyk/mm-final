import React, { useState } from "react";
import { ChevronDown, Plus, Check, Pencil, X } from "lucide-react";
import { useProjects } from "@/lib/projects";
import { api } from "@/lib/api";

const SPACE_COLORS = [
  "#C9A961", // Gold
  "#7B9BF2", // Blue
  "#82C87D", // Green
  "#E07B7B", // Rose
  "#9B7BE8", // Purple
  "#E8A87C", // Amber
  "#7BC8C8", // Teal
  "#D4A0D4", // Lavender
];

export default function ProjectSelector() {
  const { projects, current, select, reload } = useProjects();
  const [open,       setOpen]       = useState(false);
  const [adding,     setAdding]     = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newColor,   setNewColor]   = useState(SPACE_COLORS[0]);
  const [editingId,  setEditingId]  = useState(null);
  const [editName,   setEditName]   = useState("");
  const [editColor,  setEditColor]  = useState(SPACE_COLORS[0]);

  const addSpace = async () => {
    if (!newName.trim()) return;
    await api.post("/projects", { name: newName.trim(), color: newColor });
    setNewName(""); setNewColor(SPACE_COLORS[0]); setAdding(false);
    await reload();
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    await api.patch(`/projects/${id}`, { name: editName.trim(), color: editColor });
    setEditingId(null);
    await reload();
  };

  const startEdit = (p, e) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditName(p.name);
    setEditColor(p.color || SPACE_COLORS[0]);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
        style={{ border: "1px solid var(--mm-border)", color: "var(--mm-text)" }}>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
             style={{ background: current?.color || "var(--mm-gold)" }} />
        <span className="max-w-28 truncate mm-font-display">{current?.name || "Personal"}</span>
        <ChevronDown size={12} style={{ color: "var(--mm-muted)" }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setAdding(false); setEditingId(null); }} />
          <div className="absolute top-full right-0 mt-1 w-60 rounded-xl z-20 overflow-hidden animate-fade-in"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>

            {/* Header */}
            <div className="px-3 pt-3 pb-1">
              <p style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--mm-gold)",
                          fontFamily: "'Outfit', sans-serif" }}>
                Spaces
              </p>
            </div>

            {/* Space list */}
            {projects.map(p => (
              <div key={p.id}>
                {editingId === p.id ? (
                  /* Edit row */
                  <div className="px-3 py-2 space-y-2" onClick={e => e.stopPropagation()}>
                    <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                           onKeyDown={e => { if (e.key === "Enter") saveEdit(p.id); if (e.key === "Escape") setEditingId(null); }}
                           className="w-full text-xs rounded px-2 py-1 outline-none"
                           style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                                    color: "var(--mm-text)", fontFamily: "'Outfit', sans-serif" }} />
                    <div className="flex gap-1.5 flex-wrap">
                      {SPACE_COLORS.map(c => (
                        <button key={c} onClick={() => setEditColor(c)}
                                style={{
                                  width: 18, height: 18, borderRadius: "50%", background: c, border: "none",
                                  cursor: "pointer", outline: editColor === c ? `2px solid ${c}` : "none",
                                  outlineOffset: 2,
                                }} />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditingId(null)}
                              className="text-xs px-2 py-1 rounded flex-1"
                              style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)", border: "none", cursor: "pointer" }}>
                        Cancel
                      </button>
                      <button onClick={() => saveEdit(p.id)}
                              className="text-xs px-2 py-1 rounded flex-1"
                              style={{ background: "var(--mm-gold)", color: "#0A0A0A", border: "none", cursor: "pointer", fontWeight: 600 }}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal row */
                  <button
                    onClick={() => { select(p.id); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors group">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color || "var(--mm-gold)" }} />
                    <span className="flex-1 text-left truncate" style={{ color: "var(--mm-text)" }}>{p.name}</span>
                    <button onClick={e => startEdit(p, e)}
                            className="opacity-0 group-hover:opacity-60 transition-opacity p-0.5"
                            style={{ color: "var(--mm-muted)" }}>
                      <Pencil size={10} />
                    </button>
                    {p.id === current?.id && <Check size={12} style={{ color: "var(--mm-gold)" }} />}
                  </button>
                )}
              </div>
            ))}

            {/* Add new space */}
            <div style={{ borderTop: "1px solid var(--mm-border)" }}>
              {adding ? (
                <div className="px-3 py-2 space-y-2" onClick={e => e.stopPropagation()}>
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                         onKeyDown={e => { if (e.key === "Enter") addSpace(); if (e.key === "Escape") setAdding(false); }}
                         placeholder="Space name"
                         className="w-full text-xs rounded px-2 py-1 outline-none"
                         style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                                  color: "var(--mm-text)", fontFamily: "'Outfit', sans-serif" }} />
                  <div className="flex gap-1.5 flex-wrap">
                    {SPACE_COLORS.map(c => (
                      <button key={c} onClick={() => setNewColor(c)}
                              style={{
                                width: 18, height: 18, borderRadius: "50%", background: c, border: "none",
                                cursor: "pointer", outline: newColor === c ? `2px solid ${c}` : "none",
                                outlineOffset: 2,
                              }} />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setAdding(false)}
                            className="text-xs px-2 py-1 rounded flex-1"
                            style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)", border: "none", cursor: "pointer" }}>
                      Cancel
                    </button>
                    <button onClick={addSpace}
                            className="text-xs px-2 py-1 rounded flex-1"
                            style={{ background: "var(--mm-gold)", color: "#0A0A0A", border: "none", cursor: "pointer", fontWeight: 600 }}>
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5"
                        style={{ color: "var(--mm-muted)" }}>
                  <Plus size={12} /> New Space
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
