import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type AlertTone = "green" | "gold" | "red" | "amber" | "sky";

interface AlertBannerProps {
  variant?: "flat" | "glass";
  tone?: AlertTone;
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
}

interface ToneStyle {
  flatContainer: string;
  glassBorder: string;
  iconBg: string;
  iconText: string;
  action: string;
}

// Every class below must appear as a literal string here so Tailwind's JIT scanner can find it —
// dynamic template-literal class names (e.g. `border-${color}/30`) are invisible to the compiler.
const TONE_STYLES: Record<AlertTone, ToneStyle> = {
  green: {
    flatContainer: "border-primary-greenLight/30 bg-primary-greenLight/10",
    glassBorder: "border-l-primary-greenLight",
    iconBg: "bg-primary-greenLight/15",
    iconText: "text-primary-greenLight",
    action: "bg-primary-greenLight/15 text-primary-greenLight hover:bg-primary-greenLight/25",
  },
  gold: {
    flatContainer: "border-primary-gold/30 bg-primary-gold/10",
    glassBorder: "border-l-primary-gold",
    iconBg: "bg-primary-gold/15",
    iconText: "text-primary-gold",
    action: "bg-primary-gold/15 text-primary-gold hover:bg-primary-gold/25",
  },
  red: {
    flatContainer: "border-primary-redLight/30 bg-primary-redLight/10",
    glassBorder: "border-l-primary-redLight",
    iconBg: "bg-primary-redLight/15",
    iconText: "text-primary-redLight",
    action: "bg-primary-redLight/15 text-primary-redLight hover:bg-primary-redLight/25",
  },
  amber: {
    flatContainer: "border-amber-400/30 bg-amber-400/10",
    glassBorder: "border-l-amber-400",
    iconBg: "bg-amber-400/15",
    iconText: "text-amber-300",
    action: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25",
  },
  sky: {
    flatContainer: "border-sky-400/30 bg-sky-400/10",
    glassBorder: "border-l-sky-400",
    iconBg: "bg-sky-400/15",
    iconText: "text-sky-300",
    action: "bg-sky-400/15 text-sky-300 hover:bg-sky-400/25",
  },
};

export function AlertBanner({ variant = "flat", tone = "gold", icon: Icon, title, description, action }: AlertBannerProps) {
  const style = TONE_STYLES[tone];

  const containerClass =
    variant === "flat"
      ? `rounded-2xl border p-5 ${style.flatContainer}`
      : `rounded-2xl border-l-[3px] bg-white/5 p-5 backdrop-blur-md ${style.glassBorder}`;

  return (
    <div className={`flex items-start justify-between gap-4 ${containerClass}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconBg} ${style.iconText}`}>
            <Icon size={18} strokeWidth={1.75} />
          </span>
        )}
        <div>
          <p className="font-semibold text-text-primary">{title}</p>
          {description && <div className="mt-1 text-sm text-text-secondary">{description}</div>}
        </div>
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`shrink-0 whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-medium transition ${style.action}`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
