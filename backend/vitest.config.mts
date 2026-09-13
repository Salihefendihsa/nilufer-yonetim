import { defineConfig } from "vitest/config";

/**
 * Bölüm H (2. tur): backend otomatik test altyapısı.
 * - Testler GERÇEK dev veritabanına (DATABASE_URL) karşı koşar; her test
 *   kendi uuid-önekli verisini üretir ve sonunda ID bazlı siler
 *   (bkz. tests/helpers/fixtures.ts). Kalıcı veri bırakılmaz.
 * - `fileParallelism: false`: dosyalar sırayla koşar — aynı Prisma
 *   client'ı/DB'yi paylaşan testlerin birbirinin temizliğine çarpmaması için.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
