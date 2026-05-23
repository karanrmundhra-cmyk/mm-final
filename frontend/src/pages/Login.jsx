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
        toast.success("Password reset. Please log in.");
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
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: "var(--mm-bg)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
               style={{ background: "var(--mm-gold)22" }}>
            <span className="text-2xl">MM</span>
          </div>
          <h1 className="text-2xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>
            Mind Matters
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--mm-muted)" }}>
            {mode === "login" && "Welcome back"}
            {mode === "signup" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
            {mode === "reset" && "Enter new password"}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
          {resetSent && mode === "forgot" ? (
            <div className="text-center py-4">
              <p className="text-sm mb-4" style={{ color: "var(--mm-text)" }}>
                Check your email for a reset link. Enter your code below.
              </p>
              <button onClick={() => setMode("reset")}
                      className="text-sm" style={{ color: "var(--mm-gold)" }}>
                Enter reset code →
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>Full Name</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)} required
                         placeholder="Karan Mundhra"
                         className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                         style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                </div>
              )}

              {(mode === "login" || mode === "signup" || mode === "forgot") && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>Email</label>
                  <input value={form.email} onChange={e => set("email", e.target.value)} required type="email"
                         placeholder="you@example.com"
                         className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                         style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                </div>
              )}

              {(mode === "login" || mode === "signup") && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>Password</label>
                  <input value={form.password} onChange={e => set("password", e.target.value)} required type="password"
                         placeholder="••••••••"
                         className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                         style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                </div>
              )}

              {mode === "reset" && (
                <>
                  <div>
                    <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>Reset Code</label>
                    <input value={form.code} onChange={e => set("code", e.target.value)} required
                           placeholder="Code from email"
                           className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                           style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>New Password</label>
                    <input value={form.new_password} onChange={e => set("new_password", e.target.value)} required type="password"
                           placeholder="••••••••"
                           className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                           style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
                  </div>
                </>
              )}

              <button type="submit" disabled={loading}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
                {loading && <Loader size={14} className="animate-spin" />}
                {mode === "login" && "Sign In"}
                {mode === "signup" && "Create Account"}
                {mode === "forgot" && "Send Reset Link"}
                {mode === "reset" && "Reset Password"}
              </button>

              {mode === "login" && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" style={{ borderColor: "var(--mm-border)" }} />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2" style={{ background: "var(--mm-surface)", color: "var(--mm-muted)" }}>or</span>
                    </div>
                  </div>
                  <button type="button" onClick={demoLogin} disabled={loading}
                          className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-white/5 transition-colors"
                          style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
                    Try Demo Account
                  </button>
                </>
              )}
            </form>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-4 text-center text-xs space-y-1.5">
          {mode === "login" && (
            <>
              <button onClick={() => setMode("signup")} style={{ color: "var(--mm-gold)" }}>
                Don't have an account? Sign up
              </button>
              <br />
              <button onClick={() => setMode("forgot")} style={{ color: "var(--mm-muted)" }}>
                Forgot password?
              </button>
            </>
          )}
          {mode === "signup" && (
            <button onClick={() => setMode("login")} style={{ color: "var(--mm-gold)" }}>
              Already have an account? Sign in
            </button>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <button onClick={() => setMode("login")} style={{ color: "var(--mm-muted)" }}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
