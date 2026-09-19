/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        primaryGreen: "#22C55E",
        deepRed: "#EF4444",
        amber: "#F59E0B",
        background: "#0F172A",
        card: "#1E293B",
        textPrimary: "#F8FAFC",
      },
      fontFamily: {
        // Space Grotesk has no Devanagari glyphs, so Hindi text in the same element
        // falls through to the sans-serif fallback automatically, per-character —
        // safe to use everywhere, not just on known-Latin strings.
        display: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // The signature neo-brutalist "sticker" shadow: hard-edged, no blur, offset.
        hard: "4px 4px 0 0 #000",
        "hard-sm": "3px 3px 0 0 #000",
        "hard-green": "4px 4px 0 0 #22C55E",
      },
    },
  },
  plugins: [],
};
