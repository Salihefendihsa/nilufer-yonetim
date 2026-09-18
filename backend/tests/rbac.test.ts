import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * RBAC sınır matrisi: her ana uç için "yetkili rol 200 (veya 2xx/404 gibi
 * yetki-sonrası bir kod) alır, yetkisiz rol 403 alır". Amaç iş mantığını
 * değil, route seviyesindeki requireRole/requireRoleOrPermission
 * zincirinin geri adım atmadığını yakalamak — bu yüzden "izinli" beklenti
 * yalnızca `!== 401 && !== 403` olarak kontrol edilir (örn. GET /x/:id
 * uydurma id ile 404 dönebilir, bu da "yetki geçti" demektir).
 */

type RoleKey = "OWNER" | "MANAGER" | "TEAM_LEAD" | "STAFF" | "CUSTOMER";
const ALL_ROLES: RoleKey[] = ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"];

interface EndpointCase {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  allowed: RoleKey[];
  body?: Record<string, unknown>;
}

const NIL = "00000000-0000-4000-8000-000000000000";

const CASES: EndpointCase[] = [
  // Bugün eklenen/kritik uçlar
  { method: "post", path: "/auth/2fa/setup", allowed: ["OWNER", "MANAGER"] },
  { method: "get", path: "/evaluations", allowed: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF"] },
  { method: "post", path: "/evaluations", allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "get", path: "/evaluation-criteria", allowed: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF"] },
  { method: "post", path: "/evaluation-periods", allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "get", path: "/staff-bonuses", allowed: ["OWNER", "MANAGER"] },
  { method: "post", path: `/staff-bonuses/${NIL}/approve`, allowed: ["OWNER", "MANAGER"] },
  { method: "get", path: "/observer-access/current", allowed: ["OWNER"] },
  { method: "post", path: "/observer-access", allowed: ["OWNER"], body: {} },
  { method: "post", path: "/admin/impersonate", allowed: ["OWNER"], body: {} },
  { method: "get", path: "/admin/backup", allowed: ["OWNER"] },
  { method: "post", path: `/admin/users/${NIL}/reset-password`, allowed: ["OWNER"] },
  { method: "get", path: "/audit-logs", allowed: ["OWNER"] },
  { method: "get", path: "/settings", allowed: ["OWNER"] },
  { method: "get", path: "/system/health", allowed: ["OWNER"] },
  { method: "get", path: "/analytics/executive-summary", allowed: ["OWNER", "MANAGER"] },
  { method: "get", path: "/analytics/revenue-trend", allowed: ["OWNER", "MANAGER"] },
  { method: "get", path: "/dashboard/summary", allowed: ["OWNER", "MANAGER"] },
  // Personel yaşam döngüsü
  { method: "post", path: "/staff", allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "post", path: `/staff/${NIL}/promote-to-manager`, allowed: ["OWNER"], body: {} },
  { method: "patch", path: `/staff/${NIL}/role`, allowed: ["OWNER"], body: {} },
  { method: "get", path: `/staff/${NIL}/permissions`, allowed: ["OWNER"] },
  { method: "get", path: "/staff/org-chart", allowed: ["OWNER"] },
  { method: "post", path: `/users/${NIL}/terminate`, allowed: ["OWNER"], body: {} },
  { method: "post", path: `/users/${NIL}/reactivate`, allowed: ["OWNER"], body: {} },
  { method: "post", path: `/users/${NIL}/demote-from-manager`, allowed: ["OWNER"], body: {} },
  // Finans
  { method: "get", path: "/payments", allowed: ["OWNER", "MANAGER", "CUSTOMER"] },
  { method: "post", path: "/payments", allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "get", path: "/expenses", allowed: ["OWNER", "MANAGER"] },
  { method: "get", path: "/products/low-stock", allowed: ["OWNER", "MANAGER"] },
  { method: "get", path: "/contracts/health-check", allowed: ["OWNER", "MANAGER"] },
  { method: "get", path: "/quotes", allowed: ["OWNER", "MANAGER"] },
  // Operasyon
  { method: "post", path: "/jobs", allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "delete", path: `/jobs/${NIL}`, allowed: ["OWNER", "MANAGER"] },
  { method: "post", path: `/jobs/${NIL}/report/approve`, allowed: ["OWNER", "MANAGER"] },
  { method: "post", path: "/customers", allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "get", path: "/customers", allowed: ["OWNER", "MANAGER", "STAFF"] },
  { method: "post", path: "/advances", allowed: ["STAFF"], body: {} },
  { method: "patch", path: `/advances/${NIL}`, allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "post", path: "/leave-requests", allowed: ["STAFF", "TEAM_LEAD"], body: {} },
  { method: "patch", path: `/leave-requests/${NIL}/decide`, allowed: ["OWNER", "MANAGER", "TEAM_LEAD"], body: {} },
  { method: "get", path: "/team/summary", allowed: ["OWNER", "MANAGER", "TEAM_LEAD"] },
  // Bölüm I/J (3. tur)
  { method: "get", path: "/search?q=ab", allowed: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"] },
  { method: "post", path: "/appointment-requests", allowed: ["CUSTOMER"], body: {} },
  { method: "get", path: "/appointment-requests", allowed: ["OWNER", "MANAGER", "CUSTOMER"] },
  { method: "get", path: "/appointment-requests/service-types", allowed: ["OWNER", "MANAGER", "CUSTOMER"] },
  { method: "post", path: `/appointment-requests/${NIL}/schedule`, allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "post", path: `/appointment-requests/${NIL}/decline`, allowed: ["OWNER", "MANAGER"], body: {} },
  // Bölüm K (3. tur)
  { method: "get", path: "/staff/me/unavailability", allowed: ["STAFF", "TEAM_LEAD"] },
  { method: "post", path: "/staff/me/unavailability", allowed: ["STAFF", "TEAM_LEAD"], body: {} },
  { method: "delete", path: `/staff/me/unavailability/${NIL}`, allowed: ["STAFF", "TEAM_LEAD"] },
  { method: "get", path: "/staff/unavailability?date=2030-01-01", allowed: ["OWNER", "MANAGER", "TEAM_LEAD"] },
  // TEAM_LEAD/STAFF route'tan geçer ama uydurma id kapsamları dışında → 403
  // (kendi/ekip kaydı için 200 senaryosu staffUnavailability.test.ts'te).
  { method: "get", path: `/staff/${NIL}/unavailability`, allowed: ["OWNER", "MANAGER"] },
  // Bölüm L (4. tur)
  { method: "post", path: "/team/broadcast", allowed: ["TEAM_LEAD"], body: {} },
  { method: "get", path: "/team/daily-briefing", allowed: ["TEAM_LEAD"] },
  { method: "patch", path: `/jobs/${NIL}/checklist`, allowed: ["STAFF"], body: {} },
  { method: "get", path: "/customers/me/referral", allowed: ["CUSTOMER"] },
  { method: "get", path: "/customers/me/badges", allowed: ["CUSTOMER"] },
  { method: "post", path: `/contracts/${NIL}/pause`, allowed: ["CUSTOMER", "OWNER", "MANAGER"] },
  { method: "post", path: `/contracts/${NIL}/resume`, allowed: ["CUSTOMER", "OWNER", "MANAGER"] },
  // Bölüm S (5. tur)
  { method: "patch", path: `/jobs/${NIL}/feedback`, allowed: ["CUSTOMER"], body: {} },
  { method: "get", path: "/analytics/feedback-summary", allowed: ["OWNER", "MANAGER"] },
  // Bölüm T (5. tur)
  { method: "get", path: "/job-templates", allowed: ["OWNER", "MANAGER"] },
  { method: "post", path: "/job-templates", allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "delete", path: `/job-templates/${NIL}`, allowed: ["OWNER", "MANAGER"] },
  // Bölüm U (5. tur) — GET: STAFF/TEAM_LEAD route'tan geçer ama uydurma id kendi kaydı değil → 403
  { method: "get", path: `/staff/${NIL}/onboarding`, allowed: ["OWNER", "MANAGER"] },
  { method: "patch", path: `/staff/${NIL}/onboarding/${NIL}`, allowed: ["OWNER", "MANAGER"], body: {} },
  // Bölüm V (5. tur) — STAFF/TEAM_LEAD route'tan geçer ama uydurma id kendisi değil → 403
  { method: "get", path: `/evaluations/staff/${NIL}/history`, allowed: ["OWNER", "MANAGER"] },
  // Bölüm W (5. tur)
  { method: "get", path: `/products/${NIL}/forecast`, allowed: ["OWNER", "MANAGER"] },
  // Bölüm X (6. tur)
  { method: "get", path: "/customer-tags", allowed: ["OWNER", "MANAGER", "STAFF"] },
  { method: "post", path: "/customer-tags", allowed: ["OWNER", "MANAGER"], body: {} },
  { method: "delete", path: `/customer-tags/${NIL}`, allowed: ["OWNER", "MANAGER"] },
  { method: "post", path: `/customers/${NIL}/tags`, allowed: ["OWNER", "MANAGER"], body: {} },
];

describe("RBAC sınırları", () => {
  const ctx = new TestContext();
  const users = {} as Record<RoleKey, TestUser>;
  const tokens = {} as Record<RoleKey, string>;

  beforeAll(async () => {
    users.OWNER = await ctx.createUser(Role.OWNER);
    users.MANAGER = await ctx.createUser(Role.MANAGER);
    users.TEAM_LEAD = await ctx.createStaffUser(Role.TEAM_LEAD);
    users.STAFF = await ctx.createStaffUser(Role.STAFF);
    users.CUSTOMER = await ctx.createUser(Role.CUSTOMER);
    await ctx.createCustomer({ userId: users.CUSTOMER.id });
    for (const role of ALL_ROLES) tokens[role] = await ctx.tokenFor(users[role]);
  });

  afterAll(() => ctx.cleanup());

  it("token'sız istek her korumalı uçta 401 alır", async () => {
    for (const c of CASES) {
      const res = await api()[c.method](c.path).send(c.body ?? {});
      expect(res.status, `${c.method.toUpperCase()} ${c.path}`).toBe(401);
    }
  });

  for (const c of CASES) {
    const label = `${c.method.toUpperCase()} ${c.path}`;

    it(`${label} → izinli: ${c.allowed.join("/")}; diğerleri 403`, async () => {
      for (const role of ALL_ROLES) {
        const res = await api()[c.method](c.path).set("Authorization", `Bearer ${tokens[role]}`).send(c.body ?? {});
        if (c.allowed.includes(role)) {
          expect(res.status, `${label} olarak ${role}`).not.toBe(403);
          expect(res.status, `${label} olarak ${role}`).not.toBe(401);
        } else {
          expect(res.status, `${label} olarak ${role}`).toBe(403);
        }
      }
    });
  }
});
