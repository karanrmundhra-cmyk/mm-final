import React, { useState, useEffect } from "react";
import { Plus, X, Search } from "lucide-react";

/* ── City database ─────────────────────────────────────────────── */
const CITIES = [
  // Americas
  { city: "New York",       tz: "America/New_York",                  country: "US" },
  { city: "Los Angeles",    tz: "America/Los_Angeles",               country: "US" },
  { city: "Chicago",        tz: "America/Chicago",                   country: "US" },
  { city: "Miami",          tz: "America/New_York",                  country: "US" },
  { city: "Dallas",         tz: "America/Chicago",                   country: "US" },
  { city: "San Francisco",  tz: "America/Los_Angeles",               country: "US" },
  { city: "Toronto",        tz: "America/Toronto",                   country: "CA" },
  { city: "Vancouver",      tz: "America/Vancouver",                 country: "CA" },
  { city: "Calgary",        tz: "America/Edmonton",                  country: "CA" },
  { city: "Mexico City",    tz: "America/Mexico_City",               country: "MX" },
  { city: "São Paulo",      tz: "America/Sao_Paulo",                 country: "BR" },
  { city: "Rio de Janeiro", tz: "America/Sao_Paulo",                 country: "BR" },
  { city: "Buenos Aires",   tz: "America/Argentina/Buenos_Aires",    country: "AR" },
  { city: "Bogotá",         tz: "America/Bogota",                    country: "CO" },
  { city: "Lima",           tz: "America/Lima",                      country: "PE" },
  // Europe
  { city: "London",         tz: "Europe/London",                     country: "GB" },
  { city: "Paris",          tz: "Europe/Paris",                      country: "FR" },
  { city: "Berlin",         tz: "Europe/Berlin",                     country: "DE" },
  { city: "Madrid",         tz: "Europe/Madrid",                     country: "ES" },
  { city: "Barcelona",      tz: "Europe/Madrid",                     country: "ES" },
  { city: "Rome",           tz: "Europe/Rome",                       country: "IT" },
  { city: "Amsterdam",      tz: "Europe/Amsterdam",                  country: "NL" },
  { city: "Zurich",         tz: "Europe/Zurich",                     country: "CH" },
  { city: "Vienna",         tz: "Europe/Vienna",                     country: "AT" },
  { city: "Brussels",       tz: "Europe/Brussels",                   country: "BE" },
  { city: "Stockholm",      tz: "Europe/Stockholm",                  country: "SE" },
  { city: "Oslo",           tz: "Europe/Oslo",                       country: "NO" },
  { city: "Copenhagen",     tz: "Europe/Copenhagen",                 country: "DK" },
  { city: "Helsinki",       tz: "Europe/Helsinki",                   country: "FI" },
  { city: "Warsaw",         tz: "Europe/Warsaw",                     country: "PL" },
  { city: "Prague",         tz: "Europe/Prague",                     country: "CZ" },
  { city: "Budapest",       tz: "Europe/Budapest",                   country: "HU" },
  { city: "Bucharest",      tz: "Europe/Bucharest",                  country: "RO" },
  { city: "Athens",         tz: "Europe/Athens",                     country: "GR" },
  { city: "Lisbon",         tz: "Europe/Lisbon",                     country: "PT" },
  { city: "Istanbul",       tz: "Europe/Istanbul",                   country: "TR" },
  { city: "Moscow",         tz: "Europe/Moscow",                     country: "RU" },
  { city: "Kyiv",           tz: "Europe/Kiev",                       country: "UA" },
  // Middle East & Africa
  { city: "Dubai",          tz: "Asia/Dubai",                        country: "AE" },
  { city: "Abu Dhabi",      tz: "Asia/Dubai",                        country: "AE" },
  { city: "Riyadh",         tz: "Asia/Riyadh",                       country: "SA" },
  { city: "Doha",           tz: "Asia/Qatar",                        country: "QA" },
  { city: "Kuwait City",    tz: "Asia/Kuwait",                       country: "KW" },
  { city: "Manama",         tz: "Asia/Bahrain",                      country: "BH" },
  { city: "Muscat",         tz: "Asia/Muscat",                       country: "OM" },
  { city: "Tel Aviv",       tz: "Asia/Jerusalem",                    country: "IL" },
  { city: "Beirut",         tz: "Asia/Beirut",                       country: "LB" },
  { city: "Amman",          tz: "Asia/Amman",                        country: "JO" },
  { city: "Baghdad",        tz: "Asia/Baghdad",                      country: "IQ" },
  { city: "Tehran",         tz: "Asia/Tehran",                       country: "IR" },
  { city: "Cairo",          tz: "Africa/Cairo",                      country: "EG" },
  { city: "Casablanca",     tz: "Africa/Casablanca",                 country: "MA" },
  { city: "Lagos",          tz: "Africa/Lagos",                      country: "NG" },
  { city: "Nairobi",        tz: "Africa/Nairobi",                    country: "KE" },
  { city: "Johannesburg",   tz: "Africa/Johannesburg",               country: "ZA" },
  { city: "Cape Town",      tz: "Africa/Johannesburg",               country: "ZA" },
  { city: "Accra",          tz: "Africa/Accra",                      country: "GH" },
  { city: "Addis Ababa",    tz: "Africa/Addis_Ababa",                country: "ET" },
  // Asia
  { city: "Mumbai",         tz: "Asia/Kolkata",                      country: "IN" },
  { city: "New Delhi",      tz: "Asia/Kolkata",                      country: "IN" },
  { city: "Bangalore",      tz: "Asia/Kolkata",                      country: "IN" },
  { city: "Chennai",        tz: "Asia/Kolkata",                      country: "IN" },
  { city: "Hyderabad",      tz: "Asia/Kolkata",                      country: "IN" },
  { city: "Kolkata",        tz: "Asia/Kolkata",                      country: "IN" },
  { city: "Karachi",        tz: "Asia/Karachi",                      country: "PK" },
  { city: "Lahore",         tz: "Asia/Karachi",                      country: "PK" },
  { city: "Islamabad",      tz: "Asia/Karachi",                      country: "PK" },
  { city: "Dhaka",          tz: "Asia/Dhaka",                        country: "BD" },
  { city: "Colombo",        tz: "Asia/Colombo",                      country: "LK" },
  { city: "Kathmandu",      tz: "Asia/Kathmandu",                    country: "NP" },
  { city: "Kabul",          tz: "Asia/Kabul",                        country: "AF" },
  { city: "Tashkent",       tz: "Asia/Tashkent",                     country: "UZ" },
  { city: "Almaty",         tz: "Asia/Almaty",                       country: "KZ" },
  { city: "Singapore",      tz: "Asia/Singapore",                    country: "SG" },
  { city: "Kuala Lumpur",   tz: "Asia/Kuala_Lumpur",                 country: "MY" },
  { city: "Bangkok",        tz: "Asia/Bangkok",                      country: "TH" },
  { city: "Jakarta",        tz: "Asia/Jakarta",                      country: "ID" },
  { city: "Manila",         tz: "Asia/Manila",                       country: "PH" },
  { city: "Ho Chi Minh",    tz: "Asia/Ho_Chi_Minh",                  country: "VN" },
  { city: "Hanoi",          tz: "Asia/Ho_Chi_Minh",                  country: "VN" },
  { city: "Hong Kong",      tz: "Asia/Hong_Kong",                    country: "HK" },
  { city: "Shanghai",       tz: "Asia/Shanghai",                     country: "CN" },
  { city: "Beijing",        tz: "Asia/Shanghai",                     country: "CN" },
  { city: "Shenzhen",       tz: "Asia/Shanghai",                     country: "CN" },
  { city: "Seoul",          tz: "Asia/Seoul",                        country: "KR" },
  { city: "Tokyo",          tz: "Asia/Tokyo",                        country: "JP" },
  { city: "Osaka",          tz: "Asia/Tokyo",                        country: "JP" },
  { city: "Taipei",         tz: "Asia/Taipei",                       country: "TW" },
  { city: "Ulaanbaatar",    tz: "Asia/Ulaanbaatar",                  country: "MN" },
  // Pacific / Oceania
  { city: "Sydney",         tz: "Australia/Sydney",                  country: "AU" },
  { city: "Melbourne",      tz: "Australia/Melbourne",               country: "AU" },
  { city: "Brisbane",       tz: "Australia/Brisbane",                country: "AU" },
  { city: "Perth",          tz: "Australia/Perth",                   country: "AU" },
  { city: "Auckland",       tz: "Pacific/Auckland",                  country: "NZ" },
  { city: "Wellington",     tz: "Pacific/Auckland",                  country: "NZ" },
  { city: "Honolulu",       tz: "Pacific/Honolulu",                  country: "US" },
];

