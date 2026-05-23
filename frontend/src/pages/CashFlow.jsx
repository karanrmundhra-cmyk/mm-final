import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Upload, Download } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatAmount } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";

const CATS = ["Income","Expense","Asset","Liability"];
const EMPTY = { vendor:"", details:"", amount:"", category:"Expense", mode:"", head:"", currency:"INR",
                date: new Date().toISOString().slice(0,10) };

const CAT_COLORS = { Income:"#52C77A", Expense:"#E05252", Asset:"#4F8EF7", Liability:"#E0A052" };

export default function CashFlow() {
  const [txns, setTxns] = useState([]);
  const [totals, setTotals] = useState({ Income:0, Expense:0, Asset:0, Liability:0 });
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newRow, setNewRow] = useState({ ...EMPTY });
  const [filter, setFilter] = useState({ category: "" });

  const load = useCallback(async () => {
    try {
      const [txRes, totRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/cashflow/totals")
      ]);
      setTxns(txRes.data);
      setTotals(totRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parseAi = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/parse/transaction", { text: aiText });
      const fields = [
        { key:"vendor", label:"Vendor", value: data.vendor, confidence: data.confidence },
        { key:"amount", label:"Amount", value: data.amount, confidence: data.confidence },
        { key:"category", label:"Category", value: data.category, confidence: "medium" },
        { key:"details", label:"Details", value: data.details, confidence: "medium" },
        { key:"mode", label:"Mode", value: data.mode, confidence: "low" },
        { key:"date", label:"Date", value: data.date, confidence: "high" },
      ];
      setPreview({ fields, raw: data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/transactions", { ...preview.raw, ...values });
      toast.success("✓ Transaction added");
      setPreview(null); setAiText("");
      load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.vendor.trim() && !newRow.details.trim()) return;
    try {
      await api.post("/transactions", { ...newRow, amount: parseFloat(newRow.amount) || 0 });
      toast.success("✓ Transaction added");
      setNewRow({ ...EMPTY });
      load();
    } catch {}
  };

  const update = async (id, patch) => {
    setTxns(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
    try { await api.patch(`/transactions/${id}`, patch); } catch {}
  };

  const del = async (id) => {
    try { await api.delete(`/transactions/${id}`); toast.success("✓ Moved to trash"); load(); } catch {}
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/transactions/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`✓ Parsed ${data.count} transactions. Review and confirm.`);
    } catch { toast.error("Upload failed"); }
  };

  const exportCsv = () => { window.open(`${api.defaults.baseURL}/export/cashflow.csv`, "_blank"); };

  const visible = txns.filter(t => !filter.category || t.category === filter.category);

  if (loading) return <LoadingPage />;

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Cash Flow</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>Unified financial ledger</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-white/5"
                 style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
            <Upload size={12} /> Import
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleUpload} />
          </label>
          <button onClick={exportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:bg-white/5"
                  style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {CATS.map(cat => (
          <button key={cat} onClick={() => setFilter(f => ({ ...f, category: f.category === cat ? "" : cat }))}
                  className="rounded-xl p-4 text-left transition-all hover:opacity-90"
                  style={{
                    background: filter.category === cat ? `${CAT_COLORS[cat]}22` : "var(--mm-surface)",
                    border: `1px solid ${filter.category === cat ? CAT_COLORS[cat] : "var(--mm-border)"}`
                  }}>
            <div className="text-xs mb-1" style={{ color: "var(--mm-muted)" }}>{cat}</div>
            <div className="text-lg font-semibold" style={{ color: CAT_COLORS[cat] }}>
              ₹{formatAmount(totals[cat] || 0)}
            </div>
          </button>
        ))}
      </div>

      {/* AI bar */}
      <div className="flex gap-2 mb-4">
        <input value={aiText} onChange={e => setAiText(e.target.value)}
               onKeyDown={e => e.key === "Enter" && parseAi()}
               placeholder='e.g. "Paid 85000 rent to Commercial Properties via NEFT"'
               className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
               style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
        <button onClick={parseAi} disabled={!aiText.trim() || aiLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
          {aiLoading ? <Loader size={14} className="animate-spin" /> : null} Parse
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="💰" title="No transactions yet"
          desc="Track income, expenses, assets, and liabilities."
          example='"Received ₹500,000 salary from KM Ventures"'
          cta="+ Add Transaction" onCta={() => {}} />
      ) : (
        <div className="mm-card overflow-hidden">
          <div className="mm-table-wrap">
            <div className="hidden md:grid px-3 py-2 text-xs font-medium uppercase tracking-wide"
                 style={{ gridTemplateColumns: "44px 130px 1fr 1fr 120px 130px 60px",
                          color: "var(--mm-muted)", borderBottom: "1px solid var(--mm-border)" }}>
              <span>#</span><span>Date</span><span>Vendor</span>
              <span>Details</span><span>Category</span><span>Amount</span><span></span>
            </div>
            {visible.map((t, idx) => (
              <div key={t.id}
                   className="grid items-center px-3 py-2 border-b hover:bg-white/3 transition-colors"
                   style={{ gridTemplateColumns: "44px 130px 1fr 1fr 120px 130px 60px",
                            borderColor: "var(--mm-border)", minWidth: 840 }}>
                <span className="text-xs mm-frozen-col" style={{ color: "var(--mm-muted)" }}>{idx + 1}</span>
                <input type="date" value={t.date || ""}
                       onChange={e => update(t.id, { date: e.target.value })}
                       className="mm-input-ghost text-xs" />
                <input value={t.vendor || ""} onChange={e => update(t.id, { vendor: e.target.value })}
                       className="mm-input-ghost text-sm" placeholder="Vendor" />
                <input value={t.details || ""} onChange={e => update(t.id, { details: e.target.value })}
                       className="mm-input-ghost text-sm" placeholder="Details" />
                <select value={t.category} onChange={e => update(t.id, { category: e.target.value })}
                        className="mm-input-ghost text-xs">
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{ color: "var(--mm-muted)" }}>₹</span>
                  <input value={t.amount}
                         onChange={e => update(t.id, { amount: parseFloat(e.target.value) || 0 })}
                         type="number" className="mm-input-ghost text-sm font-medium"
                         style={{ color: CAT_COLORS[t.category] }} />
                </div>
                <div className="flex justify-end">
                  <button onClick={() => del(t.id)} className="p-1 rounded hover:bg-white/10"
                          style={{ color: "#E05252" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New row */}
      <div className="mt-3 mm-card p-3">
        <div className="grid gap-2 md:grid-cols-5">
          <input value={newRow.vendor} onChange={e => setNewRow(r => ({ ...r, vendor: e.target.value }))}
                 placeholder="Vendor" className="rounded-lg px-3 py-2 text-sm outline-none"
                 style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          <input value={newRow.details} onChange={e => setNewRow(r => ({ ...r, details: e.target.value }))}
                 placeholder="Details" className="rounded-lg px-3 py-2 text-sm outline-none"
                 style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          <div className="flex gap-1">
            <select value={newRow.category} onChange={e => setNewRow(r => ({ ...r, category: e.target.value }))}
                    className="rounded-lg px-2 py-2 text-sm outline-none flex-1"
                    style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 rounded-lg px-3 py-2"
               style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)" }}>
            <span className="text-sm" style={{ color: "var(--mm-muted)" }}>₹</span>
            <input type="number" value={newRow.amount} onChange={e => setNewRow(r => ({ ...r, amount: e.target.value }))}
                   placeholder="Amount" className="flex-1 bg-transparent text-sm outline-none"
                   style={{ color: "var(--mm-text)" }} />
          </div>
          <button onClick={addManual} className="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium"
                  style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {preview && (
        <EditablePreview title="Review Transaction" fields={preview.fields}
                         onConfirm={saveFromPreview} onDiscard={() => setPreview(null)} />
      )}
    </div>
  );
}

function EmptyState({ icon, title, desc, example, cta, onCta }) {
  return (
    <div className="flex flex-col items-center py-20 gap-4 text-center">
      <span style={{ fontSize: 48 }}>{icon}</span>
      <h2 className="text-lg font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>{title}</h2>
      <p className="text-sm max-w-xs" style={{ color: "var(--mm-muted)" }}>{desc}</p>
      {example && <p className="text-xs italic" style={{ color: "var(--mm-muted)" }}>Example: {example}</p>}
      {cta && <button onClick={onCta} className="mt-2 px-5 py-2.5 rounded-xl font-medium text-sm"
                      style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>{cta}</button>}
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
