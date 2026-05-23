import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Pin, Tag, Lock, Unlock, Search } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";

const EMPTY = { title:"", content:"", tags:[], pinned:false, locked:false };

export default function Notes() {
  const [notes,       setNotes]      = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [aiText,      setAiText]     = useState("");
  const [aiLoading,   setAiLoading]  = useState(false);
  const [preview,     setPreview]    = useState(null);
  const [selected,    setSelected]   = useState(null);
  const [filter,      setFilter]     = useState({ tag:"", search:"" });
  const [tags,        setTags]       = useState([]);
  const [newTitle,    setNewTitle]   = useState("");
  const [pinUnlock,   setPinUnlock]  = useState({});
  const [editContent, setEditContent]= useState("");
  const [saving,      setSaving]     = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notes");
      setNotes(data);
      setTags([...new Set(data.flatMap(n => n.tags||[]).filter(Boolean))]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) setEditContent(selected.content||"");
  }, [selected?.id, selected?.content]); // eslint-disable-line react-hooks/exhaustive-deps

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/note",{ text:aiText });
      setPreview({ fields:[
        { key:"title",   label:"Title",   value:data.title,                  confidence:data.confidence },
        { key:"content", label:"Content", value:data.content,                confidence:"medium" },
        { key:"tags",    label:"Tags",    value:(data.tags||[]).join(", "), confidence:"medium" },
      ], raw:data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      const t = values.tags ? values.tags.split(",").map(x=>x.trim()).filter(Boolean) : [];
      await api.post("/notes",{ ...preview.raw,...values, tags:t });
      toast.success("Note added");
      setPreview(null); setAiText(""); load();
    } catch { toast.error("Save failed"); }
  };

  const addNote = async () => {
    if (!newTitle.trim()) return;
    try {
      const { data } = await api.post("/notes",{ title:newTitle, content:"", tags:[] });
      toast.success("Note created");
      setNewTitle(""); await load(); setSelected(data);
    } catch {}
  };

  const saveContent = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/notes/${selected.id}`,{ content:editContent });
      setNotes(ns => ns.map(n => n.id===selected.id ? {...n,content:editContent} : n));
      setSelected(s => s ? {...s,content:editContent} : s);
    } catch {}
    setSaving(false);
  };

  const update = async (id, patch) => {
    setNotes(ns => ns.map(n => n.id===id ? {...n,...patch} : n));
    if (selected?.id===id) setSelected(s => s ? {...s,...patch} : s);
    try { await api.patch(`/notes/${id}`,patch); } catch {}
  };

  const del = async (id) => {
    try {
      await api.delete(`/notes/${id}`);
      toast.success("Moved to trash");
      if (selected?.id===id) setSelected(null);
      load();
    } catch {}
  };

  const unlockNote = (note, pin) => {
    if (pin===(note.pin||"1234")) {
      setPinUnlock(p => ({...p,[note.id]:true}));
    } else { toast.error("Incorrect PIN"); }
  };

  const visible = notes.filter(n => {
    if (filter.tag && !(n.tags||[]).includes(filter.tag)) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!n.title?.toLowerCase().includes(q) && !n.content?.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    return new Date(b.updated_at||b.created_at||0) - new Date(a.updated_at||a.created_at||0);
  });

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader size={18} className="animate-spin" style={{ color:"var(--mm-gold)" }} />
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Sidebar ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r"
           style={{ borderColor:"var(--mm-border)", background:"var(--mm-surface)" }}>

        {/* Header */}
        <div className="px-4 py-4 border-b" style={{ borderColor:"var(--mm-border)" }}>
          <h1 className="mm-page-title mb-3" style={{ fontSize:20 }}>Notes</h1>
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color:"var(--mm-muted)" }} />
            <input value={filter.search} onChange={e => setFilter(f=>({...f,search:e.target.value}))}
                   placeholder="Search notes…"
                   className="mm-form-input pl-8 text-xs" />
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              <button onClick={() => setFilter(f=>({...f,tag:""}))}
                      className={`mm-filter-tab ${!filter.tag ? "active" : ""}`}>
                All
              </button>
              {tags.map(t => (
                <button key={t} onClick={() => setFilter(f=>({...f,tag:f.tag===t?"":t}))}
                        className={`mm-filter-tab ${filter.tag===t ? "active" : ""}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI bar */}
        <div className="px-3 py-2 border-b" style={{ borderColor:"var(--mm-border)" }}>
          <div className="flex gap-0">
            <input value={aiText} onChange={e => setAiText(e.target.value)}
                   onKeyDown={e => e.key==="Enter" && parseAi()}
                   placeholder="Describe a note…"
                   className="mm-ai-input text-xs" style={{ fontSize:12 }} />
            <button onClick={parseAi} disabled={!aiText.trim()||aiLoading}
                    className="mm-btn-gold px-3 disabled:opacity-40 flex items-center gap-1 text-xs">
              {aiLoading ? <Loader size={11} className="animate-spin" /> : "Parse"}
            </button>
          </div>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="mm-label">No notes</p>
            </div>
          ) : visible.map(n => {
            const isLocked = n.locked && !pinUnlock[n.id];
            return (
              <button key={n.id}
                      onClick={() => { setSelected(n); setEditContent(n.content||""); }}
                      className="mm-row w-full text-left px-4 py-3 border-b"
                      style={{
                        borderColor:"var(--mm-border)",
                        background: selected?.id===n.id ? "var(--mm-surface-2)" : "transparent",
                        borderLeft: selected?.id===n.id ? "2px solid var(--mm-gold)" : "2px solid transparent",
                      }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {n.pinned && <Pin size={10} style={{ color:"var(--mm-gold)" }} />}
                  {n.locked && <Lock size={10} style={{ color:"var(--mm-muted)" }} />}
                  <span className="text-sm font-medium truncate" style={{ color:"var(--mm-text)" }}>
                    {n.title||"Untitled"}
                  </span>
                </div>
                {!isLocked && (
                  <p className="text-xs truncate mt-0.5" style={{ color:"var(--mm-muted)" }}>
                    {n.content||"Empty note"}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  {(n.tags||[]).slice(0,2).map(t => (
                    <span key={t} className="text-xs px-1.5 py-0.5"
                          style={{ background:"var(--mm-surface-3)", color:"var(--mm-muted)", letterSpacing:"0.08em" }}>
                      {t}
                    </span>
                  ))}
                  <span className="text-xs ml-auto" style={{ color:"var(--mm-muted)", fontSize:10 }}>
                    {timeAgo(n.updated_at||n.created_at)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* New note */}
        <div className="p-3 border-t" style={{ borderColor:"var(--mm-border)" }}>
          <div className="flex gap-0">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                   onKeyDown={e => e.key==="Enter" && addNote()}
                   placeholder="New note title…"
                   className="mm-ai-input text-xs" style={{ fontSize:12 }} />
            <button onClick={addNote} title="Create note"
                    className="mm-btn-gold px-3 flex items-center">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Editor ── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Toolbar */}
          <div className="px-6 py-3 flex items-center gap-3 border-b"
               style={{ borderColor:"var(--mm-border)" }}>
            <input value={selected.title||""} onChange={e => update(selected.id,{title:e.target.value})}
                   className="flex-1 bg-transparent outline-none mm-font-display"
                   style={{ color:"var(--mm-text)", fontSize:18, fontWeight:400 }}
                   placeholder="Untitled" />
            <div className="flex items-center gap-0.5">
              <button onClick={() => update(selected.id,{pinned:!selected.pinned})}
                      title={selected.pinned ? "Unpin" : "Pin note"}
                      className={`mm-icon-btn ${selected.pinned ? "active" : ""}`}>
                <Pin size={14} />
              </button>
              <button onClick={() => update(selected.id,{locked:!selected.locked})}
                      title={selected.locked ? "Unlock" : "Lock with PIN"}
                      className={`mm-icon-btn ${selected.locked ? "active" : ""}`}>
                {selected.locked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              <button onClick={() => del(selected.id)} title="Move to trash"
                      className="mm-icon-btn danger">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="px-6 py-2 flex items-center gap-2 border-b"
               style={{ borderColor:"var(--mm-border)" }}>
            <Tag size={11} style={{ color:"var(--mm-muted)" }} />
            <input value={(selected.tags||[]).join(", ")}
                   onChange={e => update(selected.id,{ tags:e.target.value.split(",").map(t=>t.trim()).filter(Boolean) })}
                   placeholder="tag1, tag2, tag3"
                   className="flex-1 text-xs bg-transparent outline-none"
                   style={{ color:"var(--mm-muted)" }} />
          </div>

          {/* Lock overlay */}
          {selected.locked && !pinUnlock[selected.id] ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <Lock size={28} style={{ color:"var(--mm-muted)" }} />
              <p className="mm-label">This note is locked</p>
              <PinEntry onSubmit={pin => unlockNote(selected,pin)} />
            </div>
          ) : (
            <>
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                        className="flex-1 p-6 bg-transparent outline-none resize-none text-sm leading-relaxed"
                        style={{ color:"var(--mm-text)", fontFamily:"'Inter', sans-serif" }}
                        placeholder="Start writing…" />
              <div className="px-6 py-3 flex items-center gap-3 border-t"
                   style={{ borderColor:"var(--mm-border)" }}>
                <span className="mm-label">
                  {editContent.length} chars · {editContent.split(/\s+/).filter(Boolean).length} words
                </span>
                <button onClick={saveContent} disabled={saving}
                        className="ml-auto mm-btn-gold px-5 text-xs disabled:opacity-40">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="mm-divider" style={{ width:48 }} />
          <p className="mm-label">Select a note or create one</p>
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
    <div className="flex gap-0">
      <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)}
             onKeyDown={e => e.key==="Enter" && onSubmit(pin)}
             placeholder="Enter PIN"
             className="mm-form-input text-sm text-center tracking-widest"
             style={{ width:120 }} />
      <button onClick={() => onSubmit(pin)} className="mm-btn-gold px-5 text-xs">
        Unlock
      </button>
    </div>
  );
}
