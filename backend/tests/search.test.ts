import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm I (3. tur): Global arama (/search) rol kapsamı.
 *
 * Her varlık türü için ilgili liste ucundaki kural aynen geçerli olmalı:
 * STAFF başka personelin işini/müşterisini, TEAM_LEAD ekip dışı personeli,
 * CUSTOMER başkasının kaydını GÖREMEZ; OWNER/MANAGER her şeyi görür. Test
 * verisi benzersiz bir "işaret kelime" (uuid önekli) taşır — arama bu
 * kelimeyle yapılır, böylece dev verisiyle çakışma olmaz.
 */

interface SearchResult {
  type: "customer" | "job" | "staff" | "contract" | "quote";
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

describe("Global arama (/search)", () => {
  const ctx = new TestContext();
  // Arama terimi: her koşuda farklı, Türkçe büyük İ içeriyor ki ILIKE/Türkçe
  // varyant mantığı da sınansın.
  const marker = `${TEST_PREFIX}İşaret${uid()}`;

  let owner: TestUser;
  let lead: TestUser;
  let leadMember: TestUser;
  let outsider: TestUser;
  let customerUserA: TestUser;
  let customerUserB: TestUser;
  let customerAId: string;
  let customerBId: string;
  let jobForMemberId: string;
  let jobForOutsiderId: string;
  let contractId: string;
  let quoteId: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    lead = await ctx.createStaffUser(Role.TEAM_LEAD, { tag: "lead" });
    leadMember = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "member" });
    outsider = await ctx.createStaffUser(Role.STAFF, { tag: "outsider" });
    customerUserA = await ctx.createUser(Role.CUSTOMER, { tag: "custA" });
    customerUserB = await ctx.createUser(Role.CUSTOMER, { tag: "custB" });

    // Personel adları da işaret kelimeyi taşısın (personel araması için).
    await prisma.user.update({ where: { id: leadMember.id }, data: { fullName: `${marker} Üye` } });
    await prisma.user.update({ where: { id: outsider.id }, data: { fullName: `${marker} Dışarıdan` } });

    const customerA = await ctx.createCustomer({ userId: customerUserA.id, fullName: `${marker} Müşteri A` });
    const customerB = await ctx.createCustomer({ userId: customerUserB.id, fullName: `${marker} Müşteri B` });
    customerAId = customerA.id;
    customerBId = customerB.id;

    // A'nın işi ekip üyesine, B'nin işi ekip dışı personele atanmış.
    jobForMemberId = (await ctx.createJob({ customerId: customerAId, assignedStaffId: leadMember.staffId, status: "SCHEDULED" })).id;
    jobForOutsiderId = (await ctx.createJob({ customerId: customerBId, assignedStaffId: outsider.staffId, status: "SCHEDULED" })).id;

    const contract = await prisma.contract.create({
      data: {
        customerId: customerAId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        durationMonths: 12,
        status: "ACTIVE",
      },
    });
    contractId = contract.id; // cleanup: sweepByOwners müşteri sözleşmelerini siler

