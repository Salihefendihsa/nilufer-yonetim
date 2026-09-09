import { prisma } from "./prisma";

/**
 * Hedef değerleri `Setting` tablosunda tutulur ve YALNIZCA OWNER tarafından
 * düzenlenebilir (routes/settings.ts OWNER-only). MANAGER `/settings` ucuna
 * erişemediği için hedefler, ilgili iş uçlarının (leaderboard, payments
 * summary) yanıtına gömülerek sunulur — böylece yetki sınırı korunurken
 * müdür panelindeki "Hedef: 25 İş / Ay" ve "Tahsilat Hedefi" göstergeleri
 * gerçek, yapılandırılabilir veriden beslenir.
 *
 * Ayar tanımlı değilse `null` döner ve arayüz hedefle ilgili göstergeyi hiç
 * göstermez — varsayılan bir hedef UYDURULMAZ.
 */
export const TARGET_SETTING_KEYS = {
  monthlyJobTarget: "monthly_job_target",
  monthlyRevenueTarget: "monthly_revenue_target",
} as const;

async function readNumericSetting(key: string): Promise<number | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  if (!setting) return null;
  const value = Number(setting.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Personel başına aylık tamamlanan iş hedefi (adet). */
export function getMonthlyJobTarget(): Promise<number | null> {
  return readNumericSetting(TARGET_SETTING_KEYS.monthlyJobTarget);
}

/** Aylık tahsilat (ciro) hedefi (₺). */
export function getMonthlyRevenueTarget(): Promise<number | null> {
  return readNumericSetting(TARGET_SETTING_KEYS.monthlyRevenueTarget);
}
