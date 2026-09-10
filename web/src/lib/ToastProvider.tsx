"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastVariant = "success" | "error";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  /** Kaydet/güncelle/sil gibi mutasyonlardan sonra kısa ömürlü bildirim gösterir. */
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

/** Sayfalarda tekrarlanan inline "Kaydedildi." banner'ları yerine tek, tutarlı
 * bir bildirim kaynağı — bkz. docs kalite turu Bölüm 3 (toast/snackbar). */
export function useToast() {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-fade-rise pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-pop ${
              t.variant === "success"
                ? "border-success-100 bg-white text-text-primary"
                : "border-danger-100 bg-white text-text-primary"
            }`}
          >
            {t.variant === "success" ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success-500" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0 text-danger-500" />
            )}
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Kapat"
              className="shrink-0 rounded-lg p-0.5 text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