const DEFAULT_CITIES = [
  { city: "New York",  tz: "America/New_York"  },
  { city: "London",    tz: "Europe/London"     },
  { city: "Dubai",     tz: "Asia/Dubai"        },
  { city: "Mumbai",    tz: "Asia/Kolkata"      },
  { city: "Singapore", tz: "Asia/Singapore"    },
];

/* ── Offset calculator ─────────────────────────────────────────── */
function getOffset(tz) {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
    const parts = fmt.formatToParts(now);
    const tzPart = parts.find(p => p.type === "timeZoneName")?.value || "";
    const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return "UTC+0";
    const sign = match[1];
    const hrs  = parseInt(match[2], 10);
    const mins = parseInt(match[3] || "0", 10);
    if (hrs === 0 && mins === 0) return "UTC+0";
    const minsStr = mins > 0 ? `:${String(mins).padStart(2, "0")}` : "";
    return `UTC${sign}${hrs}${minsStr}`;
  } catch { return ""; }
}

/* ── Analog clock face ─────────────────────────────────────────── */
function AnalogClock({ tz, time, size = 96 }) {
  const cityTime = (() => {
    try { return new Date(time.toLocaleString("en-US", { timeZone: tz })); }
    catch { return time; }
  })();

  const h = cityTime.getHours();
  const m = cityTime.getMinutes();
  const s = cityTime.getSeconds();

  const isNight = h < 6 || h >= 20;
  const bg       = isNight ? "#16161a" : "#ececec";
  const border   = isNight ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.13)";
  const hand     = isNight ? "#ffffff" : "#111114";
  const secHand  = isNight ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.35)";
  const numClr   = isNight ? "rgba(255,255,255,0.5)"  : "rgba(0,0,0,0.5)";

  const c = size / 2;
  const r = size / 2 - 3;

  const pt = (deg, radius) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: c + Math.cos(rad) * radius, y: c + Math.sin(rad) * radius };
  };

  const hourAngle = ((h % 12) + m / 60) * 30;
  const minAngle  = (m + s / 60) * 6;
  const secAngle  = s * 6;

  const NUMS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const numR = r - 14;
  const fs = Math.round(size * 0.097);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Face */}
      <circle cx={c} cy={c} r={r} fill={bg} stroke={border} strokeWidth="1.5" />

      {/* Minute ticks */}
      {Array.from({ length: 60 }, (_, i) => {
        const isH = i % 5 === 0;
        const o = pt(i * 6, r - 1.5);
        const inn = pt(i * 6, r - (isH ? 8 : 4.5));
        return (
          <line key={i} x1={o.x} y1={o.y} x2={inn.x} y2={inn.y}
                stroke={numClr} strokeWidth={isH ? 1.4 : 0.6} />
        );
      })}

      {/* Numbers 12–11 */}
      {NUMS.map((n, i) => {
        const pos = pt(i * 30, numR);
        return (
          <text key={n} x={pos.x} y={pos.y + fs * 0.36}
                textAnchor="middle" fill={numClr}
                fontSize={fs} fontFamily="'Outfit', sans-serif" fontWeight="400">
            {n}
          </text>
        );
      })}

      {/* Hour hand */}
      {(() => { const p = pt(hourAngle, r * 0.50); return <line x1={c} y1={c} x2={p.x} y2={p.y} stroke={hand} strokeWidth={3} strokeLinecap="round" />; })()}
      {/* Minute hand */}
      {(() => { const p = pt(minAngle,  r * 0.69); return <line x1={c} y1={c} x2={p.x} y2={p.y} stroke={hand} strokeWidth={2} strokeLinecap="round" />; })()}
      {/* Second hand */}
      {(() => { const p = pt(secAngle,  r * 0.76); return <line x1={c} y1={c} x2={p.x} y2={p.y} stroke={secHand} strokeWidth={1} strokeLinecap="round" />; })()}

      {/* Center dot */}
      <circle cx={c} cy={c} r={2.8} fill={hand} />
    </svg>
  );
}

