"use client";

import { useEffect, useState } from "react";
import { Tags } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { CustomerTagBadge } from "@/components/CustomerTagBadge";
import type { CustomerTag } from "@/lib/types";

interface CustomerTagEditorProps {
  customerId: string;
  tags: Pick<CustomerTag, "id" | "name" | "color">[];
  /** OWNER/MANAGER düzenler; diğerleri salt-okunur rozet görür. */
  editable: boolean;
  onChanged?: (tags: Pick<CustomerTag, "id" | "name" | "color">[]) => void;
}

/**
 * Bölüm X (6. tur): Müşteri detayında etiket düzenleme — aktif etiketler
 * tıklanabilir çipler; her tıklama kümeyi POST /customers/:id/tags ile tam
 * eşitler (ekle/çıkar tek çağrı).
 */
export function CustomerTagEditor({ customerId, tags, editable, onChanged }: CustomerTagEditorProps) {
  const [available, setAvailable] = useState<CustomerTag[]>([]);
  const [current, setCurrent] = useState(tags);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setCurrent(tags), [tags]);

  useEffect(() => {
    if (!editable) return;
    api
      .get<{ data: CustomerTag[] }>("/customer-tags")
      .then((res) => setAvailable(res.data))
      .catch(() => setAvailable([]));
  }, [editable]);

  async function toggle(tag: CustomerTag) {
    const has = current.some((t) => t.id === tag.id);
    const next = has ? current.filter((t) => t.id !== tag.id) : [...current, tag];
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ tags: CustomerTag[] }>(`/customers/${customerId}/tags`, { tagIds: next.map((t) => t.id) });
      setCurrent(res.tags);
      onChanged?.(res.tags);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Etiket güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  if (!editable) {
    if (current.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {current.map((t) => (
          <CustomerTagBadge key={t.id} tag={t} size="md" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-faint">
        <Tags size={12} strokeWidth={1.75} />
        Etiketler
      </p>
      {available.length === 0 ? (
        <p className="text-xs text-text-faint">Tanımlı etiket yok — Ayarlar → Müşteri Etiketleri&apos;nden ekleyin.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {available.map((t) => {
            const active = current.some((c) => c.id === t.id);
            return (
              <button
                key={t.id}
                type="button"
                disabled={busy}
                onClick={() => toggle(t)}
                aria-pressed={active}
                className={`rounded-full transition disabled:opacity-60 ${active ? "" : "opacity-45 grayscale hover:opacity-80"}`}
                title={active ? "Kaldır" : "Ekle"}
              >
                <CustomerTagBadge tag={t} size="md" />
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="text-xs text-danger-500">{error}</p>}
    </div>
  );
}
