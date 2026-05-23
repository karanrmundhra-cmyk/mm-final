/**
 * DigestWidget — weekly AI summary panel.
 * Used on the Dashboard and Reports pages.
 */
import React, { useState } from "react";
import { Loader, RefreshCw, Send, BookOpen, CheckSquare, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatAmount } from "@/lib/utils";

export default function DigestWidget() {
  const [digest,  setDigest]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [open,    setOpen]    = useState(false);

  const generate = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const { data } = await api.get("/digest/preview");
      setDigest(data);
    } catch {
      toast.error("Could not generate digest");
    }
    setLoading(false);
  };

  const sendTg = async () => {
    setSending(true);
    try {
      await api.post("/digest/send");
      toast.success("Digest sent to Telegram");
    } catch {
      toast.error("Send failed — is Telegram linked?");
    }
    setSending(false);
  };

  return (
    <div className="mm-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3"
           style={{ borderBottom: open ? "1px solid var(--mm-border)" : "none" }}>
        <div className="flex items-center gap-2">
          <BookOpen size={14} style={{ color: "var(--mm-gold)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>
            Weekly Digest
          </span>
          {digest && (
            <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(212,175,55,0.1)", color: "var(--mm-gold)", fontSize: 10 }}>
              AI Generated
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {digest && (
            <button
              onClick={sendTg}
              disabled={sending}
              title="Send to Telegram"
              className="mm-btn-ghost px-2 py-1 text-xs flex items-center gap-1">
              {sending
                ? <Loader size={11} className="animate-spin" />
                : <Send size={11} />}
              Send
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="mm-btn-gold px-3 py-1.5 text-xs flex items-center gap-1.5">
            {loading
              ? <Loader size={11} className="animate-spin" />
              : <RefreshCw size={11} />}
            {loading ? "Generating…" : digest ? "Refresh" : "Generate"}
          </button>
        </div>
      </div>

      {/* Content */}
      {open && (
        <div className="p-4">
          {loading && (
            <div className="flex items-center gap-2 py-4"
                 style={{ color: "var(--mm-muted)" }}>
              <Loader size={14} className="animate-spin" style={{ color: "var(--mm-gold)" }} />
              <span className="text-sm">Summarising your week with AI…</span>
            </div>
          )}

          {digest && !loading && (
            <>
              {/* Quick stats strip */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <MiniStat
                  icon={<CheckSquare size={11} />}
                  label="Completed"
                  value={digest.stats.completed}
                  color="#52C77A" />
                <MiniStat
                  icon={<CheckSquare size={11} />}
                  label="Pending"
                  value={digest.stats.pending}
                  color="var(--mm-muted)" />
                <MiniStat
                  icon={<TrendingUp size={11} />}
                  label="Net this week"
                  value={`₹${formatAmount(Math.abs(digest.stats.income - digest.stats.expense))}`}
                  color={digest.stats.income >= digest.stats.expense ? "#52C77A" : "#E05252"} />
              </div>

              {/* Top streaks */}
              {digest.stats.top_streaks?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {digest.stats.top_streaks.map((s, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                          style={{ background: "rgba(212,175,55,0.08)",
                                   color: "var(--mm-gold)", fontSize: 11 }}>
                      🔥 {s.activity} · {s.streak}d
                    </span>
                  ))}
                </div>
              )}

              {/* Expiring docs warning */}
              {digest.stats.expiring_docs > 0 && (
                <div className="mb-4 px-3 py-2 rounded-xl text-xs"
                     style={{ background: "rgba(224,82,82,0.08)",
                              color: "#E05252", border: "1px solid rgba(224,82,82,0.2)" }}>
                  ⚠️ {digest.stats.expiring_docs} document{digest.stats.expiring_docs > 1 ? "s" : ""} expiring within 30 days
                </div>
              )}

              {/* AI narrative — render as markdown-lite */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap"
                   style={{ color: "var(--mm-text)", lineHeight: 1.75 }}>
                {renderMarkdown(digest.summary)}
              </div>

              <p className="mt-3 text-xs" style={{ color: "var(--mm-muted)" }}>
                Generated {new Date(digest.generated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {digest.period?.from} → {digest.period?.to}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value, color }) {
  return (
    <div className="mm-card p-3 text-center" style={{ borderRadius: 14 }}>
      <div className="flex justify-center mb-1" style={{ color }}>{icon}</div>
      <div className="text-base font-medium mm-font-display" style={{ color }}>{value}</div>
      <div className="mm-label" style={{ fontSize: 10 }}>{label}</div>
    </div>
  );
}

/** Minimal markdown: ## headings → bold gold, **bold** → bold */
function renderMarkdown(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <p key={i} className="font-semibold mt-3 mb-1"
           style={{ color: "var(--mm-gold)", fontSize: 12, letterSpacing: "0.05em" }}>
          {line.replace("## ", "")}
        </p>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <p key={i} className="font-semibold mt-3 mb-1"
           style={{ color: "var(--mm-gold)", fontSize: 13, letterSpacing: "0.04em" }}>
          {line.replace("# ", "")}
        </p>
      );
    }
    // inline bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : p
    );
    return (
      <p key={i} style={{ minHeight: line ? undefined : "0.5em" }}>
        {parts}
      </p>
    );
  });
}
