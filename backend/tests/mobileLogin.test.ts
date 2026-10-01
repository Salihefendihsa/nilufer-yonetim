import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PASSWORD } from "./helpers/fixtures";

describe("Mobil giriş yapılandırması ve oturum", () => {
  const ctx = new TestContext();
  const appKey = "vt_mobil_giris_anahtari";
  let previousRecaptcha: string | undefined;
  let previousAppKey: string | undefined;

  beforeAll(() => {
    previousRecaptcha = process.env.RECAPTCHA_SECRET_KEY;
    previousAppKey = process.env.MOBILE_APP_SECRET;
    process.env.RECAPTCHA_SECRET_KEY = "vt_recaptcha_etkin";
    process.env.MOBILE_APP_SECRET = appKey;
  });

  afterAll(async () => {
    process.env.RECAPTCHA_SECRET_KEY = previousRecaptcha;
    process.env.MOBILE_APP_SECRET = previousAppKey;
    await ctx.cleanup();
  });

  function mobileLogin(email: string, password = TEST_PASSWORD, key?: string) {
    const request = api()
      .post("/auth/login")
      .set("X-Client-Type", "mobile")
      .send({ email, password });
    return key === undefined ? request : request.set("X-Mobile-App-Key", key);
  }

  it("eksik/yanlış mobil anahtar ve web tokenı olmadan girişi reddeder", async () => {
    const user = await ctx.createUser(Role.CUSTOMER);
    expect((await mobileLogin(user.email)).status).toBe(400);
    expect((await mobileLogin(user.email, TEST_PASSWORD, "yanlis-anahtar")).status).toBe(400);
    expect((await api().post("/auth/login").send({ email: user.email, password: TEST_PASSWORD })).status).toBe(400);
  });

  it("doğru mobil anahtarla yanlış parolayı reddeder", async () => {
    const user = await ctx.createUser(Role.CUSTOMER);
    const res = await mobileLogin(user.email, "yanlis-parola", appKey);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("E-posta veya şifre hatalı");
  });

  it("gerçek giriş, oturum, çıkış ve yeniden giriş akışını korur", async () => {
    const user = await ctx.createUser(Role.CUSTOMER);
    const first = await mobileLogin(user.email, TEST_PASSWORD, appKey);
    expect(first.status).toBe(200);
    expect(first.body.user).toMatchObject({ id: user.id, role: Role.CUSTOMER });
    const oldToken = first.body.token as string;

    const me = await api().get("/auth/me").set("Authorization", `Bearer ${oldToken}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(user.id);

    const logout = await api().post("/auth/logout").set("Authorization", `Bearer ${oldToken}`);
    expect(logout.status).toBe(200);
    expect(await prisma.userSession.count({ where: { userId: user.id, logoutAt: { not: null } } })).toBe(1);

    // Mevcut sözleşme: logout satırı kapatır; JWT'yi anında iptal etmez.
    expect((await api().get("/auth/me").set("Authorization", `Bearer ${oldToken}`)).status).toBe(200);

    const second = await mobileLogin(user.email, TEST_PASSWORD, appKey);
    expect(second.status).toBe(200);
    expect(second.body.token).not.toBe(oldToken);
    expect((await api().get("/auth/me").set("Authorization", `Bearer ${second.body.token}`)).status).toBe(200);
    expect(await prisma.userSession.count({ where: { userId: user.id } })).toBe(2);
  });
});
