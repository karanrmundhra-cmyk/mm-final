import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, Loader, Mail, Phone, Building2, ChevronRight,
  Upload, Download, Check, X, AlertTriangle, Users,
  CheckSquare, RefreshCw, DollarSign, FileText, Bell, Clock
} from "lucide-react";

const ITEM_META = {
  task:        { icon: CheckSquare, color: "#D4AF37" },
  routine:     { icon: RefreshCw,   color: "#D4AF37" },
  transaction: { icon: DollarSign,  color: "#D4AF37" },
  note:        { icon: FileText,    color: "#D4AF37" },
  reminder:    { icon: Bell,        color: "#D4AF37" },
};
import { api } from "@/lib/api";
import { toast } from "sonner";
import Skeleton from "@/components/Skeleton";

const EMPTY = { name:"", role:"", company:"", email:"", phone:"", group:"", notes:"" };

export default function People() {
  const [people,       setPeople]      = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [selected,     setSelected]    = useState(null);
  const [items,        setItems]       = useState([]);
  const [itemsLoading, setItemsLoading]= useState(false);
  const [newRow,       setNewRow]      = useState({ ...EMPTY });
  const [filter,       setFilter]      = useState({ group:"", search:"" });
  const [groups,       setGroups]      = useState([]);
  const [adding,       setAdding]      = useState(false);
  const [editing,      setEditing]     = useState(false);
  const [editData,     setEditData]    = useState({});

  /* ── Import state ── */
  const [importPreview,   setImportPreview]   = useState(null);   // { source, total, new, duplicates, contacts }
  const [importLoading,   setImportLoading]   = useState(false);
  const [importSaving,    setImportSaving]    = useState(false);
  const [skipDupes,       setSkipDupes]       = useState(true);
  const [selectedContacts,setSelectedContacts]= useState(new Set());
  const importRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/people");
      setPeople(data);
      setGroups([...new Set(data.map(p=>p.group).filter(Boolean))]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadItems = useCallback(async (pid) => {
    setItemsLoading(true);
    try { const { data } = await api.get(`/people/${pid}/items`); setItems(data); } catch {}
    setItemsLoading(false);
  }, []);

  useEffect(() => {
    if (selected) loadItems(selected.id);
    else setItems([]);
  }, [selected?.id, loadItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!newRow.name.trim()) return;
    try {
      await api.post("/people",newRow);
      toast.success("Contact added");
      setNewRow({...EMPTY}); setAdding(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to add contact"); }
  };

  const update = async (id, patch) => {
    setPeople(ps => ps.map(p => p.id===id ? {...p,...patch} : p));
    if (selected?.id===id) setSelected(s => s ? {...s,...patch} : s);
    try { await api.patch(`/people/${id}`,patch); }
    catch { toast.error("Failed to save changes"); }
  };

  const del = async (id) => {
    try {
      await api.delete(`/people/${id}`);
      toast.success("Moved to trash");
      if (selected?.id===id) setSelected(null);
      load();
    } catch { toast.error("Failed to delete contact"); }
  };

  /* ── Import handlers ── */
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";   // reset so same file can be re-selected
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/people/import/preview", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportPreview(data);
      // Pre-select all non-duplicate contacts
      setSelectedContacts(new Set(
        data.contacts
          .map((c, i) => i)
          .filter(i => !data.contacts[i]._duplicate)
      ));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not parse file");
    }
    setImportLoading(false);
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImportSaving(true);
    const contacts = importPreview.contacts.filter((_, i) => selectedContacts.has(i));
    try {
      const { data } = await api.post("/people/import/confirm", {
        contacts,
        skip_duplicates: false,   // selection already handled client-side
      });
      toast.success(`${data.created} contacts imported${data.skipped ? `, ${data.skipped} skipped` : ""}`);
      setImportPreview(null);
      load();
    } catch {
      toast.error("Import failed");
    }
    setImportSaving(false);
  };

  const toggleContact = (i) =>
    setSelectedContacts(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const selectAllNew = () =>
    setSelectedContacts(new Set(importPreview.contacts.map((_,i)=>i).filter(i => !importPreview.contacts[i]._duplicate)));
  const selectAll = () =>
    setSelectedContacts(new Set(importPreview.contacts.map((_,i)=>i)));
  const clearAll  = () => setSelectedContacts(new Set());

  /* ── Export handlers ── */
  const exportVcf = () => window.open(`${api.defaults.baseURL}/export/contacts.vcf`, "_blank");
  const exportCsv = () => window.open(`${api.defaults.baseURL}/export/contacts.csv`, "_blank");

  const visible = people.filter(p => {
    if (filter.group && p.group !== filter.group) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.company?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <Skeleton.TwoCol rows={6} />;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Contact list ── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r"
           style={{ borderColor:"var(--mm-border)", background:"var(--mm-surface)" }}>

        <div className="px-4 py-4 border-b" style={{ borderColor:"var(--mm-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="mm-page-title" style={{ fontSize:20 }}>People</h1>
            <div className="flex items-center gap-1.5">
              {/* Hidden file input for import */}
              <input ref={importRef} type="file" accept=".vcf,.vcard,.csv"
                     className="hidden" onChange={handleImportFile} />
              <button
                onClick={() => importRef.current?.click()}
                disabled={importLoading}
                title="Import contacts (vCard or CSV)"
                className="mm-btn-ghost px-2.5 py-1.5 flex items-center gap-1.5 text-xs">
                {importLoading
                  ? <Loader size={11} className="animate-spin" />
                  : <Upload size={11} />}
                Import
              </button>
              <button onClick={() => setAdding(true)} title="Add contact"
                      className="mm-btn-gold p-2">
                <Plus size={13} />
              </button>
            </div>
          </div>
          <input value={filter.search} onChange={e => setFilter(f=>({...f,search:e.target.value}))}
                 placeholder="Search contacts…"
                 className="mm-form-input text-xs" />
          {groups.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              <button onClick={() => setFilter(f=>({...f,group:""}))}
                      className={`mm-filter-tab ${!filter.group ? "active" : ""}`}>
                All
              </button>
              {groups.map(g => (
                <button key={g} onClick={() => setFilter(f=>({...f,group:f.group===g?"":g}))}
                        className={`mm-filter-tab ${filter.group===g ? "active" : ""}`}>
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="mm-label">No contacts</p>
            </div>
          ) : visible.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
                    className="mm-row w-full text-left px-4 py-3 border-b flex items-center gap-3"
                    style={{
                      borderColor:"var(--mm-border)",
                      background: selected?.id===p.id ? "var(--mm-surface-2)" : "transparent",
                      borderLeft: selected?.id===p.id ? "2px solid var(--mm-gold)" : "2px solid transparent",
                    }}>
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                   style={{ background:"var(--mm-gold)22", color:"var(--mm-gold)", border:"1px solid var(--mm-border-gold)" }}>
                {p.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color:"var(--mm-text)" }}>{p.name}</p>
                <p className="text-xs truncate" style={{ color:"var(--mm-muted)" }}>
                  {p.role || p.company || "—"}
                </p>
              </div>
              {selected?.id === p.id && items.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background:"rgba(212,175,55,0.12)", color:"var(--mm-gold)", fontSize:10 }}>
                  {items.length}
                </span>
              )}
              <ChevronRight size={12} style={{ color:"var(--mm-muted)", opacity:0.5 }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Detail panel ── */}
      {selected ? (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-xl">

            {/* Profile header */}
            <div className="flex items-start gap-5 mb-6">
              <div className="w-14 h-14 flex items-center justify-center text-2xl font-semibold flex-shrink-0"
                   style={{ background:"var(--mm-gold)18", color:"var(--mm-gold)",
                            border:"1px solid var(--mm-border-gold)" }}>
                {selected.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1">
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(editData).map(([k,v]) => (
                        <div key={k} className={k==="notes" ? "col-span-2" : ""}>
                          <label className="mm-label block mb-1">{k}</label>
                          {k==="notes" ? (
                            <textarea rows={3} value={v}
                                      onChange={e => setEditData(d=>({...d,[k]:e.target.value}))}
                                      className="mm-form-input resize-none" />
                          ) : (
                            <input value={v}
                                   onChange={e => setEditData(d=>({...d,[k]:e.target.value}))}
                                   className="mm-form-input" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => { await update(selected.id,editData); setEditing(false); }}
                              className="mm-btn-gold px-5">
                        Save
                      </button>
                      <button onClick={() => setEditing(false)} className="mm-btn-ghost px-5">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="mm-font-display text-xl" style={{ color:"var(--mm-text)", fontWeight:400 }}>
                      {selected.name}
                    </h2>
                    {selected.role && (
                      <p className="text-sm mt-0.5" style={{ color:"var(--mm-muted)" }}>{selected.role}</p>
                    )}
                    {selected.company && (
                      <p className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color:"var(--mm-muted)" }}>
                        <Building2 size={11} /> {selected.company}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => {
                        setEditData({ name:selected.name||"", role:selected.role||"",
                                      company:selected.company||"", email:selected.email||"",
                                      phone:selected.phone||"", group:selected.group||"",
                                      notes:selected.notes||"" });
                        setEditing(true);
                      }} className="mm-btn-ghost px-4">
                        Edit
                      </button>
                      <button onClick={() => del(selected.id)}
                              className="mm-btn-ghost px-4"
                              style={{ color:"var(--mm-muted)", borderColor:"var(--mm-border)" }}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Contact info */}
            {!editing && (
              <div className="mm-card p-4 mb-5 space-y-2">
                {selected.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} style={{ color:"var(--mm-muted)" }} />
                    <a href={`mailto:${selected.email}`} className="text-sm"
                       style={{ color:"var(--mm-text)" }}>{selected.email}</a>
                  </div>
                )}
                {selected.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} style={{ color:"var(--mm-muted)" }} />
                    <span className="text-sm" style={{ color:"var(--mm-text)" }}>{selected.phone}</span>
                  </div>
                )}
                {selected.group && (
                  <span className="inline-block text-xs px-2 py-0.5 mm-label"
                        style={{ background:"var(--mm-surface-2)" }}>
                    {selected.group}
                  </span>
                )}
                {selected.notes && (
                  <p className="text-xs pt-1" style={{ color:"var(--mm-muted)" }}>{selected.notes}</p>
                )}
              </div>
            )}

            {/* Workload summary */}
            {!itemsLoading && items.length > 0 && (() => {
              const byType = {};
              items.forEach(it => { byType[it.type] = (byType[it.type]||0) + 1; });
              const total = items.length;
              const LABELS = { task:"Tasks", routine:"Routines", transaction:"Transactions", note:"Notes", reminder:"Reminders" };
              return (
                <div className="mm-card p-4 mb-5">
                  <p className="mm-label mb-3">Workload  ·  {total} linked item{total !== 1 ? "s" : ""}</p>
                  <div className="space-y-2">
                    {Object.entries(byType).map(([type, count]) => {
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={type}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs" style={{ color:"var(--mm-muted)" }}>
                              {LABELS[type] || type}
                            </span>
                            <span className="text-xs font-medium" style={{ color:"var(--mm-gold)" }}>
                              {count}
                            </span>
                          </div>
                          <div className="mm-budget-bar">
                            <div className="mm-budget-bar-fill" style={{ width:`${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Linked items */}
            <div>
              <p className="mm-label mb-3">Linked Items</p>
              {itemsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader size={16} className="animate-spin" style={{ color:"var(--mm-gold)" }} />
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm" style={{ color:"var(--mm-muted)" }}>No linked items.</p>
              ) : (
                <div className="space-y-1">
                  {items.map((item, i) => {
                    const meta = ITEM_META[item.type] || { color: "#888" };
                    const Icon = meta.icon || Clock;
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                           style={{ background:"var(--mm-surface-2)" }}>
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                             style={{ background:`${meta.color}22` }}>
                          <Icon size={13} style={{ color:meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color:"var(--mm-text)" }}>{item.label}</p>
                          <p className="text-xs" style={{ color:"var(--mm-muted)" }}>{item.type}</p>
                        </div>
                        {item.amount && (
                          <span className="text-xs font-medium" style={{ color:"var(--mm-gold)" }}>
                            ₹{item.amount}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Users size={32} style={{ color:"var(--mm-border)", opacity:0.5 }} />
          <p className="mm-label">Select a contact to view details</p>
          <div className="flex gap-2">
            <button onClick={exportVcf}
                    className="mm-btn-ghost px-3 py-1.5 flex items-center gap-1.5 text-xs"
                    title="Download all contacts as vCard (Apple / Google / Outlook compatible)">
              <Download size={11} /> Export vCard
            </button>
            <button onClick={exportCsv}
                    className="mm-btn-ghost px-3 py-1.5 flex items-center gap-1.5 text-xs"
                    title="Download as CSV (Google Contacts compatible)">
              <Download size={11} /> Export CSV
            </button>
          </div>
        </div>
      )}

      {/* ── Import preview modal ── */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background:"rgba(0,0,0,0.85)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" }}>
          <div className="w-full max-w-2xl animate-scale-in flex flex-col"
               style={{ background:"var(--mm-surface)", border:"1px solid var(--mm-border-gold)",
                        borderRadius:32, boxShadow:"var(--elev-modal)", maxHeight:"85vh" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0"
                 style={{ borderBottom:"1px solid var(--mm-border)" }}>
              <div>
                <h2 className="mm-font-display text-lg" style={{ color:"var(--mm-text)", fontWeight:400 }}>
                  Review Import
                </h2>
                <p className="text-xs mt-0.5" style={{ color:"var(--mm-muted)" }}>
                  {importPreview.source} · {importPreview.total} contacts found ·{" "}
                  <span style={{ color:"var(--mm-gold)" }}>{importPreview.new} new</span>
                  {importPreview.duplicates > 0 && (
                    <span style={{ color:"var(--mm-gold)" }}> · {importPreview.duplicates} already exist</span>
                  )}
                </p>
              </div>
              <button onClick={() => setImportPreview(null)} className="mm-icon-btn" style={{ fontSize:20 }}>×</button>
            </div>

            {/* Selection controls */}
            <div className="flex items-center gap-3 px-7 py-3 flex-shrink-0"
                 style={{ borderBottom:"1px solid var(--mm-border)" }}>
              <span className="text-xs" style={{ color:"var(--mm-muted)" }}>
                {selectedContacts.size} selected
              </span>
              <button onClick={selectAllNew} className="mm-btn-ghost px-2.5 py-1 text-xs">New only</button>
              <button onClick={selectAll}    className="mm-btn-ghost px-2.5 py-1 text-xs">Select all</button>
              <button onClick={clearAll}     className="mm-btn-ghost px-2.5 py-1 text-xs">Clear</button>
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto px-7 py-3">
              {importPreview.contacts.map((c, i) => (
                <label key={i}
                       className="flex items-start gap-3 py-2.5 cursor-pointer border-b"
                       style={{ borderColor:"var(--mm-border)" }}>
                  <input
                    type="checkbox"
                    checked={selectedContacts.has(i)}
                    onChange={() => toggleContact(i)}
                    style={{ marginTop:3, accentColor:"var(--mm-gold)", width:13, height:13, flexShrink:0 }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color:"var(--mm-text)" }}>
                        {c.name}
                      </span>
                      {c._duplicate && (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background:"rgba(212,175,55,0.12)", color:"var(--mm-gold)", fontSize:10 }}>
                          <AlertTriangle size={9} /> {c._dup_reason}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {c.email && (
                        <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{c.email}</span>
                      )}
                      {c.phone && (
                        <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{c.phone}</span>
                      )}
                      {c.relationship && (
                        <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{c.relationship}</span>
                      )}
                      {c.location && (
                        <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{c.location}</span>
                      )}
                    </div>
                  </div>

                  {selectedContacts.has(i)
                    ? <Check size={13} style={{ color:"var(--mm-gold)", flexShrink:0, marginTop:2 }} />
                    : <div style={{ width:13, flexShrink:0 }} />}
                </label>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-7 py-5 flex-shrink-0"
                 style={{ borderTop:"1px solid var(--mm-border)" }}>
              <button
                onClick={confirmImport}
                disabled={selectedContacts.size === 0 || importSaving}
                className="mm-btn-gold flex items-center gap-2 px-5 disabled:opacity-40">
                {importSaving
                  ? <><Loader size={12} className="animate-spin" /> Importing…</>
                  : <><Check size={12} /> Import {selectedContacts.size} contact{selectedContacts.size !== 1 ? "s" : ""}</>}
              </button>
              <button onClick={() => setImportPreview(null)} className="mm-btn-ghost px-5">
                Cancel
              </button>
              {importPreview.duplicates > 0 && (
                <p className="text-xs ml-auto" style={{ color:"var(--mm-muted)" }}>
                  Duplicates are unchecked by default
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add modal ── */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" }}>
          <div className="p-7 w-full max-w-md animate-scale-in"
               style={{ background:"var(--mm-surface)", border:"1px solid var(--mm-border-gold)",
                        borderRadius:32, boxShadow:"0 24px 80px rgba(0,0,0,0.8)" }}>
            <h2 className="mm-font-display text-base mb-4"
                style={{ color:"var(--mm-text)", fontWeight:400 }}>
              New Contact
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(newRow).map(([k,v]) => (
                <div key={k} className={k==="notes" ? "col-span-2" : ""}>
                  <label className="mm-label block mb-1">{k}</label>
                  {k==="notes" ? (
                    <textarea rows={2} value={v}
                              onChange={e => setNewRow(r=>({...r,[k]:e.target.value}))}
                              className="mm-form-input resize-none" />
                  ) : (
                    <input value={v} onChange={e => setNewRow(r=>({...r,[k]:e.target.value}))}
                           onKeyDown={k==="name" ? e => e.key==="Enter" && add() : undefined}
                           className="mm-form-input" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={add} className="mm-btn-gold flex-1">Add Contact</button>
              <button onClick={() => setAdding(false)} className="mm-btn-ghost px-5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