    const quote = await prisma.quoteRequest.create({
      data: { fullName: `${marker} Teklif`, phone: "05000000000", propertyType: "EV", serviceType: "Test" },
    });
    quoteId = quote.id;
    ctx.track("quoteRequest", quote.id);
  });

  afterAll(() => ctx.cleanup());

  async function searchAs(user: TestUser, q = marker): Promise<SearchResult[]> {
    const token = await ctx.tokenFor(user);
    const res = await api().get(`/search?q=${encodeURIComponent(q)}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.results as SearchResult[];
  }

  const ids = (results: SearchResult[], type: SearchResult["type"]) => results.filter((r) => r.type === type).map((r) => r.id);

  it("2 karakterden kısa sorgu boş liste döner (sorgu yapılmaz)", async () => {
    const results = await searchAs(owner, "a");
    expect(results).toEqual([]);
  });

  it("token'sız istek 401", async () => {
    const res = await api().get(`/search?q=${encodeURIComponent(marker)}`);
    expect(res.status).toBe(401);
  });

  it("OWNER tüm türlerde sonuç görür; her sonuç normalize alanları taşır", async () => {
    const results = await searchAs(owner);
    expect(ids(results, "customer")).toEqual(expect.arrayContaining([customerAId, customerBId]));
    expect(ids(results, "job")).toEqual(expect.arrayContaining([jobForMemberId, jobForOutsiderId]));
    expect(ids(results, "staff")).toEqual(expect.arrayContaining([leadMember.staffId, outsider.staffId]));
    expect(ids(results, "contract")).toContain(contractId);
    expect(ids(results, "quote")).toContain(quoteId);
    for (const r of results) {
      expect(r).toEqual(
        expect.objectContaining({ type: expect.any(String), id: expect.any(String), title: expect.any(String), subtitle: expect.any(String), route: expect.stringMatching(/^\//) })
      );
    }
  });

  it("Türkçe büyük/küçük harf: küçük 'i' ile aranınca 'İ' içeren kayıt bulunur", async () => {
    const lower = marker.toLocaleLowerCase("tr-TR");
    expect(lower).not.toBe(marker);
    const results = await searchAs(owner, lower);
    expect(ids(results, "customer")).toContain(customerAId);
  });

  it("tür başına en fazla 5 sonuç", async () => {
    const results = await searchAs(owner, "a");
    // "a" 1 karakter → boş. Gerçek limit kontrolü: 2+ karakterli geniş bir terim.
    const wide = await searchAs(owner, TEST_PREFIX);
    for (const type of ["customer", "job", "staff", "contract", "quote"] as const) {
      expect(ids(wide, type).length, type).toBeLessThanOrEqual(5);
    }
    expect(results).toEqual([]);
  });

  it("STAFF yalnızca kendi işini ve o işin müşterisini görür; başka personelin işini/müşterisini GÖREMEZ", async () => {
    const results = await searchAs(leadMember);
    expect(ids(results, "job")).toEqual([jobForMemberId]);
    expect(ids(results, "customer")).toEqual([customerAId]);
    expect(ids(results, "job")).not.toContain(jobForOutsiderId);
    expect(ids(results, "customer")).not.toContain(customerBId);
    // STAFF personel/sözleşme/teklif aramaz.
    expect(ids(results, "staff")).toEqual([]);
    expect(ids(results, "contract")).toEqual([]);
    expect(ids(results, "quote")).toEqual([]);
  });

  it("TEAM_LEAD yalnızca ekibindeki personeli ve ekibinin işlerini görür; ekip dışı personeli GÖREMEZ", async () => {
    const results = await searchAs(lead);
    expect(ids(results, "staff")).toContain(leadMember.staffId);
    expect(ids(results, "staff")).not.toContain(outsider.staffId);
    expect(ids(results, "job")).toEqual([jobForMemberId]);
    // TEAM_LEAD'in müşteri/sözleşme/teklif listesine erişimi yok.
    expect(ids(results, "customer")).toEqual([]);
    expect(ids(results, "contract")).toEqual([]);
    expect(ids(results, "quote")).toEqual([]);
  });

  it("CUSTOMER yalnızca kendi kaydını, işini ve sözleşmesini görür; başka müşteriyi GÖREMEZ", async () => {
    const results = await searchAs(customerUserA);
    expect(ids(results, "customer")).toEqual([customerAId]);
    expect(ids(results, "job")).toEqual([jobForMemberId]);
    expect(ids(results, "contract")).toEqual([contractId]);
    expect(ids(results, "staff")).toEqual([]);
    expect(ids(results, "quote")).toEqual([]);

    const other = await searchAs(customerUserB);
    expect(ids(other, "customer")).toEqual([customerBId]);
    expect(ids(other, "contract")).toEqual([]);
    expect(ids(other, "job")).toEqual([jobForOutsiderId]);
  });
});
