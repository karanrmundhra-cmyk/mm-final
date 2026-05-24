import React, { useRef, useState } from "react";
import { Trash2, Check } from "lucide-react";

export default function SwipeRow({ onDelete, onComplete, children }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(null);
  const tracking = useRef(false);
  const THRESHOLD = 68;

  const start = (x) => { startX.current = x; tracking.current = true; };
  const move  = (x) => {
    if (!tracking.current) return;
    const dx = x - startX.current;
    setOffset(Math.max(-96, Math.min(96, dx)));
  };
  const end = () => {
    tracking.current = false;
    if (offset < -THRESHOLD && onDelete) onDelete();
    else if (offset > THRESHOLD && onComplete) onComplete();
    setOffset(0);
    startX.current = null;
  };

  const abs = Math.abs(offset);
  const isLeft  = offset < -10;
  const isRight = offset > 10;

  return (
    <div className="relative md:contents" style={{ overflow:"hidden" }}>
      {/* Swipe-right: complete */}
      {onComplete && isRight && (
        <div className="absolute inset-y-0 left-0 flex items-center px-4 pointer-events-none"
             style={{ background:"#52C77A", width: abs, minWidth:0, transition:"none" }}>
          <Check size={14} style={{ color:"#fff", opacity: abs > 30 ? 1 : 0 }} />
        </div>
      )}
      {/* Swipe-left: delete */}
      {onDelete && isLeft && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-end px-4 pointer-events-none"
             style={{ background:"#E05252", width: abs, minWidth:0, transition:"none" }}>
          <Trash2 size={14} style={{ color:"#fff", opacity: abs > 30 ? 1 : 0 }} />
        </div>
      )}
      <div style={{ transform:`translateX(${offset}px)`, transition: tracking.current ? "none" : "transform 0.22s ease",
                    background:"var(--mm-bg)", willChange:"transform" }}
           onTouchStart={e => start(e.touches[0].clientX)}
           onTouchMove={e => move(e.touches[0].clientX)}
           onTouchEnd={end}>
        {children}
      </div>
    </div>
  );
}
