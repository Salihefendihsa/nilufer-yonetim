# Yeni Özellik Turları (3. Belge) — 9. Tur ve Sonrası

`docs/NEW_FEATURES_TOUR_2.md` 8. turun sonunda ~970 satıra ulaştığı için
9. turdan itibaren tasarım kararları bu belgede tutulur. Önceki turlar:
`docs/NEW_FEATURES_TOUR.md` (1. tur), `docs/NEW_FEATURES_TOUR_2.md` (2.–8. tur).

Bu turun ortak kuralları (önceki turlarla aynı): test verisi yalnızca **ID
ile** silinir; cron/toplu iş fonksiyonları **kapsam daraltıcı parametre**
alır ve testlerde asla global çağrılmaz; dosya erişimi kimlik doğrulamalı
(`GET /files/:type/:id` deseni) — token'sız statik yol açılmaz.

---

# 9. Tur — Bölüm AM / AN / AO / AP / AQ / AR

## Bölüm AM — Kimyasal Parti / Son Kullanma Tarihi (SKT) Takibi

**Model.** `ProductBatch { id, productId, batchNumber, expiryDate @db.Date,
quantityReceived, quantityRemaining, receivedAt, supplierId?, lastExpiryAlertAt? }`
(migration `product_batch`). `StockMovement.batchId String?` — eski hareketler
ve partisiz giriş/çıkışlar `null` taşır (geriye dönük uyumluluk). Ürün
silinirse partiler cascade, hareketlerin `batchId`'si `SET NULL`.

**Giriş.** `POST /products/:id/restock` ve mal kabul
(`PATCH /products/purchase-requests/:id { status: RECEIVED }`) opsiyonel
`batchNumber` + `expiryDate (YYYY-AA-GG)` alır. **İkisi birlikte** verilmeli;
yalnız biri → 400 ("yarım parti kaydı olmaz"). Mal kabulde parti, talebin
`supplierId`'sini devralır. İkisi de boşsa davranış eskisiyle aynı.

**Çıkış (FIFO by expiry).** `lib/productBatches.ts:consumeFromBatches(tx, …)`
iş raporundaki her ürün satırı için ürünün `quantityRemaining > 0` partilerini
`expiryDate ASC, receivedAt ASC` sırasıyla düşer — kullanıcıya seçtirilmez.
Çıkış birden fazla partiye yayılırsa **her parti için ayrı `StockMovement(OUT)`**
yazılır; yalnızca ilk hareket `relatedJobReport(Product)Id` bağını taşır (o
alanlar `@unique`), devam hareketleri `batchId` + "(parti devamı)" notu taşır.
Toplam hareket miktarı = çıkış miktarı. Partiler çıkışı karşılamıyorsa kalan
kısım `batchId`'siz tek hareket olur. `Product.currentStock` düşürme mantığı
değişmedi. **Sayım mutabakatı (`/count`) parti-farkında değildir** — hangi
partinin eksildiği bilinemez; parti bakiyeleri sayımdan etkilenmez (docs notu).

**Okuma.** `GET /products/:id/batches` (OWNER/MANAGER) — tüm partiler (bakiyesi
0 olanlar da, "Tükendi"). `GET /products/expiring-batches?days=30` (OWNER/
MANAGER; 0–365, geçersizse 30) — süresi `days` gün içinde dolacak **veya
dolmuş**, bakiyeli partiler; her satır `daysLeft` ve `isExpired` taşır. Süresi
dolmuş partiler listeden **düşmez** (imha/iade takibi için görünmeli).

**Tarih matematiği.** `@db.Date` Prisma'dan UTC gece yarısı `Date` olarak
gelir; "bugün" sunucunun yerel günüdür. `daysUntil` ikisini de gün sayısına
indirger (`Date.UTC(...)`) — zaman dilimi kayması yok. Testler
`fixtures.ts:localIsoDate()` kullanır (`toISOString()` gece yarısı civarı
yerel günden sapıyordu — turun sonunda yakalandı).

