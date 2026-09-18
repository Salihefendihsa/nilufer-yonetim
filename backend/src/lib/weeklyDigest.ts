import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { isEmailConfigured, sendEmail } from "./email";
import { computeExecutiveSummary, type ExecutiveKpi, type ExecutiveSummary } from "../controllers/executiveSummaryController";

/**
 * Bölüm AF (7. tur): Haftalık yönetici özeti e-postası (Pazartesi 08:00,
 * lib/cron.ts). Yönetici Özet Paneli'nin (Bölüm G) hesabını
 * (`computeExecutiveSummary("week", true)`) yeniden kullanır — kopya yok.
 * SMTP yapılandırılmamışsa sessizce atlar (mevcut e-posta deseni).
 *
 * @param onlyOwnerIds Testlerde yalnızca belirli OWNER'lara hedefli çalıştırmak
 *   için (gerçek OWNER'lara e-posta gitmesin / Bölüm Q dersi). Üretim cron'u
 *   parametresiz çağırır → weeklyDigestEnabled olan tüm OWNER'lar.
 */
export interface WeeklyDigestResult {
  sent: number;
  skipped: number;
  emailConfigured: boolean;
  recipients: string[];
}

function formatKpi(k: ExecutiveKpi): string {
  if (k.value === null || k.value === undefined) return "—";
  switch (k.format) {
    case "currency":
      return `${Number(k.value).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`;
    case "percent":
      return `%${Math.round(Number(k.value))}`;
    case "score":
      return Number(k.value).toFixed(1);
    default:
      return String(k.value);
  }
}

export function renderWeeklyDigestHtml(summary: ExecutiveSummary, ownerName: string): string {
  const section = (title: string, kpis: ExecutiveKpi[]) =>
    kpis.length === 0
      ? ""
      : `<h3 style="margin:18px 0 6px;font-size:14px;color:#2F5233">${title}</h3>
         <table style="border-collapse:collapse;width:100%;font-size:13px">
           ${kpis
             .map(
               (k) =>
                 `<tr><td style="padding:4px 0;color:#5A6B5E">${k.label}</td><td style="padding:4px 0;text-align:right;font-weight:600">${formatKpi(k)}</td></tr>`
             )
             .join("")}
         </table>`;

  const start = new Date(summary.rangeStart).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const end = new Date(summary.rangeEnd).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const b = summary.pendingApprovalsBreakdown;
  const pendingTotal = b.quotes + b.advances + b.leaveRequests + b.expiringContracts + b.jobReports + b.staffBonuses;

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#16211A">
      <h2 style="color:#2F5233;margin-bottom:4px">Haftalık Özet</h2>
      <p style="margin:0 0 12px;color:#5A6B5E;font-size:13px">Merhaba ${ownerName}, ${start} – ${end} dönemi.</p>
      ${section("Finans", summary.sections.finance)}
      ${section("Operasyon", summary.sections.operations)}
      ${section("Personel", summary.sections.staff)}
      ${section("Müşteriler", summary.sections.customers)}
      ${section("Uyarılar", summary.sections.alerts)}
      <p style="margin-top:18px;font-size:13px"><strong>Bekleyen onaylar:</strong> ${pendingTotal} (teklif ${b.quotes}, avans ${b.advances}, izin ${b.leaveRequests}, sözleşme ${b.expiringContracts}, saha raporu ${b.jobReports}, prim ${b.staffBonuses})</p>
      <p style="margin-top:20px;font-size:11px;color:#8B9A8E">Bu e-postayı Ayarlar → Bildirim Tercihleri → "Haftalık Özet E-postası" ile kapatabilirsiniz.</p>
    </div>`;
}

export async function sendWeeklyDigest(onlyOwnerIds?: string[]): Promise<WeeklyDigestResult> {
  const owners = await prisma.user.findMany({
    where: { role: Role.OWNER, isActive: true, ...(onlyOwnerIds ? { id: { in: onlyOwnerIds } } : {}) },
    select: { id: true, email: true, fullName: true, notificationPreference: { select: { weeklyDigestEnabled: true } } },
  });

  const result: WeeklyDigestResult = { sent: 0, skipped: 0, emailConfigured: isEmailConfigured(), recipients: [] };
  const eligible = owners.filter((o) => o.notificationPreference?.weeklyDigestEnabled ?? true);
  result.skipped = owners.length - eligible.length;
  if (eligible.length === 0) return result;

  // Özet bir kez hesaplanır, her OWNER'a aynı içerik (kişisel selamlama ile).
  const summary = await computeExecutiveSummary("week", true);
  for (const owner of eligible) {
    result.recipients.push(owner.email);
    if (!result.emailConfigured) continue; // sessiz atla — mevcut desen
    await sendEmail(owner.email, "Haftalık Yönetici Özeti — Nilüfer İlaçlama", renderWeeklyDigestHtml(summary, owner.fullName));
    result.sent += 1;
  }
  return result;
}
