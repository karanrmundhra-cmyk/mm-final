/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#E6C479",
        gold: { DEFAULT: "#E6C479", light: "#F0D89A", dark: "#C9A961" },
        mm: {
          bg:        "#131313",
          surface:   "#131313",
          "surface-2": "#1A1A1A",
          border:    "rgba(255,255,255,0.08)",
          "border-gold": "rgba(230,196,121,0.4)",
          text:      "#E2E2E2",
          muted:     "rgba(226,226,226,0.45)",
          gold:      "#E6C479",
          "gold-light": "#F0D89A",
          "gold-dark":  "#C9A961",
          error:     "#E05252",
          success:   "#52C77A",
          warning:   "#E0A052",
        },
      },
      fontFamily: {
        serif:   ["EB Garamond", "Georgia", "serif"],
        display: ["EB Garamond", "Georgia", "serif"],
        body:    ["Inter", "sans-serif"],
        sans:    ["Inter", "sans-serif"],
      },
      fontSize: {
        "headline-xl": ["48px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "400" }],
        "headline-lg": ["32px", { lineHeight: "1.3", fontWeight: "400" }],
        "label-caps":  ["11px", { lineHeight: "1.5", letterSpacing: "0.2em", fontWeight: "500" }],
        "body-lg":     ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md":     ["15px", { lineHeight: "1.6", fontWeight: "400" }],
      },
      borderRadius: {
        none: "0px",
        sm:   "0px",
        md:   "0px",
        lg:   "0px",
        xl:   "0px",
        "2xl":"0px",
        full: "9999px",
        DEFAULT: "0px",
      },
      animation: {
        "fade-in":   "fadeIn 0.2s ease-out",
        "slide-up":  "slideUp 0.25s ease-out",
        "glow-pulse":"glowPulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 },                            to: { opacity: 1 } },
        slideUp:   { from: { transform: "translateY(8px)", opacity: 0 }, to: { transform: "translateY(0)", opacity: 1 } },
        glowPulse: { "0%,100%": { opacity: 0.6 }, "50%": { opacity: 1 } },
      },
      backgroundImage: {
        "gold-radial": "radial-gradient(circle at center, rgba(230,196,121,0.12) 0%, transparent 70%)",
      },
    },
  },
  safelist: [
    "pl-10", "pl-20",
    "grid-cols-[56px_1fr_140px_120px_120px_80px_40px]",
    "grid-cols-[56px_1fr_120px_120px_100px_80px_40px]",
    "grid-cols-[56px_1fr_140px_130px_120px_120px_80px_40px]",
  ],
  plugins: [require("tailwindcss-animate")],
};
