import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const backendRoot = require("node:path").resolve(__dirname, "../../backend");
const baseUrl = "http://127.0.0.1:3000";
const roleCounts = { OWNER: 22, MANAGER: 19, TEAM_LEAD: 13, STAFF: 10, CUSTOMER: 7 } as const;
type Role = keyof typeof roleCounts;
let prisma: any;
let passwordHash: string;

test.beforeAll(async () => {
  require(`${backendRoot}/node_modules/dotenv`).config({ path: `${backendRoot}/.env`, quiet: true });
  const database = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "::1"].includes(database.hostname)) {
    throw new Error("E2E testi yalnız yerel veritabanında çalışabilir");
  }
  const { PrismaClient } = require(`${backendRoot}/node_modules/@prisma/client`);
  const bcrypt = require(`${backendRoot}/node_modules/bcrypt`);
  prisma = new PrismaClient();
  passwordHash = await bcrypt.hash("TestSifre123!", 10);
});

test.afterAll(async () => {
  await prisma?.$disconnect();
});

async function createRoleAccount(role: Role) {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: {
    email: `e2e_nav_${role.toLowerCase()}_${suffix}@test.local`,
    fullName: `E2E ${role}`,
    passwordHash,
    role,
  } });
  if (role === "TEAM_LEAD" || role === "STAFF") {
    await prisma.staff.create({ data: { userId: user.id, position: "E2E Test", salaryBase: 10000 } });
  }
  if (role === "CUSTOMER") {
    await prisma.customer.create({ data: { userId: user.id, fullName: `E2E Müşteri ${suffix}`, phone: "05000000000" } });
  }
  return user;
}

async function removeRoleAccount(user: { id: string }) {
  await prisma.userSession.deleteMany({ where: { userId: user.id } });
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  await prisma.notificationPreference.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: user.id }, { targetUserId: user.id }] } });
  await prisma.staff.deleteMany({ where: { userId: user.id } });
  await prisma.customer.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

async function login(page: any, email: string) {
  await page.goto(`${baseUrl}/giris`, { waitUntil: "domcontentloaded" });
  const emailField = page.getByRole("textbox", { name: "E-posta" });
  await expect.poll(() => emailField.evaluate((element: Element) => {
    let current: Element | null = element;
    while (current) {
      if (Number(getComputedStyle(current).opacity) < 0.99) return false;
      current = current.parentElement;
    }
    return true;
  })).toBe(true);
  await emailField.fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill("TestSifre123!");
  const responsePromise = page.waitForResponse((response: any) => response.url().endsWith("/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect(page).toHaveURL(`${baseUrl}/`, { timeout: 60_000 });
}

for (const [role, expectedCount] of Object.entries(roleCounts) as [Role, number][]) {
  test(`${role} gerçek giriş, menü tıklamaları ve çıkış`, async ({ page }) => {
    test.setTimeout(420_000);
    const user = await createRoleAccount(role);
    let loggedIn = false;
    try {
      await login(page, user.email);
      loggedIn = true;
      const links = page.locator("aside nav a:visible");
      await expect(links).toHaveCount(expectedCount);
      const routes = await links.evaluateAll((items: Element[]) => items.map((item) => (item as HTMLAnchorElement).pathname));
      const failures: string[] = [];
      let visited = 0;
      for (const route of routes) {
        try {
          const link = page.locator(`aside nav a[href="${route}"]:visible`);
          await link.click({ timeout: 15_000 });
          await expect(page).toHaveURL(`${baseUrl}${route}`, { timeout: 60_000 });
          await expect(page.locator("main")).toBeVisible();
          visited++;
        } catch (error) {
          failures.push(`${route}: ${error instanceof Error ? error.message.split("\n")[0] : "bilinmeyen hata"}`);
          await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
        }
      }
      console.log(`${role} menü tıklaması: ${visited}/${routes.length}`);
      expect(failures).toEqual([]);
    } finally {
      if (loggedIn && !page.isClosed()) {
        await page.locator("aside").getByRole("button", { name: "Çıkış yap" }).click().catch(() => {});
      }
      await removeRoleAccount(user);
    }
  });
}

async function openAndCancel(page: any, route: string, buttonName: string) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: buttonName, exact: true }).first();
  await waitHydrated(button);
  await button.click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(dialog).toBeHidden();
}

async function waitHydrated(locator: any) {
  await expect.poll(() => locator.evaluate((element: Element) =>
    Object.keys(element).some((key) => key.startsWith("__reactProps$"))
  ), { timeout: 30_000 }).toBe(true);
}

