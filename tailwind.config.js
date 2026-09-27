/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand accent — vivid indigo/violet (mentor-dashboard inspired)
        accent: {
          50: "#F1EEFE",
          100: "#E4DDFD",
          400: "#8B7CF6",
          500: "#6C5CE7",
          600: "#5B4BD1",
          700: "#4A3BA8",
        },
        ink: {
          900: "#111827",
          700: "#374151",
          500: "#6b7280",
          300: "#d1d5db",
          100: "#f3f4f6",
        },
        // Dark "hero" surface for the welcome banner, with a subtle violet tint
        surface: {
          900: "#14121F",
          800: "#1D1A2B",
        },
        // Pastel stat-chip colors (top dashboard stat cards)
        mint: { bg: "#E6F9F1", fg: "#12B76A" },
        peach: { bg: "#FFF1E6", fg: "#F79009" },
        violet: { bg: "#F1EEFE", fg: "#7A5AF8" },
        pink: { bg: "#FDEFF6", fg: "#EE46BC" },
        // Bold flat colors for "Continue Learning" course cards
        course: {
          blue: "#2F5DFF",
          orange: "#FF5A36",
          dark: "#14121F",
          lime: "#B9E937",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        cardHover: "0 4px 12px rgba(16,24,40,0.08)",
        hero: "0 20px 40px -12px rgba(20,18,31,0.35)",
      },
      borderRadius: {
        xl2: "14px",
        xl3: "22px",
      },
    },
  },
  plugins: [],
};
