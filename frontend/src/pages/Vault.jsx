import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Upload, FileText, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Skeleton from "@/components/Skeleton";

const CATS = ["Legal","Finance","Personal","Property","Medical","Insurance","Other"];
const EMPTY = { title:"", category:"Other", expiry_date:"", notes:"", tags:[] };

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

export default function Vault() {
  const [docs,      setDocs]     = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [filter,    setFilter]   = useState({ category:"" });
  const [adding,    setAdding]   = useState(false);
  const [newRow,    setNewRow]   = useState({ ...EMPTY });
  const [uploading, setUploading]= useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/vault"); setDocs(data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newRow.title.trim()) return;
    try {
      await api.post("/vault",newRow);
      toast.success("Document saved");
      setNewRow({...EMPTY}); setAdding(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to save document"); }
  };

  const handleUpload = async (docId, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10*1024*1024) { toast.error("Max file size is 10MB"); return; }
    setUploading(true);
    const fd = new FormData(); fd.append("file",file);
    try {
      await api.post(`/vault/${docId}/upload`,fd,{ headers:{"Content-Type":"multipart/form-data"} });
      toast.success("File attached"); load();
    } catch { toast.error("Upload failed"); }
    setUploading(false);
  };

  const del = async (id) => {
    try { await api.delete(`/vault/${id}`); toast.success("Moved to trash"); load(); }
    catch { toast.error("Failed to delete document"); }
  };

  const visible  = docs.filter(d => !filter.category || d.category===filter.category);
  const expired  = docs.filter(d => { const n=daysUntil(d.expiry_date); return n!==null && n<0; });
  const expiring = docs.filter(d => { const n=daysUntil(d.expiry_date); return n!==null && n<=30 && n>=0; });

  if (loading) return <Skeleton.Page rows={6} />;

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="mm-page-title">Vault</h1>
          <p className="mm-page-sub">{docs.length} documents</p>
        </div>
        <button onClick={() => setAdding(true)} title="Add document"
                className="mm-btn-gold flex items-center gap-2">
          <Plus size={13} /> Add Document
        </button>
      </div>

      {/* ── Expiry alerts ── */}
      {(expired.length > 0 || expiring.length > 0) && (
        <div className="space-y-1.5 mb-5">
          {expired.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5"
                 style={{ background:"#E0525211", border:"1px solid #E0525233",
                          borderLeft:"3px solid #E05252", borderRadius:12 }}>
              <AlertTriangle size={13} style={{ color:"#E05252", flexShrink:0 }} />
              <span className="text-sm" style={{ color:"#E05252" }}>
                <strong>{d.title}</strong> — expired {Math.abs(daysUntil(d.expiry_date))} days ago
              </span>
            </div>
          ))}
          {expiring.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5"
                 style={{ background:"#E0A05211", border:"1px solid #E0A05233",
                          borderLeft:"3px solid #E0A052", borderRadius:12 }}>
              <AlertTriangle size={13} style={{ color:"#E0A052", flexShrink:0 }} />
              <span className="text-sm" style={{ color:"#E0A052" }}>
                <strong>{d.title}</strong> — expires in {daysUntil(d.expiry_date)} days
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Category filter ── */}
      <div className="flex gap-1 flex-wrap mb-5">
        <button onClick={() => setFilter({category:""})}
                className={`mm-filter-tab ${!filter.category ? "active" : ""}`}>
          All
        </button>
        {CATS.map(c => (
          <button key={c} onClick={() => setFilter(f=>({...f,category:f.category===c?"":c}))}
                  className={`mm-filter-tab ${filter.category===c ? "active" : ""}`}>
            {c}
          </button>
        ))}
      </div>

      {/* ── Empty ── */}
      {visible.length === 0 && (
        <div className="mm-empty">
          <div className="mm-divider" style={{ width:48 }} />
          <p className="mm-empty-title">No documents</p>
          <p className="mm-empty-desc">Store important documents with expiry tracking.</p>
        </div>
      )}

      {/* ── Grid ── */}
      {visible.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map(d => {
            const days = daysUntil(d.expiry_date);
            const isExpired  = days !== null && days < 0;
            const isExpiring = days !== null && days <= 30 && days >= 0;
            return (
              <div key={d.id} className="mm-card p-4"
                   style={{ borderColor: isExpired  ? "#E0525244"
                                       : isExpiring ? "#E0A05244"
                                       : "var(--mm-border)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                       style={{ background:"var(--mm-surface-3)", border:"1px solid var(--mm-border)" }}>
                    <FileText size={16} style={{ color:"var(--mm-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium" style={{ color:"var(--mm-text)" }}>{d.title}</p>
                        <span className="text-xs px-1.5 py-0.5 mm-label"
                              style={{ background:"var(--mm-surface-2)" }}>
                          {d.category}
                        </span>
                      </div>
                      <div className="flex gap-0.5 flex-shrink-0">
                        <label title="Attach file" className="mm-icon-btn cursor-pointer">
                          {uploading ? <Loader size={12} className="animate-spin" /> : <Upload size={12} />}
                          <input type="file" className="hidden" onChange={e => handleUpload(d.id,e)} />
                        </label>
                        <button onClick={() => del(d.id)} title="Move to trash"
                                className="mm-icon-btn danger">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {d.notes && (
                      <p className="text-xs mt-1.5" style={{ color:"var(--mm-muted)" }}>{d.notes}</p>
                    )}
                    {d.expiry_date && (
                      <p className="text-xs mt-1.5 font-medium"
                         style={{ color: isExpired?"#E05252" : isExpiring?"#E0A052" : "var(--mm-muted)" }}>
                        {isExpired
                          ? `Expired ${Math.abs(days)}d ago`
                          : `Expires in ${days}d`} — {d.expiry_date}
                      </p>
                    )}
                    {d.file_name && (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color:"var(--mm-muted)" }}>
                        <FileText size={9} /> {d.file_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add modal ── */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" }}>
          <div className="p-7 w-full max-w-md animate-scale-in"
               style={{ background:"var(--mm-surface)", border:"1px solid var(--mm-border-gold)",
                        borderRadius:32, boxShadow:"0 24px 80px rgba(0,0,0,0.8)" }}>
            <h2 className="mm-font-display text-base mb-5"
                style={{ color:"var(--mm-text)", fontWeight:400 }}>
              New Document
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mm-label block mb-1">Title</label>
                <input value={newRow.title} onChange={e => setNewRow(r=>({...r,title:e.target.value}))}
                       className="mm-form-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mm-label block mb-1">Category</label>
                  <select value={newRow.category} onChange={e => setNewRow(r=>({...r,category:e.target.value}))}
                          className="mm-form-input">
                    {CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mm-label block mb-1">Expiry Date</label>
                  <input type="date" value={newRow.expiry_date}
                         onChange={e => setNewRow(r=>({...r,expiry_date:e.target.value}))}
                         className="mm-form-input" />
                </div>
              </div>
              <div>
                <label className="mm-label block mb-1">Notes</label>
                <textarea rows={2} value={newRow.notes}
                          onChange={e => setNewRow(r=>({...r,notes:e.target.value}))}
                          className="mm-form-input resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={add} className="mm-btn-gold flex-1">Save Document</button>
              <button onClick={() => setAdding(false)} className="mm-btn-ghost px-5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
