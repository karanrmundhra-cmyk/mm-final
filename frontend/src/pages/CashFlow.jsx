import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Trash2, Loader, Upload, Download, Scissors, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatAmount } from "@/lib/utils";
import EditablePreview from "@/components/EditablePreview";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import Skeleton from "@/components/Skeleton";
import AnomalyWidget from "@/components/AnomalyWidget";
import Sparkline from "@/components/Sparkline";
import OnboardingTip from "@/components/OnboardingTip";

const CATS  = ["Income","Expense","Asset","Liability"];
const MODES = ["Cash","UPI","NEFT","RTGS","Card","Cheque","Other"];
const EMPTY = {
  vendor:"", details:"", amount:"", category:"Expense", mode:"", head:"", currency:"INR",
  date: new Date().toISOString().slice(0,10)
};

const CAT_COLORS = { Income:"#D4AF37", Expense:"#888880", Asset:"#D4AF37", Liability:"#888880" };

const COLS = "44px 120px 1fr 1fr 110px 130px 88px";
// # | date | vendor | details | category | amount | actions

/* ── Column filter ── */
function ColFilter({ label, col, filter, setFilter, values, open, setOpen }) {
  const active = !!filter[col];
  const ref = useRef(null);

  useEffect(() => {
    if (open !== col) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, col, setOpen]);

  return (
    <div ref={ref} className="relative inline-flex items-center gap-0.5 select-none cursor-pointer">
      <button
        onClick={() => setOpen(open === col ? null : col)}
        className="flex items-center gap-1"
        style={{ color: active ? "var(--mm-gold)" : "inherit" }}
      >
        {label}
        {active && <span className="inline-block w-1.5 h-1.5 rounded-full ml-0.5" style={{ background:"var(--mm-gold)" }} />}
        <ChevronDown size={8} />
      </button>
      {open === col && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-lg overflow-hidden shadow-xl"
             style={{ minWidth:140, background:"var(--mm-surface-2)", border:"1px solid var(--mm-border-gold)" }}>
          <button
            className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
            style={{ color:"var(--mm-gold)", borderBottom:"1px solid var(--mm-border)" }}
            onClick={() => { setFilter(f => ({...f,[col]:""})); setOpen(null); }}
          >
            All {label}
          </button>
          {values.map(v => (
            <button
              key={v}
              className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
              style={{ color: filter[col]===v ? "var(--mm-gold)" : "var(--mm-muted)" }}
              onClick={() => { setFilter(f => ({...f,[col]:v})); setOpen(null); }}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CashFlow() {
  const [txns, setTxns]       = useState([]);
  const [totals, setTotals]   = useState({ Income:0, Expense:0, Asset:0, Liability:0 });
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText]   = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newRow, setNewRow]   = useState({ ...EMPTY });
  const [colFilter, setColFilter] = useState({ category:"", vendor:"", mode:"" });
  const [filterOpen, setFilterOpen] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [splitting, setSplitting] = useState(null);

  const load = useCallback(async () => {
    try {
      const [txRes, totRes, mRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/cashflow/totals"),
        api.get("/reports/cashflow-monthly", { params: { months: 7 } }),
      ]);
      setTxns(txRes.data);
      setTotals(totRes.data);
      setMonthly(mRes.data);
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
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to add transaction"); }
  };

  const update = async (id, patch) => {
    setTxns(ts => ts.map(t => t.id===id ? {...t,...patch} : t));
    try { await api.patch(`/transactions/${id}`,patch); } catch {}
  };

  const del = async (id) => {
    try { await api.delete(`/transactions/${id}`); toast.success("Moved to trash"); load(); } catch {}
  };

  const initSplit = (t) => setSplitting({
    txn: t,
    parts: [
      { amount:(t.amount/2).toFixed(0), category:t.category, vendor:t.vendor, details:"" },
      { amount:(t.amount/2).toFixed(0), category:"Expense",  vendor:t.vendor, details:"" },
    ]
  });

  const confirmSplit = async () => {
    if (!splitting) return;
    try {
      await Promise.all(splitting.parts.map(p =>
        api.post("/transactions",{ ...p, date:splitting.txn.date, amount:parseFloat(p.amount)||0 })
      ));
      await api.delete(`/transactions/${splitting.txn.id}`);
      toast.success("Transaction split");
      setSplitting(null); load();
    } catch { toast.error("Split failed"); }
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

  // Unique values for filter dropdowns
  const allVendors  = useMemo(() => [...new Set(txns.map(t=>t.vendor).filter(Boolean))], [txns]);
  const allModes    = useMemo(() => [...new Set(txns.map(t=>t.mode).filter(Boolean))],   [txns]);

  const visible = useMemo(() => txns.filter(t => {
    if (colFilter.category && t.category !== colFilter.category) return false;
    if (colFilter.vendor   && t.vendor   !== colFilter.vendor)   return false;
    if (colFilter.mode     && t.mode     !== colFilter.mode)     return false;
    return true;
  }), [txns, colFilter]);

  const net      = (totals.Income||0) - (totals.Expense||0);
  const netWorth = (totals.Asset||0)  - (totals.Liability||0);

  if (loading) return <Skeleton.Page rows={8} />;

  return (
    <div className="px-5 py-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="mm-page-title">Cash Flow</h1>
          <p className="mm-page-sub">
            Net&nbsp;
            <span style={{ color: net >= 0 ? "var(--mm-gold)" : "var(--mm-muted)" }}>
              ₹{formatAmount(Math.abs(net))}
            </span>
            &nbsp;·&nbsp;
            Net Worth&nbsp;
            <span style={{ color: netWorth >= 0 ? "var(--mm-gold)" : "var(--mm-muted)" }}>
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
           style={{ background:"linear-gradient(135deg,rgba(212,175,55,0.06) 0%,rgba(17,17,20,0) 100%)",
                    borderColor:"var(--mm-border-gold)" }}>
        <div>
          <p className="mm-label mb-1">Net Worth</p>
          <p className="mm-font-display text-3xl font-light"
             style={{ color: netWorth >= 0 ? "var(--mm-gold)" : "var(--mm-muted)" }}>
            {netWorth >= 0 ? "" : "−"}₹{formatAmount(Math.abs(netWorth))}
          </p>
          <p className="text-xs mt-1" style={{ color:"var(--mm-muted)" }}>Assets − Liabilities</p>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="mm-card p-3" style={{ borderColor:"var(--mm-border-gold)", background:"rgba(212,175,55,0.05)" }}>
            <p className="mm-label mb-1">Assets</p>
            <p className="text-lg mm-font-display font-light" style={{ color:"var(--mm-gold)" }}>
              ₹{formatAmount(totals.Asset||0)}
            </p>
          </div>
          <div className="mm-card p-3" style={{ borderColor:"var(--mm-border)", background:"var(--mm-surface-3)" }}>
            <p className="mm-label mb-1">Liabilities</p>
            <p className="text-lg mm-font-display font-light" style={{ color:"var(--mm-muted)" }}>
              ₹{formatAmount(totals.Liability||0)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Category totals / filter cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {CATS.map((cat) => {
          const sparkValues = monthly.map(m => m[cat] || 0);
          return (
            <button key={cat}
                    onClick={() => setColFilter(f => ({ ...f, category: f.category===cat ? "" : cat }))}
                    title={`Filter by ${cat}`}
                    className="mm-card p-4 text-left transition-all"
                    style={{
                      background: colFilter.category===cat ? `${CAT_COLORS[cat]}12` : "var(--mm-surface-2)",
                      borderColor: colFilter.category===cat ? `${CAT_COLORS[cat]}55` : "var(--mm-border)",
                      boxShadow: colFilter.category===cat ? `0 4px 20px ${CAT_COLORS[cat]}22` : "var(--elev-1)",
                    }}>
              <div className="mm-label mb-2" style={{ color:"var(--mm-muted)" }}>{cat}</div>
              <div className="text-xl font-light mm-font-display" style={{ color:CAT_COLORS[cat] }}>
                ₹{formatAmount(totals[cat]||0)}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Sparkline values={sparkValues} color={CAT_COLORS[cat]} width={72} height={20} />
                <span className="text-xs" style={{ color:"var(--mm-muted)", fontSize:9 }}>
                  {monthly.length ? monthly[monthly.length-1].month : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Anomaly detection ── */}
      <AnomalyWidget />

      {/* ── Onboarding tip ── */}
      <OnboardingTip page="cashflow" />

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
            {/* Column headers with filters */}
            <div className="hidden md:grid px-3 py-2 mm-label"
                 style={{ gridTemplateColumns:COLS, borderBottom:"1px solid var(--mm-border)" }}>
              <span>#</span>
              <span style={{ color:"var(--mm-muted)" }}>Date</span>
              <ColFilter label="Vendor"   col="vendor"   filter={colFilter} setFilter={setColFilter}
                         values={allVendors} open={filterOpen} setOpen={setFilterOpen} />
              <span style={{ color:"var(--mm-muted)" }}>Details</span>
              <ColFilter label="Category" col="category" filter={colFilter} setFilter={setColFilter}
                         values={CATS} open={filterOpen} setOpen={setFilterOpen} />
              <span style={{ color:"var(--mm-muted)" }}>Amount</span>
              <span></span>
            </div>

            {visible.map((t,idx) => (
              <div key={t.id}
                   className="mm-row grid items-center px-3 py-2 border-b"
                   style={{ gridTemplateColumns:COLS, borderColor:"var(--mm-border)", minWidth:840 }}>

                <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{idx+1}</span>

                <input type="date" value={t.date||""}
                       onChange={e => update(t.id,{date:e.target.value})}
                       className="mm-input-ghost text-xs" />

                <div className="flex items-center gap-1 min-w-0">
                  <input value={t.vendor||""} onChange={e => update(t.id,{vendor:e.target.value})}
                         className="mm-input-ghost text-sm flex-1 min-w-0" placeholder="Vendor" />
                  {t.confidence && t.confidence !== "high" &&
                    <ConfidenceBadge level={t.confidence} size="xs" />}
                </div>

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

                <div className="flex justify-end gap-0.5">
                  <button onClick={() => initSplit(t)} title="Split transaction" className="mm-icon-btn">
                    <Scissors size={12} />
                  </button>
                  <button onClick={() => del(t.id)} title="Move to trash"
                          className="mm-icon-btn" style={{ color:"var(--mm-muted)" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New row — matches table columns exactly ── */}
      <div className="mm-card overflow-hidden mb-3">
        <div className="hidden md:grid px-3 py-1.5 mm-label"
             style={{ gridTemplateColumns:COLS, borderBottom:"1px solid var(--mm-border)" }}>
          <span></span>
          <span style={{ color:"var(--mm-gold)" }}>New entry</span>
          <span>Vendor</span><span>Details</span><span>Category</span><span>Amount</span><span></span>
        </div>
        <div className="grid items-center px-3 py-2 gap-1"
             style={{ gridTemplateColumns:COLS, minWidth:840 }}>
          {/* index placeholder */}
          <span />

          {/* Date */}
          <input type="date" value={newRow.date}
                 onChange={e => setNewRow(r=>({...r,date:e.target.value}))}
                 className="mm-form-input text-xs" />

          {/* Vendor */}
          <input value={newRow.vendor}
                 onChange={e => setNewRow(r=>({...r,vendor:e.target.value}))}
                 placeholder="Vendor"
                 className="mm-form-input text-sm" />

          {/* Details */}
          <input value={newRow.details}
                 onChange={e => setNewRow(r=>({...r,details:e.target.value}))}
                 onKeyDown={e => e.key==="Enter" && addManual()}
                 placeholder="Details"
                 className="mm-form-input text-sm" />

          {/* Category */}
          <select value={newRow.category}
                  onChange={e => setNewRow(r=>({...r,category:e.target.value}))}
                  className="mm-form-input text-xs"
                  style={{ color:CAT_COLORS[newRow.category] }}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>

          {/* Amount */}
          <div className="flex items-center mm-form-input gap-1 px-2">
            <span className="text-xs" style={{ color:"var(--mm-muted)" }}>₹</span>
            <input type="number" value={newRow.amount}
                   onChange={e => setNewRow(r=>({...r,amount:e.target.value}))}
                   placeholder="0"
                   className="flex-1 bg-transparent text-sm outline-none"
                   style={{ color:CAT_COLORS[newRow.category] }} />
          </div>

          {/* Add button */}
          <button onClick={addManual}
                  className="mm-btn-gold flex items-center justify-center gap-1.5 text-xs px-2 py-1.5">
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {preview && (
        <EditablePreview title="Review Transaction" fields={preview.fields}
                         onConfirm={saveFromPreview} onDiscard={() => setPreview(null)} />
      )}

      {splitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(12px)" }}>
          <div className="w-full max-w-md animate-scale-in"
               style={{ background:"var(--mm-surface)", border:"1px solid var(--mm-border-gold)",
                        borderRadius:28, padding:28, boxShadow:"var(--elev-modal)" }}>
            <h2 className="mm-font-display text-base mb-1" style={{ color:"var(--mm-text)", fontWeight:400 }}>
              Split: {splitting.txn.vendor}
            </h2>
            <p className="text-xs mb-5" style={{ color:"var(--mm-muted)" }}>
              Original: ₹{splitting.txn.amount} · Splits must add up to this amount
            </p>
            <div className="space-y-3 mb-5">
              {splitting.parts.map((p, i) => (
                <div key={i} className="mm-card p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center mm-form-input gap-1 px-2">
                      <span className="text-xs" style={{ color:"var(--mm-muted)" }}>₹</span>
                      <input type="number" value={p.amount}
                             onChange={e => setSplitting(s => ({...s, parts: s.parts.map((pp,j) => j===i ? {...pp,amount:e.target.value} : pp)}))}
                             className="flex-1 bg-transparent text-sm outline-none" style={{ color:"var(--mm-text)" }} />
                    </div>
                    <select value={p.category}
                            onChange={e => setSplitting(s => ({...s, parts: s.parts.map((pp,j) => j===i ? {...pp,category:e.target.value} : pp)}))}
                            className="mm-form-input" style={{ color:CAT_COLORS[p.category] }}>
                      {CATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <input value={p.details} placeholder="Details (optional)"
                         onChange={e => setSplitting(s => ({...s, parts: s.parts.map((pp,j) => j===i ? {...pp,details:e.target.value} : pp)}))}
                         className="mm-form-input text-xs" />
                </div>
              ))}
              {splitting.parts.length < 4 && (
                <button onClick={() => setSplitting(s => ({...s, parts:[...s.parts,{amount:0,category:"Expense",vendor:s.txn.vendor,details:""}]}))}
                        className="mm-btn-ghost w-full text-xs py-1.5">
                  + Add another part
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmSplit} className="mm-btn-gold flex-1">Confirm Split</button>
              <button onClick={() => setSplitting(null)} className="mm-btn-ghost px-5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
