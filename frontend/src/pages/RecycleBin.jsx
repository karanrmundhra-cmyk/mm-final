import React, { useState, useEffect, useCallback } from "react";
import { Loader, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";

const TYPE_LABELS = { task: "Task", routine: "Routine", transaction: "Transaction", note: "Note", reminder: "Reminder", person: "Person", document: "Document" };
const TYPE_COLORS = { task: "#C9A961", routine: "#C9A961", transaction: "#C9A961", note: "#C9A961", reminder: "#C9A961", person: "#C9A961", document: "#C9A961" };

export default function RecycleBin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/recycle-bin");
      setItems(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const restore = async (item) => {
    try {
      await api.post("/recycle-bin/restore", { item_type: item._type, item_id: item.id });
      toast.success("✓ Restored");
      load();
    } catch { toast.error("Restore failed"); }
  };

  const deletePermanent = async (item) => {
    try {
      await api.delete("/recycle-bin/permanent", { data: { item_type: item._type, item_id: item.id } });
      toast.success("✓ Permanently deleted");
      load();
    } catch { toast.error("Delete failed"); }
  };

  const clearAll = async () => {
    try {
      await Promise.all(items.map(item => api.delete("/recycle-bin/permanent", { data: { item_type: item._type, item_id: item.id } }).catch(() => {})));
      toast.success("✓ Trash cleared");
      setConfirmClear(false);
      load();
    } catch {}
  };

  const getLabel = (item) => {
    return item.task || item.title || item.activity || item.vendor || item.name || "Untitled";
  };

  const visible = filter ? items.filter(i => i._type === filter) : items;
  const types = [...new Set(items.map(i => i._type))];

  if (loading) return <LoadingPage />;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Trash</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>
            {items.length} item{items.length !== 1 ? "s" : ""} · Auto-purged after 30 days
          </p>
        </div>
        {items.length > 0 && (
          <button onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "var(--mm-surface-3)", color: "var(--mm-muted)", border: "1px solid var(--mm-border)" }}>
            <Trash2 size={12} /> Empty Trash
          </button>
        )}
      </div>

      {/* Type filter */}
      {types.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setFilter("")}
                  className="px-3 py-1 rounded-full text-xs"
                  style={{ background: !filter ? "var(--mm-gold)" : "var(--mm-surface-2)", color: !filter ? "#0A0A0A" : "var(--mm-muted)", border: "1px solid var(--mm-border)" }}>
            All
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(f => f === t ? "" : t)}
                    className="px-3 py-1 rounded-full text-xs capitalize"
                    style={{ background: filter === t ? "var(--mm-gold)" : "var(--mm-surface-2)", color: filter === t ? "#0A0A0A" : "var(--mm-muted)", border: "1px solid var(--mm-border)" }}>
              {TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4 text-center">
          <span style={{ fontSize: 48 }}>🗑️</span>
          <h2 className="text-lg font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Trash is empty</h2>
          <p className="text-sm max-w-xs" style={{ color: "var(--mm-muted)" }}>Deleted items appear here for 30 days before being permanently removed.</p>
        </div>
      ) : (
        <div className="mm-card overflow-hidden">
          {visible.map((item, idx) => {
            const typeColor = TYPE_COLORS[item._type] || "var(--mm-muted)";
            const daysLeft = item.deleted_at ? Math.max(0, 30 - Math.round((Date.now() - new Date(item.deleted_at).getTime()) / 86400000)) : 30;
            return (
              <div key={item.id || idx}
                   className="flex items-center gap-3 px-4 py-3 border-b hover:bg-white/3 transition-colors"
                   style={{ borderColor: "var(--mm-border)" }}>
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${typeColor}22`, color: typeColor }}>
                  {TYPE_LABELS[item._type] || item._type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--mm-text)" }}>{getLabel(item)}</p>
                  <p className="text-xs" style={{ color: "var(--mm-muted)" }}>
                    Deleted {timeAgo(item.deleted_at)} · {daysLeft}d until permanent deletion
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => restore(item)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs hover:bg-white/10"
                          style={{ color: "var(--mm-gold)", border: "1px solid var(--mm-border-gold)" }}
                          title="Restore">
                    <RotateCcw size={11} /> Restore
                  </button>
                  <button onClick={() => deletePermanent(item)}
                          className="p-1.5 rounded-lg hover:bg-white/10"
                          style={{ color: "var(--mm-muted)" }}
                          title="Delete forever">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-2xl p-6 w-full max-w-sm animate-fade-in text-center"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
            <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: "var(--mm-muted)" }} />
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--mm-text)" }}>Empty Trash?</h2>
            <p className="text-sm mb-4" style={{ color: "var(--mm-muted)" }}>
              This will permanently delete all {items.length} items. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={clearAll}
                      className="flex-1 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "var(--mm-surface-3)", color: "var(--mm-text)", border: "1px solid var(--mm-border)" }}>
                Delete All
              </button>
              <button onClick={() => setConfirmClear(false)}
                      className="flex-1 py-2 rounded-lg text-sm"
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
