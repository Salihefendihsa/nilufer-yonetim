import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { JobStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { deleteFile } from "../src/lib/storage";
import { analyzeJobPhoto, setPestAnalyzerForTesting, type PestAnalyzer } from "../src/lib/pestDetection";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

// 1×1 şeffaf PNG — gerçek bir görsel dosyası, API'ye hiçbir zaman gönderilmez.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

/** Gerçek API çağrısı yapmayan, çağrıları sayan sahte analizci. */
function mockAnalyzer(behavior: "ok" | "rate_limited" = "ok") {
  const calls: { mediaType: string; bytes: number }[] = [];
  const analyzer: PestAnalyzer = {
    model: "mock-vision",
    async analyze(image) {
      calls.push({ mediaType: image.mediaType, bytes: image.data.length });
      if (behavior === "rate_limited") throw new Error("429 rate_limit_error (sahte)");
      return { pestType: "Hamamböceği", confidence: 0.87, description: "Mutfak dolabı altında Alman hamamböceği izleri." };
    },
  };
  return { analyzer, calls };
}

async function waitFor<T>(fn: () => Promise<T | null>, ms = 3000): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

describe("Yapay zekâ haşere tanıma (Bölüm J)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let lead: TestUser;
  let staff: TestUser;
  let otherStaff: TestUser;
  let customerUser: TestUser;
  let staffToken: string;
  let jobId: string;
  const uploadedFiles: string[] = [];

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    lead = await ctx.createStaffUser(Role.TEAM_LEAD, { tag: "lead" });
    staff = await ctx.createStaffUser(Role.STAFF, { tag: "s1", supervisorId: lead.staffId });
    otherStaff = await ctx.createStaffUser(Role.STAFF, { tag: "s2" });
    customerUser = await ctx.createUser(Role.CUSTOMER);
    staffToken = await ctx.tokenFor(staff);
    const customer = await ctx.createCustomer();
    jobId = (await ctx.createJob({ customerId: customer.id, assignedStaffId: staff.staffId, status: JobStatus.IN_PROGRESS })).id;
  });

  afterEach(() => setPestAnalyzerForTesting(undefined));

  afterAll(async () => {
    await ctx.cleanup();
    for (const f of uploadedFiles) await deleteFile(f).catch(() => undefined);
  });

  async function uploadPhoto() {
    const res = await api()
      .post(`/jobs/${jobId}/photos`)
      .set("Authorization", `Bearer ${staffToken}`)
      .field("type", "BEFORE")
      .attach("photo", PNG, { filename: "hasere.png", contentType: "image/png" });
    expect(res.status).toBe(201);
    uploadedFiles.push(path.basename(res.body.url));
    return res.body as { id: string };
  }

  it("yükleme isteği bloklanmadan arka planda analiz edilir ve kaydedilir; ikinci kez analiz edilmez", async () => {
    const { analyzer, calls } = mockAnalyzer();
    setPestAnalyzerForTesting(analyzer);

    const photo = await uploadPhoto();
    const detection = await waitFor(() => prisma.pestDetection.findUnique({ where: { jobPhotoId: photo.id } }));
    expect(detection).not.toBeNull();
    expect(detection!.detectedPestType).toBe("Hamamböceği");
    expect(detection!.confidence).toBeCloseTo(0.87);
    expect(detection!.model).toBe("mock-vision");
    expect(calls).toEqual([{ mediaType: "image/png", bytes: PNG.length }]);

    // Aynı fotoğraf tekrar tetiklenirse API'ye gidilmez.
    expect(await analyzeJobPhoto(photo.id)).toBe("exists");
    expect(calls).toHaveLength(1);
  });

  it("hız sınırı/hata: kayıt oluşmaz, yeniden denenmez; anahtar yoksa sessizce atlanır", async () => {
    setPestAnalyzerForTesting(null); // ANTHROPIC_API_KEY yok durumu
    const photo = await uploadPhoto();
    // Yüklemenin tetiklediği arka plan analizi bitene kadar bekle (süreç içi
    // tekilleştirme sürerken ikinci çağrı "in_progress" döner).
    await new Promise((r) => setTimeout(r, 200));
    expect(await analyzeJobPhoto(photo.id)).toBe("disabled");

    const { analyzer, calls } = mockAnalyzer("rate_limited");
    setPestAnalyzerForTesting(analyzer);
    expect(await analyzeJobPhoto(photo.id)).toBe("failed");
    expect(calls).toHaveLength(1);
    expect(await prisma.pestDetection.count({ where: { jobPhotoId: photo.id } })).toBe(0);
  });

  it("GET /pest-detections rol kapsamı: personel kendi, şef ekibi, patron tümü; başka personel ve müşteri göremez", async () => {
    const { analyzer } = mockAnalyzer();
    setPestAnalyzerForTesting(analyzer);
    const photo = await uploadPhoto();
    await waitFor(() => prisma.pestDetection.findUnique({ where: { jobPhotoId: photo.id } }));

    const ids = async (user: TestUser) => {
      const res = await api().get("/pest-detections").query({ limit: 100 }).set("Authorization", `Bearer ${await ctx.tokenFor(user)}`);
      return { status: res.status, ids: (res.body.data ?? []).map((d: { photo: { id: string } }) => d.photo.id) as string[], body: res.body };
    };

    const asStaff = await ids(staff);
    expect(asStaff.ids).toContain(photo.id);
    expect(asStaff.body.summary.find((s: { pestType: string }) => s.pestType === "Hamamböceği")).toBeTruthy();
    expect((await ids(lead)).ids).toContain(photo.id);
    expect((await ids(owner)).ids).toContain(photo.id);
    expect((await ids(otherStaff)).ids).not.toContain(photo.id);
    expect((await ids(customerUser)).status).toBe(403);
  });
});
