import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Mail, Phone, Building2, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import EditablePreview from "@/components/EditablePreview";

const EMPTY = { name: "", role: "", company: "", email: "", phone: "", group: "", notes: "" };

export default function People() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY });
  const [filter, setFilter] = useState({ group: "", search: "" });
  const [groups, setGroups] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/people");
      setPeople(data);
      setGroups([...new Set(data.map(p => p.group).filter(Boolean))]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadItems = useCallback(async (pid) => {
    setItemsLoading(true);
    try {
      const { data } = await api.get(`/people/${pid}/items`);
      setItems(data);
    } catch {}
    setItemsLoading(false);
  }, []);

  useEffect(() => {
    if (selected) loadItems(selected.id);
    else setItems([]);
  }, [selected?.id]);

  const add = async () => {
    if (!newRow.name.trim()) return;
    try {
      await api.post("/people", newRow);
      toast.success("✓ Contact added");
      setNewRow({ ...EMPTY });
      setAdding(false);
      load();
    } catch {}
  };

  const update = async (id, patch) => {
    setPeople(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
    if (selected?.id === id) setSelected(s => s ? { ...s, ...patch } : s);
    try { await api.patch(`/people/${id}`, patch); } catch {}
  };

  const del = async (id) => {
    try {
      await api.delete(`/people/${id}`);
      toast.success("✓ Moved to trash");
      if (selected?.id === id) setSelected(null);
      load();
    } catch {}
  };

  const visible = people.filter(p => {
    if (filter.group && p.group !== filter.group) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.company?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <LoadingPage />;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* List panel */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r" style={{ borderColor: "var(--mm-border)", background: "var(--mm-surface)" }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--mm-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>People</h1>
            <button onClick={() => setAdding(true)}
                    className="p-1.5 rounded-lg"
                    style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
              <Plus size={14} />
            </button>
          </div>
          <input value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                 placeholder="Search contacts…"
                 className="w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                 style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          {groups.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              <button onClick={() => setFilter(f => ({ ...f, group: "" }))}
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: !filter.group ? "var(--mm-gold)" : "var(--mm-surface-2)", color: !filter.group ? "#0A0A0A" : "var(--mm-muted)" }}>
                All
              </button>
              {groups.map(g => (
                <button key={g} onClick={() => setFilter(f => ({ ...f, group: f.group === g ? "" : g }))}
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: filter.group === g ? "var(--mm-gold)" : "var(--mm-surface-2)", color: filter.group === g ? "#0A0A0A" : "var(--mm-muted)" }}>
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2 text-center px-4">
              <span style={{ fontSize: 32 }}>👥</span>
              <p className="text-xs" style={{ color: "var(--mm-muted)" }}>No contacts yet.</p>
            </div>
          ) : visible.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
                    className="w-full text-left px-4 py-3 border-b hover:bg-white/5 transition-colors flex items-center gap-3"
                    style={{ borderColor: "var(--mm-border)", background: selected?.id === p.id ? "var(--mm-surface-2)" : "transparent" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                   style={{ background: "var(--mm-gold)22", color: "var(--mm-gold)" }}>
                {p.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--mm-text)" }}>{p.name}</p>
                <p className="text-xs truncate" style={{ color: "var(--mm-muted)" }}>{p.role || p.company || "—"}</p>
              </div>
              <ChevronRight size={14} style={{ color: "var(--mm-muted)" }} />
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="max-w-2xl">
            {/* Profile header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold"
                   style={{ background: "var(--mm-gold)22", color: "var(--mm-gold)" }}>
                {selected.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1">
                {editing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(editData).map(([k, v]) => (
                        <div key={k}>
                          <label className="text-xs capitalize" style={{ color: "var(--mm-muted)" }}>{k}</label>
                          {k === "notes" ? (
                            <textarea rows={3} value={v} onChange={e => setEditData(d => ({ ...d, [k]: e.target.value }))}
                                      className="w-full rounded-lg px-3 py-2 text-sm outline-none mt-0.5 resize-none"
                                      style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                          ) : (
                            <input value={v} onChange={e => setEditData(d => ({ ...d, [k]: e.target.value }))}
                                   className="w-full rounded-lg px-3 py-2 text-sm outline-none mt-0.5"
                                   style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => { await update(selected.id, editData); setEditing(false); }}
                              className="px-4 py-1.5 rounded-lg text-sm font-medium"
                              style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>Save</button>
                      <button onClick={() => setEditing(false)}
                              className="px-4 py-1.5 rounded-lg text-sm"
                              style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>{selected.name}</h2>
                    {selected.role && <p className="text-sm" style={{ color: "var(--mm-muted)" }}>{selected.role}</p>}
                    {selected.company && (
                      <p className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color: "var(--mm-muted)" }}>
                        <Building2 size={12} /> {selected.company}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => { setEditData({ name: selected.name || "", role: selected.role || "", company: selected.company || "", email: selected.email || "", phone: selected.phone || "", group: selected.group || "", notes: selected.notes || "" }); setEditing(true); }}
                              className="px-3 py-1 rounded-lg text-xs"
                              style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
                        Edit
                      </button>
                      <button onClick={() => del(selected.id)}
                              className="px-3 py-1 rounded-lg text-xs"
                              style={{ border: "1px solid #E0505033", color: "#E05252" }}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Contact info */}
            {!editing && (
              <div className="mm-card p-4 mb-4 grid grid-cols-2 gap-3">
                {selected.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} style={{ color: "var(--mm-muted)" }} />
                    <a href={`mailto:${selected.email}`} className="text-sm" style={{ color: "var(--mm-text)" }}>{selected.email}</a>
                  </div>
                )}
                {selected.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} style={{ color: "var(--mm-muted)" }} />
                    <span className="text-sm" style={{ color: "var(--mm-text)" }}>{selected.phone}</span>
                  </div>
                )}
                {selected.group && (
                  <div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)" }}>
                      {selected.group}
                    </span>
                  </div>
                )}
                {selected.notes && (
                  <div className="col-span-2">
                    <p className="text-xs" style={{ color: "var(--mm-muted)" }}>{selected.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Linked items */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--mm-muted)" }}>
                Linked Items
              </h3>
              {itemsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader size={18} className="animate-spin" style={{ color: "var(--mm-gold)" }} />
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--mm-muted)" }}>No linked items.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="mm-card px-3 py-2 flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                            style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)" }}>
                        {item.type}
                      </span>
                      <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>
                        {item.task || item.title || item.activity || item.vendor || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <span style={{ fontSize: 48 }}>👥</span>
          <p className="text-sm" style={{ color: "var(--mm-muted)" }}>Select a contact to view details</p>
        </div>
      )}

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md animate-fade-in"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
            <h2 className="text-base font-semibold mm-font-display mb-4" style={{ color: "var(--mm-text)" }}>
              New Contact
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(newRow).map(([k, v]) => (
                <div key={k} className={k === "notes" ? "col-span-2" : ""}>
                  <label className="text-xs capitalize block mb-1" style={{ color: "var(--mm-muted)" }}>{k}</label>
                  {k === "notes" ? (
                    <textarea rows={2} value={v} onChange={e => setNewRow(r => ({ ...r, [k]: e.target.value }))}
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                              style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                  ) : (
                    <input value={v} onChange={e => setNewRow(r => ({ ...r, [k]: e.target.value }))}
                           onKeyDown={k === "name" ? e => e.key === "Enter" && add() : undefined}
                           className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                           style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={add}
                      className="flex-1 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
                Add Contact
              </button>
              <button onClick={() => setAdding(false)}
                      className="px-4 py-2 rounded-lg text-sm"
                      style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
                Cancel
              </button>
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
