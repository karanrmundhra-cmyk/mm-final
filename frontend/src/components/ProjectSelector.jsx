import React, { useState } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { useProjects } from "@/lib/projects";
import { api } from "@/lib/api";

export default function ProjectSelector() {
  const { projects, current, select, reload } = useProjects();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const addProject = async () => {
    if (!newName.trim()) return;
    await api.post("/projects", { name: newName.trim() });
    setNewName(""); setAdding(false);
    await reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
        style={{ border: "1px solid var(--mm-border)", color: "var(--mm-text)" }}>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
             style={{ background: current?.color || "var(--mm-gold)" }} />
        <span className="max-w-32 truncate mm-font-display">{current?.name || "Personal"}</span>
        <ChevronDown size={12} style={{ color: "var(--mm-muted)" }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-52 rounded-xl z-20 overflow-hidden animate-fade-in"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { select(p.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || "var(--mm-gold)" }} />
                <span className="flex-1 text-left truncate" style={{ color: "var(--mm-text)" }}>{p.name}</span>
                {p.id === current?.id && <Check size={12} style={{ color: "var(--mm-gold)" }} />}
              </button>
            ))}
            <div style={{ borderTop: "1px solid var(--mm-border)" }}>
              {adding ? (
                <div className="px-3 py-2 flex gap-2">
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                         onKeyDown={e => { if (e.key === "Enter") addProject(); if (e.key === "Escape") setAdding(false); }}
                         placeholder="Project name"
                         className="flex-1 text-sm rounded px-2 py-1 outline-none"
                         style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                                  color: "var(--mm-text)" }} />
                  <button onClick={addProject} className="text-xs px-2 py-1 rounded"
                          style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>Add</button>
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
