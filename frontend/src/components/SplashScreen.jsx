import React from "react";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50"
         style={{ background: "var(--mm-bg)" }}>
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
           style={{ background: "linear-gradient(135deg,#C9A961,#8A6030)",
                    boxShadow: "0 0 40px rgba(201,169,97,0.3)" }}>
        <span className="text-black font-bold text-3xl mm-font-display">M</span>
      </div>
      <div className="mm-gold-text text-2xl font-semibold mm-font-display tracking-widest mb-1">
        MIND MATTERS
      </div>
      <div className="text-xs tracking-widest" style={{ color: "var(--mm-muted)" }}>
        PERSONAL OPERATING SYSTEM
      </div>
      <div className="mt-10 flex gap-1">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
               style={{ background: "var(--mm-gold)", animationDelay: `${i*200}ms` }} />
        ))}
      </div>
    </div>
  );
}
