import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Edit2, Check, X, Loader,
  CheckSquare, RefreshCw, FileText, DollarSign, FolderOpen
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Skeleton from "@/components/Skeleton";
import { useNavigate } from "react-router-dom";

const PROJECT_COLORS = [
  "#D4AF37","#C9A961","#B8960C","#E8CC6B",
  "#F0EDE8","#A89880","#887060","#706050",
  "#D4AF37","#C9A961","#A89880","#706050",
];

const EMPTY = { name: "", color: "#D4AF37", description: "" };

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [counts, setCounts]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing]   = useState(null); // project id being edited
  const [newForm, setNewForm]   = useState({ ...EMPTY });
  const [editForm, setEditForm] = useState({ ...EMPTY });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: projs } = await api.get("/projects");
      setProjects(projs);
      // Load item counts for each project in parallel
      const countResults = await Promise.allSettled(
        projs.map(p =>
          Promise.all([
            api.get("/tasks",        { params: { project_id: p.id } }),
            api.get("/routines",     { params: { project_id: p.id } }),
            api.get("/notes",        { params: { project_id: p.id } }),
            api.get("/transactions", { params: { project_id: p.id } }),
          ]).then(([t, r, n, tr]) => ({
            id: p.id,
            tasks:        t.data.filter(x => !["Completed","Done"].includes(x.status)).length,
            routines:     r.data.filter(x => x.status === "Active").length,
            notes:        n.data.length,
            transactions: tr.data.length,
          }))
        )
      );
      const c = {};
      countResults.forEach(res => {
        if (res.status === "fulfilled") c[res.value.id] = res.value;
      });
      setCounts(c);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createProject = async () => {
    if (!newForm.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/projects", newForm);
      toast.success("Project created");
      setNewForm({ ...EMPTY });
      setCreating(false);
      load();
    } catch { toast.error("Failed to create project"); }
    setSaving(false);
  };

  const startEdit = (p) => {
    setEditing(p.id);
    setEditForm({ name: p.name, color: p.color, description: p.description || "" });
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      await api.patch(`/projects/${id}`, editForm);
      toast.success("Project updated");
      setEditing(null);
      load();
    } catch { toast.error("Failed to update project"); }
    setSaving(false);
  };

  const deleteProject = async (id) => {
    if (!window.confirm("Delete this project? Items won't be deleted.")) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success("Project deleted");
      load();
    } catch { toast.error("Failed to delete project"); }
  };

  if (loading) return <Skeleton.Page rows={6} />;

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="mm-page-title">Projects</h1>
          <p className="mm-page-sub">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="mm-btn-gold flex items-center gap-2 px-4 py-2">
          <Plus size={13} /> New Project
        </button>
      </div>

      {/* ── Create form ── */}
      {creating && (
        <div className="mm-card p-5 mb-5 animate-slide-up">
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--mm-text)" }}>New Project</h3>

          <div className="grid gap-3 md:grid-cols-2 mb-4">
            <input
              value={newForm.name}
              onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && createProject()}
              placeholder="Project name"
              className="mm-form-input"
              autoFocus />
            <input
              value={newForm.description}
              onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              className="mm-form-input" />
          </div>

          {/* Color picker */}
          <div className="mb-4">
            <p className="mm-label mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewForm(f => ({ ...f, color: c }))}
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: c,
                    border: newForm.color === c ? "2px solid var(--mm-gold)" : "2px solid transparent",
                    boxShadow: newForm.color === c ? `0 0 0 2px rgba(212,175,55,0.3)` : "none",
                    transition: "all 0.15s",
                  }} />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={createProject}
              disabled={!newForm.name.trim() || saving}
              className="mm-btn-gold flex items-center gap-2 px-4 py-2 disabled:opacity-40">
              {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
              Create
            </button>
            <button
              onClick={() => { setCreating(false); setNewForm({ ...EMPTY }); }}
              className="mm-btn-ghost px-4 py-2 flex items-center gap-2">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {projects.length === 0 && !creating && (
        <div className="mm-empty">
          <div className="mm-divider" style={{ width: 48 }} />
          <p className="mm-empty-title">No projects yet</p>
          <p className="mm-empty-desc">
            Projects help you group tasks, notes, routines and finances together.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mm-btn-gold flex items-center gap-2 px-4 py-2 mt-3">
            <Plus size={13} /> Create your first project
          </button>
        </div>
      )}

      {/* ── Project cards ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map(p => {
          const c  = counts[p.id] || {};
          const isEditing = editing === p.id;

          return (
            <div
              key={p.id}
              className="mm-card p-5 flex flex-col"
              style={{ borderTop: `3px solid ${p.color}` }}>

              {isEditing ? (
                /* Edit inline */
                <div className="flex flex-col gap-3">
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="mm-form-input text-sm"
                    autoFocus />
                  <input
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description"
                    className="mm-form-input text-sm" />
                  <div className="flex flex-wrap gap-1.5">
                    {PROJECT_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditForm(f => ({ ...f, color: c }))}
                        style={{
                          width: 22, height: 22, borderRadius: "50%", background: c,
                          border: editForm.color === c ? "2px solid var(--mm-gold)" : "2px solid transparent",
                        }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(p.id)}
                      disabled={saving}
                      className="mm-btn-gold px-3 py-1.5 text-xs flex items-center gap-1.5">
                      {saving ? <Loader size={11} className="animate-spin" /> : <Check size={11} />} Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="mm-btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
                      <X size={11} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: p.color, flexShrink: 0
                      }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--mm-text)" }}>
                          {p.name}
                        </p>
                        {p.description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--mm-muted)" }}>
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                      <button
                        onClick={() => startEdit(p)}
                        className="mm-icon-btn"
                        title="Edit project">
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => deleteProject(p.id)}
                        className="mm-icon-btn"
                        title="Delete project"
                        style={{ color: "var(--mm-muted)" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <StatChip
                      icon={<CheckSquare size={11} />}
                      label="Tasks"
                      value={c.tasks ?? "—"}
                      color={p.color} />
                    <StatChip
                      icon={<RefreshCw size={11} />}
                      label="Routines"
                      value={c.routines ?? "—"}
                      color={p.color} />
                    <StatChip
                      icon={<FileText size={11} />}
                      label="Notes"
                      value={c.notes ?? "—"}
                      color={p.color} />
                    <StatChip
                      icon={<DollarSign size={11} />}
                      label="Transactions"
                      value={c.transactions ?? "—"}
                      color={p.color} />
                  </div>

                  {/* Navigation shortcuts */}
                  <div className="flex gap-1.5 flex-wrap mt-auto">
                    <NavChip label="Tasks" to="/tasks" color={p.color} navigate={navigate} />
                    <NavChip label="Notes" to="/notes" color={p.color} navigate={navigate} />
                    <NavChip label="Finance" to="/cash-flow" color={p.color} navigate={navigate} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatChip({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl"
         style={{ background: `${color}10`, borderRadius: 12 }}>
      <span style={{ color }}>{icon}</span>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--mm-text)", lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ color: "var(--mm-muted)", fontSize: 10, lineHeight: 1.4 }}>{label}</p>
      </div>
    </div>
  );
}

function NavChip({ label, to, color, navigate }) {
  return (
    <button
      onClick={() => navigate(to)}
      className="text-xs px-2.5 py-1 transition-all"
      style={{
        background: `${color}14`,
        color,
        borderRadius: 20,
        border: `1px solid ${color}30`,
        fontWeight: 500,
        fontSize: 11,
      }}>
      {label}
    </button>
  );
}
