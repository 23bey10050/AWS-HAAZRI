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
    },
  },
  plugins: [],
};
