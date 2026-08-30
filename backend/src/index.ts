import "dotenv/config";
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
import userRoutes from "./routes/users";
import advanceRoutes from "./routes/advances";
import conversationRoutes from "./routes/conversations";
import notificationRoutes from "./routes/notifications";
import auditLogRoutes from "./routes/auditLogs";
import systemRoutes from "./routes/system";
import { errorHandler } from "./middleware/errorHandler";
import { recordRequest } from "./lib/metrics";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
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

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/staff", staffRoutes);
app.use("/jobs", jobRoutes);
app.use("/contracts", contractRoutes);
app.use("/payments", paymentRoutes);
app.use("/quotes", quoteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/users", userRoutes);
app.use("/advances", advanceRoutes);
app.use("/conversations", conversationRoutes);
app.use("/notifications", notificationRoutes);
app.use("/audit-logs", auditLogRoutes);
app.use("/system", systemRoutes);

app.use(errorHandler);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