**Cron.** `reminders.ts:sweepExpiringBatchAlerts(onlyProductIds?)` günlük
08:00 (`cron.ts`): 7 gün penceresi + dolmuş partiler; `ProductBatch.
lastExpiryAlertAt` ile aynı-takvim-günü dedup (lastLowStockAlertAt deseni).
Dolmuş parti için başlık "Süresi dolmuş kimyasal partisi", yaklaşan için "Son
kullanma tarihi yaklaşan parti"; `type: "batch_expiry"`.

**UI.** Web Stok: satırda "Partiler" (BatchesModal — SKT'ye göre renk: dolmuş/
≤7 gün kırmızı, ≤30 sarı, aksi yeşil; tükenen soluk), Stok Ekle ve Mal Kabul
formlarında parti no + SKT alanları, "Süresi Yaklaşan Partiler" paneli (7/30/90
gün). Mobil: `product_batches_screen.dart` (ProductBatchesScreen +
ExpiringBatchesScreen, app bar ikonu), restock ve mal kabul sheet'lerinde parti
alanları.

**Test.** `productBatches.test.ts` (7): parti açma + batchId, yarım parti 400,
FIFO yayılma (4 yakın + 2 uzak, tek rapor bağı), partisiz geriye dönük
uyumluluk, expiring/isExpired + pencere, sweep dedup (kapsamlı), mal kabul
tedarikçi devri. RBAC 2 satır. Flutter `product_batch_test` (3).

## Bölüm AN — Personel Maaş Bordrosu Görünümü

`GET /staff/me/payslip?month=YYYY-AA` — **yalnızca STAFF/TEAM_LEAD** (route
seviyesinde OWNER/MANAGER 403: yönetim tüm veriyi Finans'tan zaten görür; bu uç
kişisel özet). Kapsam `req.user → Staff` (başkasının bordrosuna erişim yolu
yok). `month` yoksa içinde bulunulan ay; biçim hatası 400.

`lib/payslip.ts:computePayslip`: `salaryBase` (Staff kaydındaki **güncel**
değer — maaş tarihçesi tutulmaz), `bonusTotal` = o ayda `approvedAt` düşen
APPROVED `StaffBonus`, `advanceTotal` = o ayda **`createdAt`** düşen APPROVED
`AdvanceRequest` (**AdvanceRequest'te karar zamanı alanı yok**; ay eşlemesi
talep tarihine göre), `net = salaryBase + bonusTotal − advanceTotal`. Satır
listeleri (`bonuses[]`, `advances[]`) dönülür. **Salt görüntüleme** — hiçbir
ödeme/muhasebe kaydı tetiklemez; vergi/SGK kesintisi yok (arayüz uyarır).

Web `/bordrom` (Sidebar "Bordrom", finans grubu, STAFF/TEAM_LEAD): 4 stat kartı
+ hesap özeti listesi, ay ileri/geri (gelecek ay kapalı). Mobil
`payslip_screen.dart` — STAFF ve TEAM_LEAD çekmecesinde "Bordrom".

**Test.** `payslip.test.ts` (4): sabit ay (2026-03) ile hesap; önceki ay;
month yok/hatalı; OWNER/MANAGER/CUSTOMER 403 + TEAM_LEAD kendi; başka personelin
primi karışmaz. RBAC 1 satır. Flutter `payslip_test` (3).

## Bölüm AO — Müşteri Şikayet / Sorun Bildirimi

**Model.** `CustomerComplaint { id, customerId, jobId?, subject, description,
status: OPEN|IN_PROGRESS|RESOLVED|CLOSED, priority: LOW|MEDIUM|HIGH (MEDIUM),
assignedToUserId?, resolutionNote?, createdAt, resolvedAt? }` (migration
`customer_complaint`). `Job.rating` (basit puanlama) ile **ilişkisiz**.

