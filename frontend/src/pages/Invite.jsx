import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Invite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = params.get("token");
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { setError("Invalid invite link"); setLoading(false); return; }
    api.get(`/invite/${token}`)
      .then(({ data }) => { setInvite(data); setLoading(false); })
      .catch(() => { setError("Invite not found or expired"); setLoading(false); });
  }, [token]);

  const accept = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post(`/invite/${token}/accept`, { name: form.name, password: form.password });
      login(data.token, data.user);
      toast.success("✓ Account created — welcome!");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to accept invite");
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--mm-bg)" }}>
      <Loader size={24} className="animate-spin" style={{ color: "var(--mm-gold)" }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--mm-bg)" }}>
      <div className="text-center">
        <p className="text-2xl mb-3">⚠️</p>
        <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--mm-text)" }}>{error}</h1>
        <button onClick={() => navigate("/login")} className="text-sm" style={{ color: "var(--mm-gold)" }}>
          Go to login →
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--mm-bg)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
               style={{ background: "var(--mm-gold)22" }}>
            <span className="text-2xl">MM</span>
          </div>
          <h1 className="text-xl font-semibold mm-font-display mb-1" style={{ color: "var(--mm-text)" }}>
            You're invited
          </h1>
          <p className="text-sm" style={{ color: "var(--mm-muted)" }}>
            {invite?.invited_by ? `${invite.invited_by} invited you to` : "Join"} Mind Matters
          </p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
          <form onSubmit={accept} className="space-y-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>Email</label>
              <input value={invite?.email || ""} disabled
                     className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-60"
                     style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>Your Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                     placeholder="Full name"
                     className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                     style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>Set Password</label>
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
                     type="password" placeholder="••••••••" minLength={8}
                     className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                     style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
            </div>
            <button type="submit" disabled={submitting}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
              {submitting && <Loader size={14} className="animate-spin" />}
              Accept Invite & Join
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
