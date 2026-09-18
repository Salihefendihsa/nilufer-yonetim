import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { JOB_CHECKLIST_TEMPLATE } from "../src/lib/checklist";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm N (4. tur): İş öncesi kontrol listesi.
 * - Şablon sabit; GET /jobs/:id her zaman tam listeyi döner (null → hepsi işaretsiz)
 * - Yalnızca işin atandığı STAFF işaretler; başka personel 403
 * - Şablon dışı öğe 400; işaret kaldırılınca checkedAt sıfırlanır
 * - Rapor oluşturulurken liste rapora kopyalanır; eksik liste raporu ENGELLEMEZ
 */
describe("İş kontrol listesi (/jobs/:id/checklist)", () => {
  const ctx = new TestContext();
  let assignee: TestUser;
  let other: TestUser;
  let owner: TestUser;
  let jobId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    assignee = await ctx.createStaffUser(Role.STAFF, { tag: "assignee" });
    other = await ctx.createStaffUser(Role.STAFF, { tag: "other" });
    owner = await ctx.createUser(Role.OWNER);
    const customer = await ctx.createCustomer();
    jobId = (await ctx.createJob({ customerId: customer.id, assignedStaffId: assignee.staffId, status: "SCHEDULED" })).id;
    for (const [k, u] of Object.entries({ assignee, other, owner })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(() => ctx.cleanup());

  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("GET /jobs/:id listeyi tam şablon olarak (hepsi işaretsiz) döner", async () => {
    const res = await api().get(`/jobs/${jobId}`).set("Authorization", as("assignee"));
    expect(res.status).toBe(200);
    expect(res.body.checklist.map((c: { item: string }) => c.item)).toEqual([...JOB_CHECKLIST_TEMPLATE]);
    expect(res.body.checklist.every((c: { isChecked: boolean }) => c.isChecked === false)).toBe(true);
  });

  it("başka personel işaretleyemez (403); OWNER route'a giremez (403)", async () => {
    const body = { items: [{ item: JOB_CHECKLIST_TEMPLATE[0], isChecked: true }] };
    const o = await api().patch(`/jobs/${jobId}/checklist`).set("Authorization", as("other")).send(body);
    expect(o.status).toBe(403);
    const w = await api().patch(`/jobs/${jobId}/checklist`).set("Authorization", as("owner")).send(body);
    expect(w.status).toBe(403);
  });

  it("şablon dışı öğe 400", async () => {
    const res = await api()
      .patch(`/jobs/${jobId}/checklist`)
      .set("Authorization", as("assignee"))
      .send({ items: [{ item: "Kahve içildi", isChecked: true }] });
    expect(res.status).toBe(400);
  });

  it("atanan personel kısmi işaretler → isComplete false; tümü → true; kaldırınca checkedAt null", async () => {
    const partial = await api()
      .patch(`/jobs/${jobId}/checklist`)
      .set("Authorization", as("assignee"))
      .send({ items: [{ item: JOB_CHECKLIST_TEMPLATE[0], isChecked: true }, { item: JOB_CHECKLIST_TEMPLATE[1], isChecked: true }] });
    expect(partial.status).toBe(200);
    expect(partial.body.isComplete).toBe(false);
    const first = partial.body.checklist.find((c: { item: string }) => c.item === JOB_CHECKLIST_TEMPLATE[0]);
    expect(first.isChecked).toBe(true);
    expect(first.checkedAt).toBeTruthy();
    const firstCheckedAt = first.checkedAt;

    const full = await api()
      .patch(`/jobs/${jobId}/checklist`)
      .set("Authorization", as("assignee"))
      .send({ items: JOB_CHECKLIST_TEMPLATE.map((item) => ({ item, isChecked: true })) });
    expect(full.body.isComplete).toBe(true);
    // Zaten işaretli olan öğenin checkedAt'i korunur.
    expect(full.body.checklist.find((c: { item: string }) => c.item === JOB_CHECKLIST_TEMPLATE[0]).checkedAt).toBe(firstCheckedAt);

    const uncheck = await api()
      .patch(`/jobs/${jobId}/checklist`)
      .set("Authorization", as("assignee"))
      .send({ items: [{ item: JOB_CHECKLIST_TEMPLATE[3], isChecked: false }] });
    expect(uncheck.body.isComplete).toBe(false);
    const last = uncheck.body.checklist.find((c: { item: string }) => c.item === JOB_CHECKLIST_TEMPLATE[3]);
    expect(last.isChecked).toBe(false);
    expect(last.checkedAt).toBeNull();
  });

  it("rapor oluşturulunca liste rapora kopyalanır; eksik liste raporu engellemez", async () => {
    const report = await api().post(`/jobs/${jobId}/report`).set("Authorization", as("assignee")).send({ dosage: "50 ml", notes: "ok" });
    expect(report.status).toBe(201);

    const fetched = await api().get(`/jobs/${jobId}/report`).set("Authorization", as("owner"));
    expect(fetched.status).toBe(200);
    expect(fetched.body.checklist).toHaveLength(JOB_CHECKLIST_TEMPLATE.length);
    // 3 işaretli, 1 (sonuncu) işaretsiz olarak kopyalandı.
    expect(fetched.body.checklist.filter((c: { isChecked: boolean }) => c.isChecked)).toHaveLength(3);
  });
});
