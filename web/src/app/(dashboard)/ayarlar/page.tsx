"use client";

import { Settings } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";

export default function SettingsPage() {
  return (
    <RequireRole roles={["OWNER"]}>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Ayarlar</h1>
          <p className="mt-1 text-sm text-text-secondary">İşletme ayarlarınızı buradan yönetin.</p>
        </div>
        <div className="rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <EmptyState icon={Settings} title="Çok yakında" description="Ayarlar sayfası üzerinde çalışıyoruz." />
        </div>
      </div>
    </RequireRole>
  );
}
