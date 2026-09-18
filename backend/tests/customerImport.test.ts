import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseCsv, csvToRecords } from "../src/lib/csv";
import { api, TestContext, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AL (8. tur): CSV toplu müşteri içe aktarma.
 * - geçerli CSV → toplu ekleme (created)
 * - telefonu mevcut satır atlanır (skipped), güncelleme yok
 * - zorunlu alan eksik satır errors[]'a düşer, diğer satırlar yine eklenir (tek transaction değil)
 * - parseCsv: tırnak, ayraç `;`, BOM
 * - Temizlik: içe aktarılan müşteriler telefon prefix'i değil, dönen isimlerle bulunup ID ile silinir.
 */
describe("CSV müşteri içe aktarma", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let token: string;
  const tag = uid();
  const createdIds: string[] = [];
  const phone = (n: number) => `0555${tag.slice(0, 3).replace(/\D/g, "1").padEnd(3, "1")}${String(n).padStart(3, "0")}`;

  const upload = (csv: string, name = "musteriler.csv") =>
    api().post("/customers/import").set("Authorization", `Bearer ${token}`).attach("file", Buffer.from(csv, "utf8"), { filename: name, contentType: "text/csv" });

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    token = await ctx.tokenFor(owner);
  });

  afterAll(async () => {
    const rows = await prisma.customer.findMany({ where: { fullName: { startsWith: `vt_csv_${tag}` } }, select: { id: true } });
    const ids = [...new Set([...createdIds, ...rows.map((r) => r.id)])];
    if (ids.length) await prisma.customer.deleteMany({ where: { id: { in: ids } } });
    await ctx.cleanup();
  });

  it("parseCsv: tırnaklı alan, alan içi virgül, ; ayracı ve BOM", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
    expect(parseCsv("﻿fullName;phone\nAli;0555\n\n")).toEqual([["fullName", "phone"], ["Ali", "0555"]]);
    const { records } = csvToRecords("FullName,Phone,Email\nAyşe,0555,a@b.c");
    expect(records[0]).toEqual({ fullname: "Ayşe", phone: "0555", email: "a@b.c" });
  });

  it("geçerli CSV → tüm satırlar eklenir; eksik alan hata olarak raporlanır, diğerleri yine eklenir", async () => {
    const csv = [
      "fullName,phone,email,address,district",
      `vt_csv_${tag} Bir,${phone(1)},bir@example.com,"Cadde 1, No 2",Nilüfer`,
      `vt_csv_${tag} İki,${phone(2)},,,Osmangazi`,
      `,${phone(3)},,,`, // fullName eksik
      `vt_csv_${tag} Dört,,,,`, // phone eksik
      `vt_csv_${tag} Beş,${phone(5)},gecersiz-eposta,,`, // email hatalı
    ].join("\n");
    const res = await upload(csv);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.skipped).toBe(0);
    expect(res.body.errors).toHaveLength(3);
    expect(res.body.errors.map((e: { row: number }) => e.row)).toEqual([4, 5, 6]);
    expect(res.body.errors[0].reason).toContain("fullName");

    const rows = await prisma.customer.findMany({ where: { phone: { in: [phone(1), phone(2)] } } });
    expect(rows).toHaveLength(2);
    createdIds.push(...rows.map((r) => r.id));
    const bir = rows.find((r) => r.phone === phone(1))!;
    expect(bir.address).toBe("Cadde 1, No 2");
    expect(bir.referralCode).toBeTruthy();
  });

  it("telefonu mevcut satır atlanır (güncelleme yok); yeni olan eklenir; dosya içi yinelenen atlanır", async () => {
    const csv = [
      "fullName;phone",
      `vt_csv_${tag} Bir GÜNCELLENMEMELİ;${phone(1)}`,
      `vt_csv_${tag} Altı;${phone(6)}`,
      `vt_csv_${tag} Altı tekrar;${phone(6)}`,
    ].join("\r\n");
    const res = await upload(csv);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: 1, skipped: 2, errors: [] });

    const bir = await prisma.customer.findFirst({ where: { phone: phone(1) } });
    expect(bir?.fullName).toBe(`vt_csv_${tag} Bir`);
    const alti = await prisma.customer.findMany({ where: { phone: phone(6) } });
    expect(alti).toHaveLength(1);
    createdIds.push(alti[0].id);
  });

  it("dosya yok / başlık eksik / .csv değil → 400", async () => {
    expect((await api().post("/customers/import").set("Authorization", `Bearer ${token}`)).status).toBe(400);
    expect((await upload("ad,telefon\nx,y")).status).toBe(400);
    expect((await upload("fullName,phone\nx,y", "musteriler.xlsx")).status).toBe(400);
  });
});
