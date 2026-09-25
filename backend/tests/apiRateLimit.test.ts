import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createApiRateLimiter } from "../src/middleware/apiRateLimit";
import { signToken } from "../src/lib/jwt";

/**
 * Genel API limiti (HEALTH_AUDIT G-1): kimliği doğrulanmış istekler kullanıcı
 * başına, kimliksizler IP başına sayılır; sahte token yeni kova açamaz.
 * Küçük limitlerle, uygulamadan bağımsız mini bir express üzerinde denenir.
 */
function miniApp() {
  const app = express();
  app.use(createApiRateLimiter({ userLimit: 3, anonLimit: 2, windowMs: 60_000 }));
  app.get("/x", (_req, res) => res.json({ ok: true }));
  return app;
}

const tokenFor = (sub: string) => signToken({ sub, role: "STAFF", email: `${sub}@t.local`, tokenVersion: 0 });

describe("Genel API rate limit", () => {
  it("aynı IP'deki iki kullanıcı ayrı kovada sayılır", async () => {
    const app = miniApp();
    const a = tokenFor("user-a");
    const b = tokenFor("user-b");
    for (let i = 0; i < 3; i++) expect((await request(app).get("/x").set("Authorization", `Bearer ${a}`)).status).toBe(200);
    expect((await request(app).get("/x").set("Authorization", `Bearer ${a}`)).status).toBe(429);
    // B, A'nın dolu kovasından etkilenmez
    expect((await request(app).get("/x").set("Authorization", `Bearer ${b}`)).status).toBe(200);
  });

  it("kimliksiz istek IP kovasına düşer; 429 gövdesi Türkçe ve açıklayıcı", async () => {
    const app = miniApp();
    expect((await request(app).get("/x")).status).toBe(200);
    expect((await request(app).get("/x")).status).toBe(200);
    const blocked = await request(app).get("/x");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Çok fazla istek/);
  });

  it("imzası geçersiz token kullanıcı kovası açamaz (IP kovasını paylaşır)", async () => {
    const app = miniApp();
    const forged = (sub: string) => `Bearer ${tokenFor(sub).slice(0, -3)}xyz`;
    expect((await request(app).get("/x").set("Authorization", forged("f1"))).status).toBe(200);
    expect((await request(app).get("/x").set("Authorization", forged("f2"))).status).toBe(200);
    expect((await request(app).get("/x").set("Authorization", forged("f3"))).status).toBe(429);
  });
});
