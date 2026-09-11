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


## Bölüm C — Değerlendirme-Prim Bağlantısı

**Karar (kullanıcı tarafından verildi, belirsizlik yok)**: Tam otomatik ödeme
YOK — güvenlik için bir inceleme katmanı var. Dönem kilitlenince yalnızca
"onay bekleyen prim önerisi" (StaffBonus, PENDING) oluşur; gerçek para
etkisi (Expense kaydı) ancak OWNER/MANAGER onayından SONRA oluşur.

- `EvaluationPeriod.bonusThreshold` (Int?, 1-20) ve `bonusAmount` (Decimal?)
  eklendi — ikisi de opsiyonel, ikisi de doluysa otomatik üretim devreye
  girer.
- Yeni `StaffBonus` modeli: `status` (PENDING/APPROVED/REJECTED),
  `evaluationId` **tekil** (bir Evaluation'dan en fazla bir prim önerisi —
  dönem kilitleme işlemi kazara iki kez tetiklenirse bile mükerrer öneri
  oluşmaz, `createMany({ skipDuplicates: true })` ile).
- `ExpenseCategory`'ye `BONUS` eklendi.
- `updateEvaluationPeriod` (mevcut dönem kilitleme akışı, DEĞİŞTİRİLMEDİ,
  yalnızca genişletildi): `isLocked: true`'ya geçişte, dönemin
  `bonusThreshold`/`bonusAmount`'ı doluysa, o dönemdeki **her Evaluation**
  için (spesifikasyonun birebir okunuşu — bir personel birden fazla
  değerlendiriciden değerlendirilmişse birden fazla StaffBonus önerisi
  çıkabilir, bilinçli bir tasarım kararı, kasıtlı toplulaştırma yok)
  `averageScore >= bonusThreshold` ise otomatik PENDING StaffBonus üretilir.
- `POST /staff-bonuses/:id/approve` (OWNER/MANAGER) — tek transaction
  içinde: StaffBonus → APPROVED VE bir `Expense(category: BONUS)` kaydı
  oluşturulur (`description`: personel adı + dönem etiketi). Personel
  kullanıcısına bildirim gider. Zaten sonuçlandırılmış bir öneriyi tekrar
  onaylamaya çalışmak 409 döner (mükerrer Expense'e karşı koruma).
- `POST /staff-bonuses/:id/reject` (OWNER/MANAGER) — yalnızca status
  REJECTED olur, hiçbir Expense oluşmaz.
- Web: Performans → Değerlendirmeler sekmesine (`EvaluationsTab.tsx`)
  "Bekleyen Primler" bölümü + yeni dönem formuna opsiyonel prim
  eşiği/tutarı alanları.
- Mobile: **Spec'te "performance_screen.dart'a ekle" deniyordu ama** o
  dosya liderlik tablosu ekranı — "Değerlendirmeler" içeriği gerçekte AYRI
  bir dosyada (`evaluations_screen.dart`, AppBar'daki ikondan açılıyor).
  Web'deki yerleşimle TUTARLI olmak için (Bekleyen Primler,
  Değerlendirmeler sekmesinin içinde) `evaluations_screen.dart`'a eklendi
  — bu netleştirme burada not düşülüyor.
- **Yan düzeltme (gerçek bug, iş sırasında bulundu)**: mobile'daki yeni
  `StaffBonus.amount` ve `EvaluationPeriod.bonusAmount` alanları Prisma'nın
  `Decimal` tipleri — JSON'da SAYI değil STRING olarak serileşiyor (bkz.
  `models/decimal.dart`'taki mevcut uyarı notu). `(json['amount'] as num)`
  ile parse edilseydi çalışma anında `TypeError` fırlatırdı; mevcut
  `decimalOr`/`decimalOrNull` yardımcıları kullanılarak düzeltildi.
- Doğrulama: Node script ile uçtan uca test edildi — bonus eşikli bir dönem
  oluşturuldu, biri eşiğin ÜSTÜNDE (averageScore 20) biri ALTINDA
  (averageScore 5) iki değerlendirme girildi, dönem kilitlendi →
  yalnızca yüksek puanlı için TEK bir PENDING StaffBonus oluştuğu
  doğrulandı (düşük puanlı için HİÇ oluşmadığı da ayrıca doğrulandı) →
  onaylanınca Expense(BONUS) oluştuğu ve net kârın tam tutar kadar
  (500₺) düştüğü doğrulandı → aynı öneriyi ikinci kez onaylamanın 409
  döndürdüğü (mükerrer ödeme koruması) doğrulandı → ayrı bir dönemde
  reddedilen bir önerinin HİÇBİR Expense üretmediği doğrulandı. Tüm test
  verileri (2 dönem, 2 değerlendirme, prim önerileri, 1 gider, 1 test
  kriteri) ID bazlı silindi.
