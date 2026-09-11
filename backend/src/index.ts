import "dotenv/config";
import path from "path";
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
import { startRecurringJobsCron, startReminderCrons } from "./lib/cron";
import notificationPreferenceRoutes from "./routes/notificationPreferences";
import analyticsRoutes from "./routes/analytics";
import sessionRoutes from "./routes/sessions";
import { errorHandler } from "./middleware/errorHandler";
import { recordRequest } from "./lib/metrics";

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
  })
);
app.use((_req, _res, next) => {
  recordRequest();
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Cross-origin resource policy override so the web app (a different origin in dev)
// can actually load these images in <img>/canvas tags — helmet defaults to same-origin.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), {
    setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
  })
);

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/staff", staffRoutes);
app.use("/jobs", jobRoutes);
app.use("/contracts", contractRoutes);
app.use("/payments", paymentRoutes);
app.use("/quotes", quoteRoutes);
app.use("/dashboard", dashboardRoutes);
// Ekip (şef) kapsamlı görünümler — şirket geneli /dashboard'tan ayrıdır.
app.use("/team", teamRoutes);
app.use("/users", userRoutes);
app.use("/advances", advanceRoutes);
app.use("/leave-requests", leaveRequestRoutes);
app.use("/expenses", expenseRoutes);
app.use("/suppliers", supplierRoutes);
app.use("/staff-bonuses", staffBonusRoutes);
app.use("/conversations", conversationRoutes);
app.use("/notifications", notificationRoutes);
app.use("/audit-logs", auditLogRoutes);
app.use("/system", systemRoutes);
app.use("/products", productRoutes);
app.use("/search", searchRoutes);
app.use("/admin", adminRoutes);
app.use("/settings", settingsRoutes);
app.use("/service-types", serviceTypeRoutes);
app.use("/districts", districtRoutes);
app.use("/observer-access", observerAccessRoutes);
app.use("/evaluations", evaluationRoutes);
app.use("/evaluation-criteria", evaluationCriteriaRoutes);
app.use("/evaluation-periods", evaluationPeriodsRoutes);
app.use("/notification-preferences", notificationPreferenceRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/sessions", sessionRoutes);

app.use(errorHandler);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  startRecurringJobsCron();
  startReminderCrons();
});