**Uçlar** (`/complaints`): `POST` yalnızca CUSTOMER, kendi Customer kaydı
adına; `jobId` verilirse **kendi işi** olmalı (aksi 400); `subject 3–200`,
`description 10–4000`; yönetime bildirim (`type: "complaint"`). `GET` —
CUSTOMER kendi kayıtları, OWNER/MANAGER tümü; filtre `status`, `priority`;
sıralama `status ASC, priority DESC, createdAt DESC` (açık + yüksek öncelik
üstte). `GET /:id` — başkasının kaydı CUSTOMER için **404** (varlık
sızdırılmaz). `PATCH /:id` (OWNER/MANAGER) `{ status?, priority?,
assignedToUserId?|null, resolutionNote?|null }`, boş gövde 400; atanan
kullanıcı aktif ve **CUSTOMER olmayan** biri olmalı (aksi 400).
RESOLVED/CLOSED'a geçişte `resolvedAt` damgalanır; geri açılırsa (RESOLVED→
IN_PROGRESS) `resolvedAt = null`. Durum değişince müşteriye bildirim
("Şikayetiniz sonuçlandı" / "güncellendi", çözüm notu eklenir).

**UI.** Web `/sikayetler` tek sayfa, role göre: CUSTOMER "Şikayetlerim" (yeni
şikayet formu — kendi işlerinden seçim, aciliyet; geçmiş liste), OWNER/MANAGER
"Şikayetler" (durum + öncelik filtreleri, "Yönet" modalı: durum/öncelik/
sorumlu/çözüm notu; sorumlu listesi `/staff` + "Bana ata"). **Bekleyen
Onaylar'a eklenmedi** (farklı iş akışı). Sidebar'da aynı href iki girişle (rol
filtresi sonrası tek görünür). Mobil `complaints_screen.dart`: müşteri "Diğer"
→ "Şikayetlerim" (FAB ile yeni), yönetim "Diğer Modüller" → "Şikayetler".

**Test.** `complaints.test.ts` (5): oluşturma + bildirim, yabancı iş 400 /
kısa açıklama 400, kapsam (liste + GET 404 + filtreler), atama + CUSTOMER'a
atama 400, RESOLVED damgası + bildirim + yeniden açma + boş gövde 400. RBAC 4
satır. Fixtures: `customerComplaint` süpürmesi. Flutter `complaint_test` (3).

## Bölüm AP — Personel Takvim Dışa Aktarma (ICS)

**Üretici.** `lib/ics.ts` — bağımlılıksız minimal RFC 5545 (`ics`/
`ical-generator` projede yoktu; ihtiyaç dar olduğu için ek paket yerine ~80
satır yazıldı, `csv.ts` ile aynı gerekçe): CRLF, 75-oktet katlama (çok baytlı
karakter bölünmez), `\ ; ,` ve satır sonu kaçışı, UTC `YYYYMMDDTHHMMSSZ`,
`X-PUBLISHED-TTL`/`REFRESH-INTERVAL` 1 saat.

**İçerik.** `staffCalendarController.ts:buildStaffCalendar(staffId)`: gelecek
**30 gün**, `PENDING/SCHEDULED`, `scheduledAt` dolu, kendi atanmış işleri.
`SUMMARY` = müşteri adı — hizmet türü; `LOCATION` = adres, ilçe; `DTEND` =
`scheduledEndAt` (varsa ve başlangıçtan sonraysa) yoksa **+1 saat**; `UID` =
`job-<id>@nilufer-ilaclama`; `DESCRIPTION` iş no + müşteri telefonu + not.

**Erişim.** İki yol, tek üretici:
- `GET /staff/me/calendar.ics` (requireAuth, STAFF/TEAM_LEAD) — tek seferlik
  indirme (`text/calendar`, `Content-Disposition`).
- `GET /calendar/:token.ics` — **requireAuth YOK**; `Staff.calendarToken`
  (`String? @unique`, `crypto.randomUUID`, migration `staff_calendar_token`)
  kimlik doğrulama görevi görür. Bilinmeyen/yenilenmiş/biçimsiz token → 404;
  **arşivlenmiş veya pasif** personelin token'ı da 404. Bu, "token'sız statik
  yol yasağı"nın istisnası değildir: yol token'lı ve kayıt bazlı doğrulanır.
