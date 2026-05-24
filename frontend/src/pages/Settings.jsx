import React, { useState, useEffect, useCallback } from "react";
import { Loader, Save, Copy, Check, ExternalLink, Download } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import People from "@/pages/People";
import RecycleBin from "@/pages/RecycleBin";

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tgStatus, setTgStatus] = useState(null);
  const [tgCode, setTgCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("Profile");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });

  const TABS = ["Profile", "Appearance", "Telegram", "Export", "Account", "People", "Trash"];

  const load = useCallback(async () => {
    try {
      const [sRes, tgRes] = await Promise.all([
        api.get("/settings"),
        api.get("/telegram/status").catch(() => ({ data: { linked: false } }))
      ]);
      setSettings(sRes.data);
      setTgStatus(tgRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch) => {
    setSaving(true);
    try {
      await api.patch("/settings", patch);
      setSettings(s => ({ ...s, ...patch }));
      toast.success("✓ Saved");
    } catch { toast.error("Save failed"); }
    setSaving(false);
  };

  const saveProfile = async () => {
    await save({ name: settings.name, email: settings.email, timezone: settings.timezone });
  };

  const generateTgCode = async () => {
    try {
      const { data } = await api.post("/telegram/link");
      setTgCode(data.code);
    } catch { toast.error("Failed"); }
  };

  const copyCode = () => {
    if (!tgCode) return;
    navigator.clipboard.writeText(`/start ${tgCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const changePassword = async () => {
    if (pwForm.next !== pwForm.confirm) { toast.error("Passwords don't match"); return; }
    if (pwForm.next.length < 8) { toast.error("Min 8 characters"); return; }
    try {
      await api.post("/auth/change-password", { current_password: pwForm.current, new_password: pwForm.next });
      toast.success("✓ Password changed");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch { toast.error("Current password incorrect"); }
  };

  const exportAll = () => { window.open(`${api.defaults.baseURL}/export/all.xlsx`, "_blank"); };

  const copyIcal = () => {
    const url = `${api.defaults.baseURL}/calendar/ical`;
    navigator.clipboard.writeText(url);
    toast.success("iCal URL copied");
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const isLight = html.classList.contains("light");
    html.classList.toggle("light", !isLight);
    localStorage.setItem("mm_theme", isLight ? "dark" : "light");
    save({ theme: isLight ? "dark" : "light" });
  };

  if (loading) return <LoadingPage />;

  const theme = document.documentElement.classList.contains("light") ? "light" : "dark";

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold mm-font-display" style={{ color: "var(--mm-text)" }}>Settings</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--mm-muted)" }}>Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: "var(--mm-border)" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-2 text-sm font-medium transition-colors relative"
                  style={{ color: tab === t ? "var(--mm-text)" : "var(--mm-muted)" }}>
            {t}
            {tab === t && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                   style={{ background: "var(--mm-gold)" }} />
            )}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === "Profile" && settings && (
        <div className="space-y-4">
          <Field label="Full Name">
            <input value={settings.name || ""} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
                   className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                   style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          </Field>
          <Field label="Email">
            <input value={settings.email || ""} onChange={e => setSettings(s => ({ ...s, email: e.target.value }))}
                   type="email"
                   className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                   style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
          </Field>
          <Field label="Timezone">
            <select value={settings.timezone || "Asia/Kolkata"} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }}>
              {["Asia/Kolkata","Asia/Dubai","Asia/Singapore","Europe/London","America/New_York","America/Los_Angeles","UTC"].map(tz => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </Field>
          <SaveBtn onClick={saveProfile} saving={saving} />
        </div>
      )}

      {/* Appearance */}
      {tab === "Appearance" && (
        <div className="space-y-4">
          <div className="mm-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>Theme</p>
              <p className="text-xs" style={{ color: "var(--mm-muted)" }}>Currently: {theme}</p>
            </div>
            <button onClick={toggleTheme}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
              Switch to {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>

          {settings && (
            <>
              <Field label="Daily Digest Time">
                <input type="time" value={settings.digest_time || "08:00"} onChange={e => setSettings(s => ({ ...s, digest_time: e.target.value }))}
                       className="rounded-lg px-3 py-2 text-sm outline-none"
                       style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
              </Field>
              <SaveBtn onClick={() => save({ digest_time: settings.digest_time })} saving={saving} />
            </>
          )}
        </div>
      )}

      {/* Telegram */}
      {tab === "Telegram" && (
        <div className="space-y-4">
          <div className="mm-card p-4">
            <p className="text-sm font-medium mb-1" style={{ color: "var(--mm-text)" }}>Telegram Bot</p>
            <p className="text-xs mb-3" style={{ color: "var(--mm-muted)" }}>
              Link your Telegram account to receive briefings, add tasks via chat, and get reminders.
            </p>
            {tgStatus?.linked ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--mm-gold)" }} />
                <span className="text-sm" style={{ color: "var(--mm-gold)" }}>Connected as @{tgStatus.username}</span>
              </div>
            ) : tgCode ? (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: "var(--mm-muted)" }}>
                  1. Open <strong>@MindMattersBot</strong> on Telegram<br />
                  2. Send the command below
                </p>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-sm"
                     style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }}>
                  <span className="flex-1">/start {tgCode}</span>
                  <button onClick={copyCode} className="p-1 rounded"
                          style={{ color: copied ? "var(--mm-gold)" : "var(--mm-muted)" }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-xs" style={{ color: "var(--mm-muted)" }}>Code expires in 10 minutes.</p>
              </div>
            ) : (
              <button onClick={generateTgCode}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
                Generate Link Code
              </button>
            )}
          </div>
        </div>
      )}

      {/* Export */}
      {tab === "Export" && (
        <div className="space-y-3">
          <div className="mm-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>Export All Data</p>
              <p className="text-xs" style={{ color: "var(--mm-muted)" }}>Download everything as Excel workbook</p>
            </div>
            <button onClick={exportAll}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
              <Download size={14} /> Export XLSX
            </button>
          </div>
          <div className="mm-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>iCal Feed</p>
              <p className="text-xs" style={{ color: "var(--mm-muted)" }}>Subscribe in Apple Calendar, Google Calendar, etc.</p>
            </div>
            <button onClick={copyIcal}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                    style={{ border: "1px solid var(--mm-border)", color: "var(--mm-muted)" }}>
              <Copy size={14} /> Copy URL
            </button>
          </div>
        </div>
      )}

      {/* Account */}
      {tab === "Account" && (
        <div className="space-y-4">
          <div className="mm-card p-4">
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--mm-text)" }}>Change Password</p>
            <div className="space-y-3">
              <Field label="Current Password">
                <input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                       className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                       style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
              </Field>
              <Field label="New Password">
                <input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                       className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                       style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
              </Field>
              <Field label="Confirm New Password">
                <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                       className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                       style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)", color: "var(--mm-text)" }} />
              </Field>
              <button onClick={changePassword}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
                Update Password
              </button>
            </div>
          </div>

          <div className="mm-card p-4">
            <p className="text-sm font-medium mb-1" style={{ color: "var(--mm-text)" }}>Account Info</p>
            <p className="text-xs" style={{ color: "var(--mm-muted)" }}>Signed in as <strong>{user?.email || settings?.email}</strong></p>
          </div>
        </div>
      )}

      {tab === "People" && <People />}

      {tab === "Trash" && <RecycleBin />}

    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs block mb-1.5" style={{ color: "var(--mm-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, saving }) {
  return (
    <button onClick={onClick} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
      {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
      {saving ? "Saving…" : "Save Changes"}
    </button>
  );
}

function LoadingPage() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader size={24} className="animate-spin" style={{ color: "var(--mm-gold)" }} />
    </div>
  );
}
