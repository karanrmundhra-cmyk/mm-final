import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Upload, Download, FileText, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";

const CATS = ["Legal","Finance","Personal","Property","Medical","Insurance","Other"];
const EMPTY = { title: "", category: "Other", expiry_date: "", notes: "", tags: [] };

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

export default function Vault() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: "" });
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/vault");
      setDocs(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newRow.title.trim()) return;
    try {
      await api.post("/vault", newRow);
      toast.success("✓ Document saved");
      setNewRow({ ...EMPTY });
      setAdding(false);
      load();
    } catch {}
  };

  const handleUpload = async (docId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max file size is 10MB"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/vault/${docId}/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("✓ File attached");
      load();
    } catch { toast.error("Upload failed"); }
    setUploading(false);
  };

  const del = async (id) => {
    try { await api.delete(`/vault/${id}`); toast.success("✓ Moved to trash"); if (selected?.id === id) setSelected(null); load(); } catch {}
  };

  const update = async (id, patch) => {
    setDocs(ds => ds.map(d => d.id === id ? { ...d, ...patch } : d));
    if (selected?.id === id) setSelected(s => s ? { ...s, ...patch } : s);
    try { await api.patch(`/vault/${id}`, patch); } catch {}
  };

  const visible = docs.filter(d => !filter.category || d.category === filter.category);
  const expiring = docs.filter(d => { const n = daysUntil(d.expiry_date); return n !== null && n <= 30 && n >= 0; });
  const expired = docs.filter(d => { const n = daysUntil(d.expiry_date); return n !== null && n < 0; });

  if (loading) return <LoadingPage />;

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Vault</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>{docs.length} documents</p>
        </div>
        <button onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
          <Plus size={12} /> Add Document
        </button>
      </div>

      {/* Expiry alerts */}
      {(expired.length > 0 || expiring.length > 0) && (
        <div className="space-y-2 mb-4">
          {expired.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2 rounded-xl"
                 style={{ background: "#E0525211", border: "1px solid #E0525233" }}>
              <AlertTriangle size={14} style={{ color: "#E05252", flexShrink: 0 }} />
              <span className="text-sm" style={{ color: "#E05252" }}>
                <strong>{d.title}</strong> expired {Math.abs(daysUntil(d.expiry_date))} days ago
              </span>
            </div>
          ))}
          {expiring.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2 rounded-xl"
                 style={{ background: "#E0A05211", border: "1px solid #E0A05233" }}>
              <AlertTriangle size={14} style={{ color: "#E0A052", flexShrink: 0 }} />
              <span className="text-sm" style={{ color: "#E0A052" }}>
                <strong>{d.title}</strong> expires in {daysUntil(d.expiry_date)} days
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setFilter({ category: "" })}
                className="px-3 py-1 rounded-full text-xs"
                style={{ background: !filter.category ? "var(--mm-gold)" : "var(--mm-surface-2)", color: !filter.category ? "#0A0A0A" : "var(--mm-muted)", border: "1px solid var(--mm-border)" }}>
          All
        </button>
        {CATS.map(c => (
          <button key={c} onClick={() => setFilter(f => ({ ...f, category: f.category === c ? "" : c }))}
                  className="px-3 py-1 rounded-full text-xs"
                  style={{ background: filter.category === c ? "var(--mm-gold)" : "var(--mm-surface-2)", color: filter.category === c ? "#0A0A0A" : "var(--mm-muted)", border: "1px solid var(--mm-border)" }}>
            {c}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4 text-center">
          <span style={{ fontSize: 48 }}>🗄️</span>
          <h2 className="text-lg font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>No documents</h2>
          <p className="text-sm max-w-xs" style={{ color: "var(--mm-muted)" }}>Store important documents with expiry tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map(d => {
            const days = daysUntil(d.expiry_date);
            const isExpired = days !== null && days < 0;
            const isExpiring = days !== null && days <= 30 && days >= 0;
            return (
              <div key={d.id} className="mm-card p-4"
                   style={{ borderColor: isExpired ? "#E0525244" : isExpiring ? "#E0A05244" : "var(--mm-border)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: "var(--mm-surface-2)" }}>
                    <FileText size={18} style={{ color: "var(--mm-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>{d.title}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)" }}>
                          {d.category}
                        </span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <label className="p-1 rounded hover:bg-white/10 cursor-pointer"
                               style={{ color: "var(--mm-muted)" }} title="Attach file">
                          {uploading ? <Loader size={12} className="animate-spin" /> : <Upload size={12} />}
                          <input type="file" className="hidden" onChange={e => handleUpload(d.id, e)} />
                        </label>
                        <button onClick={() => del(d.id)} className="p-1 rounded hover:bg-white/10"
                                style={{ color: "#E05252" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {d.notes && <p className="text-xs mt-1" style={{ color: "var(--mm-muted)" }}>{d.notes}</p>}
                    {d.expiry_date && (
                      <p className="text-xs mt-1 font-medium"
                         style={{ color: isExpired ? "#E05252" : isExpiring ? "#E0A052" : "var(--mm-muted)" }}>
                        {isExpired ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d`} — {d.expiry_date}
                      </p>
                    )}
                    {d.file_name && (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--mm-muted)" }}>
                        <FileText size={10} /> {d.file_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md animate-fade-in"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
            <h2 className="text-base font-semibold mm-font-display mb-4" style={{ color: "var(--mm-text)" }}>New Document</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--mm-muted)" }}>Title</label>
                <input value={newRow.title} onChange={e => setNewRow(r => ({ ...r, title: e.target.value }))}
                       className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                       style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--mm-muted)" }}>Category</label>
                  <select value={newRow.category} onChange={e => setNewRow(r => ({ ...r, category: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }}>
                    {CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--mm-muted)" }}>Expiry Date</label>
                  <input type="date" value={newRow.expiry_date} onChange={e => setNewRow(r => ({ ...r, expiry_date: e.target.value }))}
                         className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                         style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--mm-muted)" }}>Notes</label>
                <textarea rows={2} value={newRow.notes} onChange={e => setNewRow(r => ({ ...r, notes: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                          style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={add}
                      className="flex-1 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>Save</button>
              <button onClick={() => setAdding(false)}
                      className="px-4 py-2 rounded-lg text-sm"
                      style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
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
