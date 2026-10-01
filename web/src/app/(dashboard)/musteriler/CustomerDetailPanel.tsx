"use client";

import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/SectionTitle";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Briefcase, Wallet, Pencil, Trash2, FileDown, Star } from "lucide-react";
import { api, ApiError, downloadFile } from "@/lib/api";
import { formatDate, currencyFormatter } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { CustomerDetail } from "@/lib/types";
import { CustomerTagEditor } from "@/components/CustomerTagEditor";
import { CustomerDocuments } from "@/components/CustomerDocuments";
import { useAuth } from "@/lib/AuthProvider";
import { CustomerRequestGuard, selectedCustomerDetail } from "@/lib/customerRequest";

/** Ham ödeme türü kodu (CASH) yerine Türkçe — para/page.tsx ile aynı etiketler. */
const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  TRANSFER: "Havale/EFT",
};

interface CustomerDetailPanelProps {
  customerId: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CustomerDetailPanel(props: CustomerDetailPanelProps) {
  return <CustomerDetailPanelContent key={props.customerId ?? "closed"} {...props} />;
}

function CustomerDetailPanelContent({ customerId, onClose, onEdit, onDelete }: CustomerDetailPanelProps) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const canEditTags = user?.role === "OWNER" || user?.role === "MANAGER";
  const visibleDetail = selectedCustomerDetail(detail, customerId);

  useEffect(() => {
    if (!customerId) {
      setDetail(null);
      return;
    }

    const guard = new CustomerRequestGuard();
    setDetail(null);
    setError(null);
    setLoading(true);
    void guard.runLatest(() => api.get<CustomerDetail>(`/customers/${customerId}`), {
      onSuccess: (result) => {
        if (result.id === customerId) setDetail(result);
        else setError("Detaylar yüklenemedi");
      },
      onError: (err) => setError(err instanceof ApiError ? err.message : "Detaylar yüklenemedi"),
      onSettled: () => setLoading(false),
    });
    return () => guard.close();
  }, [customerId]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {customerId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink/20"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface-card p-6 shadow-xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-faint">Müşteri</p>
                <SectionTitle size="lg" className="mt-1 text-xl">{visibleDetail?.fullName ?? (loading ? "Yükleniyor..." : "Müşteri")}</SectionTitle>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-2xl text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

            {visibleDetail && (
              <div className="flex flex-col gap-6">
                {/* Bölüm X (6. tur): etiketler */}
                <CustomerTagEditor customerId={visibleDetail.id} tags={visibleDetail.tags ?? []} editable={canEditTags} />

                {/* Bölüm AB (6. tur): belge kasası — yalnızca yönetim */}
                {canEditTags && <CustomerDocuments key={visibleDetail.id} customerId={visibleDetail.id} />}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoItem label="Telefon" value={visibleDetail.phone} />
                  <InfoItem label="E-posta" value={visibleDetail.email ?? "—"} />
                  <InfoItem label="Semt" value={visibleDetail.district ?? "—"} />
                  <InfoItem label="Adres" value={visibleDetail.address ?? "—"} />
                </div>

                <div
                  className={`rounded-2xl p-4 ${
                    visibleDetail.outstandingBalance > 0 ? "bg-danger-50" : "bg-primary-50"
                  }`}
                >
                  <p className="text-xs font-medium text-text-secondary">Bekleyen Bakiye</p>
                  <p className={`mt-1 text-2xl font-semibold ${visibleDetail.outstandingBalance > 0 ? "text-danger-500" : "text-primary-600"}`}>
                    {currencyFormatter.format(Math.max(visibleDetail.outstandingBalance, 0))}
                  </p>
                  {visibleDetail.outstandingBalance <= 0 && (
                    <p className="mt-0.5 text-xs text-primary-600">Bakiye kapalı</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-primary transition hover:border-border-strong hover:bg-surface-subtle"
                  >
                    <Pencil size={15} strokeWidth={1.75} />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-danger-50 px-4 py-2.5 text-sm font-medium text-danger-500 transition hover:bg-danger-100"
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                    Sil
                  </button>
                </div>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Briefcase size={16} strokeWidth={1.75} className="text-text-faint" />
                      <h3 className="text-sm font-semibold text-text-primary">Geçmiş İşler</h3>
                    </div>
                    {(() => {
                      const rated = visibleDetail.jobs.filter((j) => j.rating != null);
                      if (rated.length === 0) return null;
                      const avg = rated.reduce((sum, j) => sum + (j.rating ?? 0), 0) / rated.length;
                      return (
                        <div className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                          <Star size={13} strokeWidth={1.75} fill="currentColor" className="text-warning-500" />
                          {avg.toFixed(1)} ({rated.length})
                        </div>
                      );
                    })()}
                  </div>
                  {visibleDetail.jobs.length === 0 ? (
                    <p className="text-sm text-text-faint">Henüz iş kaydı yok.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface-subtle">
                      {visibleDetail.jobs.map((job) => (
                        <li key={job.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{job.serviceType}</p>
                            <p className="text-xs text-text-faint">{formatDate(job.scheduledAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={job.status} />
                            {job.status === "COMPLETED" && (job._count?.jobReports ?? 0) > 0 && (
                              <button
                                type="button"
                                aria-label="PDF İndir"
                                title="PDF İndir"
                                onClick={() => downloadFile(`/jobs/${job.id}/report/pdf`, `is-raporu-${job.id}.pdf`)}
                                className="flex h-7 w-7 items-center justify-center rounded-xl text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
                              >
                                <FileDown size={15} strokeWidth={1.75} />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Wallet size={16} strokeWidth={1.75} className="text-text-faint" />
                    <h3 className="text-sm font-semibold text-text-primary">Ödemeler</h3>
                  </div>
                  {visibleDetail.payments.length === 0 ? (
                    <p className="text-sm text-text-faint">Henüz ödeme kaydı yok.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface-subtle">
                      {visibleDetail.payments.map((payment) => (
                        <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{currencyFormatter.format(payment.amount)}</p>
                            <p className="text-xs text-text-faint">{formatDate(payment.createdAt)}</p>
                          </div>
                          <span className="text-xs text-text-secondary">{PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-faint">{label}</p>
      <p className="mt-0.5 font-medium text-text-primary">{value}</p>
    </div>
  );
}
