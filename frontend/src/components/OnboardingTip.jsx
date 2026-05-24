import React, { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

const TIPS = {
  tasks:     'Try the AI bar: "Call Priya about Q2 deck tomorrow at 3pm #Finance"',
  cashflow:  'Try: "Paid ₹8500 rent to Commercial Properties via NEFT on 1st June"',
  notes:     'Try: "Meeting notes — discussed budget, decided to cut 20% opex"',
  reminders: 'Try: "Remind me to file advance tax on 15th September at 10am"',
};

export default function OnboardingTip({ page }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!page || !TIPS[page]) return;
    const key = `mm_tip_${page}`;
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(t);
    }
  }, [page]);
  const dismiss = () => {
    localStorage.setItem(`mm_tip_${page}`, "1");
    setVisible(false);
  };
  if (!visible || !TIPS[page]) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mb-4 animate-fade-in"
         style={{ background:"rgba(212,175,55,0.07)", border:"1px solid rgba(212,175,55,0.25)",
                  borderRadius:12 }}>
      <Sparkles size={13} style={{ color:"var(--mm-gold)", flexShrink:0 }} />
      <p className="flex-1 text-xs italic" style={{ color:"var(--mm-gold)", opacity:0.85 }}>
        {TIPS[page]}
      </p>
      <button onClick={dismiss} style={{ color:"var(--mm-muted)", flexShrink:0 }}>
        <X size={11} />
      </button>
    </div>
  );
}