/* ── World Clock component ─────────────────────────────────────── */
export default function WorldClock() {
  const [cities, setCities] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mm_world_cities") || "null") || DEFAULT_CITIES; }
    catch { return DEFAULT_CITIES; }
  });
  const [time,       setTime]       = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [search,     setSearch]     = useState("");

  /* Single interval drives all 5 clocks */
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const addCity = (c) => {
    if (cities.length >= 5 || cities.find(x => x.tz === c.tz && x.city === c.city)) return;
    const next = [...cities, { city: c.city, tz: c.tz }];
    setCities(next);
    localStorage.setItem("mm_world_cities", JSON.stringify(next));
    if (next.length >= 5) setShowPicker(false);
  };

  const removeCity = (idx) => {
    const next = cities.filter((_, i) => i !== idx);
    setCities(next);
    localStorage.setItem("mm_world_cities", JSON.stringify(next));
  };

  const filtered = search.trim()
    ? CITIES.filter(c =>
        c.city.toLowerCase().includes(search.toLowerCase()) ||
        c.country.toLowerCase().includes(search.toLowerCase()))
    : CITIES;

  return (
    <>
      {/* Add city button — title comes from the parent Section */}
      {cities.length < 5 && (
        <div className="flex justify-end mb-2">
          <button onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1 text-xs px-2 py-1 transition-opacity"
                  style={{ color: "var(--mm-muted)", borderRadius: 8, opacity: 0.7 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}>
            <Plus size={11} /> Add city
          </button>
        </div>
      )}

      {/* 5-clock grid */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cities.length}, 1fr)` }}>
        {cities.map(({ city, tz }, idx) => {
          const ct = (() => {
            try { return new Date(time.toLocaleString("en-US", { timeZone: tz })); }
            catch { return time; }
          })();
          const h       = ct.getHours();
          const isNight = h < 6 || h >= 20;
          const timeStr = ct.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
          const offset  = getOffset(tz);

          return (
            <div key={`${tz}-${idx}`}
                 className="relative group flex flex-col items-center gap-2 py-3 px-2"
                 style={{
                   background: "var(--mm-surface-2)",
                   border: "1px solid var(--mm-border)",
                   borderRadius: 16,
                 }}>
              {/* Remove button */}
              <button onClick={() => removeCity(idx)}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--mm-muted)", padding: 3, lineHeight: 1 }}>
                <X size={10} />
              </button>

              <AnalogClock tz={tz} time={time} size={90} />

              <div className="text-center w-full px-1">
                <p className="truncate text-center"
                   style={{
                     fontSize: 11, fontWeight: 500,
                     fontFamily: "'Outfit', sans-serif",
                     color: "var(--mm-text)", lineHeight: 1.3,
                   }}>
                  {city}
                </p>
                <p style={{
                  fontSize: 12, fontFamily: "'Outfit', sans-serif",
                  color: isNight ? "rgba(240,237,232,0.55)" : "var(--mm-text)",
                  lineHeight: 1.4,
                }}>
                  {timeStr}
                </p>
                <p style={{ fontSize: 9, color: "var(--mm-muted)", letterSpacing: "0.05em" }}>
                  {offset}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* City picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)" }}
             onClick={e => e.target === e.currentTarget && setShowPicker(false)}>
          <div className="w-full max-w-sm animate-scale-in"
               style={{
                 background: "var(--mm-surface)",
                 border: "1px solid var(--mm-border-gold)",
                 borderRadius: 24, padding: 20,
                 maxHeight: "72vh", display: "flex", flexDirection: "column",
               }}>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif",
                           fontSize: 18, fontWeight: 400, color: "var(--mm-text)" }}>
                Add City ({cities.length}/5)
              </h3>
              <button onClick={() => setShowPicker(false)} className="mm-icon-btn">×</button>
            </div>

            <div className="relative mb-3">
              <Search size={13} style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                color: "var(--mm-muted)", pointerEvents: "none",
              }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                     placeholder="Search city or country…"
                     className="mm-form-input pl-8 w-full text-xs" autoFocus />
            </div>

            <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-0.5">
              {filtered.map((c, i) => {
                const added = cities.some(x => x.city === c.city && x.tz === c.tz);
                return (
                  <button key={`${c.tz}-${i}`} onClick={() => !added && addCity(c)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left transition-all"
                          style={{
                            borderRadius: 12, opacity: added ? 0.4 : 1,
                            cursor: added ? "default" : "pointer",
                          }}
                          onMouseEnter={e => !added && (e.currentTarget.style.background = "var(--mm-surface-2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span className="flex-1 text-sm" style={{ color: "var(--mm-text)" }}>{c.city}</span>
                    <span style={{ fontSize: 10, color: "var(--mm-muted)" }}>{c.country}</span>
                    {added && <span style={{ fontSize: 10, color: "var(--mm-gold)" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
