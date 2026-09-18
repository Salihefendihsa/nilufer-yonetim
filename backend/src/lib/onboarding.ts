/**
 * Bölüm U (5. tur): Yeni personel işe alım kontrol listesi — sabit şablon.
 * Staff oluşturulurken (staffController.createStaff) transaction içinde
 * eklenir. "İlk Hafta Değerlendirmesi Yapıldı" formal EvaluationPeriod'dan
 * AYRI, yalnızca bir kontrol maddesidir.
 */
export const ONBOARDING_TEMPLATE = [
  "Kimlik/Evrak Teslim Alındı",
  "İş Sözleşmesi İmzalandı",
  "Ekipman/Üniforma Teslim Edildi",
  "Güvenlik Eğitimi Tamamlandı",
  "İlk Hafta Değerlendirmesi Yapıldı",
] as const;

export function onboardingSeedRows(staffId: string) {
  return ONBOARDING_TEMPLATE.map((item, sortOrder) => ({ staffId, item, sortOrder }));
}

export function onboardingProgress(items: { isCompleted: boolean }[]) {
  const total = items.length;
  const completed = items.filter((i) => i.isCompleted).length;
  return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0, isComplete: total > 0 && completed === total };
}
