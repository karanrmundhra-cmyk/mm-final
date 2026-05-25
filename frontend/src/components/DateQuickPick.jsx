import React from "react";

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function nextWeekday(dow) {
  const d = new Date();
  const diff = (dow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const today = () => addDays(0);

const PRESETS = [
  { label: "Today",   date: () => today() },
  { label: "Tomorrow",date: () => addDays(1) },
  { label: "Fri",     date: () => nextWeekday(5) },
  { label: "+7d",     date: () => addDays(7) },
];

export default function DateQuickPick({ value, onChange, inputClassName = "mm-input-ghost text-xs" }) {
  return (
    <div>
      <input
        type="date"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        className={inputClassName}
      />
      <div className="flex gap-1 mt-1 flex-wrap">
        {PRESETS.map(p => {
          const d = p.date();
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(d)}
              className={`mm-date-pill ${value === d ? "active" : ""}`}
            >
              {p.label}
            </button>
          );
        })}
        {value && (
          <button type="button" onClick={() => onChange("")} className="mm-date-pill">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
