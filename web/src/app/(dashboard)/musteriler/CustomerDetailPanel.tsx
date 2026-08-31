"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Briefcase, Wallet, Pencil, Trash2, FileDown } from "lucide-react";
import { api, ApiError, downloadFile } from "@/lib/api";
import { formatDate, currencyFormatter } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { CustomerDetail } from "@/lib/types";

interface CustomerDetailPanelProps {
  customerId: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CustomerDetailPanel({ customerId, onClose, onEdit, onDelete }: CustomerDetailPanelProps) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setDetail(null);
      return;
    }

    setError(null);
    api
      .get<CustomerDetail>(`/customers/${customerId}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Detaylar yüklenemedi"));
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
                <h2 className="mt-1 text-xl font-semibold text-text-primary">{detail?.fullName ?? "Yükleniyor..."}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-2xl text-text-faint transition hover:bg-white/5 hover:text-text-primary"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

            {detail && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoItem label="Telefon" value={detail.phone} />
                  <InfoItem label="E-posta" value={detail.email ?? "—"} />
                  <InfoItem label="Semt" value={detail.district ?? "—"} />
                  <InfoItem label="Adres" value={detail.address ?? "—"} />
                </div>

                <div
                  className={`rounded-2xl p-4 ${
                    detail.outstandingBalance > 0 ? "bg-primary-red/10" : "bg-primary-green/10"
                  }`}
                >
                  <p className="text-xs font-medium text-text-secondary">Bekleyen Bakiye</p>
                  <p className={`mt-1 text-2xl font-semibold ${detail.outstandingBalance > 0 ? "text-primary-redLight" : "text-primary-greenLight"}`}>
                    {currencyFormatter.format(Math.max(detail.outstandingBalance, 0))}
                  </p>
                  {detail.outstandingBalance <= 0 && (
                    <p className="mt-0.5 text-xs text-primary-greenLight">Bakiye kapalı</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-white/10"
                  >
                    <Pencil size={15} strokeWidth={1.75} />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-red/10 px-4 py-2.5 text-sm font-medium text-primary-redLight transition hover:bg-primary-red/20"
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                    Sil
                  </button>
                </div>

                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Briefcase size={16} strokeWidth={1.75} className="text-text-faint" />
                    <h3 className="text-sm font-semibold text-text-primary">Geçmiş İşler</h3>
                  </div>
                  {detail.jobs.length === 0 ? (
                    <p className="text-sm text-text-faint">Henüz iş kaydı yok.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-white/5 rounded-2xl bg-white/[0.02]">
                      {detail.jobs.map((job) => (
                        <li key={job.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{job.serviceType}</p>
                            <p className="text-xs text-text-faint">{formatDate(job.scheduledAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={job.status} />
                            {job.status === "COMPLETED" && (
                              <button
                                type="button"
                                aria-label="PDF İndir"
                                title="PDF İndir"
                                onClick={() => downloadFile(`/jobs/${job.id}/report/pdf`, `is-raporu-${job.id}.pdf`)}
                                className="flex h-7 w-7 items-center justify-center rounded-xl text-text-faint transition hover:bg-white/5 hover:text-text-primary"
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
                  {detail.payments.length === 0 ? (
                    <p className="text-sm text-text-faint">Henüz ödeme kaydı yok.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-white/5 rounded-2xl bg-white/[0.02]">
                      {detail.payments.map((payment) => (
                        <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{currencyFormatter.format(payment.amount)}</p>
                            <p className="text-xs text-text-faint">{formatDate(payment.createdAt)}</p>
                          </div>
                          <span className="text-xs text-text-secondary">{payment.paymentType}</span>
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
