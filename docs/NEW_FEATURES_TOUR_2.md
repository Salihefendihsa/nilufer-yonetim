# 5 Yeni Özellik Turu (2. Tur) — Tasarım Kararları

Bu belge A→E sırasıyla eklenen 5 özelliğin tasarım kararlarını, API
sözleşmelerini ve varsayılan (spec'te belirtilmemiş) iş kurallarını kaydeder.
İlk turun (İzin Talepleri, PDF, Gider Takibi, 2FA, Tedarikçi, Push) kararları
için bkz. `docs/NEW_FEATURES_TOUR.md`.

## Bölüm A — Otomatik Stok Uyarısı

- `Product.lastLowStockAlertAt` (DateTime?) eklendi — aynı gün içinde tekrar
  bildirim gitmesini önler; stok kritik eşiğin ÜSTÜNE çıkınca `null`'a
  sıfırlanır (bir sonraki düşüşte yeniden bildirim gitsin diye).
- **Mevcut kodla birleştirme (spec'te açıkça istenmemişti ama gerekliydi)**:
  sistemde zaten `checkLowStockAndNotify(productId)` adlı, bir iş raporu
  stok düşürdüğünde ANINDA tetiklenen bir fonksiyon vardı
  (`lib/reminders.ts`) — ama (a) yalnızca OWNER'a bildiriyordu (MANAGER'a
  değil), (b) hiçbir dedup'ı yoktu (aynı ürün art arda düşüşlerde defalarca
  bildirim üretebilirdi). Yeni saatlik cron taramasıyla AYNI paylaşılan
  `evaluateLowStockAlert()` fonksiyonunu kullanacak şekilde refactor edildi:
  artık o da `notifyManagement` (OWNER+MANAGER) kullanıyor ve aynı günlük
  dedup kuralına tabi. Bu, iki farklı tetikleyicinin (anlık + saatlik) aynı
  ürün için çift bildirim göndermesini de engelliyor.
- Yeni `sweepLowStockAlerts()` (`lib/reminders.ts`) — TÜM ürünleri tarar,
  her biri için `evaluateLowStockAlert()` çağırır. `lib/cron.ts`'teki
  `startReminderCrons()` içine, `resetExpiredStaffStatuses` ile AYNI yerde/
  şekilde, `cron.schedule("0 * * * *", ...)` ile (her saat başı) eklendi.
- Web/Mobile UI değişikliği YOK — spec bunu istemiyordu, yalnızca backend +
  mevcut "Bildirimler" ekranında (zaten var olan bir mekanizma) görünür.
- Doğrulama: **canlı, gerçek bir tetiklenmeyle doğrulandı** — backend'i
  yeniden başlatırken saat tam 14:00'ı geçti ve zamanlanmış cron GERÇEKTEN
  ateşlendi; demo veride zaten kritik durumda olan (negatif stoklu) birkaç
  ürün için OWNER+MANAGER'a (3 alıcı) gerçek bildirimler oluştuğu, aynı saat
  içindeki 2. manuel taramanın dedup sayesinde hiçbir yeni bildirim
  üretmediği doğrulandı. Ayrıca ayrı bir script ile: sağlıklı bir ürünün
  eşiği geçici olarak yükseltilip "kritik" hale getirildi → bildirim +
  `lastLowStockAlertAt` damgası oluştuğu görüldü → eşik eski haline
  döndürülüp ürün tekrar sağlıklı hale gelince `lastLowStockAlertAt`'ın
  `null`'a sıfırlandığı doğrulandı. Bu sentetik testin ürettiği 3 bildirim
  ID bazlı silindi; gerçek cron'un ürettiği (demo verideki gerçekten kritik
  ürünlere ait) bildirimler test verisi OLMADIĞI için dokunulmadı.


## Bölüm B — Sözleşme Yenileme Hatırlatması

- `Contract.lastRenewalAlertAt` (DateTime?) eklendi.
- **Mevcut kodla ilişki (spec'te belirtilmemişti, netleştirildi)**: sistemde
  zaten `sendContractExpiryReminders` vardı — 30 günlük pencere, günde bir
  kez 08:00'de, sözleşme sayısını TOPLU bir özet olarak bildiren, dedup
  alanı olmayan (zaten günde bir kez çalıştığı için buna ihtiyacı yoktu)
  bir fonksiyon. Yeni `sweepContractRenewalAlerts` bunun YERİNE geçmiyor —
  onunla BİRLİKTE, 7 gün veya daha az kalan sözleşmeler için SÖZLEŞME
  BAZLI, daha aciliyetli ikinci bir hatırlatma katmanı ekliyor (30 gün =
  "haberin olsun", 7 gün = "acele et"). İkisi de aynı 08:00 cron bloğunda
  çalışıyor.
- Dedup için Bölüm A'daki gibi ayrı bir "eşik üstüne çıkınca sıfırlama"
  mantığına GEREK YOK — `lastRenewalAlertAt` yalnızca "bugün zaten
  uyarıldı mı" kontrolü yapıyor; bir sözleşme yenilenip `endDate` uzatılırsa
  otomatik olarak 7 günlük pencerenin dışına çıkar ve bir sonraki gerçek
  yaklaşımda eski damga zaten "bugün değil" olduğu için doğal olarak
  yeniden tetiklenir.
- Web/Mobile UI değişikliği YOK — spec bunu istemiyordu.
- Doğrulama: gerçek bir müşteriye bağlı, endDate'i 3 gün sonrası olan test
  sözleşmesi oluşturuldu; tarama tetiklendi; OWNER+MANAGER'a (aynı anda
  gerçekten yaklaşan BAŞKA bir sözleşme için de) toplam 6 bildirim oluştu;
  lastRenewalAlertAt damgalandığı doğrulandı; aynı gün 2. taramanın hiçbir
  yeni bildirim üretmediği (dedup) doğrulandı; test sözleşmesi VE yalnızca
  ona ait 3 bildirim ID bazlı silindi, gerçek (test dışı) sözleşmeye ait
  bildirimlere dokunulmadı.