for (const role of Object.keys(roleCounts) as Role[]) {
  test(`${role} ekran kontrolleri ve yetki sınırı`, async ({ page }) => {
    test.setTimeout(300_000);
    const user = await createRoleAccount(role);
    try {
      await login(page, user.email);
      await page.goto(`${baseUrl}/isler`, { waitUntil: "domcontentloaded" });
      const calendar = page.getByRole("button", { name: "Takvim", exact: true });
      await waitHydrated(calendar);
      await calendar.click();
      await expect(calendar).toHaveClass(/bg-surface-card/);
      const list = page.getByRole("button", { name: "Liste", exact: true });
      await list.click();
      await expect(list).toHaveClass(/bg-surface-card/);

      if (role === "OWNER" || role === "MANAGER") {
        await openAndCancel(page, "/isler", "Yeni İş");
        await openAndCancel(page, "/personel", "Yeni Personel");
        await openAndCancel(page, "/sozlesmeler", "Yeni Sözleşme");
        await openAndCancel(page, "/para", "Tahsilat Kaydet");
        await openAndCancel(page, "/stok", "Yeni Ürün");
      }
      if (role === "MANAGER") {
        await openAndCancel(page, "/musteriler", "Yeni Müşteri");
      }
      if (role === "TEAM_LEAD" || role === "STAFF") {
        const staff = await prisma.staff.findUniqueOrThrow({ where: { userId: user.id } });
        const before = await prisma.leaveRequest.count({ where: { staffId: staff.id } });
        await openAndCancel(page, "/izinlerim", "Yeni Talep");
        expect(await prisma.leaveRequest.count({ where: { staffId: staff.id } })).toBe(before);
      }
      if (role === "CUSTOMER") {
        const customer = await prisma.customer.findUniqueOrThrow({ where: { userId: user.id } });
        const before = await prisma.customerComplaint.count({ where: { customerId: customer.id } });
        await openAndCancel(page, "/sikayetler", "Yeni Şikayet");
        expect(await prisma.customerComplaint.count({ where: { customerId: customer.id } })).toBe(before);
      }

      if (role !== "OWNER") {
        await page.goto(`${baseUrl}/loglar`, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(`${baseUrl}/`, { timeout: 30_000 });
        const token = await page.evaluate(() => localStorage.getItem("token"));
        expect(token).toBeTruthy();
        const response = await page.request.get("http://127.0.0.1:4000/audit-logs", {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(response.status()).toBe(403);
        if (role !== "MANAGER") {
          const deniedName = `e2e_yetki_${randomUUID().slice(0, 8)}`;
          const createResponse = await page.request.post("http://127.0.0.1:4000/customers", {
            headers: { Authorization: `Bearer ${token}` },
            data: { fullName: deniedName, phone: "05000000002" },
          });
          expect(createResponse.status()).toBe(403);
          expect(await prisma.customer.count({ where: { fullName: deniedName } })).toBe(0);
        }
      }

      await page.locator("aside").getByRole("button", { name: "Çıkış yap" }).click();
      await expect(page).toHaveURL(/\/giris$/, { timeout: 30_000 });
    } finally {
      await removeRoleAccount(user);
    }
  });
}

for (const role of Object.keys(roleCounts) as Role[]) {
  test(`${role} ana ekran genişlikleri`, async ({ page }) => {
    test.setTimeout(180_000);
    const user = await createRoleAccount(role);
    try {
      await login(page, user.email);
      for (const width of [360, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main")).toBeVisible();
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth, `${role} ${width}px yatay taşma`).toBeLessThanOrEqual(width + 1);
        if (width < 768) {
          const menu = page.getByRole("button", { name: "Menüyü aç" });
          await waitHydrated(menu);
          await menu.click();
          const drawer = page.locator("aside:visible").last();
          await expect(drawer.getByRole("link", { name: "Ana Sayfa" })).toBeVisible();
          await drawer.getByRole("link", { name: "Ana Sayfa" }).click();
        } else {
          await expect(page.locator("aside:visible").getByRole("link", { name: "Ana Sayfa" })).toBeVisible();
        }
      }
      await page.locator("aside").getByRole("button", { name: "Çıkış yap" }).click();
      await expect(page).toHaveURL(/\/giris$/);
    } finally {
      await removeRoleAccount(user);
    }
  });
}

for (const role of Object.keys(roleCounts) as Role[]) {
  test(`${role} ortak filtre ve sekme düğmeleri`, async ({ page }) => {
    test.setTimeout(180_000);
    const user = await createRoleAccount(role);
    try {
      await login(page, user.email);

      await page.goto(`${baseUrl}/takvim`, { waitUntil: "domcontentloaded" });
      const nextMonth = page.getByRole("button", { name: "Sonraki ay" });
      await waitHydrated(nextMonth);
      const label = nextMonth.locator("..").locator("span");
      const originalMonth = await label.innerText();
      await nextMonth.click();
      await expect(label).not.toHaveText(originalMonth);
      await page.getByRole("button", { name: "Önceki ay" }).click();
      await expect(label).toHaveText(originalMonth);

      await page.goto(`${baseUrl}/bildirimler`, { waitUntil: "domcontentloaded" });
      const unread = page.getByRole("button", { name: /^Okunmadı/ });
      await waitHydrated(unread);
      await unread.click();
      await expect(unread).toHaveClass(/bg-primary-600/);
      const read = page.getByRole("button", { name: /^Okundu/ });
      await read.click();
      await expect(read).toHaveClass(/bg-primary-600/);

      await page.goto(`${baseUrl}/ayarlar`, { waitUntil: "domcontentloaded" });
      if (role === "OWNER" || role === "MANAGER") {
        const operations = page.getByRole("tab", { name: "Operasyon" });
        await waitHydrated(operations);
        await operations.click();
        await expect(operations).toHaveAttribute("aria-selected", "true");
        const account = page.getByRole("tab", { name: "Hesap" });
        await account.click();
        await expect(account).toHaveAttribute("aria-selected", "true");
      } else {
        await expect(page.getByRole("tablist", { name: "Ayar grupları" })).toHaveCount(0);
      }

      await page.locator("aside").getByRole("button", { name: "Çıkış yap" }).click();
      await expect(page).toHaveURL(/\/giris$/);
    } finally {
      await removeRoleAccount(user);
    }
  });
}
