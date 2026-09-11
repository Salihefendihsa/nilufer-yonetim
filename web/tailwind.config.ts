import type { Config } from "tailwindcss";

/**
 * globals.css'teki her CSS değişkeni "R G B" (boşlukla ayrılmış ondalık
 * kanal) olarak tanımlı — hex DEĞİL — çünkü Tailwind'in opacity modifier'ı
 * (`bg-primary-600/40` gibi, bu kod tabanında yaygın kullanılıyor) yalnızca
 * bu formatta çalışabiliyor: derleme anında CSS değişkeninin içini
 * göremediği için `rgb(var(--x) / <alpha-value>)` kalıbına ihtiyaç duyuyor.
 */
function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

/**
 * Nilüfer İlaçlama — tasarım sistemi (açık + koyu tema).
 *
 * Palet yeşil-beyaz: kart yüzeyleri, çok açık yeşilimsi gri sayfa zemini,
 * marka yeşili aksiyon/vurgu rengi. Semantik renkler (success/warning/danger/info)
 * yeşil skalasıyla aynı doygunluk-ışıklık ailesinden seçildi ki bir arada
 * kullanıldıklarında tek bir dil gibi okunsunlar.
 *
 * Bölüm D (2. tur): Her renk artık `var(--token)` — GERÇEK değerler
 * src/app/globals.css'te (açık `:root`, koyu `[data-theme="dark"]` +
 * `prefers-color-scheme: dark`). Böylece `bg-primary-600` gibi HER
 * kullanım, hangi bileşende olursa olsun, otomatik olarak temaya göre
 * doğru rengi üretir — tek tek bileşen değiştirmeye gerek kalmaz.
 *
 * Not: `primary.green` / `primary.greenLight` / `primary.gold` / `primary.red` /
 * `primary.redLight` takma adları eski kod tarafından yaygın kullanıldığı için
 * korundu.
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: withOpacity("--background"),
        foreground: withOpacity("--foreground"),

        // Ana yeşil skala — 500 varsayılan aksiyon rengi, 700 marka koyu yeşili.
        primary: {
          50: withOpacity("--primary-50"),
          100: withOpacity("--primary-100"),
          200: withOpacity("--primary-200"),
          300: withOpacity("--primary-300"),
          400: withOpacity("--primary-400"),
          500: withOpacity("--primary-500"),
          600: withOpacity("--primary-600"),
          700: withOpacity("--primary-700"),
          800: withOpacity("--primary-800"),
          900: withOpacity("--primary-900"),
          // Geriye dönük takma adlar
          green: withOpacity("--primary-green"),
          greenLight: withOpacity("--primary-green-light"),
          gold: withOpacity("--primary-gold"),
          red: withOpacity("--primary-red"),
          redLight: withOpacity("--primary-red-light"),
        },

        // Nötr griler — hafif yeşilimsi (yüzeylerle aynı sıcaklıkta kalsın diye)
        neutral: {
          50: withOpacity("--neutral-50"),
          100: withOpacity("--neutral-100"),
          200: withOpacity("--neutral-200"),
          300: withOpacity("--neutral-300"),
          400: withOpacity("--neutral-400"),
          500: withOpacity("--neutral-500"),
          600: withOpacity("--neutral-600"),
          700: withOpacity("--neutral-700"),
          800: withOpacity("--neutral-800"),
          900: withOpacity("--neutral-900"),
        },

        success: {
          50: withOpacity("--success-50"),
          100: withOpacity("--success-100"),
          500: withOpacity("--success-500"),
          600: withOpacity("--success-600"),
          700: withOpacity("--success-700"),
        },
        warning: {
          50: withOpacity("--warning-50"),
          100: withOpacity("--warning-100"),
          500: withOpacity("--warning-500"),
          600: withOpacity("--warning-600"),
          700: withOpacity("--warning-700"),
        },
        danger: {
          50: withOpacity("--danger-50"),
          100: withOpacity("--danger-100"),
          500: withOpacity("--danger-500"),
          600: withOpacity("--danger-600"),
          700: withOpacity("--danger-700"),
        },
        info: {
          50: withOpacity("--info-50"),
          100: withOpacity("--info-100"),
          500: withOpacity("--info-500"),
          600: withOpacity("--info-600"),
          700: withOpacity("--info-700"),
        },

        ink: withOpacity("--text-primary"),

        surface: {
          page: withOpacity("--surface-page"),
          base: withOpacity("--surface-base"),
          card: withOpacity("--surface-card"),
          cardHover: withOpacity("--surface-card-hover"),
          sidebar: withOpacity("--surface-sidebar"),
          subtle: withOpacity("--surface-subtle"),
          muted: withOpacity("--surface-muted"),
        },

        border: {
          DEFAULT: withOpacity("--border"),
          strong: withOpacity("--border-strong"),
          accent: withOpacity("--border-accent"),
        },

        text: {
          primary: withOpacity("--text-primary"),
          secondary: withOpacity("--text-secondary"),
          faint: withOpacity("--text-faint"),
          inverse: withOpacity("--text-inverse"),
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
