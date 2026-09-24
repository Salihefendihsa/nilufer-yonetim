import { afterAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";
import { findOrphanNotificationIds } from "../src/lib/orphanNotifications";

/**
 * Test koşuları gerçek yöneticilere bildirim bırakmamalı (HEALTH_AUDIT V-2):
 * bir TestContext'in API ile ürettiği kaydın bildirimi, o context'e ait
 * OLMAYAN bir yöneticiye düşse bile cleanup sonrası kalmamalı.
 */
describe("Test bildirim hijyeni", () => {
  // "Gerçek" yönetici yerine geçen, ayrı bir context'e ait OWNER.
  const outside = new TestContext();
  afterAll(() => outside.cleanup());

  it("cleanup, dışarıdaki yöneticiye düşen ve silinen kayda işaret eden bildirimi siler", async () => {
    const owner: TestUser = await outside.createUser(Role.OWNER);

    const ctx = new TestContext();
    const staff = await ctx.createStaffUser(Role.STAFF);
    const token = await ctx.tokenFor(staff);
    const res = await api()
      .post("/staff-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "vt_Hijyen talebi", description: "Bildirim temizliği için oluşturulan test talebi.", category: "OTHER" });
    expect(res.status).toBe(201);

    const before = await prisma.notification.count({ where: { userId: owner.id, relatedId: res.body.id } });
    expect(before).toBe(1);

    await ctx.cleanup();

    const after = await prisma.notification.count({ where: { userId: owner.id, relatedId: res.body.id } });
    expect(after).toBe(0);
  });

  it("findOrphanNotificationIds yalnızca kaydı silinmiş bildirimleri döner", async () => {
    const user = await outside.createUser(Role.MANAGER);
    const live = await prisma.notification.create({
      data: { userId: user.id, title: "vt_canlı", relatedType: "User", relatedId: user.id },
    });
    const orphan = await prisma.notification.create({
      data: { userId: user.id, title: "vt_yetim", relatedType: "Job", relatedId: "00000000-0000-4000-8000-000000000000" },
    });
    const ids = await findOrphanNotificationIds(new Date(Date.now() - 60_000));
    expect(ids).toContain(orphan.id);
    expect(ids).not.toContain(live.id);
  });
});
