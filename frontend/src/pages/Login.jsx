import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup | forgot | reset
  const [form, setForm] = useState({ email: "", password: "", name: "", code: "", new_password: "" });
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { data } = await api.post("/auth/login", { email: form.email, password: form.password });
        login(data.token, data.user);
        navigate("/");
      } else if (mode === "signup") {
        const { data } = await api.post("/auth/signup", { email: form.email, password: form.password, name: form.name });
        login(data.token, data.user);
        navigate("/");
      } else if (mode === "forgot") {
        await api.post("/auth/forgot", { email: form.email });
        setResetSent(true);
        toast.success("Reset link sent to your email");
      } else if (mode === "reset") {
        await api.post("/auth/reset", { code: form.code, new_password: form.new_password });
        toast.success("Password reset. Please sign in.");
        setMode("login");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Something went wrong");
    }
    setLoading(false);
  };

  const demoLogin = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/demo-login");
      login(data.token, data.user);
      navigate("/");
    } catch { toast.error("Demo login failed"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
         style={{ background: "var(--mm-bg)" }}>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl overflow-hidden"
           style={{
             background: "var(--mm-surface)",
             border: "1px solid var(--mm-border)",
             boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,169,97,0.06)",
           }}>

        {/* ── Logo area ── */}
        <div className="flex flex-col items-center pt-10 pb-6 px-8">

          {/* MM Monogram logo — actual brand PNG */}
          <div style={{
            width: 116,
            height: 116,
            borderRadius: "50%",
            overflow: "hidden",
            marginBottom: 22,
            background: "#FFFFFF",
            boxShadow: "0 0 40px rgba(201,169,97,0.28), 0 0 0 1px rgba(201,169,97,0.18)",
            flexShrink: 0,
          }}>
            <img
              src="/mm-logo.png"
              alt="Mind Matters"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          {/* Wordmark */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 34,
            fontWeight: 400,
            color: "var(--mm-text)",
            letterSpacing: "0.03em",
            lineHeight: 1,
            marginBottom: 6,
          }}>
            Mind Matters
          </h1>

          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--mm-muted)",
            marginBottom: 20,
          }}>
            Personal Operating System
          </p>

          {/* Divider */}
          <div style={{
            width: 40,
            height: 1,
            background: "linear-gradient(90deg, transparent, var(--mm-gold), transparent)",
            marginBottom: 20,
          }} />

          {/* Mode label */}
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "var(--mm-muted)",
          }}>
            {mode === "login"  && "Sign In"}
            {mode === "signup" && "Create Account"}
            {mode === "forgot" && "Reset Password"}
            {mode === "reset"  && "New Password"}
          </p>
        </div>

        {/* ── Form area ── */}
        <div className="px-8 pb-8">
          {resetSent && mode === "forgot" ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm" style={{ color: "var(--mm-text)" }}>
                Check your email for a reset link.
              </p>
              <button onClick={() => setMode("reset")}
                      className="text-sm" style={{ color: "var(--mm-gold)" }}>
                Enter reset code →
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">

              {mode === "signup" && (
                <Field label="FULL NAME">
                  <input value={form.name} onChange={e => set("name", e.target.value)} required
                         placeholder="Karan Mundhra"
                         style={inputStyle} />
                </Field>
              )}

              {(mode === "login" || mode === "signup" || mode === "forgot") && (
                <Field label="EMAIL">
                  <input value={form.email} onChange={e => set("email", e.target.value)}
                         required type="email" placeholder="you@example.com"
                         style={inputStyle} />
                </Field>
              )}

              {(mode === "login" || mode === "signup") && (
                <Field label="PASSWORD">
                  <input value={form.password} onChange={e => set("password", e.target.value)}
                         required type="password" placeholder="••••••••"
                         style={inputStyle} />
                </Field>
              )}

              {mode === "reset" && (
                <>
                  <Field label="RESET CODE">
                    <input value={form.code} onChange={e => set("code", e.target.value)} required
                           placeholder="Code from your email"
                           style={inputStyle} />
                  </Field>
                  <Field label="NEW PASSWORD">
                    <input value={form.new_password} onChange={e => set("new_password", e.target.value)}
                           required type="password" placeholder="••••••••"
                           style={inputStyle} />
                  </Field>
                </>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                      className="w-full flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{
                        marginTop: 8,
                        padding: "13px 0",
                        borderRadius: 50,
                        background: "linear-gradient(135deg, #E4C98C 0%, #C9A961 50%, #b8942a 100%)",
                        color: "#0A0A0A",
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        border: "none",
                        cursor: loading ? "not-allowed" : "pointer",
                      }}>
                {loading && <Loader size={14} className="animate-spin" />}
                {!loading && (
                  <>
                    {mode === "login"  && "Sign In"}
                    {mode === "signup" && "Create Account"}
                    {mode === "forgot" && "Send Reset Link"}
                    {mode === "reset"  && "Reset Password"}
                  </>
                )}
              </button>

              {/* Demo */}
              {mode === "login" && (
                <>
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px" style={{ background: "var(--mm-border)" }} />
                    <span style={{ fontSize: 10, color: "var(--mm-muted)", letterSpacing: "0.15em" }}>OR</span>
                    <div className="flex-1 h-px" style={{ background: "var(--mm-border)" }} />
                  </div>
                  <button type="button" onClick={demoLogin} disabled={loading}
                          className="w-full disabled:opacity-60 transition-colors hover:bg-white/5"
                          style={{
                            padding: "12px 0",
                            borderRadius: 50,
                            border: "1px solid var(--mm-border)",
                            color: "var(--mm-muted)",
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 12,
                            letterSpacing: "0.08em",
                            background: "transparent",
                            cursor: "pointer",
                          }}>
                    Try Demo Account
                  </button>
                </>
              )}
            </form>
          )}

          {/* Footer links */}
          <div className="mt-5 text-center space-y-2">
            {mode === "login" && (
              <>
                <button onClick={() => setMode("forgot")}
                        style={{ fontSize: 11, color: "var(--mm-muted)", display: "block", width: "100%",
                                 letterSpacing: "0.06em" }}>
                  Forgot password?
                </button>
                <p style={{ fontSize: 11, color: "var(--mm-muted)" }}>
                  New here?{" "}
                  <button onClick={() => setMode("signup")}
                          style={{ color: "var(--mm-gold)", textDecoration: "underline",
                                   textUnderlineOffset: 2 }}>
                    Create account
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <button onClick={() => setMode("login")}
                      style={{ fontSize: 11, color: "var(--mm-muted)" }}>
                Already have an account?{" "}
                <span style={{ color: "var(--mm-gold)" }}>Sign in</span>
              </button>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button onClick={() => setMode("login")}
                      style={{ fontSize: 11, color: "var(--mm-muted)" }}>
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* ── Tagline footer ── */}
        <div style={{
          borderTop: "1px solid var(--mm-border)",
          padding: "12px 0",
          textAlign: "center",
        }}>
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 9,
            letterSpacing: "0.1em",
            color: "var(--mm-muted)",
            opacity: 0.6,
          }}>
            Calm · Intelligent · In Control
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--mm-border)",
  color: "var(--mm-text)",
  fontFamily: "'Outfit', sans-serif",
  fontSize: 13,
  outline: "none",
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{
        display: "block",
        marginBottom: 6,
        fontFamily: "'Outfit', sans-serif",
        fontSize: 9,
        letterSpacing: "0.06em",
        color: "var(--mm-muted)",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
