import { expect, test } from "@playwright/test";

test("giriş e-posta alanı doldurulur", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("http://127.0.0.1:3000/giris", { waitUntil: "domcontentloaded" });

  const email = page.getByRole("textbox", { name: "E-posta" });
  await expect(email).toBeVisible();
  await email.fill("denetim@example.test");
  await expect(email).toHaveValue("denetim@example.test");
  await expect.poll(() => email.evaluate((element) => {
    let current: Element | null = element;
    while (current) {
      if (Number(getComputedStyle(current).opacity) < 0.99) return false;
      current = current.parentElement;
    }
    return true;
  })).toBe(true);

  await page.screenshot({ path: testInfo.outputPath("giris-alan.png"), fullPage: true });
});
