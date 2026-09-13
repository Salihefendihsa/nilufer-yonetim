import { createHash } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { generate as generateTotp } from "otplib";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PASSWORD, type TestUser } from "./helpers/fixtures";

/**
 * Auth akışları: login, 2FA (setup→enable→login→verify), şifre sıfırlama
 * token yaşam döngüsü, mustChangePassword zorlaması.
 */
describe("Auth", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
  });

  afterAll(() => ctx.cleanup());

  describe("login", () => {
    it("doğru bilgilerle token + user döner", async () => {
      const res = await ctx.login(owner.email);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTypeOf("string");
      expect(res.body.user).toMatchObject({ id: owner.id, role: "OWNER" });
      expect(res.body.mustChangePassword).toBe(false);
    });

    it("yanlış şifre 401 döner (genel mesaj, kullanıcı varlığı sızmaz)", async () => {
      const res = await ctx.login(owner.email, "yanlis-sifre");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("E-posta veya şifre hatalı");
    });

    it("olmayan e-posta da aynı 401 mesajını döner", async () => {
      const res = await ctx.login("vt_yok_" + owner.email, TEST_PASSWORD);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("E-posta veya şifre hatalı");
    });

    it("devre dışı hesap 403 döner", async () => {
      const inactive = await ctx.createUser(Role.STAFF, { isActive: false, tag: "inactive" });
      const res = await ctx.login(inactive.email);
      expect(res.status).toBe(403);
    });

    it("token /auth/me'de kabul edilir; bozuk token 401", async () => {
      const token = await ctx.tokenFor(staff);
      const ok = await api().get("/auth/me").set("Authorization", `Bearer ${token}`);
      expect(ok.status).toBe(200);
      expect(ok.body.id ?? ok.body.user?.id).toBe(staff.id);

      const bad = await api().get("/auth/me").set("Authorization", "Bearer bozuk.token.degeri");
      expect(bad.status).toBe(401);
    });
  });

  describe("2FA akışı (setup → enable → login → verify)", () => {
    let manager: TestUser;

    beforeAll(async () => {
      manager = await ctx.createUser(Role.MANAGER, { tag: "2fa" });
    });

    it("STAFF 2FA kuramaz (403) — yalnızca OWNER/MANAGER", async () => {
      const res = await api().post("/auth/2fa/setup").set("Authorization", `Bearer ${await ctx.tokenFor(staff)}`);
      expect(res.status).toBe(403);
    });

    it("tam akış: kurulum sırrı → gerçek TOTP ile etkinleştirme → login preToken → verify ile tam token", async () => {
      const token = await ctx.tokenFor(manager);

      const setup = await api().post("/auth/2fa/setup").set("Authorization", `Bearer ${token}`);
      expect(setup.status).toBe(200);
      expect(setup.body.secret).toBeTypeOf("string");
      expect(setup.body.qrCodeDataUrl).toMatch(/^data:image\/png/);

      // Henüz etkin DEĞİL — setup tek başına 2FA'yı açmaz.
      const beforeEnable = await prisma.user.findUniqueOrThrow({ where: { id: manager.id } });
      expect(beforeEnable.twoFactorEnabled).toBe(false);

      const wrongCode = await api()
        .post("/auth/2fa/enable")
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "000000" });
      expect(wrongCode.status).toBe(400);

      const code = await generateTotp({ secret: setup.body.secret });
      const enable = await api().post("/auth/2fa/enable").set("Authorization", `Bearer ${token}`).send({ code });
      expect(enable.status).toBe(200);
      expect(enable.body.recoveryCodes).toHaveLength(10);

      // Login artık tam token yerine preToken döner.
      const login = await ctx.login(manager.email);
      expect(login.status).toBe(200);
      expect(login.body.twoFactorRequired).toBe(true);
      expect(login.body.token).toBeUndefined();
      const preToken = login.body.preToken as string;

      const badVerify = await api().post("/auth/2fa/verify").send({ preToken, code: "000000" });
      expect(badVerify.status).toBe(401);

      const verify = await api()
        .post("/auth/2fa/verify")
        .send({ preToken, code: await generateTotp({ secret: setup.body.secret }) });
      expect(verify.status).toBe(200);
      expect(verify.body.token).toBeTypeOf("string");

      // preToken tek kullanımlık — ikinci kez 401.
      const reuse = await api()
        .post("/auth/2fa/verify")
        .send({ preToken, code: await generateTotp({ secret: setup.body.secret }) });
      expect(reuse.status).toBe(401);

      // Kurtarma kodu ile giriş de çalışır ve kod tüketilir.
      const login2 = await ctx.login(manager.email);
      const recoveryCode = enable.body.recoveryCodes[0] as string;
      const viaRecovery = await api().post("/auth/2fa/verify").send({ preToken: login2.body.preToken, recoveryCode });
      expect(viaRecovery.status).toBe(200);

      const login3 = await ctx.login(manager.email);
      const reusedRecovery = await api().post("/auth/2fa/verify").send({ preToken: login3.body.preToken, recoveryCode });
      expect(reusedRecovery.status).toBe(401);
    });
  });

  describe("şifre sıfırlama", () => {
    function hashResetToken(raw: string) {
      return createHash("sha256").update(raw).digest("hex");
    }

    async function issueToken(userId: string, opts: { expiresAt?: Date; usedAt?: Date } = {}) {
      const raw = `vt_reset_${Math.random().toString(36).slice(2)}`;
      const row = await prisma.passwordResetToken.create({
        data: {
          userId,
          token: hashResetToken(raw),
          expiresAt: opts.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
          usedAt: opts.usedAt,
        },
      });
      ctx.track("passwordResetToken", row.id);
      return raw;
    }

    it("forgot-password kullanıcı var/yok fark etmeksizin aynı mesajı döner ve varsa token üretir", async () => {
      const user = await ctx.createUser(Role.STAFF, { tag: "forgot" });
      const known = await api().post("/auth/forgot-password").send({ email: user.email });
      const unknown = await api().post("/auth/forgot-password").send({ email: `vt_yok_${user.email}` });
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body.message).toBe(unknown.body.message);
      expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);
    });

    it("geçerli token şifreyi değiştirir, eski JWT'leri geçersiz kılar ve token'ı kullanılmış işaretler", async () => {
      const user = await ctx.createUser(Role.STAFF, { tag: "reset" });
      const oldToken = await ctx.tokenFor(user);
      const raw = await issueToken(user.id);

      const res = await api().post("/auth/reset-password").send({ token: raw, newPassword: "YeniSifre123!" });
      expect(res.status).toBe(200);

      // Eski şifre artık geçersiz, yeni şifre çalışır.
      expect((await ctx.login(user.email, TEST_PASSWORD)).status).toBe(401);
      expect((await ctx.login(user.email, "YeniSifre123!")).status).toBe(200);

      // tokenVersion arttı → eski JWT reddedilir.
      const me = await api().get("/auth/me").set("Authorization", `Bearer ${oldToken}`);
      expect(me.status).toBe(401);

      // Aynı token ikinci kez kullanılamaz.
      const again = await api().post("/auth/reset-password").send({ token: raw, newPassword: "BaskaSifre123!" });
      expect(again.status).toBe(400);
    });

    it("süresi dolmuş token reddedilir", async () => {
      const user = await ctx.createUser(Role.STAFF, { tag: "expired" });
      const raw = await issueToken(user.id, { expiresAt: new Date(Date.now() - 1000) });
      const res = await api().post("/auth/reset-password").send({ token: raw, newPassword: "YeniSifre123!" });
      expect(res.status).toBe(400);
    });

    it("kullanılmış token reddedilir", async () => {
      const user = await ctx.createUser(Role.STAFF, { tag: "used" });
      const raw = await issueToken(user.id, { usedAt: new Date() });
      const res = await api().post("/auth/reset-password").send({ token: raw, newPassword: "YeniSifre123!" });
      expect(res.status).toBe(400);
    });

    it("uydurma token reddedilir", async () => {
      const res = await api().post("/auth/reset-password").send({ token: "vt_olmayan_token", newPassword: "YeniSifre123!" });
      expect(res.status).toBe(400);
    });
  });

  describe("mustChangePassword zorlaması", () => {
    it("bayrak açıkken yalnızca /auth/me, /auth/logout, /auth/change-password geçer; diğer uçlar 403", async () => {
      const user = await ctx.createStaffUser(Role.STAFF, { tag: "mcp" });
      await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });

      const login = await ctx.login(user.email);
      expect(login.status).toBe(200);
      expect(login.body.mustChangePassword).toBe(true);
      const token = login.body.token as string;

      const me = await api().get("/auth/me").set("Authorization", `Bearer ${token}`);
      expect(me.status).toBe(200);

      const blocked = await api().get("/jobs").set("Authorization", `Bearer ${token}`);
      expect(blocked.status).toBe(403);
      expect(blocked.body.mustChangePassword).toBe(true);

      const wrongCurrent = await api()
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "yanlis", newPassword: "YeniSifre123!" });
      expect(wrongCurrent.status).toBe(401);

      const changed = await api()
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: TEST_PASSWORD, newPassword: "YeniSifre123!" });
      expect(changed.status).toBe(200);
      expect(changed.body.token).toBeTypeOf("string");

      // Yeni token ile artık diğer uçlar açık; eski token tokenVersion nedeniyle ölü.
      const after = await api().get("/jobs").set("Authorization", `Bearer ${changed.body.token}`);
      expect(after.status).toBe(200);
      const stale = await api().get("/jobs").set("Authorization", `Bearer ${token}`);
      expect(stale.status).toBe(401);
    });
  });
});
