import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { renderWeeklyDigestHtml, sendWeeklyDigest } from "../src/lib/weeklyDigest";
import { computeExecutiveSummary } from "../src/controllers/executiveSummaryController";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AF (7. tur): Haftalık özet e-postası.
 * - sendWeeklyDigest(onlyOwnerIds) HEDEFLİ çağrılır — gerçek OWNER'lara gitmez
 *   (Bölüm Q dersi). Test ortamında SMTP boş (setup.ts) → sessizce atlanır:
 *   emailConfigured=false, sent=0, alıcı listesi yine hesaplanır.
 * - weeklyDigestEnabled=false olan OWNER atlanır (skipped), pasif OWNER hiç seçilmez
 * - HTML şablonu Yönetici Özeti bölümlerini ve bekleyen onayları içerir
 * - Tercih ucu weeklyDigestEnabled'ı okur/yazar
 */
describe("Haftalık özet e-postası", () => {
  const ctx = new TestContext();
  let ownerOn: TestUser;
  let ownerOff: TestUser;
  let ownerInactive: TestUser;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    ownerOn = await ctx.createUser(Role.OWNER, { tag: "on" });
    ownerOff = await ctx.createUser(Role.OWNER, { tag: "off" });
    ownerInactive = await ctx.createUser(Role.OWNER, { tag: "inactive", isActive: false });
    await prisma.notificationPreference.create({ data: { userId: ownerOff.id, weeklyDigestEnabled: false } });
    tokens.on = await ctx.tokenFor(ownerOn);
  });

  afterAll(() => ctx.cleanup());

  it("hedefli çağrı: SMTP yokken sessiz atlar (sent 0), açık OWNER alıcı listesinde, kapalı olan skipped, pasif seçilmez", async () => {
    const result = await sendWeeklyDigest([ownerOn.id, ownerOff.id, ownerInactive.id]);
    expect(result.emailConfigured).toBe(false);
    expect(result.sent).toBe(0);
    expect(result.recipients).toEqual([ownerOn.email]);
    expect(result.skipped).toBe(1);
  });

  it("hedef listesi boşsa hiçbir OWNER seçilmez (global çağrı yapılmaz)", async () => {
    const result = await sendWeeklyDigest(["00000000-0000-4000-8000-000000000000"]);
    expect(result.recipients).toEqual([]);
    expect(result.sent).toBe(0);
  });

  it("HTML şablonu: bölüm başlıkları, KPI etiketleri ve bekleyen onay kırılımı", async () => {
    const summary = await computeExecutiveSummary("week", true);
    const html = renderWeeklyDigestHtml(summary, "Test Patron");
    expect(html).toContain("Haftalık Özet");
    expect(html).toContain("Merhaba Test Patron");
    expect(html).toContain("Bekleyen onaylar");
    for (const k of summary.sections.finance.slice(0, 2)) expect(html).toContain(k.label);
    expect(html).toContain("Haftalık Özet E-postası");
  });

  it("tercih ucu weeklyDigestEnabled'ı döner ve günceller", async () => {
    const before = await api().get("/notification-preferences").set("Authorization", `Bearer ${tokens.on}`);
    expect(before.status).toBe(200);
    expect(before.body.weeklyDigestEnabled).toBe(true);
    const upd = await api().patch("/notification-preferences").set("Authorization", `Bearer ${tokens.on}`).send({ weeklyDigestEnabled: false });
    expect(upd.status).toBe(200);
    expect(upd.body.weeklyDigestEnabled).toBe(false);
    const after = await sendWeeklyDigest([ownerOn.id]);
    expect(after.recipients).toEqual([]);
    expect(after.skipped).toBe(1);
  });
});
