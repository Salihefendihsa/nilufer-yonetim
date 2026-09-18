import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computeQuoteResponseTime } from "../src/controllers/analyticsController";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AE (7. tur): Teklif yanıt süresi (SLA).
 * - firstContactedAt yalnızca NEW → başka duruma İLK geçişte damgalanır, sonra sabit
 * - convert: convertedAt; hiç temas yoksa firstContactedAt = dönüşüm anı
 * - computeQuoteResponseTime: bilinen damgalarla ortalama; damgasız → null
 * Gerçek dev teklifleriyle çakışmamak için saf hesap 30 yıl önceye demirlenmiş
 * penceredeki uydurma-olmayan kayıtlarla (createdAt geriye alınmış) yapılır;
 * kayıtlar ID ile silinir.
 */
describe("Teklif yanıt hızı", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  const tokens: Record<string, string> = {};
  const createdCustomerIds: string[] = [];

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    tokens.owner = await ctx.tokenFor(owner);
    tokens.staff = await ctx.tokenFor(staff);
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await ctx.cleanup();
  });

  const as = (k: string) => `Bearer ${tokens[k]}`;
  const base = () => ({ fullName: `${TEST_PREFIX}Teklif ${uid()}`, phone: "05000000001", propertyType: "Ev", serviceType: "Genel" });

  it("CONTACTED'e ilk geçişte firstContactedAt damgalanır ve sonraki güncellemede değişmez", async () => {
    const q = await api().post("/quotes").send(base());
    expect(q.status).toBe(201);
    ctx.track("quoteRequest", q.body.id);
    expect(q.body.firstContactedAt).toBeNull();

    const contacted = await api().patch(`/quotes/${q.body.id}`).set("Authorization", as("owner")).send({ status: "CONTACTED" });
    expect(contacted.status).toBe(200);
    expect(contacted.body.firstContactedAt).toBeTruthy();
    const stamp = contacted.body.firstContactedAt;

    const revised = await api().patch(`/quotes/${q.body.id}`).set("Authorization", as("owner")).send({ status: "REVISION", note: "x" });
    expect(revised.body.firstContactedAt).toBe(stamp);
  });

  it("doğrudan convert: convertedAt set, firstContactedAt de dönüşüm anına eşit", async () => {
    const q = await api().post("/quotes").send(base());
    ctx.track("quoteRequest", q.body.id);
    const conv = await api().post(`/quotes/${q.body.id}/convert`).set("Authorization", as("owner"));
    expect(conv.status).toBe(201);
    createdCustomerIds.push(conv.body.id);
    const row = await prisma.quoteRequest.findUniqueOrThrow({ where: { id: q.body.id } });
    expect(row.convertedAt).not.toBeNull();
    expect(row.firstContactedAt?.getTime()).toBe(row.convertedAt?.getTime());
  });

  it("saf hesap: 2h ve 4h temas → 3h; dönüşüm 10h; damgasız kayıt ortalamaya girmez; boş pencere null", async () => {
    // 30 yıl önceye demirlenmiş, dev verisinden yalıtılmış pencere.
    const anchor = new Date(new Date().getFullYear() - 30, 3, 15, 12);
    const at = (h: number) => new Date(anchor.getTime() - (10 - h) * 3600000); // createdAt = anchor-10h
    const created = new Date(anchor.getTime() - 10 * 3600000);
    const rows = [
      { firstContactedAt: at(2), convertedAt: null },
      { firstContactedAt: at(4), convertedAt: at(10) },
      { firstContactedAt: null, convertedAt: null },
    ];
    const ids: string[] = [];
    for (const r of rows) {
      const q = await prisma.quoteRequest.create({ data: { ...base(), createdAt: created, firstContactedAt: r.firstContactedAt, convertedAt: r.convertedAt } });
      ids.push(q.id);
      ctx.track("quoteRequest", q.id);
    }
    const result = await computeQuoteResponseTime(7, anchor);
    expect(result.quoteCount).toBe(3);
    expect(result.contactedCount).toBe(2);
    expect(result.avgFirstContactHours).toBe(3);
    expect(result.convertedCount).toBe(1);
    expect(result.avgConversionHours).toBe(10);

    const empty = await computeQuoteResponseTime(7, new Date(anchor.getTime() - 365 * 24 * 3600000));
    expect(empty.quoteCount).toBe(0);
    expect(empty.avgFirstContactHours).toBeNull();
    expect(empty.avgConversionHours).toBeNull();
  });

  it("GET /analytics/quote-response-time: OWNER 200 (last30/last90), STAFF 403", async () => {
    const res = await api().get("/analytics/quote-response-time").set("Authorization", as("owner"));
    expect(res.status).toBe(200);
    expect(res.body.last30.days).toBe(30);
    expect(res.body.last90.days).toBe(90);
    expect((await api().get("/analytics/quote-response-time").set("Authorization", as("staff"))).status).toBe(403);
  });
});
