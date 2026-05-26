import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, Bell, RefreshCw, Loader } from "lucide-react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

export default function Calendar({ embedded = false }) {
  const navigate = useNavigate();
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [tasks,     setTasks]     = useState([]);
  const [reminders, setReminders] = useState([]);
  const [routines,  setRoutines]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(today);

  const load = useCallback(async () => {
    try {
      const [t, r, ro] = await Promise.all([
        api.get("/tasks"),
        api.get("/reminders"),
        api.get("/routines"),
      ]);
      setTasks(t.data);
      setReminders(r.data);
      setRoutines(ro.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Build calendar grid */
  const year  = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const prev = () => setCurrent(new Date(year, month-1, 1));
  const next = () => setCurrent(new Date(year, month+1, 1));

  /* Items for a given date */
  const itemsForDay = (date) => {
    if (!date) return [];
    const items = [];
    tasks.filter(t => t.date && isSameDay(new Date(t.date), date) && !["Completed","Done"].includes(t.status))
         .forEach(t => items.push({ type:"task", label:t.task, color:"var(--mm-muted)" }));
    reminders.filter(r => r.fire_at && !r.dismissed && isSameDay(new Date(r.fire_at), date))
             .forEach(r => items.push({ type:"reminder", label:r.title, color:"var(--mm-gold)" }));
    return items;
  };

  /* Items for selected day (full detail) */
  const selectedTasks = tasks.filter(t => t.date && isSameDay(new Date(t.date), selected) && !["Completed","Done"].includes(t.status));
  const selectedReminders = reminders.filter(r => r.fire_at && isSameDay(new Date(r.fire_at), selected));
  const dayOfWeek = selected.getDay();
  const selectedRoutines = routines.filter(r => {
    if (r.frequency === "Daily" || r.frequency === "Weekdays" && dayOfWeek>=1 && dayOfWeek<=5) return true;
    if (r.frequency === "Weekends" && (dayOfWeek===0||dayOfWeek===6)) return true;
    if (r.frequency === `Every ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dayOfWeek]}`) return true;
    if (r.frequency === "Weekly" && isSameDay(selected, today)) return true;
    return false;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader size={18} className="animate-spin" style={{ color:"var(--mm-gold)" }} />
    </div>
  );

  return (
    <div className={`flex ${embedded ? "h-full" : "h-[calc(100vh-60px)]"} overflow-hidden`}>

      {/* ── Calendar grid ── */}
      <div className="flex-1 flex flex-col overflow-hidden px-5 py-6">

        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="mm-page-title">{MONTHS[month]} {year}</h1>
            <p className="mm-page-sub">
              {selectedTasks.length} tasks · {selectedReminders.length} reminders
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setCurrent(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); }}
                    className="mm-btn-ghost px-3 py-1.5 text-xs">Today</button>
            <button onClick={prev} className="mm-icon-btn"><ChevronLeft size={16} /></button>
            <button onClick={next} className="mm-icon-btn"><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center mm-label">{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="flex-1 grid grid-cols-7 gap-1 overflow-y-auto content-start">
          {cells.map((date, idx) => {
            if (!date) return <div key={`e-${idx}`} />;
            const isToday   = isSameDay(date, today);
            const isSel     = isSameDay(date, selected);
            const dayItems  = itemsForDay(date);

            return (
              <button key={date.getTime()} onClick={() => setSelected(date)}
                      className="p-2 text-left transition-all"
                      style={{
                        borderRadius: 16,
                        minHeight: 72,
                        background: isSel
                          ? "rgba(201,169,97,0.12)"
                          : isToday
                          ? "var(--mm-surface-2)"
                          : "transparent",
                        border: isSel
                          ? "1px solid var(--mm-gold)"
                          : isToday
                          ? "1px solid var(--mm-border)"
                          : "1px solid transparent",
                        boxShadow: isSel ? "0 0 12px rgba(201,169,97,0.15)" : "none",
                      }}>
                <span className="text-sm font-medium"
                      style={{
                        color: isToday ? "var(--mm-gold)" : "var(--mm-text)",
                        opacity: date.getMonth() !== month ? 0.3 : 1,
                      }}>
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayItems.slice(0,3).map((item, i) => (
                    <div key={i} className="text-xs truncate px-1 py-0.5"
                         style={{ background:`${item.color}18`, color:item.color, borderRadius:6, fontSize:10 }}>
                      {item.label}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <div className="text-xs" style={{ color:"var(--mm-muted)", fontSize:10 }}>
                      +{dayItems.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day detail panel ── */}
      <div className="w-72 flex-shrink-0 border-l flex flex-col overflow-hidden"
           style={{ borderColor:"var(--mm-border)", background:"var(--mm-surface)" }}>
        <div className="px-4 py-4 border-b" style={{ borderColor:"var(--mm-border)" }}>
          <p className="mm-font-display text-xl" style={{ color:"var(--mm-text)", fontWeight:400 }}>
            {selected.toLocaleDateString("en-IN",{ weekday:"long" })}
          </p>
          <p className="mm-label mt-0.5">
            {selected.toLocaleDateString("en-IN",{ day:"numeric", month:"long" })}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Tasks */}
          {selectedTasks.length > 0 && (
            <div className="px-4 pt-4 pb-2">
              <p className="mm-label mb-2">Tasks Due</p>
              {selectedTasks.map(t => (
                <button key={t.id} onClick={() => navigate("/tasks")}
                        className="mm-row w-full flex items-center gap-2.5 px-3 py-2.5 mb-1 text-left"
                        style={{ borderRadius:12, background:"rgba(79,142,247,0.08)" }}>
                  <Check size={12} style={{ color:"var(--mm-muted)", flexShrink:0 }} />
                  <span className="flex-1 text-sm truncate" style={{ color:"var(--mm-text)" }}>{t.task}</span>
                </button>
              ))}
            </div>
          )}

          {/* Reminders */}
          {selectedReminders.length > 0 && (
            <div className="px-4 pt-3 pb-2">
              <p className="mm-label mb-2">Reminders</p>
              {selectedReminders.map(r => (
                <button key={r.id} onClick={() => navigate("/reminders")}
                        className="mm-row w-full flex items-center gap-2.5 px-3 py-2.5 mb-1 text-left"
                        style={{ borderRadius:12, background:"rgba(201,169,97,0.08)", opacity:r.dismissed?0.5:1 }}>
                  <Bell size={12} style={{ color:"var(--mm-gold)", flexShrink:0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color:"var(--mm-text)" }}>{r.title}</p>
                    {r.fire_at && (
                      <p className="text-xs" style={{ color:"var(--mm-muted)" }}>
                        {new Date(r.fire_at).toLocaleTimeString("en-IN",{ hour:"2-digit", minute:"2-digit" })}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Routines */}
          {selectedRoutines.length > 0 && (
            <div className="px-4 pt-3 pb-2">
              <p className="mm-label mb-2">Routines</p>
              {selectedRoutines.map(r => (
                <button key={r.id} onClick={() => navigate("/routines")}
                        className="mm-row w-full flex items-center gap-2.5 px-3 py-2.5 mb-1 text-left"
                        style={{ borderRadius:12, background:"rgba(168,85,247,0.08)" }}>
                  <RefreshCw size={12} style={{ color:"var(--mm-muted)", flexShrink:0 }} />
                  <span className="flex-1 text-sm truncate" style={{ color:"var(--mm-text)" }}>{r.activity}</span>
                  <span className="text-xs" style={{ color:"var(--mm-muted)" }}>{r.frequency}</span>
                </button>
              ))}
            </div>
          )}

          {selectedTasks.length === 0 && selectedReminders.length === 0 && selectedRoutines.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="mm-divider" style={{ width:40 }} />
              <p className="mm-label">Nothing scheduled</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