- `GET /staff/me/calendar-token` (yoksa üretir, idempotent) → `{ token, url,
  webcalUrl, windowDays }`; `POST /staff/me/calendar-token/rotate` → yeni
  token, eski link anında ölür (audit `staff.calendar_token.rotate`).
- Link tabanı `API_PUBLIC_URL` (yeni env, `.env.example`'a eklendi; varsayılan
  `http://localhost:4000`).

**Migration notu.** `prisma migrate dev` unique-constraint uyarısı için
etkileşimli onay istediği (non-interactive ortamda çıktı) için bu migration
elle yazılıp `prisma migrate deploy` + `prisma generate` ile uygulandı;
`migrate status` "up to date".

**UI.** Web Ayarlar → "Takvimimi Dışa Aktar" (STAFF/TEAM_LEAD): link + kopyala,
"Google Takvim'e Ekle" (`calendar.google.com/calendar/r?cid=<webcal>`), Apple/
Outlook (`webcal://`), `.ics İndir` (Authorization header'lı `downloadFile`),
"Token'ı Yenile" (onay diyaloglu). Mobil Ayarlar → `CalendarExportCard`
(kopyala/paylaş/`url_launcher` ile aç/`downloadAndShare`/yenile).

**Test.** `staffCalendar.test.ts` (6): kaçış+tarih, katlama, iskelet; kapsam
(COMPLETED / 45 gün / başkasının / tarihsiz iş dışlanır) + DTEND kuralları +
LOCATION; token üretimi idempotent + header'sız erişim + geçersiz 404; rotate
sonrası eski 404 / yeni 200 + arşivli personel 404. RBAC 3 satır.

## Bölüm AQ — Araç Bakım Takibi

**Model.** `VehicleMaintenance { id, staffId, maintenanceType: INSPECTION|
OIL_CHANGE|TIRE|OTHER, lastServiceDate @db.Date, nextDueDate @db.Date, note?,
lastDueAlertAt?, createdAt }` (migration `vehicle_maintenance`, Staff'a
cascade). Backend **vehiclePlate şartı koymaz** (plaka sonradan kaldırılsa
geçmiş okunabilir kalsın); bölümü yalnızca plakası dolu personelde göstermek
arayüzün işi (web/mobil ikisi de koşullu).

**Uçlar.** `GET /staff/:id/vehicle-maintenance` — OWNER/MANAGER herkes,
STAFF/TEAM_LEAD **yalnızca kendi** (aksi 403); yanıt `{ vehiclePlate, data[]
}` ve her satır `daysLeft`, `isOverdue`. `POST` / `PATCH /:maintenanceId` /
`DELETE /:maintenanceId` OWNER/MANAGER; `nextDueDate < lastServiceDate` → 400;
kayıt URL'deki personele ait değilse **404**. PATCH'te `nextDueDate`
değişirse `lastDueAlertAt` sıfırlanır (yeni pencerede yeniden bildirim).

**Cron.** `reminders.ts:sweepVehicleMaintenanceAlerts(onlyStaffIds?)` günlük
08:00: `nextDueDate ≤ bugün+14` (gecikmişler dahil), arşivli personel hariç,
`lastDueAlertAt` günlük dedup; başlık "Yaklaşan araç bakımı" / "Araç bakımı
gecikti", `type: "vehicle_maintenance"`.

**UI.** Web Personel kartı → "Araç Bakımı" butonu (**yalnızca `vehiclePlate`
doluysa**) → `VehicleMaintenanceModal` (liste + vade rozeti: gecikmiş/≤7
kırmızı, ≤14 sarı, aksi yeşil; ekle/sil). Mobil personel detayı →
`VehicleMaintenanceCard` (aynı koşul; 403'te gizli; ekle sheet + sil).

**Test.** `vehicleMaintenance.test.ts` (5): oluşturma + 400 + liste;
STAFF kendi/başkası 403; PATCH/DELETE yabancı :id 404 + güncelleme; sweep
pencere + dedup + vade değişiminde yeniden + gecikmiş başlığı; DELETE 204→404.
RBAC 4 satır. Flutter `vehicle_maintenance_test` (2; plaka koşulu dahil).

## Bölüm AR — Personel Puantaj (Giriş/Çıkış)

**Model.** `AttendanceRecord { id, staffId, date @db.Date, clockInAt?,
clockOutAt?, note?, createdAt }`, **`@@unique([staffId, date])`** (migration
`attendance_record`). `StaffUnavailability`'den (müsait değilim işareti) ayrı:
bu, gerçek çalışma saati kaydıdır.

**Tasarım kararları.**
- "Gün" = sunucunun yerel takvim günü (UTC gece yarısı olarak saklanır).
- `POST /staff/me/clock-in`: bugün kayıt yoksa oluşturur (201). Kayıt varsa
  **409** — çıkış yapılmış olsa da (mesaj ayrışır: "Bugün zaten giriş
  yaptınız" / "giriş ve çıkış zaten kaydedildi"). **Mevcut kaydı
  güncellemez**: giriş saati ilk basışta sabitlenir; öğle arası sonrası
  "yeniden giriş" desteklenmez (molalar için StaffStatus var); düzeltme
  yönetimin işi. Eşzamanlı çift tıklama unique ihlaliyle (P2002) yine 409.
- `POST /staff/me/clock-out`: giriş yoksa **400**; zaten çıkış varsa **409**.
- `GET /staff/me/attendance/today` → `{ record | null }` (Ana Sayfa butonu).
- `GET /staff/:id/attendance?month=YYYY-AA` — OWNER/MANAGER herkes, STAFF/
  TEAM_LEAD kendi (aksi 403); `totalHours` = yalnızca **hem giriş hem çıkışı
  olan** günlerin saat toplamı (2 ondalık), `completedDays`, `openCount`
  (çıkışsız günler toplama girmez, ayrıca sayılır), satırlarda `workedHours`.

**UI.** Web Ana Sayfa (STAFF ve TEAM_LEAD) `ClockCard`: "Giriş Yap" → "Çıkış
Yap" → "Bugün tamamlandı"; 409'da bugünkü kayıt yeniden çekilir. Personel
kartı → "Puantaj" (`AttendanceModal`: ay gezinme, toplam/tam gün/çıkışsız,
günlük liste). Mobil `clock_card.dart` (STAFF + TEAM_LEAD gövdeleri),
personel detayında `AttendanceCard` (403'te gizli, günler açılır/kapanır).

**Test.** `attendance.test.ts` (5): girişsiz çıkış 400; clock-in 201 + ikinci
409 + saat korunur + tek kayıt; clock-out + tekrar 409 + çıkış sonrası giriş
409; aylık toplam (8 + 6.5 = 14.5, açık gün sayılmaz, başka ay dışlanır, month
400); STAFF kendi/başkası 403. RBAC 4 satır. Flutter `attendance_test` (2).

## 9. Tur Toplam

- Backend vitest: 264 → **314** test (+50: AM 9, AN 5, AO 9, AP 9, AQ 9,
  AR 9 — RBAC matrisi satırları dahil). 40 dosya, tümü yeşil.
- Flutter: 63 → **76** test (+13: AM 3, AN 3, AO 3, AQ 2, AR 2).
- Yeni migration: `product_batch`, `customer_complaint`,
  `staff_calendar_token` (elle, deploy), `vehicle_maintenance`,
  `attendance_record`.
- Yeni env (sır değil): `API_PUBLIC_URL` (`.env.example`).
- Cron/toplu iş: `sweepExpiringBatchAlerts(onlyProductIds?)`,
  `sweepVehicleMaintenanceAlerts(onlyStaffIds?)` — testlerde yalnızca kapsamlı.
- Test verisi ID ile temizlendi; DB'de `vt_` kalıntısı yok (users/products/
  batches/complaints/vehicle/attendance/suppliers = 0 doğrulandı).
- Bilinen, bu turdan bağımsız: `npm run test:typecheck` (tsconfig.test.json)
  `staffSuggestion.test.ts` / `teamBroadcast.test.ts`'te main'de zaten var olan
  14 tip hatası veriyor (vitest çalışmasını etkilemiyor); dokunulmadı.
