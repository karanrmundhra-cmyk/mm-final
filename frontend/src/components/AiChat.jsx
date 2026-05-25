import React, { useState, useRef, useEffect } from "react";
import { X, Send, Zap } from "lucide-react";
import { api } from "@/lib/api";

export default function AiChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi, I'm your Chief of Staff. Ask me anything about your tasks, finances, routines, or schedule — I'm here to help you run your day." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const { data } = await api.post("/ai/chat", { message: text, session_id: sessionId });
      setMessages(m => [...m, { role: "assistant", text: data.response }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "Sorry, I couldn't connect. Try again." }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden pointer-events-auto animate-slide-up"
           style={{ background: "var(--mm-surface)", border: "1px solid var(--mm-border)",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.6)", maxHeight: "80vh" }}>
        <div className="flex items-center justify-between px-4 py-3"
             style={{ background: "linear-gradient(135deg,rgba(201,169,97,.1),rgba(0,0,0,0))",
                      borderBottom: "1px solid var(--mm-border)" }}>
          <div className="flex items-center gap-2">
            <Zap size={16} style={{ color: "var(--mm-gold)" }} />
            <span className="font-semibold text-sm mm-font-display" style={{ color: "var(--mm-text)" }}>
              Chief of Staff
            </span>
          </div>
          <button onClick={onClose} style={{ color: "var(--mm-muted)" }}><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: "50vh" }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-xs rounded-2xl px-3 py-2 text-sm"
                   style={{
                     background: m.role === "user" ? "var(--mm-gold)" : "var(--mm-surface-2)",
                     color: m.role === "user" ? "#0A0A0A" : "var(--mm-text)",
                     borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px"
                   }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3 py-2 flex gap-1"
                   style={{ background: "var(--mm-surface-2)", borderRadius: "18px 18px 18px 4px" }}>
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                       style={{ background: "var(--mm-muted)", animationDelay: `${i*150}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="p-3 flex gap-2" style={{ borderTop: "1px solid var(--mm-border)" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask anything..."
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--mm-surface-2)", border: "1px solid var(--mm-border)",
                     color: "var(--mm-text)" }}
          />
          <button onClick={send} disabled={!input.trim() || loading}
                  className="p-2 rounded-xl disabled:opacity-40"
                  style={{ background: "var(--mm-gold)", color: "#0A0A0A" }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
