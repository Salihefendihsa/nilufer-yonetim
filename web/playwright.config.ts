import { defineConfig } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const localHosts = ["localhost", "127.0.0.1", "::1"];
const backendEnv = path.resolve(__dirname, "../backend/.env");
if (!existsSync(backendEnv)) throw new Error("E2E için yerel backend ayarı gerekli");
const dotenv = require("../backend/node_modules/dotenv");
const backendSettings = dotenv.parse(readFileSync(backendEnv));
const database = new URL(backendSettings.DATABASE_URL ?? "");
if (!localHosts.includes(database.hostname) || database.pathname !== "/nilufer_yonetim") {
  throw new Error("E2E yalnız yerel test veritabanında çalışabilir");
}
const webEnv = path.resolve(__dirname, ".env.local");
const webSettings = existsSync(webEnv) ? dotenv.parse(readFileSync(webEnv)) : {};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? webSettings.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
if (!localHosts.includes(new URL(apiUrl).hostname)) {
  throw new Error("E2E yalnız yerel API hedefiyle çalışabilir");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
});
