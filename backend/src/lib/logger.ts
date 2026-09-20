import pino from "pino";

/**
 * Yapılandırılmış (JSON) log çıktısı — `console.error`'un yerini alır.
 * Prod'da bir log toplayıcıya (CloudWatch, Loki, vb.) bağlanmak `stdout`'u
 * okumaktan ibarettir; ekstra bir servis/kurulum gerekmez.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined, // pid/hostname alanlarını ekleme — log toplayıcılar zaten container/host bilgisini biliyor
});
