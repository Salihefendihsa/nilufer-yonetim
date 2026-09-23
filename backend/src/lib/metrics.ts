const startedAt = Date.now();
let totalRequestsToday = 0;
let requestsDayKey = new Date().toDateString();
let errorTimestamps: number[] = [];

/**
 * Sistem Durumu → "Canlı Trafik": dakika başına istek/hata sayısı, son
 * TRAFFIC_WINDOW_MINUTES dakika için halka tampon.
 *
 * Önceden grafik yalnızca istemci tarafında, ekran açıkken 10 sn'de bir
 * alınan `totalRequestsToday` farkından üretiliyordu: ilk çubuk ancak ikinci
 * yoklamada çıkıyor ("İlk örnekler toplanıyor…" takılı görünüyordu), ekrandan
 * çıkınca geçmiş kayboluyordu ve çubuklar yalnızca ekranın kendi yoklama
 * isteğini (≈1 istek/10 sn) gösteriyordu. Sunucu artık gerçek trafiği
 * biriktiriyor; ekran açılır açılmaz son bir saat görünür.
 *
 * Bellek içi ve süreç başınadır (diğer sayaçlar gibi) — yeniden başlatmada
 * sıfırlanır, çoklu instance'ta her instance kendi trafiğini raporlar.
 */
export const TRAFFIC_WINDOW_MINUTES = 60;
const MINUTE_MS = 60 * 1000;

interface TrafficBucket {
  minuteStart: number;
  requests: number;
  errors: number;
}
let traffic: TrafficBucket[] = [];

function currentBucket(now = Date.now()): TrafficBucket {
  const minuteStart = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const last = traffic[traffic.length - 1];
  if (last && last.minuteStart === minuteStart) return last;
  const bucket = { minuteStart, requests: 0, errors: 0 };
  traffic.push(bucket);
  const cutoff = minuteStart - (TRAFFIC_WINDOW_MINUTES - 1) * MINUTE_MS;
  if (traffic[0].minuteStart < cutoff) traffic = traffic.filter((b) => b.minuteStart >= cutoff);
  return bucket;
}

function resetDailyCounterIfNeeded() {
  const todayKey = new Date().toDateString();
  if (todayKey !== requestsDayKey) {
    requestsDayKey = todayKey;
    totalRequestsToday = 0;
  }
}

export function recordRequest(): void {
  resetDailyCounterIfNeeded();
  totalRequestsToday += 1;
  currentBucket().requests += 1;
}

export function recordError(): void {
  errorTimestamps.push(Date.now());
  currentBucket().errors += 1;
}

/**
 * Son TRAFFIC_WINDOW_MINUTES dakika, en eskiden en yeniye, boş dakikalar 0
 * ile doldurulmuş (grafikte boşluk = gerçekten istek yok).
 */
export function getTrafficSeries(now = Date.now()): { minute: string; requests: number; errors: number }[] {
  const currentMinute = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const byMinute = new Map(traffic.map((b) => [b.minuteStart, b]));
  const series = [];
  for (let i = TRAFFIC_WINDOW_MINUTES - 1; i >= 0; i--) {
    const minuteStart = currentMinute - i * MINUTE_MS;
    const bucket = byMinute.get(minuteStart);
    series.push({
      minute: new Date(minuteStart).toISOString(),
      requests: bucket?.requests ?? 0,
      errors: bucket?.errors ?? 0,
    });
  }
  return series;
}

export function getMetrics() {
  resetDailyCounterIfNeeded();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  errorTimestamps = errorTimestamps.filter((t) => t > dayAgo);

  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    totalRequestsToday,
    errorCount24h: errorTimestamps.length,
    trafficPerMinute: getTrafficSeries(),
  };
}
