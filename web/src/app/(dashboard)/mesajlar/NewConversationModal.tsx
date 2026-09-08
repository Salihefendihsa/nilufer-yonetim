"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/auth";
import type { AvailableContact } from "@/lib/types";
import { Users } from "lucide-react";

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (contact: AvailableContact) => void;
}

export function NewConversationModal({ open, onClose, onSelect }: NewConversationModalProps) {
  const [contacts, setContacts] = useState<AvailableContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .get<{ data: AvailableContact[] }>("/conversations/available-contacts")
      .then((res) => setContacts(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Kişiler yüklenemedi"))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Yeni Konuşma">
      {error && <p className="mb-3 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : contacts.length === 0 ? (
        <EmptyState icon={Users} title="Konuşabileceğiniz kimse yok" description="Yetki kapsamınızda başka kullanıcı bulunmuyor." />
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                onClick={() => onSelect(contact)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface-subtle"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
                  {contact.fullName
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span>
                  <p className="text-sm font-medium text-text-primary">{contact.fullName}</p>
                  <p className="text-xs text-text-secondary">{ROLE_LABELS[contact.role as Role] ?? contact.role}</p>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
