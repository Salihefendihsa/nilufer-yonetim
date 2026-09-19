import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { buildIcsCalendar, escapeIcsText, foldIcsLine, icsDate } from "../src/lib/ics";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AP (9. tur): personel takvim dışa aktarma (ICS).
 * - lib/ics.ts: kaçış, katlama, tarih biçimi, VCALENDAR iskeleti
 * - GET /staff/me/calendar.ics: yalnızca kendi PENDING/SCHEDULED + 30 gün
 *   penceresindeki işler; COMPLETED / pencere dışı / başkasının işi yok;
 *   scheduledEndAt varsa DTEND o, yoksa +1 saat; LOCATION adres+ilçe
 * - GET /calendar/:token.ics: token'la header'sız erişim; bilinmeyen token 404;
 *   rotate sonrası eski token 404, yenisi çalışır
 */
describe("ICS üretici (lib/ics.ts)", () => {
  it("metin kaçışı ve tarih biçimi RFC 5545'e uygun", () => {
    expect(escapeIcsText("a,b;c\\d\nnew")).toBe("a\\,b\\;c\\\\d\\nnew");
    expect(icsDate(new Date("2026-10-05T09:30:00.000Z"))).toBe("20261005T093000Z");
  });

  it("75 oktetten uzun satır katlanır; çok baytlı karakter bölünmez", () => {
    const long = "SUMMARY:" + "ğ".repeat(60); // ğ = 2 bayt → 8 + 120 oktet
    const folded = foldIcsLine(long);
    expect(folded.length).toBeGreaterThan(1);
    expect(folded.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    const enc = new TextEncoder();
    expect(folded.every((l) => enc.encode(l).length <= 75)).toBe(true);
    // Katlamayı geri alınca orijinal metin
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join("")).toBe(long);
  });

  it("VCALENDAR iskeleti + VEVENT alanları, CRLF satır sonu", () => {
    const ics = buildIcsCalendar(
      [{ uid: "u1@x", start: new Date("2026-10-05T09:00:00Z"), end: new Date("2026-10-05T10:00:00Z"), summary: "Test; A, B", location: "Adres, İlçe" }],
      { name: "Takvim", now: new Date("2026-10-01T00:00:00Z") }
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT\r\nUID:u1@x\r\n");
    expect(ics).toContain("DTSTART:20261005T090000Z");
    expect(ics).toContain("SUMMARY:Test\\; A\\, B");
    expect(ics).toContain("LOCATION:Adres\\, İlçe");
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });
});

describe("Personel takvim dışa aktarma", () => {
  const ctx = new TestContext();
  let staff: TestUser;
  let other: TestUser;
  let staffToken: string;
  let jobInWindowId: string;
  let jobWithEndId: string;

  const inDays = (d: number, h = 9) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    x.setHours(h, 0, 0, 0);
    return x;
  };

  beforeAll(async () => {
    staff = await ctx.createStaffUser(Role.STAFF);
    other = await ctx.createStaffUser(Role.STAFF, { tag: "other" });
    staffToken = await ctx.tokenFor(staff);
    const customer = await ctx.createCustomer({ fullName: "vt_Takvim Müşterisi" });
    await prisma.customer.update({ where: { id: customer.id }, data: { address: "Çekirge Cd. 12, Daire 3", district: "Nilüfer" } });

    jobInWindowId = (await ctx.createJob({ customerId: customer.id, assignedStaffId: staff.staffId!, status: JobStatus.SCHEDULED, scheduledAt: inDays(3), serviceType: "vt_Haşere" })).id;
    jobWithEndId = (
      await ctx.createJob({ customerId: customer.id, assignedStaffId: staff.staffId!, status: JobStatus.PENDING, scheduledAt: inDays(5, 14), scheduledEndAt: inDays(5, 16), serviceType: "vt_Kemirgen" })
    ).id;
    // Görünmemesi gerekenler
    await ctx.createJob({ customerId: customer.id, assignedStaffId: staff.staffId!, status: JobStatus.COMPLETED, scheduledAt: inDays(2), serviceType: "vt_Tamamlanmış" });
    await ctx.createJob({ customerId: customer.id, assignedStaffId: staff.staffId!, status: JobStatus.SCHEDULED, scheduledAt: inDays(45), serviceType: "vt_PencereDışı" });
    await ctx.createJob({ customerId: customer.id, assignedStaffId: other.staffId!, status: JobStatus.SCHEDULED, scheduledAt: inDays(4), serviceType: "vt_Başkasının" });
    await ctx.createJob({ customerId: customer.id, assignedStaffId: staff.staffId!, status: JobStatus.SCHEDULED, scheduledAt: null, serviceType: "vt_Tarihsiz" });
  });

  afterAll(() => ctx.cleanup());

  it("GET /staff/me/calendar.ics: yalnızca kendi, pencere içi, aktif işler; DTEND kuralı; konum", async () => {
    const res = await api().get("/staff/me/calendar.ics").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    const ics = res.text;
    expect(ics.split("BEGIN:VEVENT")).toHaveLength(3); // 2 etkinlik
    expect(ics).toContain(`UID:job-${jobInWindowId}@nilufer-ilaclama`);
    expect(ics).toContain(`UID:job-${jobWithEndId}@nilufer-ilaclama`);
    expect(ics).toContain("SUMMARY:vt_Takvim Müşterisi — vt_Haşere");
    expect(ics).toContain("LOCATION:Çekirge Cd. 12\\, Daire 3\\, Nilüfer");
    expect(ics).not.toContain("vt_Tamamlanmış");
    expect(ics).not.toContain("vt_PencereDışı");
    expect(ics).not.toContain("vt_Başkasının");
    expect(ics).not.toContain("vt_Tarihsiz");

    // DTEND: scheduledEndAt varsa o (+2 saat), yoksa +1 saat
    const lines = ics.replace(/\r\n /g, "").split("\r\n");
    const events: string[][] = [];
    let cur: string[] | null = null;
    for (const l of lines) {
      if (l === "BEGIN:VEVENT") cur = [];
      else if (l === "END:VEVENT" && cur) {
        events.push(cur);
        cur = null;
      } else if (cur) cur.push(l);
    }
    const pick = (ev: string[], key: string) => ev.find((l) => l.startsWith(`${key}:`))!.slice(key.length + 1);
    const parse = (s: string) => new Date(s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"));
    const hasere = events.find((e) => pick(e, "UID").includes(jobInWindowId))!;
    const kemirgen = events.find((e) => pick(e, "UID").includes(jobWithEndId))!;
    expect(parse(pick(hasere, "DTEND")).getTime() - parse(pick(hasere, "DTSTART")).getTime()).toBe(60 * 60 * 1000);
    expect(parse(pick(kemirgen, "DTEND")).getTime() - parse(pick(kemirgen, "DTSTART")).getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it("token: ilk istekte üretilir, header'sız /calendar/:token.ics çalışır; geçersiz token 404", async () => {
    const first = await api().get("/staff/me/calendar-token").set("Authorization", `Bearer ${staffToken}`);
    expect(first.status).toBe(200);
    expect(first.body.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.body.url).toContain(`/calendar/${first.body.token}.ics`);
    expect(first.body.webcalUrl.startsWith("webcal://")).toBe(true);
    // İkinci istek aynı token'ı döner (idempotent)
    const again = await api().get("/staff/me/calendar-token").set("Authorization", `Bearer ${staffToken}`);
    expect(again.body.token).toBe(first.body.token);

    const pub = await api().get(`/calendar/${first.body.token}.ics`);
    expect(pub.status).toBe(200);
    expect(pub.headers["content-type"]).toContain("text/calendar");
    expect(pub.text).toContain(`UID:job-${jobInWindowId}@nilufer-ilaclama`);

    const bogus = await api().get("/calendar/00000000-0000-4000-8000-000000000000.ics");
    expect(bogus.status).toBe(404);
    const garbage = await api().get("/calendar/not-a-token.ics");
    expect(garbage.status).toBe(404);
  });

  it("rotate: eski token 404, yeni token çalışır; arşivli personelin token'ı çalışmaz", async () => {
    const before = (await api().get("/staff/me/calendar-token").set("Authorization", `Bearer ${staffToken}`)).body.token as string;
    const rotated = await api().post("/staff/me/calendar-token/rotate").set("Authorization", `Bearer ${staffToken}`);
    expect(rotated.status).toBe(200);
    expect(rotated.body.token).not.toBe(before);

    expect((await api().get(`/calendar/${before}.ics`)).status).toBe(404);
    expect((await api().get(`/calendar/${rotated.body.token}.ics`)).status).toBe(200);

    await prisma.staff.update({ where: { id: staff.staffId! }, data: { archivedAt: new Date() } });
    expect((await api().get(`/calendar/${rotated.body.token}.ics`)).status).toBe(404);
    await prisma.staff.update({ where: { id: staff.staffId! }, data: { archivedAt: null } });
  });
});
