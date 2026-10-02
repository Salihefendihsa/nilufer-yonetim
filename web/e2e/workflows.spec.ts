import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { unlink } from "node:fs/promises";

const backendRoot = path.resolve(__dirname, "../../backend");
const webUrl = "http://127.0.0.1:3000";
const suffix = randomUUID().slice(0, 8);
const password = "TestSifre123!";
const customerAName = `e2e_akis_A_${suffix}`;
const customerBName = `e2e_akis_B_${suffix}`;
const documentName = `e2e_belge_${suffix}.txt`;
const serviceName = `e2e_hizmet_${suffix}`;
const messageText = `e2e_mesaj_${suffix}`;
const renewalService = `e2e_yenile_${suffix}`;
let prisma: any;
let owner: any;
let staffUser: any;
let staff: any;
let customerA: any;
let customerB: any;

test.beforeAll(async () => {
  require(`${backendRoot}/node_modules/dotenv`).config({ path: `${backendRoot}/.env`, quiet: true });
  const database = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "::1"].includes(database.hostname)) {
    throw new Error("E2E testi yalnız yerel veritabanında çalışabilir");
  }
  const { PrismaClient } = require(`${backendRoot}/node_modules/@prisma/client`);
  const bcrypt = require(`${backendRoot}/node_modules/bcrypt`);
  prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);
  owner = await prisma.user.create({ data: {
    email: `e2e_akis_owner_${suffix}@test.local`, fullName: `E2E Yönetici ${suffix}`, passwordHash, role: "OWNER",
  } });
  staffUser = await prisma.user.create({ data: {
    email: `e2e_akis_staff_${suffix}@test.local`, fullName: `E2E Personel ${suffix}`, passwordHash, role: "STAFF",
  } });
  staff = await prisma.staff.create({ data: { userId: staffUser.id, position: "E2E Test", salaryBase: 10000 } });
  customerA = await prisma.customer.create({ data: { fullName: customerAName, phone: "05000000003" } });
  customerB = await prisma.customer.create({ data: { fullName: customerBName, phone: "05000000004" } });
});

