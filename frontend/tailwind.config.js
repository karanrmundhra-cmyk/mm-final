/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: "#C9A961", light: "#E4C98C", dark: "#A88840" },
        mm: {
          bg: "#0A0A0A", surface: "#111111", border: "#1E1C17",
          text: "#F0EBE1", muted: "#8A8070", gold: "#C9A961",
        },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        display: ["Outfit", "Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: { lg: "0.5rem", md: "0.375rem", sm: "0.25rem" },
      animation: {
        "aurora": "aurora 8s linear infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
      },
      keyframes: {
        aurora: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { transform: "translateY(8px)", opacity: 0 }, to: { transform: "translateY(0)", opacity: 1 } },
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
