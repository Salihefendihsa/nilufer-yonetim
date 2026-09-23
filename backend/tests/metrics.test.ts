import { describe, expect, it } from "vitest";
import { getTrafficSeries, recordError, recordRequest, TRAFFIC_WINDOW_MINUTES } from "../src/lib/metrics";
import { api } from "./helpers/fixtures";

describe("Sistem Durumu — dakika bazlı trafik serisi", () => {
  it("son 60 dakikayı sıfır doldurulmuş, eskiden yeniye döndürür; istek/hata içinde bulunulan dakikaya yazılır", () => {
    const before = getTrafficSeries();
    expect(before).toHaveLength(TRAFFIC_WINDOW_MINUTES);
    const lastBefore = before[before.length - 1];

    recordRequest();
    recordRequest();
    recordError();

    const after = getTrafficSeries();
    const lastAfter = after[after.length - 1];
    // Dakika sınırı testin ortasına denk gelirse yeni kova 0'dan başlar.
    if (lastAfter.minute === lastBefore.minute) {
      expect(lastAfter.requests).toBe(lastBefore.requests + 2);
      expect(lastAfter.errors).toBe(lastBefore.errors + 1);
    } else {
      expect(lastAfter.requests).toBeGreaterThanOrEqual(0);
    }
    // Sıralı ve 1 dakika aralıklı.
    for (let i = 1; i < after.length; i++) {
      expect(new Date(after[i].minute).getTime() - new Date(after[i - 1].minute).getTime()).toBe(60_000);
    }
  });

  it("pencere dışındaki eski dakikalar seride yer almaz", () => {
    const future = Date.now() + 2 * 60 * 60 * 1000;
    const series = getTrafficSeries(future);
    expect(series).toHaveLength(TRAFFIC_WINDOW_MINUTES);
    expect(series.every((b) => b.requests === 0 && b.errors === 0)).toBe(true);
  });

  it("GET /system/health yanıtında trafficPerMinute var (OWNER)", async () => {
    const { TestContext } = await import("./helpers/fixtures");
    const { Role } = await import("@prisma/client");
    const ctx = new TestContext();
    try {
      const owner = await ctx.createUser(Role.OWNER);
      const token = await ctx.tokenFor(owner);
      const res = await api().get("/system/health").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.trafficPerMinute).toHaveLength(TRAFFIC_WINDOW_MINUTES);
    } finally {
      await ctx.cleanup();
    }
  });
});
