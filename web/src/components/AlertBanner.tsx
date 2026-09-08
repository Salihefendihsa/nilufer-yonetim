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
    flatContainer: "border-primary-200 bg-primary-50",
    glassBorder: "border-l-primary-500",
    iconBg: "bg-primary-100",
    iconText: "text-primary-700",
    action: "bg-primary-600 text-white hover:bg-primary-700",
  },
  gold: {
    flatContainer: "border-border-accent bg-warning-50",
    glassBorder: "border-l-primary-500",
    iconBg: "bg-warning-100",
    iconText: "text-warning-500",
    action: "bg-warning-100 text-warning-500 hover:bg-warning-500/25",
  },
  red: {
    flatContainer: "border-danger-100 bg-danger-50",
    glassBorder: "border-l-danger-500",
    iconBg: "bg-danger-100",
    iconText: "text-danger-500",
    action: "bg-danger-100 text-danger-500 hover:bg-danger-100",
  },
  amber: {
    flatContainer: "border-warning-100 bg-warning-50",
    glassBorder: "border-l-warning-500",
    iconBg: "bg-warning-100",
    iconText: "text-warning-500",
    action: "bg-warning-100 text-warning-500 hover:bg-warning-100",
  },
  sky: {
    flatContainer: "border-info-100 bg-info-50",
    glassBorder: "border-l-info-500",
    iconBg: "bg-info-100",
    iconText: "text-info-500",
    action: "bg-info-100 text-info-500 hover:bg-info-100",
  },
};

export function AlertBanner({ variant = "flat", tone = "gold", icon: Icon, title, description, action }: AlertBannerProps) {
  const style = TONE_STYLES[tone];

  const containerClass =
    variant === "flat"
      ? `rounded-2xl border p-5 ${style.flatContainer}`
      : `rounded-2xl border border-border border-l-[3px] bg-surface-card p-5 shadow-card ${style.glassBorder}`;

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
