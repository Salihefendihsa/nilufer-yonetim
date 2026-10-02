import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

describe("Sözleşme düzenleme", () => {
  const ctx = new TestContext();
  let manager: TestUser;
  let staff: TestUser;
  let customerId: string;
  let contractId: string;
  let managerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    manager = await ctx.createUser(Role.MANAGER);
    staff = await ctx.createStaffUser(Role.STAFF);
    customerId = (await ctx.createCustomer()).id;
    managerToken = await ctx.tokenFor(manager);
    staffToken = await ctx.tokenFor(staff);
    const created = await api()
      .post("/contracts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        customerId,
        startDate: "2026-10-03",
        endDate: "2027-10-03",
        durationMonths: 12,
        status: "ACTIVE",
        serviceType: "Test hizmeti",
        amount: 44.55,
      });
    expect(created.status).toBe(201);
    contractId = created.body.id as string;
    ctx.track("contract", contractId);
  });

  afterAll(() => ctx.cleanup());

  it("MANAGER alanları günceller, isteğe bağlı alanları temizler; STAFF reddedilir", async () => {
    const denied = await api()
      .patch(`/contracts/${contractId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ amount: 1 });
    expect(denied.status).toBe(403);

    const updated = await api()
      .patch(`/contracts/${contractId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ serviceType: null, amount: null, recurrenceType: null });
    expect(updated.status).toBe(200);
    expect(updated.body.serviceType).toBeNull();
    expect(updated.body.amount).toBeNull();
    const saved = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
    expect(saved.serviceType).toBeNull();
    expect(saved.amount).toBeNull();
  });
});
