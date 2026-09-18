import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm K (3. tur): Personel müsait-olmama işaretleri.
 * - kendi kaydını oluşturur/siler; BAŞKASININ kaydını silemez (404, varlık sızmaz)
 * - geçmiş tarih 400; saat aralığı doğrulaması
 * - GET /staff/:id/unavailability kapsamı: STAFF kendi, TEAM_LEAD ekibi, OWNER herkes
 * - GET /staff/unavailability?date= — iş atama formundaki uyarının veri kaynağı:
 *   işaretli personel listede, işaretsiz değil; TEAM_LEAD yalnızca ekibini görür
 */

const NIL = "00000000-0000-4000-8000-000000000000";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("Personel müsaitlik (/staff/**/unavailability)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let lead: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let customer: TestUser;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    lead = await ctx.createStaffUser(Role.TEAM_LEAD, { tag: "lead" });
    member = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "member" });
    outsider = await ctx.createStaffUser(Role.STAFF, { tag: "outsider" });
    customer = await ctx.createUser(Role.CUSTOMER);
    for (const [key, u] of Object.entries({ owner, lead, member, outsider, customer })) {
      tokens[key] = await ctx.tokenFor(u);
    }
  });

  afterAll(() => ctx.cleanup());

  const as = (key: string) => `Bearer ${tokens[key]}`;
  const targetDate = isoDate(3);

  describe("oluşturma doğrulaması", () => {
    it("geçmiş tarih 400", async () => {
      const res = await api().post("/staff/me/unavailability").set("Authorization", as("member")).send({ date: isoDate(-1) });
      expect(res.status).toBe(400);
    });

    it("yalnızca başlangıç saati verilirse 400; başlangıç >= bitiş 400; bozuk saat 400", async () => {
      const onlyStart = await api().post("/staff/me/unavailability").set("Authorization", as("member")).send({ date: targetDate, startTime: "13:00" });
      expect(onlyStart.status).toBe(400);
      const inverted = await api()
        .post("/staff/me/unavailability")
        .set("Authorization", as("member"))
        .send({ date: targetDate, startTime: "15:00", endTime: "13:00" });
      expect(inverted.status).toBe(400);
      const bad = await api()
        .post("/staff/me/unavailability")
        .set("Authorization", as("member"))
        .send({ date: targetDate, startTime: "25:00", endTime: "26:00" });
      expect(bad.status).toBe(400);
    });

    it("bugün (tüm gün) kabul edilir", async () => {
      const res = await api().post("/staff/me/unavailability").set("Authorization", as("member")).send({ date: isoDate(0) });
      expect(res.status).toBe(201);
      expect(res.body.date).toBe(isoDate(0));
      expect(res.body.startTime).toBeNull();
      ctx.track("staffUnavailability", res.body.id);
    });
  });

  describe("kendi kaydı / başkasının kaydı", () => {
    let memberRowId: string;
    let outsiderRowId: string;

    beforeAll(async () => {
      const m = await api()
        .post("/staff/me/unavailability")
        .set("Authorization", as("member"))
        .send({ date: targetDate, startTime: "13:00", endTime: "17:00", reason: "Doktor" });
      expect(m.status).toBe(201);
      expect(m.body.staffId).toBe(member.staffId);
      memberRowId = m.body.id;

      const o = await api().post("/staff/me/unavailability").set("Authorization", as("outsider")).send({ date: targetDate });
      expect(o.status).toBe(201);
      outsiderRowId = o.body.id;
    });

    it("GET /staff/me/unavailability?month= kendi kayıtlarını döner", async () => {
      const res = await api().get(`/staff/me/unavailability?month=${targetDate.slice(0, 7)}`).set("Authorization", as("member"));
      expect(res.status).toBe(200);
      const ids = res.body.data.map((r: { id: string }) => r.id);
      expect(ids).toContain(memberRowId);
      expect(ids).not.toContain(outsiderRowId);
    });

    it("başkasının kaydını SİLEMEZ (404) — kayıt yerinde kalır", async () => {
      const res = await api().delete(`/staff/me/unavailability/${outsiderRowId}`).set("Authorization", as("member"));
      expect(res.status).toBe(404);
      const still = await prisma.staffUnavailability.findUnique({ where: { id: outsiderRowId } });
      expect(still).not.toBeNull();
    });

    it("kendi kaydını siler (204); tekrar silme 404", async () => {
      const res = await api().delete(`/staff/me/unavailability/${memberRowId}`).set("Authorization", as("member"));
      expect(res.status).toBe(204);
      const gone = await prisma.staffUnavailability.findUnique({ where: { id: memberRowId } });
      expect(gone).toBeNull();
      const again = await api().delete(`/staff/me/unavailability/${memberRowId}`).set("Authorization", as("member"));
      expect(again.status).toBe(404);
    });
  });

  describe("GET /staff/:id/unavailability kapsamı", () => {
    it("STAFF kendi kaydına erişir, başkasınınkine 403", async () => {
      const own = await api().get(`/staff/${member.staffId}/unavailability`).set("Authorization", as("member"));
      expect(own.status).toBe(200);
      const other = await api().get(`/staff/${outsider.staffId}/unavailability`).set("Authorization", as("member"));
      expect(other.status).toBe(403);
    });

    it("TEAM_LEAD ekip üyesine erişir, ekip dışına 403", async () => {
      const inTeam = await api().get(`/staff/${member.staffId}/unavailability`).set("Authorization", as("lead"));
      expect(inTeam.status).toBe(200);
      const outTeam = await api().get(`/staff/${outsider.staffId}/unavailability`).set("Authorization", as("lead"));
      expect(outTeam.status).toBe(403);
    });

    it("OWNER herkese erişir; olmayan personel 404", async () => {
      const res = await api().get(`/staff/${outsider.staffId}/unavailability?month=${targetDate.slice(0, 7)}`).set("Authorization", as("owner"));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const missing = await api().get(`/staff/${NIL}/unavailability`).set("Authorization", as("owner"));
      expect(missing.status).toBe(404);
    });
  });

  describe("GET /staff/unavailability?date= (iş atama formu uyarısı)", () => {
    it("date zorunlu (400); işaretli personel listede, işaretsiz değil", async () => {
      const noDate = await api().get("/staff/unavailability").set("Authorization", as("owner"));
      expect(noDate.status).toBe(400);

      const res = await api().get(`/staff/unavailability?date=${targetDate}`).set("Authorization", as("owner"));
      expect(res.status).toBe(200);
      const staffIds = res.body.data.map((r: { staffId: string }) => r.staffId);
      expect(staffIds).toContain(outsider.staffId); // tüm gün işaretli
      expect(staffIds).not.toContain(member.staffId); // kaydı silinmişti
      expect(staffIds).not.toContain(lead.staffId); // hiç işaretlemedi

      const otherDay = await api().get(`/staff/unavailability?date=${isoDate(10)}`).set("Authorization", as("owner"));
      expect(otherDay.body.data.map((r: { staffId: string }) => r.staffId)).not.toContain(outsider.staffId);
    });

    it("TEAM_LEAD yalnızca ekibini görür (ekip dışı işaret gizli)", async () => {
      const res = await api().get(`/staff/unavailability?date=${targetDate}`).set("Authorization", as("lead"));
      expect(res.status).toBe(200);
      expect(res.body.data.map((r: { staffId: string }) => r.staffId)).not.toContain(outsider.staffId);
    });
  });

  describe("RBAC", () => {
    it("me/unavailability yalnızca STAFF/TEAM_LEAD; OWNER/CUSTOMER 403", async () => {
      for (const key of ["owner", "customer"]) {
        const post = await api().post("/staff/me/unavailability").set("Authorization", as(key)).send({ date: targetDate });
        expect(post.status, `post ${key}`).toBe(403);
        const get = await api().get("/staff/me/unavailability").set("Authorization", as(key));
        expect(get.status, `get ${key}`).toBe(403);
      }
    });

    it("/staff/unavailability?date= STAFF/CUSTOMER 403", async () => {
      for (const key of ["member", "customer"]) {
        const res = await api().get(`/staff/unavailability?date=${targetDate}`).set("Authorization", as(key));
        expect(res.status, key).toBe(403);
      }
    });
  });
});
