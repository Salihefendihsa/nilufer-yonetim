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

- Mevcut tekrarlayan sözleşme→iş üretim mantığı incelendi: `lib/cron.ts:
  generateRecurringJobs` her gece 02:00'de `Contract.nextGenerationDate`
  alanı `<= now` olan her sözleşme için bir `Job` üretir ve bu alanı bir
  periyot ileri alır (`lib/recurrence.ts:addRecurrencePeriod`).
  `nextGenerationDate` ZATEN "bir sonraki beklenen otomatik iş tarihi"
  anlamına geliyor — Bölüm E için YENİ bir hesaplama İCAT EDİLMEDİ, mevcut
  alan aynen kullanıldı.
- `GET /contracts/health-check` (OWNER/MANAGER) — `status: ACTIVE`,
  `recurrenceType` dolu, `nextGenerationDate < now` olan sözleşmeleri
  "gecikmiş" sayar (normal koşullarda bu asla olmamalı; sunucu kapalıyken
  02:00 geçtiyse veya bir hata oluştuysa ortaya çıkar). Her kayıt için
  `daysOverdue` (`Math.ceil` ile — kısmi bir gün bile "1 gün gecikmiş"
  sayılır, gecikme olduğundan az gösterilmesin diye).
- Web: Sözleşmeler sayfası başlığına, gecikme varsa turuncu bir rozet
  butonu ("N otomasyon gecikmesi") — tıklanınca genişleyen bir panel,
  her satırda "Şimdi İş Oluştur" → `/isler?customerId=&serviceType=`
  linkine yönlendirir; İşler sayfası bu query parametrelerini okuyup
  formu önceden doldurulmuş halde otomatik açar.
  - **Yan not**: `useSearchParams()` Next.js'te bir `<Suspense>` sınırı
    gerektiriyor (aksi halde statik dışa aktarımda derleme hatası) —
    `JobsPage` bu yüzden ince bir `Suspense` sarmalayıcıya bölündü.
- Mobile: Sözleşmeler ekranı AppBar'ına aynı rozet (`Badge` widget'ı) +
  açılır panel; "Şimdi Oluştur" butonu mevcut `JobFormScreen`'e yeni
  opsiyonel `prefillCustomerId`/`prefillServiceType` parametreleriyle
  yönlendirir.
- Doğrulama: gerçek bir müşteriye bağlı, `recurrenceType: MONTHLY`,
  `nextGenerationDate` gelecekte olan SAĞLIKLI bir test sözleşmesi
  oluşturuldu → health-check'te GÖRÜNMEDİĞİ doğrulandı → ardından
  `nextGenerationDate` doğrudan (cron'un kaçırdığı bir çalışmayı simüle
  etmek için) 3 gün geriye çekildi → artık health-check'te doğru
  `customerName`/`serviceType`/`daysOverdue` ile GÖRÜNDÜĞÜ doğrulandı.
  Test sözleşmesi ID bazlı silindi.


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
