const startedAt = Date.now();
let totalRequestsToday = 0;
let requestsDayKey = new Date().toDateString();
let errorTimestamps: number[] = [];

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
}

export function recordError(): void {
  errorTimestamps.push(Date.now());
}

export function getMetrics() {
  resetDailyCounterIfNeeded();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  errorTimestamps = errorTimestamps.filter((t) => t > dayAgo);

  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    totalRequestsToday,
    errorCount24h: errorTimestamps.length,
  };
}
