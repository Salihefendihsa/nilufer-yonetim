import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          green: "#2F5233",
          greenLight: "#5DA130",
          red: "#7A1F26",
          redLight: "#C1272D",
          gold: "#D4AE3D",
        },
        ink: "#0E0F0D",
        surface: {
          page: "#1C1E1B",
          base: "#242721",
          card: "#2C2F28",
          cardHover: "#333730",
          sidebar: "#1A1C18",
        },
        border: "rgba(255,255,255,0.10)",
        text: {
          primary: "#EDEEEA",
          secondary: "#A8ACA2",
          faint: "#787C72",
        },
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
