import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import customerRoutes from "./routes/customers";
import staffRoutes from "./routes/staff";
import jobRoutes from "./routes/jobs";
import contractRoutes from "./routes/contracts";
import paymentRoutes from "./routes/payments";
import quoteRoutes from "./routes/quotes";
import dashboardRoutes from "./routes/dashboard";
import teamRoutes from "./routes/team";
import userRoutes from "./routes/users";
import advanceRoutes from "./routes/advances";
import leaveRequestRoutes from "./routes/leaveRequests";
import appointmentRequestRoutes from "./routes/appointmentRequests";
import jobTemplateRoutes from "./routes/jobTemplates";
import customerTagRoutes from "./routes/customerTags";
import expenseRoutes from "./routes/expenses";
import supplierRoutes from "./routes/suppliers";
import staffBonusRoutes from "./routes/staffBonuses";
import conversationRoutes from "./routes/conversations";
import notificationRoutes from "./routes/notifications";
import auditLogRoutes from "./routes/auditLogs";
import systemRoutes from "./routes/system";
import productRoutes from "./routes/products";
import searchRoutes from "./routes/search";
import adminRoutes from "./routes/admin";
import settingsRoutes from "./routes/settings";
import serviceTypeRoutes from "./routes/serviceTypes";
import districtRoutes from "./routes/districts";
import observerAccessRoutes from "./routes/observerAccess";
import evaluationRoutes, { criteriaRouter as evaluationCriteriaRoutes, periodsRouter as evaluationPeriodsRoutes } from "./routes/evaluations";
import notificationPreferenceRoutes from "./routes/notificationPreferences";
import analyticsRoutes from "./routes/analytics";
import sessionRoutes from "./routes/sessions";
import fileRoutes from "./routes/files";
import dataDeletionRoutes from "./routes/dataDeletionRequests";
import announcementRoutes from "./routes/announcements";
import complaintRoutes from "./routes/complaints";
import calendarRoutes from "./routes/calendar";
import { errorHandler } from "./middleware/errorHandler";
import { recordRequest } from "./lib/metrics";

/**
 * Bölüm H (2. tur): Express uygulaması `index.ts`'ten ayrıldı — test suite
 * (tests/) uygulamayı port'a BAĞLAMADAN supertest ile içeri alır; cron'lar ve
 * `listen` yalnızca index.ts'te (gerçek sunucu) çalışır.
 */
const app = express();

// Yalnızca gerçekten bir reverse proxy/load balancer arkasında çalışırken
// (Nginx, Cloudflare, bir PaaS vb.) açılmalı — aksi halde istemcinin
// X-Forwarded-For header'ını taklit ederek IP bazlı rate limiting'i (bkz.
// middleware/loginRateLimit.ts) atlatması mümkün olur. Doğrudan internete
// açıksa (proxy YOKSA) TRUST_PROXY ayarlanmamalı; varsayılan kapalıdır.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY);
}

app.use(helmet());
// CORS_ORIGIN tanımlıysa (virgülle ayrılmış liste) yalnızca o origin'lere
// izin verilir — production'da web panelinin gerçek domain'i buraya
// yazılmalı. Boş bırakılırsa (varsayılan/dev davranışı) her origin'e izin
// verilir; kimlik doğrulama cookie değil Authorization: Bearer header'ı
// üzerinden yapıldığı için (bkz. lib/jwt.ts) bu CSRF anlamında düşük risklidir,
// ama production'da CORS_ORIGIN ayarlamak yine de iyi pratiktir.
const corsOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors(corsOrigins && corsOrigins.length > 0 ? { origin: corsOrigins } : undefined));
app.use(express.json({ limit: "5mb" })); // room for a base64-encoded signature image in the JSON body
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    // Test suite (NODE_ENV=test, bkz. vitest.config.ts) tek süreçte yüzlerce
    // istek atar; genel limit devre dışı kalır. Login/şifre sıfırlama
    // limitleri (middleware/loginRateLimit.ts) testte de AYNEN çalışır.
    skip: () => process.env.NODE_ENV === "test",
  })
);
app.use((_req, _res, next) => {
  recordRequest();
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Bölüm AC (7. tur) — GÜVENLİK: `/uploads` statik servisi KALDIRILDI. Eskiden
// fotoğraf/imza/belge dosyaları kimliksiz erişilebiliyordu (yalnızca rastgele
// dosya adına güveniliyordu). Artık tek yol `GET /files/:type/:id`
// (routes/files.ts → controllers/filesController.ts): requireAuth + kaydın
// yetki kuralı, sonra stream. `/uploads/*` istekleri hiçbir route'a
// düşmez → Express varsayılan 404.

const apiRouter = express.Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/customers", customerRoutes);
apiRouter.use("/staff", staffRoutes);
apiRouter.use("/jobs", jobRoutes);
apiRouter.use("/contracts", contractRoutes);
apiRouter.use("/payments", paymentRoutes);
apiRouter.use("/quotes", quoteRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
// Ekip (şef) kapsamlı görünümler — şirket geneli /dashboard'tan ayrıdır.
apiRouter.use("/team", teamRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/advances", advanceRoutes);
apiRouter.use("/leave-requests", leaveRequestRoutes);
apiRouter.use("/appointment-requests", appointmentRequestRoutes);
apiRouter.use("/job-templates", jobTemplateRoutes);
apiRouter.use("/customer-tags", customerTagRoutes);
apiRouter.use("/expenses", expenseRoutes);
apiRouter.use("/suppliers", supplierRoutes);
apiRouter.use("/staff-bonuses", staffBonusRoutes);
apiRouter.use("/conversations", conversationRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use("/audit-logs", auditLogRoutes);
apiRouter.use("/system", systemRoutes);
apiRouter.use("/products", productRoutes);
apiRouter.use("/search", searchRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/settings", settingsRoutes);
apiRouter.use("/service-types", serviceTypeRoutes);
apiRouter.use("/districts", districtRoutes);
apiRouter.use("/observer-access", observerAccessRoutes);
apiRouter.use("/evaluations", evaluationRoutes);
apiRouter.use("/evaluation-criteria", evaluationCriteriaRoutes);
apiRouter.use("/evaluation-periods", evaluationPeriodsRoutes);
apiRouter.use("/notification-preferences", notificationPreferenceRoutes);
apiRouter.use("/analytics", analyticsRoutes);
apiRouter.use("/sessions", sessionRoutes);
apiRouter.use("/files", fileRoutes);
apiRouter.use("/data-deletion-requests", dataDeletionRoutes);
apiRouter.use("/announcements", announcementRoutes);
apiRouter.use("/complaints", complaintRoutes);
// Bölüm AP (9. tur): token'lı ICS aboneliği — requireAuth yok (bkz. routes/calendar.ts).
apiRouter.use("/calendar", calendarRoutes);

// ADR-004: API versiyonlama. Var olan istemciler (web, yayınlanmış mobil
// sürümler) önek olmadan çağırmaya devam eder — bu satır hiçbir mevcut
// davranışı değiştirmez. `/v1` aynı router'ı ayrıca mount eder; ileride
// kırıcı bir backend değişikliği gerektiğinde yeni istemciler `/v1`'e,
// eskileri önek olmayan (bu sürümde donan) yola yönlendirilebilir.
app.use(apiRouter);
app.use("/v1", apiRouter);

app.use(errorHandler);

export default app;