test.afterAll(async () => {
  if (!prisma) return;
  try {
    const customerIds = [customerA?.id, customerB?.id].filter(Boolean);
    const userIds = [owner?.id, staffUser?.id].filter(Boolean);
    if (customerIds.length) {
      const docs = await prisma.customerDocument.findMany({ where: { customerId: { in: customerIds } } });
      await prisma.customerDocument.deleteMany({ where: { customerId: { in: customerIds } } });
      for (const doc of docs) {
        const filename = path.basename(doc.fileUrl);
        try {
          await unlink(path.join(backendRoot, "uploads", filename));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      await prisma.job.deleteMany({ where: { customerId: { in: customerIds } } });
      await prisma.contract.deleteMany({ where: { customerId: { in: customerIds }, serviceType: renewalService } });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    }
    if (userIds.length) {
      const conversations = await prisma.conversation.findMany({ where: {
        participantAId: { in: userIds }, participantBId: { in: userIds },
      } });
      const ids = conversations.map((item: { id: string }) => item.id);
      await prisma.message.deleteMany({ where: { conversationId: { in: ids } } });
      await prisma.conversation.deleteMany({ where: { id: { in: ids } } });
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { OR: [
        { actorUserId: { in: userIds } }, { targetUserId: { in: userIds } },
      ] } });
    }
    if (staff) await prisma.staff.deleteMany({ where: { id: staff.id } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

async function login(page: any, email: string) {
  await page.goto(`${webUrl}/giris`);
  const emailField = page.getByRole("textbox", { name: "E-posta" });
  await expect(emailField).toBeVisible();
  await expect.poll(() => emailField.evaluate((element: Element) => {
    let current: Element | null = element;
    while (current) {
      if (Number(getComputedStyle(current).opacity) < 0.99) return false;
      current = current.parentElement;
    }
    return Object.keys(element).some((key) => key.startsWith("__reactProps$"));
  })).toBe(true);
  await emailField.fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  const response = page.waitForResponse((res: any) => res.url().endsWith("/auth/login") && res.request().method() === "POST");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(`${webUrl}/`);
}

test("Müşteri A/B detayı ayrılır; belge yüklenir, indirilir ve yenilemede kalır", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, owner.email);
  await page.goto(`${webUrl}/musteriler`);
  const search = page.getByPlaceholder("İsim, telefon veya semt ara...");
  await search.fill(customerAName);
  await page.getByRole("row").filter({ hasText: customerAName }).click();
  const panel = page.locator("aside.fixed");
  await expect(panel.getByText(customerAName)).toBeVisible();
  await panel.getByRole("button", { name: "Kapat" }).click();
  await search.fill(customerBName);
  await page.getByRole("row").filter({ hasText: customerBName }).click();
  await expect(panel.getByText(customerBName)).toBeVisible();
  await expect(panel.getByText(customerAName)).toHaveCount(0);
  await panel.locator('input[type="file"]').setInputFiles({
    name: documentName, mimeType: "text/plain", buffer: Buffer.from("Yerel E2E belge örneği"),
  });
  await expect(panel.getByText(documentName)).toBeVisible();
  expect(await prisma.customerDocument.count({ where: { customerId: customerB.id, fileName: documentName } })).toBe(1);
  expect(await prisma.customerDocument.count({ where: { customerId: customerA.id, fileName: documentName } })).toBe(0);
  const fileResponse = page.waitForResponse((res) => res.url().includes("/files/customer-document/") && res.status() === 200);
  await panel.getByRole("listitem").filter({ hasText: documentName }).getByRole("button", { name: "İndir" }).click();
  expect((await fileResponse).status()).toBe(200);
  await page.reload();
  await search.fill(customerBName);
  await page.getByRole("row").filter({ hasText: customerBName }).click();
  await expect(panel.getByText(documentName)).toBeVisible();

  await panel.getByRole("button", { name: "Kapat" }).click();
  let releaseOld!: () => void;
  const oldResponse = new Promise<void>((resolve) => { releaseOld = resolve; });
  await page.route(`**/customers/${customerA.id}`, async (route) => {
    await oldResponse;
    await route.continue();
  });
  await search.fill(customerAName);
  const oldRequest = page.waitForRequest((request) => request.url().endsWith(`/customers/${customerA.id}`));
  await page.getByRole("row").filter({ hasText: customerAName }).click();
  await oldRequest;
  await expect(panel.getByText("Yükleniyor...")).toBeVisible();
  await expect(panel.getByText(documentName)).toHaveCount(0);
  await panel.getByRole("button", { name: "Kapat" }).click();
  await search.fill(customerBName);
  await page.getByRole("row").filter({ hasText: customerBName }).click();
  await expect(panel.getByText(customerBName)).toBeVisible();
  const oldFinished = page.waitForResponse((response) => response.url().endsWith(`/customers/${customerA.id}`));
  releaseOld();
  await oldFinished;
  await expect(panel.getByText(customerBName)).toBeVisible();
  await expect(panel.getByText(customerAName)).toHaveCount(0);
});

test("İş oluşturma, test personeline atama ve durum değişimi kalıcıdır", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, owner.email);
  await page.goto(`${webUrl}/isler`);
  await page.getByRole("button", { name: "Yeni İş" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator(`option[value="${customerB.id}"]`).locator("..").selectOption(customerB.id);
  await dialog.locator(`option[value="${staff.id}"]`).locator("..").selectOption(staff.id);
  await dialog.locator('option[value="__diger__"]').locator("..").selectOption("__diger__");
  await dialog.getByPlaceholder("Hizmet türünü yazın").fill(serviceName);
  await dialog.getByRole("button", { name: "Oluştur" }).click();
  await expect(dialog).toBeHidden();
  const job = await prisma.job.findFirstOrThrow({ where: { customerId: customerB.id, serviceType: serviceName } });
  expect(job.assignedStaffId).toBe(staff.id);
  const card = page.locator("div.border-l-4").filter({ hasText: serviceName });
  await expect(card).toBeVisible();
  await card.locator("select").selectOption("SCHEDULED");
  await expect.poll(async () => (await prisma.job.findUnique({ where: { id: job.id } })).status).toBe("SCHEDULED");
  await page.reload();
  await expect(page.locator("div.border-l-4").filter({ hasText: serviceName })).toBeVisible();
});

test("Mesaj yalnız ayrılmış iki test hesabı arasında kalıcıdır", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, owner.email);
  await page.goto(`${webUrl}/mesajlar`);
  await page.getByRole("button", { name: "Yeni Konuşma" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: new RegExp(staffUser.fullName) }).click();
  await page.getByPlaceholder("Bir mesaj yazın...").fill(messageText);
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: messageText })).toBeVisible();
  const sent = await prisma.message.findFirstOrThrow({ where: { content: messageText, senderId: owner.id } });
  const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: sent.conversationId } });
  expect([conversation.participantAId, conversation.participantBId].sort()).toEqual([owner.id, staffUser.id].sort());
  await page.reload();
  await expect(page.getByRole("paragraph").filter({ hasText: messageText })).toBeVisible();
});

test("Sözleşme yenileme onayı doğru adla gösterilir ve yeni dönem kalıcıdır", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, owner.email);
  const token = await page.evaluate(() => localStorage.getItem("token"));
  const created = await page.request.post("http://127.0.0.1:4000/contracts", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customerId: customerA.id,
      startDate: "2026-10-03",
      endDate: "2027-10-03",
      durationMonths: 12,
      status: "ACTIVE",
      serviceType: renewalService,
      amount: 33.33,
    },
  });
  expect(created.status()).toBe(201);
  const original = await created.json();
  await page.goto(`${webUrl}/sozlesmeler?highlight=${original.id}`);
  const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Yenile" }) });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Yenile" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Yenile" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sil" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Yenile" }).click();
  await expect.poll(async () => (await prisma.contract.findUnique({ where: { id: original.id } })).status).toBe("EXPIRED");
  const renewed = await prisma.contract.findFirstOrThrow({ where: {
    customerId: customerA.id,
    serviceType: renewalService,
    status: "ACTIVE",
    id: { not: original.id },
  } });
  await page.goto(`${webUrl}/sozlesmeler?highlight=${renewed.id}`);
  await expect(page.getByRole("row").filter({ has: page.getByRole("button", { name: "Yenile" }) })).toHaveCount(1);
});
