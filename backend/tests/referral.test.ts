import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { generateReferralCode, normalizeReferralCode } from "../src/lib/referral";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm P (4. tur): Arkadaşını Davet Et.
 * - GET /customers/me/referral: kod yoksa üretir, link + davet sayısı
 * - POST /quotes ?ref=/referralCode: geçerli kod saklanır, uydurma kod yoksayılır (form başarılı)
 * - POST /quotes/:id/convert: yeni müşteri referredByCustomerId ile bağlanır,
 *   davet edene "Davetiniz kabul edildi!" bildirimi; davet sayısı artar
 * - İndirim/ödül YOK (yalnızca takip)
 */
describe("Referans programı", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let referrerUser: TestUser;
  let referrerCustomerId: string;
  let referralCode: string;
  const createdCustomerIds: string[] = [];
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    referrerUser = await ctx.createUser(Role.CUSTOMER, { tag: "referrer" });
    referrerCustomerId = (await ctx.createCustomer({ userId: referrerUser.id })).id; // referralCode: null (eski kayıt gibi)
    for (const [k, u] of Object.entries({ owner, referrerUser })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(async () => {
    // convert ile oluşan müşteriler fixture listesinde değil — ID bazlı sil.
    await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await ctx.cleanup();
  });

  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("kod üretimi: 6 karakter, karışabilen harfler yok; normalize büyük harfe çevirir", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(normalizeReferralCode(" ab12cd ")).toBe("AB12CD");
    expect(normalizeReferralCode("x")).toBeNull();
    expect(normalizeReferralCode(42)).toBeNull();
  });

  it("GET /customers/me/referral kodu yoksa üretir ve sabit kalır; link ?ref= içerir; sayı 0", async () => {
    const first = await api().get("/customers/me/referral").set("Authorization", as("referrerUser"));
    expect(first.status).toBe(200);
    expect(first.body.referralCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(first.body.inviteLink).toContain(`/teklif-al?ref=${first.body.referralCode}`);
    expect(first.body.referredCount).toBe(0);
    referralCode = first.body.referralCode;

    const second = await api().get("/customers/me/referral").set("Authorization", as("referrerUser"));
    expect(second.body.referralCode).toBe(referralCode);

    const forbidden = await api().get("/customers/me/referral").set("Authorization", as("owner"));
    expect(forbidden.status).toBe(403);
  });

  it("POST /quotes: geçerli ?ref= saklanır; uydurma kod yoksayılır ama talep yine oluşur", async () => {
    const base = { fullName: `${TEST_PREFIX}Davetli ${uid()}`, phone: "05001112233", propertyType: "Ev", serviceType: "Genel" };
    const withRef = await api().post(`/quotes?ref=${referralCode.toLowerCase()}`).send(base);
    expect(withRef.status).toBe(201);
    expect(withRef.body.referralCode).toBe(referralCode);
    ctx.track("quoteRequest", withRef.body.id);

    const bodyRef = await api().post("/quotes").send({ ...base, referralCode });
    expect(bodyRef.body.referralCode).toBe(referralCode);
    ctx.track("quoteRequest", bodyRef.body.id);

    const bogus = await api().post("/quotes").send({ ...base, referralCode: "ZZZZZZ" });
    expect(bogus.status).toBe(201);
    expect(bogus.body.referralCode).toBeNull();
    ctx.track("quoteRequest", bogus.body.id);
  });

  it("convert: yeni müşteri davet edene bağlanır, bildirim gider, davet sayısı artar", async () => {
    const quote = await api()
      .post("/quotes")
      .send({ fullName: `${TEST_PREFIX}Yeni Müşteri ${uid()}`, phone: "05009998877", propertyType: "Ev", serviceType: "Genel", referralCode });
    ctx.track("quoteRequest", quote.body.id);

    const converted = await api().post(`/quotes/${quote.body.id}/convert`).set("Authorization", as("owner"));
    expect(converted.status).toBe(201);
    createdCustomerIds.push(converted.body.id);
    expect(converted.body.referredByCustomerId).toBe(referrerCustomerId);
    expect(converted.body.referralCode).toMatch(/^[A-Z0-9]{6}$/); // yeni müşterinin de kendi kodu var

    const notif = await prisma.notification.findFirst({
      where: { userId: referrerUser.id, type: "referral_converted", relatedId: converted.body.id },
    });
    expect(notif?.title).toBe("Davetiniz kabul edildi!");

    const me = await api().get("/customers/me/referral").set("Authorization", as("referrerUser"));
    expect(me.body.referredCount).toBe(1);
    expect(me.body.referred[0].id).toBe(converted.body.id);
  });

  it("convert: kodsuz teklif bağlantısız kalır (referredByCustomerId null)", async () => {
    const quote = await api()
      .post("/quotes")
      .send({ fullName: `${TEST_PREFIX}Bağımsız ${uid()}`, phone: "05007776655", propertyType: "Ev", serviceType: "Genel" });
    ctx.track("quoteRequest", quote.body.id);
    const converted = await api().post(`/quotes/${quote.body.id}/convert`).set("Authorization", as("owner"));
    expect(converted.status).toBe(201);
    createdCustomerIds.push(converted.body.id);
    expect(converted.body.referredByCustomerId).toBeNull();
  });
});
