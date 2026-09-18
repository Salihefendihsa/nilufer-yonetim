import { z } from "zod";

/**
 * Bölüm N (4. tur): İş öncesi günlük kontrol listesi — sabit şablon, her iş
 * için aynı (ServiceType/Setting bazlı özelleştirme bilinçli olarak YOK).
 * Personel PATCH /jobs/:id/checklist ile işaretler; rapor oluşturulurken
 * Job.checklist JobReport.checklist'e kopyalanır.
 */
export const JOB_CHECKLIST_TEMPLATE = [
  "Ekipman kontrol edildi",
  "Kullanılacak ürün doğrulandı",
  "Müşteriyle iletişime geçildi",
  "Güvenlik önlemleri alındı",
] as const;

export type ChecklistItemName = (typeof JOB_CHECKLIST_TEMPLATE)[number];

export interface ChecklistEntry {
  item: string;
  isChecked: boolean;
  checkedAt: string | null;
}

export const checklistUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        item: z.enum(JOB_CHECKLIST_TEMPLATE),
        isChecked: z.boolean(),
      })
    )
    .min(1),
});

/** Şablonun tamamını, mevcut kayıt ve gelen güncellemeyle birleştirerek döner. */
export function mergeChecklist(
  existing: unknown,
  updates: { item: string; isChecked: boolean }[],
  now = new Date()
): ChecklistEntry[] {
  const prev = normalizeChecklist(existing);
  return JOB_CHECKLIST_TEMPLATE.map((item) => {
    const update = updates.find((u) => u.item === item);
    const before = prev.find((p) => p.item === item);
    if (!update) return before ?? { item, isChecked: false, checkedAt: null };
    if (update.isChecked) {
      return { item, isChecked: true, checkedAt: before?.isChecked ? before.checkedAt : now.toISOString() };
    }
    return { item, isChecked: false, checkedAt: null };
  });
}

/** Veritabanındaki Json değerini (null/eski/bozuk olabilir) tam şablona oturtur. */
export function normalizeChecklist(value: unknown): ChecklistEntry[] {
  const rows = Array.isArray(value) ? (value as Partial<ChecklistEntry>[]) : [];
  return JOB_CHECKLIST_TEMPLATE.map((item) => {
    const row = rows.find((r) => r && r.item === item);
    return {
      item,
      isChecked: row?.isChecked === true,
      checkedAt: row?.isChecked === true && typeof row.checkedAt === "string" ? row.checkedAt : null,
    };
  });
}

export function isChecklistComplete(value: unknown): boolean {
  return normalizeChecklist(value).every((e) => e.isChecked);
}
