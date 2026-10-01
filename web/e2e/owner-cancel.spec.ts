import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const backendRoot = require("node:path").resolve(__dirname, "../../backend");
let prisma: any;
let owner: { id: string; email: string };
const cancelledName = `e2e_iptal_${randomUUID().slice(0, 8)}`;
const createdName = `e2e_musteri_${randomUUID().slice(0, 8)}`;
const editedName = `${createdName}_duzenlendi`;

test.beforeAll(async () => {
  require(`${backendRoot}/node_modules/dotenv`).config({ path: `${backendRoot}/.env`, quiet: true });
  const database = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "::1"].includes(database.hostname)) {
    throw new Error("E2E testi yalnız yerel veritabanında çalışabilir");
  }

  const { PrismaClient } = require(`${backendRoot}/node_modules/@prisma/client`);
  const bcrypt = require(`${backendRoot}/node_modules/bcrypt`);
  prisma = new PrismaClient();
  owner = await prisma.user.create({ data: {
    email: `e2e_owner_${randomUUID().slice(0, 8)}@test.local`,
    fullName: "E2E OWNER",
    passwordHash: await bcrypt.hash("TestSifre123!", 10),
    role: "OWNER",
  } });
});

test.afterAll(async () => {
  try {
    if (prisma) {
      await prisma.customer.deleteMany({ where: { fullName: cancelledName } });
      await prisma.customer.deleteMany({ where: { fullName: { in: [createdName, editedName] } } });
      if (owner) {
        await prisma.userSession.deleteMany({ where: { userId: owner.id } });
        await prisma.notification.deleteMany({ where: { userId: owner.id } });
        await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: owner.id }, { targetUserId: owner.id }] } });
        await prisma.user.delete({ where: { id: owner.id } });
      }
    }
  } finally {
    await prisma?.$disconnect();
  }
});

test("OWNER müşteri kaydı yenilemede korunur ve düzenleme kaydedilir", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("http://127.0.0.1:3000/giris", { waitUntil: "domcontentloaded" });
  const emailField = page.getByRole("textbox", { name: "E-posta" });
  await expect.poll(() => emailField.evaluate((element) => {
    let current: Element | null = element;
    while (current) {
      if (Number(getComputedStyle(current).opacity) < 0.99) return false;
      current = current.parentElement;
    }
    return true;
  })).toBe(true);
  await emailField.fill(owner.email);
  await page.getByLabel("Şifre", { exact: true }).fill("TestSifre123!");
  const loginResponse = page.waitForResponse((response) => response.url().endsWith("/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL("http://127.0.0.1:3000/", { timeout: 60_000 });

  await page.getByRole("link", { name: "Müşteriler", exact: true }).click();
  await page.getByRole("button", { name: "Yeni Müşteri" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("input").nth(0).fill(createdName);
  await dialog.locator("input").nth(1).fill("05000000001");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toBeHidden();
  expect(await prisma.customer.count({ where: { fullName: createdName } })).toBe(1);
  await expect(page.getByRole("row").filter({ hasText: createdName })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("row").filter({ hasText: createdName })).toBeVisible();
  await page.getByRole("row").filter({ hasText: createdName }).click();
  await page.getByRole("button", { name: "Düzenle" }).click();
  const editDialog = page.getByRole("dialog");
  await editDialog.locator("input").first().fill(editedName);
  await editDialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(editDialog).toBeHidden();
  expect(await prisma.customer.count({ where: { fullName: editedName } })).toBe(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("row").filter({ hasText: editedName })).toBeVisible();

  const search = page.getByPlaceholder("İsim, telefon veya semt ara...");
  await search.fill(editedName);
  await expect(page.getByRole("row").filter({ hasText: editedName })).toBeVisible();
  await search.fill("e2e_eslesmeyen_arama");
  await expect(page.getByRole("row").filter({ hasText: editedName })).toHaveCount(0);

  await page.locator("aside").getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/giris$/);
});

test("OWNER müşteri formunu iptal edince kayıt oluşmaz", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("http://127.0.0.1:3000/giris", { waitUntil: "domcontentloaded" });
  const emailField = page.getByRole("textbox", { name: "E-posta" });
  await expect.poll(() => emailField.evaluate((element) => {
    let current: Element | null = element;
    while (current) {
      if (Number(getComputedStyle(current).opacity) < 0.99) return false;
      current = current.parentElement;
    }
    return true;
  })).toBe(true);
  await emailField.fill(owner.email);
  await page.getByLabel("Şifre", { exact: true }).fill("TestSifre123!");
  const loginResponse = page.waitForResponse((response) => response.url().endsWith("/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  const response = await loginResponse;
  if (response.status() !== 200) {
    const result = await response.json();
    const sent = response.request().postDataJSON();
    throw new Error(`Giriş ${new URL(response.url()).origin} ${response.status()}: ${result.error ?? "bilinmeyen hata"}; e-posta uzunluğu=${sent.email?.length ?? 0}, parola uzunluğu=${sent.password?.length ?? 0}`);
  }
  await expect(page).toHaveURL("http://127.0.0.1:3000/", { timeout: 60_000 });

  await page.getByRole("link", { name: "Müşteriler", exact: true }).click();
  await expect(page).toHaveURL(/\/musteriler$/, { timeout: 60_000 });
  await page.getByRole("button", { name: "Yeni Müşteri" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").locator("input").first().fill(cancelledName);
  await page.getByRole("button", { name: "Vazgeç" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(await prisma.customer.count({ where: { fullName: cancelledName } })).toBe(0);

  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/giris$/);
});
