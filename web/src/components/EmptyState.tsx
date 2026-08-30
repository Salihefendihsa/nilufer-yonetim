import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] py-20 text-center backdrop-blur-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-text-faint">
        <Icon size={26} strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && <p className="max-w-xs text-sm text-text-secondary">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
