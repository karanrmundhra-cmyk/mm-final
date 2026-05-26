import React, { useState, useEffect, useCallback } from "react";
import { Loader, Save, Copy, Check, ExternalLink, Download, Keyboard } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import People from "@/pages/People";
import RecycleBin from "@/pages/RecycleBin";
import Projects from "@/pages/Projects";

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
  const [density, setDensityState] = useState(() => localStorage.getItem("mm_density") || "default");
  const [oled,    setOledState]    = useState(() => localStorage.getItem("mm_oled") === "1");

  const TABS = ["Profile", "Appearance", "Spaces", "Telegram", "Export", "Account", "People", "Trash"];

  const load = useCallback(async () => {
    try {
      const [sRes, tgRes] = await Promise.all([
        api.get("/settings"),
        api.get("/telegram/status").catch(() => ({ data: { linked: false } }))
      ]);
      /* Pre-populate name / email from auth token if settings API left them blank */
      const merged = {
        ...sRes.data,
        name:  sRes.data.name  || user?.name  || "",
        email: sRes.data.email || user?.email || "",
      };
      setSettings(merged);
      setTgStatus(tgRes.data);
    } catch {}
    setLoading(false);
  }, [user]);

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

  const applyDensity = (d) => {
    const html = document.documentElement;
    html.classList.remove("density-compact", "density-comfortable");
    if (d === "compact")      html.classList.add("density-compact");
    if (d === "comfortable")  html.classList.add("density-comfortable");
    localStorage.setItem("mm_density", d);
    setDensityState(d);
  };

  const toggleOled = () => {
    const html = document.documentElement;
    html.classList.toggle("oled");
    const next = html.classList.contains("oled");
    localStorage.setItem("mm_oled", next ? "1" : "0");
    setOledState(next);
  };

  if (loading) return <LoadingPage />;

  const theme = document.documentElement.classList.contains("light") ? "light" : "dark";

  return (
    <div className={`px-4 py-6 mx-auto ${tab === "Spaces" ? "max-w-5xl" : "max-w-2xl"}`}>
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
          {/* Theme */}
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

          {/* Row density */}
          <div className="mm-card p-4">
            <p className="text-sm font-medium mb-1" style={{ color: "var(--mm-text)" }}>Row Density</p>
            <p className="text-xs mb-3" style={{ color: "var(--mm-muted)" }}>Adjust spacing in tables and lists</p>
            <div className="flex gap-2">
              {[
                { key:"compact",     label:"Compact",     desc:"Tighter rows" },
                { key:"default",     label:"Default",     desc:"Balanced" },
                { key:"comfortable", label:"Comfortable", desc:"Spacious rows" },
              ].map(({ key, label, desc }) => {
                const active = density === key;
                return (
                  <button key={key} onClick={() => applyDensity(key)}
                          className="flex-1 px-3 py-3 rounded-xl text-center transition-all"
                          style={{
                            background: active ? "rgba(201,169,97,0.12)" : "var(--mm-surface-2)",
                            border: active ? "1px solid var(--mm-border-gold)" : "1px solid var(--mm-border)",
                          }}>
                    <p className="text-sm font-medium mb-0.5" style={{ color: active ? "var(--mm-gold)" : "var(--mm-text)" }}>
                      {label}
                    </p>
                    <p className="text-xs" style={{ color: "var(--mm-muted)" }}>{desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* OLED mode */}
          <div className="mm-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>OLED True Black</p>
              <p className="text-xs" style={{ color: "var(--mm-muted)" }}>
                Pure #000 background — saves battery on OLED screens
              </p>
            </div>
            <button onClick={toggleOled}
                    className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                    style={{
                      background: oled ? "var(--mm-gold)" : "var(--mm-surface-3)",
                      border: "1px solid var(--mm-border)",
                    }}>
              <span className="absolute top-0.5 rounded-full transition-all"
                    style={{
                      width: 20, height: 20,
                      background: "#0A0A0A",
                      left: oled ? 18 : 2,
                    }} />
            </button>
          </div>

          {/* Keyboard shortcuts */}
          <div className="mm-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--mm-text)" }}>Keyboard Shortcuts</p>
              <p className="text-xs" style={{ color: "var(--mm-muted)" }}>
                View all available keyboard shortcuts · also press <kbd className="px-1 py-0.5 text-xs"
                  style={{ background:"var(--mm-surface-3)", border:"1px solid var(--mm-border)", borderRadius:5 }}>⌘/</kbd>
              </p>
            </div>
            <button onClick={() => window.dispatchEvent(new CustomEvent("mm:shortcuts"))}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                    style={{ border:"1px solid var(--mm-border)", color:"var(--mm-muted)" }}>
              <Keyboard size={13} /> View
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

      {tab === "Spaces" && (
        <div className="-mx-4 -my-6">
          <Projects />
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
