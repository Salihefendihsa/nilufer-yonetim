import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * GET /admin/backup: KISMİ, geri yüklenemez veri dökümü. User/Staff alanları açık
 * allowlist ile seçilir; kimlik doğrulama sırları hiçbir yoldan çıkmamalıdır.
 * Yalnızca SAHTE sırlar kullanılır.
 */
describe("Veri dışa aktarımı (GET /admin/backup)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let ownerToken: string;
  const FAKE_2FA = `FAKE2FASECRET${uid()}`;
  const FAKE_FCM = `fake-fcm-token-${uid()}`;
  const FAKE_CAL = `fake-calendar-token-${uid()}`;
  // Sır-benzeri değeri ZARARSIZ adlı anahtarda saklamak: ad desenine güvenen bir filtre bunu kaçırırdı.
  const FAKE_SETTING_SECRET = `sahte-ayar-sirri-${uid()}`;
  const harmlessKey = `${TEST_PREFIX}firma_notu_${uid()}`;
  const secretNamedKey = `${TEST_PREFIX}smtp_password_${uid()}`;
  let ownerHash: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    await prisma.user.update({
      where: { id: owner.id },
      data: { twoFactorSecret: FAKE_2FA, twoFactorEnabled: true, fcmTokens: [FAKE_FCM] },
    });
    await prisma.staff.update({ where: { id: staff.staffId! }, data: { calendarToken: FAKE_CAL } });
    await prisma.setting.createMany({
      data: [
        { key: harmlessKey, value: FAKE_SETTING_SECRET },
        { key: secretNamedKey, value: FAKE_SETTING_SECRET },
      ],
    });
    ownerHash = (await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).passwordHash;
    ownerToken = await ctx.tokenFor(owner);
  });

  afterAll(async () => {
    await prisma.setting.deleteMany({ where: { key: { in: [harmlessKey, secretNamedKey] } } });
    await ctx.cleanup();
  });

  const get = (token: string) => api().get("/admin/backup").set("Authorization", `Bearer ${token}`);

  it("OWNER dökümü alır; User ve Staff kayıtları yalnızca allowlist alanlarını taşır", async () => {
    const res = await get(ownerToken);
    expect(res.status).toBe(200);
    const u = res.body.users.find((x: { id: string }) => x.id === owner.id);
    expect(Object.keys(u).sort()).toEqual(["createdAt", "email", "fullName", "id", "isActive", "phone", "role"]);
    const s = res.body.staff.find((x: { id: string }) => x.id === staff.staffId);
    expect(s).toBeTruthy();
    expect(s).not.toHaveProperty("calendarToken");
  });

  it("hiçbir yolda sır sızmaz: şifre özeti, 2FA sırrı, FCM/takvim token'ları ve sır-benzeri ayar yanıt metninde yoktur", async () => {
    const text = (await get(ownerToken)).text;
    for (const leaked of [ownerHash, FAKE_2FA, FAKE_FCM, FAKE_CAL, FAKE_SETTING_SECRET, harmlessKey, secretNamedKey]) {
      expect(text.includes(leaked)).toBe(false);
    }
    for (const key of ["passwordHash", "twoFactorSecret", "fcmTokens", "tokenVersion", "calendarToken"]) {
      expect(text.includes(`"${key}"`)).toBe(false);
    }
  });

  it("settings yalnızca açık allowlist anahtarlarını içerir; zararsız adlı anahtardaki sahte sır da çıkmaz", async () => {
    const res = await get(ownerToken);
    const allowed: string[] = res.body.meta.settingsKeys;
    expect(allowed.length).toBeGreaterThan(0);
    for (const s of res.body.settings as { key: string }[]) {
      expect(allowed).toContain(s.key);
    }
    expect(JSON.stringify(res.body.settings)).not.toContain(FAKE_SETTING_SECRET);
  });

  it("çıktı kısmi/geri yüklenemez olarak işaretlidir ve tam yedek izlenimi vermez", async () => {
    const res = await get(ownerToken);
    expect(res.body.meta.restorable).toBe(false);
    expect(res.body.meta.kind).toBe("partial-data-export");
    expect(res.body.meta.collections).toContain("users");
    expect(res.headers["content-disposition"]).not.toMatch(/yedek/);
  });

  it("yetkisiz roller erişemez: MANAGER/STAFF 403, tokensız 401", async () => {
    const manager = await ctx.createUser(Role.MANAGER);
    expect((await get(await ctx.tokenFor(manager))).status).toBe(403);
    expect((await get(await ctx.tokenFor(staff))).status).toBe(403);
    expect((await api().get("/admin/backup")).status).toBe(401);
  });
});
