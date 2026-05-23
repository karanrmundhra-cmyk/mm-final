import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Pin, Tag, Lock, Unlock, Search } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";

const EMPTY = { title: "", content: "", tags: [], pinned: false, locked: false };

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState({ tag: "", search: "" });
  const [tags, setTags] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [pinUnlock, setPinUnlock] = useState({});
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notes");
      setNotes(data);
      const allTags = [...new Set(data.flatMap(n => n.tags || []).filter(Boolean))];
      setTags(allTags);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) {
      setEditContent(selected.content || "");
    }
  }, [selected?.id, selected?.content]); // eslint-disable-line react-hooks/exhaustive-deps

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/note", { text: aiText });
      const fields = [
        { key: "title", label: "Title", value: data.title, confidence: data.confidence },
        { key: "content", label: "Content", value: data.content, confidence: "medium" },
        { key: "tags", label: "Tags", value: (data.tags || []).join(", "), confidence: "medium" },
      ];
      setPreview({ fields, raw: data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      const tags = values.tags ? values.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      await api.post("/notes", { ...preview.raw, ...values, tags });
      toast.success("✓ Note added");
      setPreview(null); setAiText("");
      load();
    } catch { toast.error("Save failed"); }
  };

  const addNote = async () => {
    if (!newTitle.trim()) return;
    try {
      const { data } = await api.post("/notes", { title: newTitle, content: "", tags: [] });
      toast.success("✓ Note created");
      setNewTitle("");
      await load();
      setSelected(data);
    } catch {}
  };

  const saveContent = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/notes/${selected.id}`, { content: editContent });
      setNotes(ns => ns.map(n => n.id === selected.id ? { ...n, content: editContent } : n));
      setSelected(s => s ? { ...s, content: editContent } : s);
    } catch {}
    setSaving(false);
  };

  const update = async (id, patch) => {
    setNotes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
    if (selected?.id === id) setSelected(s => s ? { ...s, ...patch } : s);
    try { await api.patch(`/notes/${id}`, patch); } catch {}
  };

  const del = async (id) => {
    try {
      await api.delete(`/notes/${id}`);
      toast.success("✓ Moved to trash");
      if (selected?.id === id) setSelected(null);
      load();
    } catch {}
  };

  const appendToNote = async (id, text) => {
    try {
      await api.post(`/notes/${id}/append`, { text });
      load();
    } catch {}
  };

  const unlockNote = (note, pin) => {
    if (pin === (note.pin || "1234")) {
      setPinUnlock(p => ({ ...p, [note.id]: true }));
    } else {
      toast.error("Incorrect PIN");
    }
  };

  const visible = notes.filter(n => {
    if (filter.tag && !(n.tags || []).includes(filter.tag)) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!n.title?.toLowerCase().includes(q) && !n.content?.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
  });

  if (loading) return <LoadingPage />;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r" style={{ borderColor: "var(--mm-border)", background: "var(--mm-surface)" }}>
        {/* Header */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--mm-border)" }}>
          <h1 className="text-base font-semibold mm-font-display mb-3" style={{ color: "var(--mm-text)" }}>Notes</h1>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--mm-muted)" }} />
            <input value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                   placeholder="Search notes…"
                   className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                   style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setFilter(f => ({ ...f, tag: "" }))}
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: !filter.tag ? "var(--mm-gold)" : "var(--mm-surface-2)", color: !filter.tag ? "#0A0A0A" : "var(--mm-muted)" }}>
                All
              </button>
              {tags.map(t => (
                <button key={t} onClick={() => setFilter(f => ({ ...f, tag: f.tag === t ? "" : t }))}
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: filter.tag === t ? "var(--mm-gold)" : "var(--mm-surface-2)", color: filter.tag === t ? "#0A0A0A" : "var(--mm-muted)" }}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI bar */}
        <div className="px-3 py-2 border-b" style={{ borderColor: "var(--mm-border)" }}>
          <div className="flex gap-1.5">
            <input value={aiText} onChange={e => setAiText(e.target.value)}
                   onKeyDown={e => e.key === "Enter" && parseAi()}
                   placeholder="Describe a note…"
                   className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
                   style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
            <button onClick={parseAi} disabled={!aiText.trim() || aiLoading}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
              {aiLoading ? <Loader size={12} className="animate-spin" /> : "Parse"}
            </button>
          </div>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2 text-center px-4">
              <span style={{ fontSize: 32 }}>📝</span>
              <p className="text-xs" style={{ color: "var(--mm-muted)" }}>No notes. Create one below.</p>
            </div>
          ) : visible.map(n => {
            const isLocked = n.locked && !pinUnlock[n.id];
            return (
              <button key={n.id}
                      onClick={() => { setSelected(n); setEditContent(n.content || ""); }}
                      className="w-full text-left px-4 py-3 border-b hover:bg-white/5 transition-colors"
                      style={{ borderColor: "var(--mm-border)", background: selected?.id === n.id ? "var(--mm-surface-2)" : "transparent" }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {n.pinned && <Pin size={10} style={{ color: "var(--mm-gold)" }} />}
                  {n.locked && <Lock size={10} style={{ color: "var(--mm-muted)" }} />}
                  <span className="text-sm font-medium truncate" style={{ color: "var(--mm-text)" }}>
                    {n.title || "Untitled"}
                  </span>
                </div>
                {!isLocked && (
                  <p className="text-xs truncate" style={{ color: "var(--mm-muted)" }}>
                    {n.content || "Empty note"}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {(n.tags || []).slice(0, 2).map(t => (
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)" }}>
                      {t}
                    </span>
                  ))}
                  <span className="text-xs ml-auto" style={{ color: "var(--mm-muted)" }}>
                    {timeAgo(n.updated_at || n.created_at)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* New note */}
        <div className="p-3 border-t" style={{ borderColor: "var(--mm-border)" }}>
          <div className="flex gap-2">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                   onKeyDown={e => e.key === "Enter" && addNote()}
                   placeholder="Note title…"
                   className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
                   style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
            <button onClick={addNote}
                    className="p-1.5 rounded-lg flex items-center"
                    style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Note toolbar */}
          <div className="px-6 py-3 flex items-center gap-3 border-b" style={{ borderColor: "var(--mm-border)" }}>
            <input value={selected.title || ""} onChange={e => update(selected.id, { title: e.target.value })}
                   className="flex-1 text-base font-semibold bg-transparent outline-none"
                   style={{ color: "var(--mm-text)" }} placeholder="Untitled" />
            <div className="flex items-center gap-1">
              <button onClick={() => update(selected.id, { pinned: !selected.pinned })}
                      className="p-1.5 rounded hover:bg-white/10"
                      style={{ color: selected.pinned ? "var(--mm-gold)" : "var(--mm-muted)" }}
                      title="Pin">
                <Pin size={14} />
              </button>
              <button onClick={() => update(selected.id, { locked: !selected.locked })}
                      className="p-1.5 rounded hover:bg-white/10"
                      style={{ color: selected.locked ? "var(--mm-gold)" : "var(--mm-muted)" }}
                      title="Lock">
                {selected.locked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              <button onClick={() => del(selected.id)}
                      className="p-1.5 rounded hover:bg-white/10"
                      style={{ color: "#E05252" }}
                      title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="px-6 py-2 flex items-center gap-2 border-b" style={{ borderColor: "var(--mm-border)" }}>
            <Tag size={12} style={{ color: "var(--mm-muted)" }} />
            <input value={(selected.tags || []).join(", ")}
                   onChange={e => update(selected.id, { tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
                   placeholder="tag1, tag2, tag3"
                   className="flex-1 text-xs bg-transparent outline-none"
                   style={{ color: "var(--mm-muted)" }} />
          </div>

          {/* Lock overlay */}
          {selected.locked && !pinUnlock[selected.id] ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Lock size={32} style={{ color: "var(--mm-muted)" }} />
              <p className="text-sm" style={{ color: "var(--mm-muted)" }}>This note is locked</p>
              <PinEntry onSubmit={pin => unlockNote(selected, pin)} />
            </div>
          ) : (
            <>
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                        className="flex-1 p-6 bg-transparent outline-none resize-none text-sm leading-relaxed"
                        style={{ color: "var(--mm-text)" }}
                        placeholder="Start writing…" />
              <div className="px-6 py-3 flex items-center gap-3 border-t" style={{ borderColor: "var(--mm-border)" }}>
                <span className="text-xs" style={{ color: "var(--mm-muted)" }}>
                  {editContent.length} chars · {editContent.split(/\s+/).filter(Boolean).length} words
                </span>
                <button onClick={saveContent} disabled={saving}
                        className="ml-auto px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                        style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <span style={{ fontSize: 48 }}>📝</span>
          <p className="text-sm" style={{ color: "var(--mm-muted)" }}>Select a note or create one</p>
        </div>
      )}

      {preview && (
        <EditablePreview title="Review Note" fields={preview.fields}
                         onConfirm={saveFromPreview} onDiscard={() => setPreview(null)} />
      )}
    </div>
  );
}

function PinEntry({ onSubmit }) {
  const [pin, setPin] = useState("");
  return (
    <div className="flex gap-2">
      <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)}
             onKeyDown={e => e.key === "Enter" && onSubmit(pin)}
             placeholder="Enter PIN"
             className="rounded-lg px-3 py-2 text-sm outline-none text-center tracking-widest"
             style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)", width: 120 }} />
      <button onClick={() => onSubmit(pin)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
        Unlock
      </button>
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
