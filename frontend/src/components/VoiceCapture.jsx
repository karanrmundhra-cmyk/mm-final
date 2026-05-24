import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, X, Check, Loader } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ConfidenceBadge from "@/components/ConfidenceBadge";

const TYPE_LABELS = { task: "📋 Task", reminder: "🔔 Reminder", note: "📝 Note", transaction: "💰 Transaction" };

export default function VoiceCapture({ onClose }) {
  const [phase, setPhase] = useState("idle"); // idle | recording | processing | preview
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const silenceRef = useRef(null);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    clearInterval(timerRef.current);
    clearTimeout(silenceRef.current);
    if (mediaRef.current) {
      mediaRef.current.stream?.getTracks().forEach(t => t.stop());
    }
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = handleStop;
      recorder.start(100);
      setPhase("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      silenceRef.current = setTimeout(() => stopRecording(), 30000);
    } catch (e) {
      setError("Microphone access denied. Please allow microphone use.");
    }
  }

  function stopRecording() {
    cleanup();
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }
    setPhase("processing");
  }

  async function handleStop() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("file", blob, "recording.webm");
    try {
      const { data } = await api.post("/parse/voice", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setTranscript(data.transcript || "");
      setItems(data.items || []);
      if (data.error) setError(data.error);
      setPhase("preview");
    } catch (e) {
      setError("Could not process audio. Please try again.");
      setPhase("idle");
    }
  }

  async function confirmAll() {
    let count = 0;
    for (const item of items) {
      try {
        if (item.type === "task") await api.post("/tasks", item.data);
        else if (item.type === "reminder") await api.post("/reminders", item.data);
        else if (item.type === "note") await api.post("/notes", item.data);
        else if (item.type === "transaction") await api.post("/transactions", item.data);
        count++;
      } catch {}
    }
    toast.success(`✓ ${count} item${count !== 1 ? "s" : ""} saved`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-slide-up"
           style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: "1px solid var(--mm-border)" }}>
          <span className="font-semibold text-sm mm-font-display" style={{ color: "var(--mm-text)" }}>
            Voice Capture
          </span>
          <button onClick={onClose} style={{ color: "var(--mm-muted)" }}><X size={16} /></button>
        </div>

        <div className="px-5 py-6">
          {/* Idle */}
          {phase === "idle" && (
            <div className="flex flex-col items-center gap-5">
              <p className="text-sm text-center" style={{ color: "var(--mm-muted)" }}>
                Tap to record. Say a task, reminder, note, or transaction.
              </p>
              <p className="text-xs text-center" style={{ color: "var(--mm-muted)", fontStyle: "italic" }}>
                "Call Priya about Q2 deck tomorrow and remind me at 9am"
              </p>
              <button
                onClick={startRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center transition-all"
                style={{ background: "linear-gradient(135deg,var(--mm-gold),var(--mm-gold-dark))",
                         boxShadow: "0 0 0 8px rgba(201,169,97,0.15)" }}>
                <Mic size={32} style={{ color: "#0A0A0A" }} />
              </button>
              {error && <p className="text-xs text-center" style={{ color: "var(--mm-muted)" }}>{error}</p>}
            </div>
          )}

          {/* Recording */}
          {phase === "recording" && (
            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--mm-gold)" }} />
                <span className="text-sm" style={{ color: "var(--mm-text)" }}>
                  Recording... {String(Math.floor(seconds / 60)).padStart(2,"0")}:{String(seconds % 60).padStart(2,"0")}
                </span>
              </div>
              {/* Waveform */}
              <div className="flex items-center gap-0.5 h-12">
                {Array.from({length: 24}).map((_, i) => (
                  <div key={i} className="rounded-full animate-pulse"
                       style={{ width: 3, background: "var(--mm-gold)",
                                height: `${20 + Math.random() * 28}px`,
                                animationDelay: `${i * 50}ms` }} />
                ))}
              </div>
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(212,175,55,0.1)", border: "2px solid var(--mm-border-gold)" }}>
                <Square size={20} style={{ color: "var(--mm-gold)" }} />
              </button>
            </div>
          )}

          {/* Processing */}
          {phase === "processing" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader size={32} className="animate-spin" style={{ color: "var(--mm-gold)" }} />
              <p className="text-sm" style={{ color: "var(--mm-muted)" }}>Processing audio...</p>
            </div>
          )}

          {/* Preview */}
          {phase === "preview" && (
            <div className="space-y-4">
              {transcript && (
                <div className="rounded-lg p-3" style={{ background: "var(--mm-surface-2)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--mm-muted)" }}>You said:</p>
                  <p className="text-sm" style={{ color: "var(--mm-text)", fontStyle: "italic" }}>
                    "{transcript}"
                  </p>
                </div>
              )}
              {items.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs" style={{ color: "var(--mm-muted)" }}>Items found ({items.length}):</p>
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2"
                         style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)" }}>
                      <div>
                        <span className="text-xs" style={{ color: "var(--mm-muted)" }}>
                          {TYPE_LABELS[item.type] || item.type}
                        </span>
                        <p className="text-sm" style={{ color: "var(--mm-text)" }}>
                          {item.data?.task || item.data?.title || item.data?.activity || item.data?.vendor || ""}
                        </p>
                      </div>
                      <ConfidenceBadge level={item.confidence} showLabel />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center" style={{ color: "var(--mm-muted)" }}>
                  {error || "No items detected. Try recording again."}
                </p>
              )}
              {error && <p className="text-xs" style={{ color: "var(--mm-muted)" }}>{error}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={confirmAll}
                  disabled={items.length === 0}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
                  <Check size={16} />
                  Confirm All ({items.length})
                </button>
                <button
                  onClick={() => { setPhase("idle"); setItems([]); setTranscript(""); setError(""); }}
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: "var(--mm-surface-2)", color: "var(--mm-muted)",
                           border: "1px solid var(--mm-border)" }}>
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
