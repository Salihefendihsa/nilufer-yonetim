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


## Bölüm D — Karanlık Mod (Dark Mode)

- **Web**: `next-themes` npm kurulumu denendi ve başarılı oldu, ama sonunda
  KULLANILMADI — bunun yerine mevcut CSS custom property mimarisi (zaten
  `globals.css`'te vardı) tam anlamıyla kullanılacak şekilde genişletildi:
  `tailwind.config.ts`'teki TÜM renk token'ları (`primary`/`neutral`/
  `success`/`warning`/`danger`/`info`/`surface`/`border`/`text`) artık
  `rgb(var(--x) / <alpha-value>)` kalıbıyla CSS değişkenine işaret ediyor —
  ÖNCEDEN yalnızca `background`/`foreground` böyleydi, geri kalanı sabit
  hex'ti (yani tema değiştirmenin ÖNCEDEN hiçbir etkisi olmuyordu). Basit
  bir `lib/theme.tsx` (React context + localStorage + hidrasyon öncesi
  "flash önleyici" inline script `layout.tsx`'te) `<html data-theme="...">`
  yazıyor; `globals.css`'teki üç blok (`:root` açık, `@media
  (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` sistem
  tercihi, `:root[data-theme="dark"]` açık seçim) aynı değerleri taşıyor.
- **Tasarım kararı**: `primary`/`success`/`warning`/`danger`/`info`
  skalalarının 300-900 tonları koyu modda AÇIK moddakiyle BİREBİR AYNI
  kalıyor (butonlar/kahraman panelleri kendi içinde sabit renk blokları,
  ters çevirmek "hover daha koyu olsun" gibi anlamları bozardı) — yalnızca
  50-200 (soluk rozet zemini tonları) koyulaştırıldı. Grafikler (recharts)
  İSTİSNA: `CHART_COLORS`/`GRID`/`AXIS_TEXT` artık `rgb(var(--chart-N))`
  gibi CSS değişkeni STRING'İ olarak SVG `stroke=`/`fill=` prop'larına
  geçiyor (modern tarayıcılar SVG sunum özniteliklerinde `var()`'ı
  destekler) — ayrıca grafikler kartın ÜZERİNE çizildiği için (buton gibi
  kendi içinde kapalı bir blok değil) `--chart-1..6` koyu modda AYRI ve
  daha parlak bir palet kullanıyor, okunabilir kalsın diye.
- **Kod incelemesi ile bulunan ve düzeltilen 8 gerçek `bg-white` sorunu**
  (design token'a bağlı olmayan, koyu modda "beyaz blok" gibi görünecek
  yerler — `ToastProvider.tsx`, bugün eklenen Bekleyen Primler kartı
  (`EvaluationsTab.tsx`), `OrgChartView.tsx`'teki iki rozet, `sozlesmeler/
  page.tsx`'teki iki yer, `ayarlar/page.tsx`'teki kurtarma kodu/sır
  chip'leri ve Tehlikeli Bölge ikonu) `bg-surface-card`'a çevrildi. İKİ
  KASITLI İSTİSNA bırakıldı ve yorumla işaretlendi: 2FA QR kod görseli
  (taranabilirlik için beyaz zemin ZORUNLU) ve imza pedi (kağıt/mürekkep
  metaforu — hem web `SignaturePad.tsx` hem mobile `job_detail_screen.dart`
  aynı gerekçeyle beyaz bırakıldı). Ayrıca iki sayfada (`musteriler`,
  `personel`) StatusStrip'teki çok açık gri "boşta" noktası (`#CFD8D0`,
  koyu zeminde neredeyse görünmez olurdu) `rgb(var(--border-strong))`'a
  çevrildi.
- **Mobile**: `shared_preferences` eklendi. `ThemeController`
  (ChangeNotifier + SharedPreferences) `MaterialApp.themeMode`'a bağlı;
  `AppTheme.light()`/`dark()` (`ColorScheme`, `scaffoldBackgroundColor`,
  `appBarTheme`, `cardTheme`, `inputDecorationTheme`, buton temaları)
  `AppColors`/yeni `AppDarkColors` sınıflarından besleniyor. Ayarlar
  ekranına Açık/Koyu/Sistem seçici (`_ThemeCard`) eklendi.
- **Bilinen ve kabul edilen mimari sınır (yorumla dürüstçe belgelendi,
  gizlenmedi)**: Flutter tarafında web'deki CSS custom property
  mekanizmasının doğrudan bir karşılığı yok. Ekranlarda YÜZLERCE yerde
  `const TextStyle(color: AppColors.x)` gibi DERLEME-ZAMANI sabitleri
  kullanılıyor (performans/okunabilirlik için bilinçli bir desen) — bunlar
  yalnızca `Theme.of(context)` ÜZERİNDEN OKUNAN Material bileşenleri
  (Scaffold/AppBar/Card/TextField/Button — ki bunlar ekranların büyük
  kısmını oluşturur) otomatik geçiş yapar; ekran içi ÖZEL `Container`/
  `Text` stilleri (doğrudan `AppColors.x` yazılanlar) koyu modda AÇIK
  tema rengini kullanmaya devam eder. Bunu tam çözmek her ekranı
  `Theme.of(context).colorScheme.x` kullanacak şekilde yeniden yazmak
  anlamına gelir — yüzlerce satırlık, bu bölümün kapsamını aşan bir
  refactor.
- **Bulunup düzeltilen 2 YÜKSEK ETKİLİ, MEKANİK, DÜŞÜK RİSKLİ istisna**
  (kod incelemesiyle bulundu, yukarıdaki genel sınırın dışında bırakılmadı
  çünkü ÇOK yaygın/görünür ve düzeltmesi tamamen mekanikti):
  1. **42 dosyada** `Scaffold(backgroundColor: AppColors.surfacePage, ...)`
     — her ekranın kendi Scaffold'u temanın `scaffoldBackgroundColor`'ını
     EZİYORDU, yani koyu mod sayfa zemininin PRATİKTE HİÇBİR ekranda
     görünmeyeceği anlamına geliyordu (en ciddi bulgu). Tüm 42 dosyada bu
     satır silindi — Scaffold artık `Theme.of(context).scaffoldBackgroundColor`'ı
     doğal olarak devralıyor.
  2. Alt gezinme çubuğu (`role_shell.dart`/`staff_shell.dart`/
     `team_lead_shell.dart` — HER roldeki ana ekranın kalıcı krom'u) ve
     yan menü (`app_drawer.dart`) `AppColors.surfaceBase`/`primary50`
     sabitliyordu — `Theme.of(context).colorScheme.surface` ve
     `Theme.of(context).brightness == Brightness.dark ? AppDarkColors.primary50
     : AppColors.primary50` ile tema-duyarlı hale getirildi.
  - İncelenip KASITLI OLARAK dokunulmayanlar: imza pedi (`job_detail_screen.dart`,
    beyaz kağıt metaforu — web ile aynı gerekçe), sabit renkli kahraman
    paneller/rozetler üzerindeki `Colors.white` (drawer başlığı,
    impersonation banner'ı — bunlar zaten kendi içinde sabit renkli
    bloklar, web'deki aynı desenle tutarlı).
- Doğrulama: web `tsc --noEmit` + `next build` (sıfır uyarı/hata,
  Tailwind'in `darkMode: ["selector", ...]` yapılandırması 3.4.1'de doğru
  derlendi) ve mobile `dart analyze` (72 — bugüne kadarki temiz taban,
  sıfır YENİ hata) + `flutter test` ile doğrulandı. **Gerçek bir
  telefon/tarayıcıda görsel karşılaştırma YAPILAMADI** (kısıt: Chrome/
  telefon/emülatör UI otomasyonuna dokunulmaması gerekiyordu) — doğrulama
  tamamen kod okuma + derleme/lint/test yeşil geçişiyle sınırlı kaldı; bu
  açıkça bir sınırlama olarak not düşülüyor.


## Bölüm E — Sözleşme Otomasyon Sağlık Kontrolü

- Mevcut tekrarlayan iş üretim mantığı incelendi: `lib/cron.ts:
  generateRecurringJobs`, her gece 02:00'de `Contract.nextGenerationDate`si
  `<= now` olan her tekrarlayan sözleşme için bir `Job` üretip bu tarihi
  bir periyot ileri alıyor. Yani `nextGenerationDate` ZATEN "bir sonraki
  beklenen iş tarihi"nin ta kendisi — **yeni bir hesaplama mantığı icat
  edilmedi**, mevcut alan aynen kullanıldı.
- `GET /contracts/health-check` (OWNER/MANAGER, `/contracts/:id`'den ÖNCE
  kayıtlı — route sıralaması kuralına uyuldu): `status=ACTIVE`,
  `recurrenceType` dolu, `nextGenerationDate < now` olan sözleşmeleri
  döner — bu normal koşulda hiç olmaması gereken bir durum (cron her gece
  bunu temizler); varsa cron'un o sözleşme için çalışmadığının kanıtıdır
  (sunucu kesintisi vb.). `daysOverdue = Math.max(1, Math.ceil(...))`.
- Web: Sözleşmeler sayfasına "N otomasyon gecikmesi" rozet butonu →
  tıklanınca liste açılır (müşteri, beklenen tarih, kaç gün gecikmiş,
  "Şimdi İş Oluştur"). Buton `/isler?customerId=&serviceType=` sorgu
  parametreleriyle yönlendiriyor; `JobFormModal` artık opsiyonel bir
  `prefill` prop'u alıyor ve sözleşmedeki hizmet türü aktif hizmet türleri
  listesinde varsa doğrudan seçiyor, yoksa "Diğer" ile serbest metin
  olarak dolduruyor (silinmiş/yeniden adlandırılmış hizmet türü durumunu
  ele alıyor).
- **Bulunup düzeltilen gerçek build hatası**: `useSearchParams()`'ı
  `/isler` sayfasında doğrudan bir Client Component'in en üstünde
  kullanmak Next.js'in statik dışa aktarımını kırıyordu (`useSearchParams()
  should be wrapped in a suspense boundary`) — `next build` bunu HATA
  olarak veriyordu, geliştirme sunucusunda (`next dev`) fark edilmiyordu.
  Sayfa `JobsPage` (ince bir `<Suspense>` sarmalayıcı) ve `JobsPageContent`
  (asıl mantık) olarak ikiye ayrıldı — projedeki diğer sayfalarda zaten
  kullanılan "ince wrapper + iç içerik bileşeni" deseniyle tutarlı.
- Mobile: Sözleşmeler ekranı AppBar'ına bir `Badge` rozetli ikon
  (`Icons.favorite_border_rounded`) → tıklanınca aynı gecikme listesi
  açılır. "Şimdi Oluştur" butonu web'deki URL sorgu parametresi yerine
  doğrudan `JobFormScreen(prefillCustomerId:, prefillServiceType:)`
  widget parametreleriyle yönlendiriyor — Flutter'da bu yaklaşım
  web'deki Suspense sorununa hiç maruz kalmıyor (URL state'e ihtiyaç yok).
- Doğrulama: gerçek bir müşteriye bağlı, `nextGenerationDate`'i 5 gün
  geçmişte olan, `status=ACTIVE` + `recurrenceType=MONTHLY` test sözleşmesi
  oluşturuldu → `/contracts/health-check`'te doğru şekilde (6 gün gecikmiş
  olarak — `Math.ceil` kısmi gün farkını yukarı yuvarlıyor, beklenen
  davranış) göründüğü doğrulandı → `nextGenerationDate` ileriye alınınca
  (cron'un normal şekilde yakaladığı senaryo simüle edilerek) listeden
  kaybolduğu doğrulandı → STAFF rolünün 403 aldığı (OWNER/MANAGER
  kısıtlaması) doğrulandı → test sözleşmesi ID bazlı silindi.
- Doğrulama sırasında: backend `tsc --noEmit` ✓, web `tsc --noEmit` +
  `next build` (yukarıdaki Suspense düzeltmesinden SONRA sıfır hata) ✓,
  mobile `dart analyze` (72 — temiz taban) + `flutter test` ✓.

## Not: Bölüm D ve E'nin birlikte commit edilmesi

Bu turun geri kalanı (Bölüm D ve E) çalışma sırasında bazı dosyalarda
(`web/src/app/(dashboard)/sozlesmeler/page.tsx`, `web/src/app/(dashboard)/
isler/page.tsx`, mobile'daki birçok ekran dosyası) iç içe geliştiği için
— aynı dosyanın aynı satırlarına hem karanlık mod hem sağlık kontrolü
değişikliği dokunduğu için — iki bölüm git commit'lerinde TEMİZ AYRILAMADI.
Bu yüzden Bölüm D ve E tek bir commit'te birleştirildi; commit mesajı her
ikisini de ayrı ayrı açıklıyor.

## Bölüm G — Yönetici Özet Paneli (Executive Dashboard)

**Ne yapıldı:** OWNER/MANAGER için tüm kritik KPI'ları tek çağrıda
toplayan `GET /analytics/executive-summary?range=today|week|month`
endpoint'i; web'de `/yonetici-ozeti` sayfası (Sidebar → "Yönetici Özeti",
Ana Sayfa'nın hemen altında); mobilde "Diğer Modüller" listesinin en
üstünde "Yönetici Özeti" ekranı.

**Tasarım kararları:**

- **Mantık kopyalanmadı, mevcut fonksiyonlar dışa açıldı.** Bu uçtan önce
  net kâr, düşük stok, gecikmiş sözleşme vb. hesapları route handler'ların
  İÇİNDE (`res.json` ile bitişik) yaşıyordu. Handler'lar ikiye bölündü:
  saf hesaplama fonksiyonu + onu çağıran ince handler:
  - `paymentsController.computePaymentsSummary(canViewFinance)` +
    `canUserViewFinance()` — `/payments/summary` aynı fonksiyonu çağırır.
  - `dashboardController.computeDashboardSummary()`
  - `productsController.findLowStockProducts()` (`/products/low-stock`)
  - `contractsController.findOverdueRecurringContracts()` (`/contracts/health-check`, Bölüm E)
  - `reminders.contractRenewalWindowWhere()` — Bölüm B'nin 7 günlük
    penceresi; `sweepContractRenewalAlerts` de artık bu filtreyi kullanır.
  - `staffCertificationsController.expiringCertificationsWhere()`
  Böylece "yönetici özetindeki net kâr ≠ Para sayfasındaki net kâr" türü
  bir tutarsızlık yapısal olarak imkânsız.
- **Tüm alt sorgular tek `Promise.all` içinde** — 20 paralel sorgu, canlı
  ölçümde ~85 ms.
- **Drill-down hedefi backend'den gelir** (`drillDown.href` web,
  `drillDown.route` + `filter` mobil). Web'de hedef sayfalar
  `?filter=`/`?tab=`/`?status=` parametresini `useInitialQueryParam`
  hook'u ile okur (`window.location` — `useSearchParams` DEĞİL, Bölüm E'de
  görülen Suspense/`next build` sorununa girmemek için) ve
  `DrillDownChip` ile "Filtre: … ✕" rozeti gösterir. Desteklenen hedefler:
  `/stok?filter=critical`, `/sozlesmeler?filter=overdue|renewal`,
  `/para?tab=payments|expenses`, `/performans?tab=evaluations|bonuses`,
  `/personel?filter=on_leave|expiring_certs`,
  `/musteriler?filter=debt|new`, `/isler?status=COMPLETED`.
- **Mobil sınırı dürüstçe:** mobil liste ekranları dışarıdan filtre
  parametresi almadığı için kart tıklaması ilgili EKRANA gider, filtre
  uygulanmaz (`filter` modelde taşınır, ileride kullanılabilir).
- **Bekleyen onay tanımı** web'deki "Bekleyen Onaylar" sayfasıyla birebir:
  NEW teklif + PENDING avans + PENDING izin + 30 gün içinde bitecek
  sözleşme + onaysız saha raporu + PENDING prim önerisi; kırılım
  `pendingApprovalsBreakdown` alanında ayrıca döner.
- **Tarih aralığı yalnızca operasyon kartlarını etkiler** (iş sayısı,
  tamamlanma oranı). Finans kartları her zaman "bu ay / geçen ay"
  (spesifikasyon böyle), "bu ay yeni müşteri" de takvim ayına bağlı.
- **view_finance izni olmayan MANAGER**'a net kâr kartı `null` + "Finans
  görüntüleme izni gerekli" ipucu döner — `/payments/summary` ile aynı
  kural, aynı fonksiyon.

**Doğrulama (canlı):** OWNER token'ıyla endpoint çağrıldı; `netProfitThisMonth`,
`totalOutstandingBalance`, `thisMonthTotal`, `lastMonthTotal` birebir
`/payments/summary` ile; kritik stok (3) `/products/low-stock` ile; gecikmiş
otomasyon (0) `/contracts/health-check` ile; 30 gün sözleşme (1)
`/contracts/expiring` ile; bugünkü iş/aktif personel/bekleyen rapor
`/dashboard/summary` ile; NEW teklif (3) / PENDING avans (2) ilgili liste
uçlarının `pagination.total`'ı ile eşleşti. `range=week/month` sınırları
(Pazartesi başlangıç, ay başı) doğru; geçersiz `range` → `today`.
RBAC: OWNER 200, MANAGER 200 (net kâr null), TEAM_LEAD 403, token'sız 401.
Backend/web `tsc` ✓, `next build` ✓ (`/yonetici-ozeti` statik), `dart
analyze` 72 (değişmedi), `flutter test` ✓. Test verisi oluşturulmadı.

## Bölüm H — Otomatik Test Altyapısı (Backend öncelikli)

**Ne yapıldı:** `backend/` için vitest 5 + supertest; `mobile/` için model
parse birim testleri. Toplam 81 backend + 14 Flutter testi, hepsi yeşil.

**Tasarım kararları:**

- **`src/app.ts` ↔ `src/index.ts` ayrımı.** Express uygulaması `app.ts`'e
  taşındı (`export default app`), `index.ts` yalnızca dotenv + `listen` +
  cron başlatma. Testler `app`'i port'a bağlamadan supertest ile içeri alır;
  cron'lar test sürecinde hiç başlamaz.
- **Transaction-rollback DEĞİL, ID bazlı temizlik.** Prisma interactive
  transaction'ı yalnızca `tx` client'ını gören kodu sarmalar; supertest →
  Express → controller zinciri global `prisma`'yı kullandığı için HTTP
  seviyesindeki bir testi transaction içine almak ya tüm controller'ları
  client-enjeksiyonlu yapmayı ya da AsyncLocalStorage ile client'ı
  değiştirmeyi gerektirirdi — ikisi de test için üretim kodunu bükmek.
  Bunun yerine bugüne kadar elle yürütülen disiplin otomatikleştirildi:
  `tests/helpers/fixtures.ts:TestContext` her kaydı `vt_` önekli + uuid'li
  üretir, `cleanup()` FK sırasına göre ID bazlı siler (yan etkiyle oluşan
  Notification/AuditLog/UserSession/Expense/PasswordResetToken/
  TwoFactor*/ImpersonationSession satırları dahil). Suite sonunda dev
  DB'de `vt_` önekli hiçbir satır kalmadığı SQL ile doğrulandı.
- **Dış servisler test modunda kapalı** (`tests/helpers/setup.ts`):
  RECAPTCHA_SECRET_KEY/SMTP_*/FIREBASE_* boş string'e çekilir (`delete`
  değil — `@prisma/client` import edilirken .env'i yeniden yükleyip eksik
  anahtarları dolduruyor, var olan boş değeri ezmiyor). Böylece web login
  akışı token'sız test edilebilir ve gerçek e-posta/push gitmez.
- **Genel rate limit `NODE_ENV=test`'te atlanır** (`app.ts`, tek satır
  `skip`) — 81 test tek süreçte 300/15dk sınırını aşabilir. Login/şifre
  sıfırlama limitleri (`middleware/loginRateLimit.ts`) testte de AYNEN
  çalışır; test kullanıcıları benzersiz e-postalı olduğu için çakışmaz.
- **RBAC matrisi veri odaklı** (`tests/rbac.test.ts:CASES`): 41 uç × 5 rol;
  "izinli rol 401/403 almaz, izinsiz rol 403 alır" — iş mantığı değil route
  zinciri test edilir, uydurma id ile 404/400 dönmesi "yetki geçti" sayılır.
  Yeni bir korumalı uç eklerken bu listeye bir satır eklemek yeterli.
- **Not:** İstekte geçen `admin/db-tables` ucu kod tabanında yok (böyle bir
  route hiç eklenmemiş); yerine `admin/backup`, `admin/impersonate`,
  `admin/users/:id/reset-password` OWNER-only olarak matrise alındı.
- **İyimser kilit testi iki katmanlı:** (a) gerçek eşzamanlı iki PATCH
  (COMPLETED vs CANCELLED) — tam olarak biri 200, diğeri 400/409, DB'de tek
  zaman damgası; (b) deterministik: `updateMany where status=eski` sözleşmesi
  doğrudan (yarış zamanlamasına bağlı olmadan) doğrulanır.
- **Mobile:** `test/models/decimal_parsing_test.dart` — Decimal taşıyan her
  modelin (Product, Job, Staff, Contract, Quote, Advance, StaffBonus,
  EvaluationPeriod, ExecutiveSummary) string/sayı/null gösterimlerini kabul
  ettiğini sabitler; biri `as num`'a dönerse kırılır. STAFF yanıtında
  `salaryBase`'in hiç olmaması (redaction) da çökme yaratmıyor.

**Kapsam (81 test):** auth (13: login başarılı/başarısız/pasif hesap, 2FA
setup→enable→login→verify + preToken tek kullanım + kurtarma kodu, şifre
sıfırlama geçerli/süresi dolmuş/kullanılmış/uydurma + eski JWT iptali,
mustChangePassword zorlaması) · RBAC (43) · iş state machine + iyimser
kilit (6) · personel yaşam döngüsü (6: terfi→arşiv+token iptali, düşürme→
aynı kayıt canlanır maaş/pozisyon korunur, düşürmede yeni kayıt için
pozisyon+maaş zorunlu, terminate→login 403 + JWT 401 + arşiv, reactivate→
login OK, OWNER terminate edilemez, STAFF↔TEAM_LEAD swap) · finans (6:
aktif maaş net kârı düşürür/arşivlenince çıkar, terminate de hariç tutar,
gider/tahsilat, view_finance izni, executive-summary = payments/summary,
prim onayı→Expense(BONUS) + ikinci onay 409 ve ikinci gider yok) ·
güvenlik (7: OWNER impersonate edilemez, impersonation token OWNER uçlarına
giremez ve end sonrası ölür, MANAGER impersonate başlatamaz, TEAM_LEAD
ekip kapsamı liste/detay/yeniden atama, STAFF yalnızca kendini görür, maaş
sızıntısı, evaluator kimliği sızıntısı).

**Çalıştırma:** `cd backend && npm test` (~40 sn, Postgres ayakta olmalı),
`npm run test:typecheck`; `cd mobile && flutter test`. CI yok —
PROJECT_HANDOFF_TR.md §12.2.1'e "her önemli değişiklikten önce" kuralı eklendi.

---

# 3. Tur — Bölüm I / J / K

## Bölüm I — Global Arama

**Ne yapıldı:** `GET /search?q=` yeniden yazıldı: müşteri, iş, personel,
sözleşme ve teklif tek çağrıda paralel aranır (`Promise.all`), sonuçlar
normalize `{ type, id, title, subtitle, route }` listesi olarak döner. Web
Header'daki arama kutusu bu uca bağlandı (300 ms debounce, türe göre gruplu
dropdown, ikon + tür etiketi); mobilde Ana Sayfa AppBar'ına büyüteç →
tam ekran `SearchScreen`.

**Tasarım kararları:**

- **Rol kapsamı kopyalanmadı, aynı yardımcılar kullanıldı**
  (`getStaffIdForUser`, `getTeamStaffIds`, `getCustomerIdForUser`): STAFF
  yalnızca kendisine atanmış işleri ve o işlerin müşterilerini
  (`customersController.listCustomers` ile aynı `jobs.some` filtresi),
  TEAM_LEAD ekibinin işlerini/personelini, CUSTOMER kendi kaydını/işini/
  sözleşmesini görür. TEAM_LEAD'in `/customers` listesine erişimi olmadığı
  için müşteri sonucu almaz (ekibinin müşterileri iş sonuçlarında görünür).
  Teklif (`QuoteRequest`) yalnızca OWNER/MANAGER — modelde müşteri FK'sı yok,
  ad/telefon formdan geldiği gibi aranır.
- **Türkçe İ/i:** PostgreSQL `ILIKE` (Prisma `mode: "insensitive"`) `lower()`
  üzerinden çalışır; DB collation'ı (`en_US.utf8`) "İ"→"i" dönüşümünü Türkçe
  kuralıyla yapmaz. Bu yüzden terimin varyantları (İ↔i, I↔ı,
  `toLocaleLowerCase("tr-TR")`, `toLocaleUpperCase("tr-TR")`) ek OR dalları
  olarak eklenir — "İSMAİL" yazan da "ismail" yazan da aynı kaydı bulur.
  Ş/Ğ/Ü/Ö/Ç `lower()` ile zaten doğru eşleşir. Test: `search.test.ts`
  "Türkçe büyük/küçük harf".
- **Performans:** en az 2 karakter (altında sorgu hiç yapılmaz), tür başına
  `LIMIT 5`, `select` ile yalnızca gerekli sütunlar.
- **Deep-link'ler:** müşteri → `/musteriler?detailId=` (detay paneli açılır),
  iş → `/isler?search=<müşteri adı>`, personel/sözleşme/teklif →
  `?highlight=<id>` (liste o kayda daraltılır, "Arama sonucu" chip'i ile
  temizlenir — mevcut drill-down deseni). Mobil `route`'u kullanmaz; `type`+
  `id`'den detay ekranını türetir (sözleşme/teklifte ayrı detay ekranı
  olmadığı için liste açılır).

**Test (8 + 4):** rol kapsamı (STAFF başkasının işini/müşterisini,
TEAM_LEAD ekip dışı personeli, CUSTOMER başka müşteriyi göremez), Türkçe
eşleşme, min uzunluk, limit, normalize alanlar, 401. Flutter: yanıt modeli
ayrıştırma + sabit sıralı gruplama.

## Bölüm J — Müşteri Kendi Randevu Talebi

**Ne yapıldı:** `AppointmentRequest` modeli (PENDING/SCHEDULED/DECLINED,
`resultingJobId`, `respondedByUserId/At`, `declineReason`).
`/appointment-requests`: CUSTOMER oluşturur ve yalnızca kendi taleplerini
görür; OWNER/MANAGER tümünü listeler, `/:id/schedule { jobId }` ile var olan
bir işe bağlar, `/:id/decline { reason }` ile reddeder. Web müşteri
panelindeki "Yeni Randevu İste" butonu — Stitch'te vardı ama anonim teklif
formuna (`/quotes`) gidiyordu — artık bu akışa bağlı; Bekleyen Onaylar'a
6. kaynak "Randevu Talepleri" eklendi. Mobilde müşteri kabuğunda "Randevu
Taleplerim" ekranı (form alt sayfası + durum listesi).

**Tasarım kararları:**

- **Doğrulama:** `preferredDateStart` gelecekte, `< preferredDateEnd`,
  `serviceTypeId` aktif bir ServiceType olmalı (400). Müşteri formunda
  aralık "gün başı – gün sonu" olarak gönderilir ("3–5 Ekim arası").
- **Planlama = var olan işe bağlama.** `schedule` iş oluşturmaz; işin
  `customerId`'si talebin müşterisiyle aynı olmalı (aksi 400) — yanlış
  müşteriye bağlama veri tutarsızlığı yaratır. Web'de "Planla" düğmesi
  `/isler?customerId=&serviceType=&scheduledAt=&appointmentRequestId=` ile iş
  formunu ön dolu açar; `JobFormModal.onSaved` artık oluşturulan `Job`'u
  döndürür ve sayfa `schedule` çağrısını yapar. İkinci karar 409.
- **Bildirimler:** yeni talep → yönetime (`appointment_request`, alert
  kategorisi); planlama → müşteriye (`appointment_request_scheduled`, job
  kategorisi, `relatedType: Job`); red → müşteriye gerekçeyle
  (`appointment_request_declined`). `notificationCategories.ts` güncellendi.
- **Hizmet türü listesi:** `/service-types` CUSTOMER'a kapalı (yönetim
  ayarı) — `GET /appointment-requests/service-types` yalnızca aktif
  türlerin `id+name`'ini döner.
- `QuoteRequestModal.tsx` (web) artık hiçbir yerden çağrılmadığı için
  silindi; anonim `/quotes` ucu ve reCAPTCHA akışı backend'de duruyor.

**Test (12 + 6 RBAC + 2 Flutter):** doğrulama (geçmiş tarih, start≥end,
geçersiz hizmet türü), CUSTOMER kendi/başkasının talebi, OWNER filtre,
planlama (yanlış müşteri 400, olmayan iş 404, başarı + bildirim + 409),
reddetme (gerekçesiz 400, başarı + bildirim gövdesi), RBAC.

## Bölüm K — Personel Müsaitlik İşaretleri

**Ne yapıldı:** `StaffUnavailability` (date `@db.Date`, `startTime/endTime`
"HH:mm" — null ise tüm gün, `reason`). İzin talebinden (`LeaveRequest`,
onay gerektirir, `Staff.status`'u değiştirir) AYRI, onaysız ve anlık:
"bugün öğleden sonra müsait değilim". Uçlar: `POST/GET/DELETE
/staff/me/unavailability`, `GET /staff/:id/unavailability?month=`,
`GET /staff/unavailability?date=`. Web iş formu ve mobil iş formu seçilen
tarihte müsait olmayan personeli işaretler; Takvim'de STAFF/TEAM_LEAD için
işaretleme paneli.

**Tasarım kararları:**

- **Atama ENGELLENMEZ.** Uyarı yalnızca bilgilendiricidir — seçenek yanında
  "⚠ müsait değil (13:00–17:00)" ve seçim altında sarı uyarı kutusu; kaydet
  düğmesi etkilenmez (acil durumlar). `GET /staff/unavailability?date=`
  yardımcı ucu, formun N personel için N istek yerine tek çağrıyla uyarı
  çizmesi için eklendi (TEAM_LEAD ekip kapsamlı).
- **Tarih saat dilimi:** istemci `YYYY-MM-DD` düz string gönderir, sunucu
  UTC gece yarısı `DATE` olarak saklar ve aynı biçimde geri verir — ISO
  tam-zaman gönderilmesi halinde yaşanacak "bir gün kayma" sorunu baştan
  kapatıldı. Geçmiş gün 400; bugün kabul.
- **Sahiplik:** silme `deleteMany({ id, staffId })` ile — başkasının kaydı
  için 404 döner, kaydın varlığı sızmaz. `GET /staff/:id/...` kapsamı STAFF
  kendi, TEAM_LEAD ekibi (aksi 403), OWNER/MANAGER herkes.
- **Route sırası:** `/unavailability` ve `/me/unavailability` sabit yolları
  `/:id`'den ÖNCE kayıtlı; aksi halde Express `me`'yi id sanır.
- RBAC matrisinde `GET /staff/:id/unavailability` için TEAM_LEAD/STAFF
  "izinli" sayılmadı: route'tan geçerler ama uydurma id kapsam dışı → 403.
  Kendi/ekip kaydı için 200 senaryosu `staffUnavailability.test.ts`'te.

**Test (13 + 5 RBAC + 3 Flutter):** doğrulama (geçmiş, tek saat, ters
aralık, bozuk saat), kendi kaydını silme / başkasınınkini silememe,
`?month=` listesi, `/staff/:id` kapsamı (STAFF/TEAM_LEAD 403, OWNER 200/404),
`?date=` uyarı kaynağı (işaretli var, işaretsiz yok, başka gün yok,
TEAM_LEAD ekip dışını görmez), RBAC.

## 3. Tur Toplam

- Backend vitest: 81 → **125** test (+44: I 8, J 12, K 13, RBAC +11).
- Flutter: 14 → **23** test (+9 model testi).
- Yeni migration: `appointment_requests`, `staff_unavailability`.

---

# 4. Tur — Bölüm L / M / N / O / P / Q / R

## Bölüm L — Şef: Ekibe Toplu Mesaj

**Durum:** altyapı zaten vardı (`POST /conversations/broadcast`: her üyeye ayrı
mesaj + `team_broadcast` bildirimi + push + audit; web `BroadcastModal`, mobil
Mesajlar ekranı). Spec'teki `POST /team/broadcast { message }` aynı handler'a
bağlanan, yalnızca TEAM_LEAD'e açık bir yol olarak eklendi; `message` ve
`content` eşanlamlı. Ekibi olmayan şef 400. Push zaten `notifyUser →
pushToUsers → isPushConfigured()` zinciriyle gidiyor. Test: `teamBroadcast.test.ts`
(her üye alır, ekip dışı ve şefin kendisi almaz, boş metin 400, RBAC).

## Bölüm M — Şef: Günlük Ekip Brifingi

`GET /team/daily-briefing` (TEAM_LEAD). `getTeamSummary`'nin hesabı
`computeTeamSummary(teamIds)` olarak dışa alındı (kopya yok); brifing tek
`Promise.all` içinde bu özeti, bugünü kapsayan **onaylı** izinleri
(`LeaveRequest`) ve bugünkü müsait-olmama işaretlerini (`StaffUnavailability`,
Bölüm K) birleştirir. Üye satırı: `status` (Staff.status), `todaysJobsCount`,
`onLeave`, `unavailable/unavailableAllDay/unavailableRanges/unavailableReason`,
`isSelf` (getTeamStaffIds ilk sırada şefin kendisini döner). `availableNowCount`
= izinli değil ∧ tüm gün müsait-değil değil ∧ AVAILABLE. Web `TeamBriefingCard`,
mobil `_buildTeamBriefing`. `date` alanı yerel tarih (UTC kayması testte
yakalandı ve düzeltildi).

## Bölüm N — Personel: Günlük Kontrol Listesi

Yeni model YOK — `Job.checklist Json?` ve `JobReport.checklist Json?`; sabit
şablon `lib/checklist.ts` (4 öğe, ServiceType/Setting bazlı özelleştirme
bilinçli olarak yok). `PATCH /jobs/:id/checklist { items }` yalnızca işin
atandığı STAFF; şablon dışı öğe 400; `mergeChecklist` işaret kaldırılınca
`checkedAt`'i sıfırlar, korunan öğenin zamanını değiştirmez. `GET /jobs/:id`
her zaman tam şablonu döner (null → hepsi işaretsiz). Rapor oluşturulurken
liste rapora kopyalanır; **eksik liste raporu engellemez** (yalnızca
"N öğe eksik" uyarısı). Web `JobChecklist` (rapor modalının ilk adımı), mobil
`_ChecklistCard` (iş detayında rapor formunun üstünde).

## Bölüm O — Personel: Yol Tarifi

Backend değişikliği yok: `/jobs` yanıtına `customer.address/district` zaten
gömülü. Web `directionsUrl()` + personel Ana Sayfa iş kartında "Yol Tarifi"
(yeni sekme); mobil `Job.directionsUri` + iş detayında `url_launcher`
(`LaunchMode.externalApplication`). Adres yoksa buton gizli.
**Manuel doğrulama notu:** gerçek cihazda Google Maps/Apple Maps'in açıldığı ve
adresin doğru aratıldığı elle kontrol edilmeli (otomatik test yok — basit
deep-link).

## Bölüm P — Müşteri: Arkadaşını Davet Et

- `Customer.referralCode` (unique, 6 karakter, karışabilen harfler yok —
  `lib/referral.ts`), `Customer.referredByCustomerId` (self-relation),
  `QuoteRequest.referralCode`. Migration `prisma migrate diff + deploy` ile
  üretildi (unique-constraint uyarısı interaktif onay istiyordu).
- `POST /quotes` `?ref=` veya gövde `referralCode`: yalnızca **gerçek bir
  müşteriye ait** kod saklanır, uydurma kod sessizce yoksayılır (form başarısız
  olmaz). `POST /quotes/:id/convert`: yeni müşteri davet edene bağlanır, kendi
  kodunu alır, davet edene "Davetiniz kabul edildi!" (`referral_converted`).
  `createCustomer` da kod üretir; eski kayıtlar ilk `GET /customers/me/referral`
  çağrısında kod alır.
- Repo'da anonim teklif formu sayfası yoktu (dış site `/quotes`'a POST ediyor);
  davet linkinin hedefi olarak public **`/teklif-al?ref=`** sayfası eklendi
  (`WEB_APP_URL` tabanlı). Web `ReferralCard`, mobil `ReferralScreen`
  (kopyala/paylaş).
- **İndirim/ödül mekanizması bilinçli olarak YOK** — yalnızca takip/gösterim.
  Ödül kuralı (ilk işte % indirim, puan, vb.) ayrı bir iş kararı gerektirir.

## Bölüm Q — Ek Küçük Dokunuşlar

- **Sadık Müşteri** (`lib/badges.ts`): tamamlanmış iş ≥ 5 (sabit eşik).
  `/customers` liste+detay `completedJobCount`/`isLoyal`; `GET /customers/me/badges`
  (CUSTOMER). Rozet: müşteri listesi, müşteri Ana Sayfa, mobil Ana Sayfa.
- **Başarı rozeti**: değerlendirme kriter ortalaması (1–20) ≥18 Altın / ≥15
  Gümüş / ≥12 Bronz. `/staff/leaderboard` satırlarına `evaluationAverageScore`
  + `achievementTier` (SUBMITTED/LOCKED değerlendirmeler), `/evaluations`
  öğelerine `achievementTier`. Performans tablosu ve mobil performans listesi.
- **Sözleşme duraklat/devam**: `Contract.isPaused/pausedAt`;
  `POST /contracts/:id/pause|resume` — CUSTOMER kendi sözleşmesi (aksi 403),
  OWNER/MANAGER hepsi; yalnızca ACTIVE; mükerrer 409; audit log. Duraklatılmış
  sözleşme için `generateRecurringJobs` iş üretmez ve `findOverdueRecurringContracts`
  gecikmiş saymaz; `resume`'da `nextGenerationDate` bugünden eskiyse periyot
  periyot geleceğe alınır (duraklama dönemindeki kaçırılmış tarihler toplu
  üretilmez). Müşteri web Ana Sayfa `MyContractsCard`, mobil `MyContractsScreen`.
- **Test izolasyonu notu:** ilk sürümde test `generateRecurringJobs()`'u global
  çağırınca dev DB'deki gerçek bir vadesi gelmiş sözleşme için iş üretti (iş ID
  ile silindi, sözleşme tarihi geri alındı). Fonksiyona `onlyContractIds?`
  parametresi eklendi; test yalnızca kendi sözleşmesini işler.

## Bölüm R — Giriş Sayfası + Tasarım Tutarlılığı

- **Web `/giris`:** split-screen korunup zenginleştirildi (gradyan + nokta
  deseni + nefes alan halka dekoru), rol sekmeleri ikonlu ve aktif gösterge
  `framer-motion layoutId` ile kayar, tema düğmesi (`useTheme`, sistem tercihi
  yalnızca istemcide okunur — hidrasyon uyuşmazlığı yok), giriş → 2FA →
  Şifremi Unuttum tek sayfada `AnimatePresence` fade/slide, çok adımlı
  akışlarda `StepIndicator` (1/2, 2/2), `ErrorNotice` sakin ve yol gösterici
  (`friendlyError`: 401 → "eşleşmedi, yazımı kontrol edin", 429 → "biraz
  bekleyin", 2FA 401 → "kodlar 30 sn'de bir değişir"). `/sifremi-unuttum`
  sayfası da duruyor (e-posta linkleri için).
- **Mobil `LoginScreen`:** marka bandı (gradyan + `CustomPaint` nokta deseni),
  ikonlu rol kartları — `AuthProvider.login(expectedRole)` hesabın gerçek rolü
  uyuşmazsa oturum açmaz, açıklayıcı hata; 2FA akışında ikinci adımda kontrol
  edilir ve giriş ekranına döner. `_AuthGate` `AnimatedSwitcher` (fade+slide),
  Şifremi Unuttum `PageRouteBuilder` fade, 2FA ekranında 2/2 göstergesi.
- **Tutarlılık taraması (web+mobil):** izinler, değerlendirmeler, primler,
  tedarikçiler, giderler, org şeması, yönetici özeti, loglar, kullanım
  istatistikleri, randevu talepleri, müsaitlik, arama tarandı. Düzeltilenler:
  Tedarikçiler boş durumu → `EmptyState`; Sistem Durumu ilk ölçümde "uyarı"
  yerine "İlk ölçüm alınıyor..."; mobil arama ekranı özel `_Hint` yerine ortak
  `LoadingView/ErrorRetryView/EmptyStateView`; Para ekranında `Colors.red` →
  `AppColors.danger500`. Kasıtlı `bg-white` (2FA QR kodu, imza pedi) korundu.
  Koyu mod: yeni sayfalar yalnızca tema token'larını kullanıyor.

## 4. Tur Toplam

- Backend vitest: 125 → **155** test (+30: L 5, M 3, N 6, P 6, Q 10).
- Flutter: 23 → **35** test (+12).
- Yeni migration: `job_checklist`, `customer_referral`, `contract_pause`.

---

# 5. Tur — Bölüm S / T / U / V / W

## Bölüm S — Yapılandırılmış Müşteri Geri Bildirimi

Alanlar **Job** modeline eklendi (ayrı CustomerFeedback modeli gereksizdi;
`rating/ratingComment` zaten Job'da ve genel puan olarak DOKUNULMADI):
`serviceQualityScore / punctualityScore / staffProfessionalismScore` (1–5),
`wouldRecommend?`, `feedbackComment?`, `feedbackSubmittedAt?`.
`PATCH /jobs/:id/feedback` — CUSTOMER, kendi işi (403), COMPLETED (400), bir
kez (409; `updateMany where feedbackSubmittedAt: null` iyimser kilit).
`GET /analytics/feedback-summary` (OWNER/MANAGER): 3 kriter ortalaması, tavsiye
oranı, yanıt sayısı — veri yoksa null. Web: `FeedbackModal` ("Detaylı
Değerlendir", müşteri Ana Sayfa), Raporlar → "Müşteri Geri Bildirimi"
`RankBars` kartı. Mobil: iş detayında `_FeedbackCard` (alt sayfa), Raporlar'da
özet blok.

## Bölüm T — İş Şablonları

`JobTemplate` (name, serviceType, defaultPrice, defaultDurationMinutes,
defaultNotes, isActive). `/job-templates` CRUD OWNER/MANAGER; DELETE yumuşak
(`isActive:false`, `?includeInactive=true`). "Şablondan Doldur" istemci
mantığıdır: hizmet türü/fiyat/not dolar, `defaultDurationMinutes` + planlanan
saat varsa bitiş saati hesaplanır; kullanıcı her alanı değiştirebilir. Web
Ayarlar → `JobTemplatesSection` (OWNER **ve** MANAGER — diğer Ayarlar bölümleri
OWNER'a özel), `JobFormModal` dropdown'ı. Mobil `JobTemplatesScreen`
(Ayarlar listesi + Müdür çekmecesi "İş Şablonları"), iş formunda dropdown.

## Bölüm U — Yeni Personel İşe Alım Kontrol Listesi

`OnboardingChecklistItem` (staffId, item, sortOrder, isCompleted,
completedAt/By). `createStaff` transaction'ında `lib/onboarding.ts` şablonu
(5 madde) otomatik eklenir — `usersController.demoteFromManager`'ın yeniden
oluşturduğu Staff kaydına EKLENMEZ (o bir işe alım değil, rol düşürme).
`GET /staff/:id/onboarding` OWNER/MANAGER herkes, STAFF/TEAM_LEAD kendi kaydı
salt-okunur (aksi 403), `progress {total, completed, percent, isComplete}`;
`PATCH /staff/:id/onboarding/:itemId` OWNER/MANAGER — damga, yeniden
işaretlemede korunur, geri alınca sıfırlanır, audit log. Web: `OnboardingModal`
+ kartta "İşe Alım" butonu; mobil: `OnboardingCard` personel detayında (liste
boşsa — özellikten önce açılmış kayıt — gizli).

## Bölüm V — Değerlendirme Geçmişi Trendi

`GET /evaluations/staff/:staffId/history` — yalnızca SUBMITTED/LOCKED
değerlendirmeler (taslak trendi bozmaz), dönem başlangıcına göre kronolojik;
nokta: `periodLabel, averageScore, achievementTier, status`; `overallAverage`,
`lastDelta` (tek dönemde null). Kapsam `resolveViewScope` (STAFF/TEAM_LEAD
yalnızca kendisi → aksi 403), evaluator kimliği `redactEvaluatorForRole` ile
yönetim dışına dönmez — testle sabitlendi. Web: `EvaluationTrendCard` (recharts
`TrendChart`) `EvaluationsModal` üstünde ve Performans → Değerlendirmeler'de
STAFF/TEAM_LEAD kendi trendi (`SelfEvaluationTrend`; önceden bu rol boş
durum görüyordu). Mobil: `RevenueTrendChart`'a `fixedMaxY/valueFormatter`
eklendi (ciro davranışı korunur), `EvaluationTrendCard` (fl_chart, 1–20).

## Bölüm W — Stok Tükenme Tahmini

`lib/stockForecast.ts`: son 30 gün **OUT** hareketleri toplamı / 30 = günlük
ortalama; `currentStock / günlük = kalan gün` (floor) ve tükenme tarihi. OUT
yoksa tüm alanlar null + `note: "Tahmin için yeterli veri yok"` — uydurma sayı
yok. IN hareketleri ve 30 günden eski OUT'lar sayılmaz (testle sabit).
`GET /products/:id/forecast` (OWNER/MANAGER); `/products` listesine her satır
için `forecast` tek `groupBy` ile gömüldü (N+1 yok). Web/mobil kartta
"Tahmini N gün sonra biter" (≤7 gün kırmızı, ≤30 sarı, 0 → "Tükendi"); veri
yoksa hiçbir şey.

## 5. Tur Toplam

- Backend vitest: 155 → **185** test (+30: S 7, T 7, U 6, V 4, W 6).
- Flutter: 35 → **44** test (+9).
- Yeni migration: `job_structured_feedback`, `job_templates`, `onboarding_checklist`.
- Cron/toplu iş fonksiyonu bu turda test edilmedi; test verisi ürün/hareket/
  dönem/kriter dahil ID ile temizlendi (Bölüm Q dersi korunuyor).

---

# 6. Tur — Bölüm X / Y / Z / AA / AB

## Bölüm X — Müşteri Segmentasyonu (Etiketler)

`CustomerTag` (name unique, color `#RRGGBB`, isActive) + **açık** ara tablo
`CustomerTagAssignment` (implicit m:n yerine — etiket silinince atamalar
Cascade ile temizlenir, ileride atama tarihi/atayan eklenebilir).
`/customer-tags` CRUD OWNER/MANAGER (GET STAFF de görür — listede rozet için),
DELETE gerçek silme, pasifleştirme için PATCH `isActive:false`.
`POST /customers/:id/tags { tagIds }` kümeyi **tam eşitler** (transaction:
notIn sil + skipDuplicates ekle). `GET /customers?tagId=` filtre; liste/detay
yanıtında `tags` düz liste (`tagAssignments` sızmaz). Web: Ayarlar
`CustomerTagsSection` (palet + özel renk), müşteri listesinde rozet + filtre
çipleri, detay panelinde `CustomerTagEditor`. Mobil: `customer_tags.dart`
(model/API/chip/editor/`CustomerTagsScreen` — Ayarlar + Müdür çekmecesi).

## Bölüm Y — Hizmet Garanti Takibi

`ServiceType.defaultWarrantyDays` (Int?), `Job.warrantyExpiresAt`
(DateTime?). `lib/warranty.ts`: iş COMPLETED olunca `completedAt + gün`;
Job.serviceType serbest metin olduğu için ServiceType **adıyla** eşleşir,
eşleşme veya gün yoksa null. `updateJob`'un hem yönetim hem STAFF dalında
uygulanır. `GET /customers/:id/active-warranties?serviceType=` (OWNER/MANAGER)
geçerli garantiler + `daysLeft`; bekleyen randevu taleplerinde yönetim
listesine `activeWarranty` (aynı tür) gömülür, müşteriye dönmez.
**Otomatik ücretsizlik yok** — yalnızca bilgilendirme. Web: `WarrantyBadge`
(iş listesi, süresi dolmuşsa gizli), `WarrantyNotice` (iş formu + Bekleyen
Onaylar), Ayarlar → Hizmet Türleri satırında "Garanti N gün" düzenleme.
Mobil: `Job.warrantyDaysLeft` + detay pill, iş formunda uyarı kutusu.
Not: repo'daki anonim teklif formu müşteri seçtirmediği için "teklif formunda
uyarı" iş formu ve randevu talebine uygulandı.

## Bölüm Z — Akıllı Personel Atama Önerisi

`GET /jobs/suggest-staff?date=&time=&serviceType=` (OWNER/MANAGER/TEAM_LEAD;
TEAM_LEAD `getTeamStaffIds`). Yeni hesap tekrarı yok: Staff (archivedAt null,
status ON_LEAVE → müsait değil), `StaffUnavailability` (tüm gün veya verilen
saati kapsayan aralık → `isUnavailable`), Job.assignedStaffId + scheduledAt o
gün (CANCELLED sayılmaz) → `todayJobCount`. Sıralama: müsaitler önce, iş yükü
artan, ad; ilk müsait `isRecommended`. **Saat verilmezse** kısmi aralık
listeden düşürmez, `unavailableReason` metni taşır (UI rozet). `serviceType`
yalnızca yankılanır — yetkinlik eşlemesi yok, uydurma puan üretilmez. Web/
mobil iş formu personel seçicisi öneri sırasına dizilir ("★ Önerilen · Ad ·
Bugün N iş ⚠ neden"); seçim yönetimde kalır.

## Bölüm AA — Yıldan Yıla Karşılaştırmalı Raporlama

`computeRevenueTrend(monthCount, anchor)` — pencere artık `[başlangıç,
bitiş)` kapalı aralık (önceden `gte` açık uçluydu; "bugüne kadar" için fark
yok, geçmiş anchor'da gerekliydi). `computeYearOverYear` aynı fonksiyonu
bugün ve 12 ay öncesi için çağırıp indeks bazında eşler: `{ month, thisYear,
lastYear, changePercent }` — geçen yıl 0 ise oran null, uydurma yok. PDF
export etkilenmez. Web: Raporlar "Ciro Trendi" ikinci seri (gri) +
"Geçen yılı gizle/karşılaştır"; mobil `RevenueTrendChart.secondaryPoints`
(gri kesikli). Test, gerçek dev ödemeleriyle çakışmamak için **delta**
bazlıdır (baseline − sonra) ve ödemeleri ID ile siler.

## Bölüm AB — Müşteri Belge Kasası

`CustomerDocument` (fileName orijinal ad, fileUrl `/uploads/<rastgele>`,
fileType, fileSize, uploadedBy). `lib/upload.ts:uploadDocument` — JobPhoto ile
aynı disk deposu/adlandırma; resim + PDF + ofis belgeleri, 15 MB.
`DELETE /customers/:id/documents/:docId` DB kaydı + diskteki dosyayı
(`path.basename` — traversal yok) birlikte kaldırır; `docId + customerId`
eşleşmezse 404 → başka müşterinin belgesi kendi yolundan silinemez. Multer
hataları (boyut, tür reddi) artık `errorHandler`'da 400 (önceden 500; JobPhoto
da yararlanır). Web: `CustomerDocuments` (sürükle-bırak, indir, onaylı sil)
detay panelinde. Mobil: `file_picker` bağımlılığı eklendi;
`CustomerDocumentsTab` 4. sekme (yönetim), indir/paylaş `downloadAndShare`.
Güvenlik notu: `/uploads` statik ve kimliksiz servis ediliyor (mevcut JobPhoto
tasarımıyla aynı) — dosya adı rastgele UUID; hassas belgeler için ileride
imzalı/yetkili indirme ucu düşünülebilir.

## 6. Tur Toplam

- Backend vitest: 185 → **212** test (+27: X 8, Y 5, Z 4, AA 4, AB 6).
- Flutter: 44 → **52** test (+8).
- Yeni migration: `customer_tags`, `job_warranty`, `customer_documents`.
- Cron/toplu iş çağrısı yok; test verisi (etiket, ödeme, ürün, belge dosyaları
  dahil) ID/isim ile temizlendi; `uploads/` test sonrası boş.

---

# 7. Tur — Bölüm AC / AD / AE / AF / AG

## Bölüm AC — KRİTİK GÜVENLİK: Kimlik Doğrulamalı Dosya İndirme

**Sorun:** `/uploads` klasörü (iş fotoğrafları, imzalar, müşteri belgeleri,
mesaj ekleri) `express.static` ile kimliksiz servis ediliyordu; güvenlik
yalnızca rastgele dosya adına dayanıyordu.

**Düzeltme:**
- `app.ts`'teki statik mount **kaldırıldı**. `/uploads/*` artık hiçbir route'a
  düşmez → Express 404. Test `fileAccess.test.ts` bunu diskte gerçek dosya
  varken (token'lı ve token'sız) doğrular.
- Tek yol: `GET /files/:type/:id` (`requireAuth`). `type` → yetki kuralı, ilgili
  uçla birebir: `job-photo/:photoId` ve `job-signature/:jobId` → `canAccessJob`
  (OWNER/MANAGER hepsi, TEAM_LEAD ekibi, STAFF kendi işi, CUSTOMER kendi işi);
  `customer-document/:docId` → yalnızca OWNER/MANAGER (CUSTOMER kendi belgesi
  bile olsa 403 — belge uçlarıyla aynı); `message-attachment/:messageId` →
  konuşma katılımcısı. Yetkisiz 403 "Bu dosyaya erişim yetkiniz yok", yok 404
  "Dosya bulunamadı" — tutarlı mesajlar, var/yok bilgisi sızmaz. Disk yolu
  `path.basename` + `UPLOADS_DIR` sınırı (traversal testi). Content-Type bilinen
  MIME/uzantı, Content-Disposition orijinal ad, `Cache-Control: private`.
- **Karar (5. madde):** imzalı/kısa ömürlü token'sız URL (a) YERİNE (b)
  seçildi: web'de `fetchFileBlob` + `AuthImage` (object URL; `useAuthFileUrl`
  hook'u, revoke ile), indirmelerde zaten Authorization gönderen `downloadFile`;
  mobilde `Image.network(headers: Authorization)` (`AuthImage` widget) ve
  `getBytes` (token'lı). Gerekçe: mevcut istemci altyapısına en az değişiklik,
  token'sız hiçbir URL yüzeyi açılmıyor, ek imza/anahtar yönetimi yok.
- `resolveUploadUrl` web ve mobilde kaldırıldı → `fileUrl(type, id)`. DB'de
  saklanan `/uploads/<ad>` değerleri korunur (yalnızca dosya adı referansı olarak
  kullanılır); istemci bunları hiçbir yerde URL olarak kullanmaz.

## Bölüm AD — KVKK: Veri Silme/Anonimleştirme Talebi

`DataDeletionRequest` (PENDING/COMPLETED/REJECTED). Müşteri
`POST /customers/me/deletion-request` (bekleyen varsa 409; yönetime bildirim);
`/data-deletion-requests` **yalnızca OWNER**. Onay transaction'ı: Customer
adı "Silinmiş Müşteri", telefon placeholder, e-posta/adres/semt/davet kodu null;
belgeler ve etiket atamaları kaldırılır; User `isActive=false` +
`tokenVersion++` (mevcut JWT'ler 401, login engellenir), ad anonim, e-posta
`deleted-<id>@anonim.local`, oturumlar ve FCM token'ları silinir.
**Job/Payment/Contract kayıtları silinmez** (mali/yasal zorunluluk;
istatistikler bozulmaz) — testte sayılar önce/sonra eşit. Audit log
"GERİ ALINAMAZ" detayıyla. Red → gerekçe + müşteriye bildirim; reddedilen
müşteri yeniden talep açabilir.

## Bölüm AE — Teklif→Dönüşüm Süresi (SLA)

`QuoteRequest.firstContactedAt`: `updateQuote`'ta status NEW'den başka bir
duruma **ilk** geçişte damgalanır, sonra sabit; `convert`te `convertedAt`
(mevcut alan) ve temas damgası yoksa `firstContactedAt = dönüşüm anı`.
`computeQuoteResponseTime(days, anchor)`: pencerede **oluşturulan**
tekliflerde ortalama ilk temas / dönüşüm (saat, 1 ondalık); damgasız kayıt
ortalamaya girmez; hiç yoksa null. Pencere `[since, now]` kapalı — ilk
sürümde üst sınır yoktu, testte yakalandı. `GET /analytics/quote-response-time`
→ `{ last30, last90 }`. Web Raporlar 2 StatCard, mobil "Yanıt Hızı" bloğu.

## Bölüm AF — Haftalık Özet E-postası

`lib/weeklyDigest.ts`: `sendWeeklyDigest(onlyOwnerIds?)` — Yönetici Özet
Paneli'nin `computeExecutiveSummary("week", true)` hesabını yeniden kullanır;
HTML şablonu bölümler + bekleyen onay kırılımı; OWNER + aktif +
`weeklyDigestEnabled`; SMTP yoksa sessizce atlar. Cron `0 8 * * 1`.
**Tercih alanı `NotificationPreference.weeklyDigestEnabled`** (spec'teki
`User.weeklyDigestEnabled` yerine) — mevcut `dailyDigestEnabled` ile aynı
model/uç/toggle UI'ı yeniden kullanılıyor; davranış aynı (OWNER kapatabilir).
**Test:** cron global çağrılmadı; `onlyOwnerIds` ile yalnızca test OWNER'ları
hedeflendi; test ortamında SMTP boş → `sent 0`, alıcı/atlama listesi ve HTML
içeriği doğrulandı.

## Bölüm AG — Düşük Memnuniyet Uyarısı

`rateJob`: `rating ≤ 2` → `notifyManagement("Düşük memnuniyet", "<müşteri> -
<iş>, puan: N/5")`; `submitJobFeedback`: `wouldRecommend === false` → aynı
bildirim, kriter puanları özetli. Tür `low_satisfaction` (alert kategorisi).
Normal/yüksek puanda bildirim yok (testle sabit).

## 7. Tur Toplam

- Backend vitest: 212 → **239** test (+27: AC 8, AD 7, AE 5, AF 4, AG 3).
- Flutter: 52 → **54** test (+2).
- Yeni migration: `data_deletion_requests`, `quote_first_contacted`,
  `weekly_digest_pref`.
- Cron/toplu iş: yalnızca `sendWeeklyDigest(onlyOwnerIds)` hedefli; test verisi
  ID/isim ile temizlendi, `uploads/` boş.

---

# 8. Tur — Bölüm AH / AI / AJ / AK / AL

## Bölüm AH — Personel Yıllık İzin Bakiyesi

`Staff.annualLeaveQuotaDays Int @default(14)` (migration
`staff_leave_quota`); staff create/update şemasında `0–365`. `lib/leaveBalance.ts`:
`leaveDaysInYear(start, end, year)` uçlar dahil ve **takvim yılına kırpılmış**;
`computeLeaveBalance(staffId, year)` = kota − APPROVED izin günleri.
`GET /staff/:id/leave-balance?year=` — OWNER/MANAGER herkes, STAFF/TEAM_LEAD
yalnızca kendi (aksi 403). `decideLeaveRequest`: bakiyeyi aşan talep
**reddedilmez**, yanıt `exceedsBalance / requestedDays / remainingDaysAfter`
taşır; liste yanıtında bekleyen talepler aynı bayrakla gelir. Web
`LeaveBalanceCard` (progress bar, ≥%80 uyarı, aşımda kırmızı) personel
kartında; onay ekranında "Bakiyeyi aşıyor (kalan N gün)" rozeti. Mobil aynı
kart (`leave_balance_card.dart`) + `LeaveBalanceExceedBadge`; personel
formunda kota alanı.

## Bölüm AI — Otomatik Stok Yenileme Önerisi

`StockPurchaseRequest.isAutoGenerated Boolean @default(false)`.
`reminders.ts:autoSuggestReplenishment(productId)`: ürün için PENDING talep
yoksa **ve** en son `supplierId`'li talep varsa, o tedarikçi + o miktarla
`isAutoGenerated=true` PENDING talep açar (requestedBy: ilk aktif OWNER),
yönetime bildirim. `evaluateLowStockAlert` kritik dalında çağrılır (günlük
bildirim dedup'ından bağımsız). `sweepLowStockAlerts(onlyProductIds?)` kapsam
daraltıcı parametre aldı — testler yalnızca kendi ürünleriyle çağırır, cron
global çağrılmaz. Web/mobil satın alma listesinde "Otomatik Öneri" rozeti.

## Bölüm AJ — Müşteri Kendi Verisini İndirebilsin

`GET /customers/me/data-export` (yalnızca CUSTOMER; parametre yok — kapsam
`req.user → Customer`): `customer + jobs + contracts + payments +
appointmentRequests + documents(META)`. Belgelerde `fileUrl` **dışa
verilmez**; dosya içeriği için mevcut `GET /files/customer-document/:id` deseni
geçerli. `Content-Disposition: verilerim-YYYY-MM-DD.json`, audit
`customer.data_export`. Web Ayarlar → "Verilerimi İndir" (`downloadFile`,
Authorization header'lı Blob). Mobil Diğer → "Verilerimi İndir"
(`downloadAndShare`).

## Bölüm AK — Sistem Geneli Duyuru Şeridi

`Announcement { id, message, isActive, createdByUserId, createdAt, expiresAt? }`.
`POST /announcements` (OWNER) transaction içinde önceki aktifleri pasifleştirir
→ **tek aktif duyuru**; geçmiş `expiresAt` 400. `GET /announcements/active`
(tüm oturumlar) süresi dolmamış aktif ya da `null`. `DELETE /announcements/:id`
(OWNER) `isActive=false` (fiziksel silme yok). Web `AnnouncementBanner`
layout'un en üstünde; kapatma localStorage'a **duyuru ID'sini** yazar, yeni
duyuru (farklı ID) yeniden görünür; OWNER Ayarlar → "Duyuru Şeridi" yönetimi.
Mobil `AnnouncementBanner` Ana Sayfa gövdelerinin ilk öğesi (SharedPreferences).
**Test notu:** RBAC POST boş gövdeyle 400 alır (gerçek aktif duyuruyu
pasifleştirmesin); özellik testi test öncesi aktif gerçek duyuruları ID ile
geri açar.

## Bölüm AL — Toplu Müşteri İçe Aktarma (CSV)

`POST /customers/import` (OWNER/MANAGER, multipart `file`, yalnızca `.csv`,
2MB, **bellekte** — diske yazılmaz). `lib/csv.ts`: bağımlılıksız RFC 4180
ayrıştırıcı (tırnak, `""` kaçışı, `,`/`;` ayracı otomatik, BOM) — `csv-parse`
projede yoktu, ek bağımlılık yerine bu yazıldı. Başlık zorunlu (`fullName`,
`phone`; büyük/küçük harf duyarsız), doğrulama mevcut Customer create şemasıyla
aynı. **Satır bazlı işlem (tek transaction değil):** telefonu kayıtlı satır
`skipped` (güncelleme yok), dosya içi yinelenen de `skipped`, hatalı satır
`errors[{row, reason}]`, diğerleri eklenir. Yanıt `{ created, skipped, errors }`.
Web Müşteriler → "CSV İçe Aktar" + sonuç modalı (özet + hata tablosu).
**Mobil: kapsam dışı** (CSV hazırlama masaüstü işi).

## 8. Tur Toplam

- Backend vitest: 239 → **264** test (+25: AH 5, AI 4, AJ 4, AK 7, AL 5 — RBAC
  matrisi satırları dahil).
- Flutter: 54 → **63** test (+9: AH 5, AI 2, AK 2).
- Yeni migration: `staff_leave_quota`, `purchase_request_auto_generated`,
  `announcement`.
- Cron/toplu iş: `sweepLowStockAlerts(onlyProductIds)` hedefli; test verisi ID
  ile temizlendi; DB'de `vt_` kalıntısı ve `isAutoGenerated` kaydı yok.
