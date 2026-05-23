import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader, Upload, Download } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatAmount } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import Skeleton from "@/components/Skeleton";
import AnomalyWidget from "@/components/AnomalyWidget";

const CATS  = ["Income","Expense","Asset","Liability"];
const EMPTY = { vendor:"", details:"", amount:"", category:"Expense", mode:"", head:"", currency:"INR",
                date: new Date().toISOString().slice(0,10) };

const CAT_COLORS  = { Income:"#52C77A", Expense:"#E05252", Asset:"#4F8EF7", Liability:"#E0A052" };

export default function CashFlow() {
  const [txns, setTxns]     = useState([]);
  const [totals, setTotals] = useState({ Income:0, Expense:0, Asset:0, Liability:0 });
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newRow, setNewRow] = useState({ ...EMPTY });
  const [filter, setFilter] = useState({ category:"" });

  const load = useCallback(async () => {
    try {
      const [txRes, totRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/cashflow/totals"),
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
      const { data } = await api.post("/parse/transaction",{ text:aiText });
      setPreview({ fields:[
        { key:"vendor",   label:"Vendor",   value:data.vendor,   confidence:data.confidence },
        { key:"amount",   label:"Amount",   value:data.amount,   confidence:data.confidence },
        { key:"category", label:"Category", value:data.category, confidence:"medium" },
        { key:"details",  label:"Details",  value:data.details,  confidence:"medium" },
        { key:"mode",     label:"Mode",     value:data.mode,     confidence:"low" },
        { key:"date",     label:"Date",     value:data.date,     confidence:"high" },
      ], raw:data });
    } catch { toast.error("Parse failed"); }
    setAiLoading(false);
  };

  const saveFromPreview = async (values) => {
    try {
      await api.post("/transactions",{ ...preview.raw,...values });
      toast.success("Transaction added");
      setPreview(null); setAiText(""); load();
    } catch { toast.error("Save failed"); }
  };

  const addManual = async () => {
    if (!newRow.vendor.trim() && !newRow.details.trim()) return;
    try {
      await api.post("/transactions",{ ...newRow, amount:parseFloat(newRow.amount)||0 });
      toast.success("Transaction added");
      setNewRow({ ...EMPTY }); load();
    } catch {}
  };

  const update = async (id, patch) => {
    setTxns(ts => ts.map(t => t.id===id ? {...t,...patch} : t));
    try { await api.patch(`/transactions/${id}`,patch); } catch {}
  };

  const del = async (id) => {
    try { await api.delete(`/transactions/${id}`); toast.success("Moved to trash"); load(); } catch {}
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file",file);
    try {
      const { data } = await api.post("/transactions/upload",fd,{ headers:{"Content-Type":"multipart/form-data"} });
      toast.success(`Parsed ${data.count} transactions. Review and confirm.`);
    } catch { toast.error("Upload failed"); }
  };

  const exportCsv = () => window.open(`${api.defaults.baseURL}/export/cashflow.csv`,"_blank");

  const visible  = txns.filter(t => !filter.category || t.category === filter.category);
  const net      = (totals.Income||0) - (totals.Expense||0);
  const netWorth = (totals.Asset||0) - (totals.Liability||0);

  if (loading) return <Skeleton.Page rows={8} />;

  return (
    <div className="px-5 py-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="mm-page-title">Cash Flow</h1>
          <p className="mm-page-sub">
            Net&nbsp;
            <span style={{ color: net >= 0 ? "#52C77A" : "#E05252" }}>
              ₹{formatAmount(Math.abs(net))}
            </span>
            &nbsp;·&nbsp;
            Net Worth&nbsp;
            <span style={{ color: netWorth >= 0 ? "#4F8EF7" : "#E05252" }}>
              ₹{formatAmount(Math.abs(netWorth))}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <label className="mm-btn-ghost flex items-center gap-1.5 cursor-pointer" title="Import CSV or XLSX">
            <Upload size={12} /> Import
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleUpload} />
          </label>
          <button onClick={exportCsv} title="Export to CSV"
                  className="mm-btn-ghost flex items-center gap-1.5">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* ── Net Worth card ── */}
      <div className="mm-card p-4 mb-5 flex items-center gap-6"
           style={{ background:"linear-gradient(135deg, rgba(79,142,247,0.08) 0%, rgba(17,17,20,0) 100%)",
                    borderColor:"rgba(79,142,247,0.2)" }}>
        <div>
          <p className="mm-label mb-1">Net Worth</p>
          <p className="mm-font-display text-3xl font-light"
             style={{ color: netWorth >= 0 ? "#4F8EF7" : "#E05252" }}>
            {netWorth >= 0 ? "" : "−"}₹{formatAmount(Math.abs(netWorth))}
          </p>
          <p className="text-xs mt-1" style={{ color:"var(--mm-muted)" }}>Assets − Liabilities</p>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="mm-card p-3" style={{ borderColor:"rgba(82,199,122,0.2)", background:"rgba(82,199,122,0.05)" }}>
            <p className="mm-label mb-1">Assets</p>
            <p className="text-lg mm-font-display font-light" style={{ color:"#52C77A" }}>
              ₹{formatAmount(totals.Asset||0)}
            </p>
          </div>
          <div className="mm-card p-3" style={{ borderColor:"rgba(224,160,82,0.2)", background:"rgba(224,160,82,0.05)" }}>
            <p className="mm-label mb-1">Liabilities</p>
            <p className="text-lg mm-font-display font-light" style={{ color:"#E0A052" }}>
              ₹{formatAmount(totals.Liability||0)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Category totals / filter ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {CATS.map((cat) => (
          <button key={cat}
                  onClick={() => setFilter(f => ({ ...f, category: f.category===cat ? "" : cat }))}
                  title={`Filter by ${cat}`}
                  className="mm-card p-4 text-left transition-all"
                  style={{
                    background: filter.category===cat ? `${CAT_COLORS[cat]}12` : "var(--mm-surface-2)",
                    borderColor: filter.category===cat ? `${CAT_COLORS[cat]}55` : "var(--mm-border)",
                    boxShadow: filter.category===cat
                      ? `0 4px 20px ${CAT_COLORS[cat]}22`
                      : "var(--elev-1)",
                  }}>
            <div className="mm-label mb-2" style={{ color:"var(--mm-muted)" }}>{cat}</div>
            <div className="text-xl font-light mm-font-display" style={{ color:CAT_COLORS[cat] }}>
              ₹{formatAmount(totals[cat]||0)}
            </div>
          </button>
        ))}
      </div>

      {/* ── Anomaly detection ── */}
      <AnomalyWidget />

      {/* ── AI bar ── */}
      <div className="flex gap-0 mb-5">
        <input value={aiText} onChange={e => setAiText(e.target.value)}
               onKeyDown={e => e.key==="Enter" && parseAi()}
               placeholder='Describe a transaction — "Paid 85000 rent to Commercial Properties via NEFT"'
               className="mm-ai-input" />
        <button onClick={parseAi} disabled={!aiText.trim()||aiLoading}
                className="mm-btn-gold px-5 disabled:opacity-40 flex items-center gap-2">
          {aiLoading ? <Loader size={13} className="animate-spin" /> : null}
          {aiLoading ? "Parsing…" : "Parse"}
        </button>
      </div>

      {/* ── Empty ── */}
      {visible.length === 0 && (
        <div className="mm-empty">
          <div className="mm-divider" style={{ width:48 }} />
          <p className="mm-empty-title">No transactions</p>
          <p className="mm-empty-desc">Track income, expenses, assets and liabilities.</p>
        </div>
      )}

      {/* ── Table ── */}
      {visible.length > 0 && (
        <div className="mm-card overflow-hidden mb-3">
          <div className="mm-table-wrap">
            <div className="hidden md:grid px-3 py-2 mm-label"
                 style={{ gridTemplateColumns:"44px 120px 1fr 1fr 110px 130px 52px",
                          borderBottom:"1px solid var(--mm-border)" }}>
              <span>#</span><span>Date</span><span>Vendor</span>
              <span>Details</span><span>Category</span><span>Amount</span><span></span>
            </div>
            {visible.map((t,idx) => (
              <div key={t.id}
                   className="mm-row grid items-center px-3 py-2 border-b"
                   style={{ gridTemplateColumns:"44px 120px 1fr 1fr 110px 130px 52px",
                            borderColor:"var(--mm-border)", minWidth:840 }}>

                <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{idx+1}</span>

                <input type="date" value={t.date||""}
                       onChange={e => update(t.id,{date:e.target.value})}
                       className="mm-input-ghost text-xs" />

                <input value={t.vendor||""} onChange={e => update(t.id,{vendor:e.target.value})}
                       className="mm-input-ghost text-sm" placeholder="Vendor" />

                <input value={t.details||""} onChange={e => update(t.id,{details:e.target.value})}
                       className="mm-input-ghost text-sm" placeholder="Details" />

                <select value={t.category} onChange={e => update(t.id,{category:e.target.value})}
                        className="mm-input-ghost text-xs mm-status-select"
                        style={{ color:CAT_COLORS[t.category]||"var(--mm-muted)" }}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>

                <div className="flex items-center gap-0.5">
                  <span className="text-xs mr-0.5" style={{ color:"var(--mm-muted)" }}>₹</span>
                  <input value={t.amount}
                         onChange={e => update(t.id,{amount:parseFloat(e.target.value)||0})}
                         type="number" className="mm-input-ghost text-sm font-medium"
                         style={{ color:CAT_COLORS[t.category] }} />
                </div>

                <div className="flex justify-end">
                  <button onClick={() => del(t.id)} title="Move to trash"
                          className="mm-icon-btn danger">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New row ── */}
      <div className="mm-card p-3">
        <div className="grid gap-2 md:grid-cols-5">
          <input value={newRow.vendor} onChange={e => setNewRow(r=>({...r,vendor:e.target.value}))}
                 placeholder="Vendor" className="mm-form-input" />
          <input value={newRow.details} onChange={e => setNewRow(r=>({...r,details:e.target.value}))}
                 placeholder="Details" className="mm-form-input" />
          <select value={newRow.category} onChange={e => setNewRow(r=>({...r,category:e.target.value}))}
                  className="mm-form-input" style={{ color:CAT_COLORS[newRow.category] }}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <div className="flex items-center" style={{ background:"var(--mm-surface-2)", border:"1px solid var(--mm-border)", padding:"0 12px" }}>
            <span className="text-sm mr-1" style={{ color:"var(--mm-muted)" }}>₹</span>
            <input type="number" value={newRow.amount}
                   onChange={e => setNewRow(r=>({...r,amount:e.target.value}))}
                   placeholder="Amount"
                   className="flex-1 bg-transparent text-sm outline-none"
                   style={{ color:"var(--mm-text)" }} />
          </div>
          <button onClick={addManual}
                  className="mm-btn-gold flex items-center justify-center gap-2">
            <Plus size={13} /> Add
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

