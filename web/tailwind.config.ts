import type { Config } from "tailwindcss";

/**
 * Nilüfer İlaçlama — açık (light) tema tasarım sistemi.
 *
 * Palet yeşil-beyaz: beyaz kart yüzeyleri, çok açık yeşilimsi gri sayfa zemini,
 * marka yeşili aksiyon/vurgu rengi. Semantik renkler (success/warning/danger/info)
 * yeşil skalasıyla aynı doygunluk-ışıklık ailesinden seçildi ki bir arada
 * kullanıldıklarında tek bir dil gibi okunsunlar.
 *
 * Not: `primary.green` / `primary.greenLight` / `primary.gold` / `primary.red` /
 * `primary.redLight` takma adları eski kod tarafından yaygın kullanıldığı için
 * korundu; değerleri light temada okunabilir olacak şekilde yeniden bağlandı.
 */
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

        // Ana yeşil skala — 500 varsayılan aksiyon rengi, 700 marka koyu yeşili.
        primary: {
          50: "#F1F8F2",
          100: "#DEEFE1",
          200: "#BFDFC5",
          300: "#94C79E",
          400: "#61A870",
          500: "#3D8A4E",
          600: "#2F6B3D",
          700: "#2F5233",
          800: "#243F28",
          900: "#17281A",
          // Geriye dönük takma adlar (light temaya göre yeniden bağlandı)
          green: "#2F5233",
          greenLight: "#3D8A4E",
          gold: "#A97A16",
          red: "#9B1C1C",
          redLight: "#C0392B",
        },

        // Nötr griler — hafif yeşilimsi (yüzeylerle aynı sıcaklıkta kalsın diye)
        neutral: {
          50: "#F7F9F7",
          100: "#EFF2EF",
          200: "#E3E8E3",
          300: "#CFD8D0",
          400: "#A3B0A5",
          500: "#7C8A7F",
          600: "#5A6B5E",
          700: "#425145",
          800: "#2A352C",
          900: "#16211A",
        },

        success: {
          50: "#ECFBF0",
          100: "#D3F4DC",
          500: "#15803D",
          600: "#166534",
          700: "#14532D",
        },
        warning: {
          50: "#FEF7E7",
          100: "#FCEDC9",
          500: "#B57F13",
          600: "#96690F",
          700: "#78540C",
        },
        danger: {
          50: "#FDF0EF",
          100: "#FADAD7",
          500: "#C0392B",
          600: "#9B1C1C",
          700: "#7A1F26",
        },
        info: {
          50: "#EDF5FB",
          100: "#D5E7F5",
          500: "#1F6FA8",
          600: "#175A8A",
          700: "#12466C",
        },

        ink: "#16211A",

        surface: {
          page: "#F4F7F4",
          base: "#FFFFFF",
          card: "#FFFFFF",
          cardHover: "#F7FAF7",
          sidebar: "#FFFFFF",
          subtle: "#F2F6F2",
          muted: "#E8EEE8",
        },

        border: {
          DEFAULT: "#E3E8E3",
          strong: "#CFD8D0",
          accent: "#BFDFC5",
        },

        text: {
          primary: "#16211A",
          secondary: "#5A6B5E",
          faint: "#8B9A8E",
          inverse: "#FFFFFF",
        },
      },

      // Tek bir gölge ölçeği — kartlar `shadow-card`, açılır katmanlar `shadow-pop`.
      boxShadow: {
        card: "0 1px 2px rgba(22,33,26,0.04), 0 4px 16px rgba(22,33,26,0.06)",
        cardHover: "0 2px 4px rgba(22,33,26,0.06), 0 12px 28px rgba(22,33,26,0.10)",
        pop: "0 8px 32px rgba(22,33,26,0.14)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.6)",
      },

      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },

      // Tipografi ölçeği — mevcut text-xs/sm/base/lg/xl kullanımını bozmadan
      // satır yüksekliklerini ve harf aralıklarını standartlaştırır.
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
        lg: ["1.0625rem", { lineHeight: "1.625rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.015em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.025em" }],
      },

      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },

      // 4px tabanlı spacing — mevcut Tailwind ölçeğine ek ara adımlar.
      spacing: {
        4.5: "1.125rem",
        18: "4.5rem",
      },

      keyframes: {
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "grow-bar": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.25s ease-out both",
        "grow-bar": "grow-bar 0.6s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
