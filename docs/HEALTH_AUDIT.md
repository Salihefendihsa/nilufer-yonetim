# Sistem Sağlık Taraması — 24 Eylül 2026

Bu rapor bir "her şeyi düzelt" turu değil; bulgular karar verilmek üzere listelenmiştir.
Tek kod değişikliği: mobil giriş ekranındaki logo kayması (Bölüm 4.4).

## Düzeltme durumu (2. tur, 24 Eylül 2026)

Seçilen 12 madde düzeltildi; ayrıntılar ilgili commit mesajlarında.

| Madde | Rapor | Durum |
|---|---|---|
| Tema butonu + Row sonsuz genişlik çökmesi | 1.1 #1–2 | ✅ 115 buton tarandı, 4 buton düzeltildi, regresyon testi |
| Test hesapları | V-1 | ✅ 16 hesap silindi (`npm run db:cleanup-residue`) |
| Test bildirim sızıntısı + kirli bildirimler | V-2 | ✅ 3.535 bildirim silindi; TestContext artık kendi izini temizliyor |
| Genel istek limiti + mobil 429 mesajı | G-1, U-6 | ✅ Kullanıcı başına 2000/15 dk, kimliksiz IP başına 300 |
| Web 360px taşma | U-1 | ✅ Layout `min-w-0` |
| Süresi dolan sözleşmeler | V-4 | ✅ Otomatik EXPIRED + üretim filtresi; 3 kayıt düzeltildi |
| Negatif bakiye | V-3 | ✅ İptaller hariç formül; demo ödemeler işlerle eşlendi (negatif 27 → 0) |
| İzin çakışması | V-6 | ✅ 409 + gün kümesi; mükerrer kayıt düzeltildi |
| Bildirim yönlendirmeleri | 1.1 #3 | ✅ Web + mobil, 7 tür (+ Customer/User) |
| Karanlık mod kontrastı | U-2 | ✅ Tek yerden (globals.css), ≥ 5,1:1 |
| Üretim saat dilimi + saat dilimsiz tarihler | §2.3 | ✅ Dockerfile `TZ`; mobil 14 alan `apiDate`/`apiInstant` |
| RBAC matrisi | G-2 | ✅ 16 satır eklendi |

Açık kalanlar (bu turda seçilmedi): V-5 (net kâr formülü), V-7, V-8, V-9, 1.1 #4–7, U-3–U-5.
Not: demo `owner@nilufer.com` hesabının görünen adı veritabanında "Test Owner" (seed'de "Salih Patron"); demo hesaplara dokunulmadığı için değiştirilmedi.

## Yöntem ve sınırlar

- **Veri**: her hesaplanan alan curl ile API'den alındı, aynı değer salt-okunur SQL ile bağımsız hesaplanıp karşılaştırıldı.
- **Web**: 5 rolün her biriyle (owner, manager, ekiplideri, personel1, musteri1) gerçek giriş; Sidebar'daki **her** sayfa 1366px ve 360px'te gezildi (toplam 71 sayfa ziyareti). Kaydedilen: API 4xx/5xx yanıtları, konsol hataları, ekrandaki hata kutuları, yatay taşma.
- **Mobil**: Chrome eklentisi bağlı değildi. Flutter'ın kendi penceresine (8090) CDP ile bağlanıldı; giriş ekranı ve logo orada doğrulandı. Ancak bu debug penceresinde viewport emülasyonu semantik ağacı bozduğu için (koordinatlar eski boyutta kalıyor, tıklamalar yanlış yere gidiyor), sistematik gezinme **ayrı bir debug örneğinde** (`flutter run -d web-server --web-port=8092`, 8090'a dokunmadan) 360×780'de yapıldı. 5 rolün her alt sekmesi + her çekmece/“Daha Fazla” girişi açıldı, listelerde ilk satıra dokunulup detayın açıldığı kontrol edildi, Flutter konsolundaki tüm exception/overflow mesajları ekran bazında toplandı.
- **Formlar**: veritabanına yazmamak için "Kaydet/Gönder/Onayla/Sil" butonlarına canlıda **basılmadı**; bunların API çağrısı ve başarı/hata geri bildirimi kod taraması ile doğrulandı (web'de tüm `api.post/patch/put/delete`, mobilde tüm yazma çağrıları).
- **Tarama sırasında karşılaşılan iki şey** (sonuçları etkilediği için yazılı):
  1. Genel rate limit (300 istek/15 dk/IP) Patron hesabıyla ~12 mobil ekrandan sonra doldu, ekranlar "Bir hata oluştu" gösterdi (bkz. Güvenlik G-1). Taramanın geri kalanı için backend geçici olarak `NODE_ENV=test` ile (yalnızca genel limiti kapatır, kod değişikliği yok) çalıştırıldı; sonunda normal `npm run dev`'e dönüldü.
  2. Tarayıcı, Ayarlar ekranındaki ilk satır olan "E-posta bildirimleri" anahtarını owner ve personel1 için kapattı. İkisi de aynı kullanıcıların token'ıyla API üzerinden `emailEnabled: true` olarak geri alındı. Tarama sonunda Job/Message/Announcement/AuditLog/LeaveRequest/StaffRequest/Complaint tablolarında yeni kayıt olmadığı SQL ile doğrulandı.

---

## Bölüm 1 — Buton / bağlantı / aksiyon taraması

### 1.1 Kırık veya eksik bağlantılar (ciddiyet sıralı)

| # | Ciddiyet | Rol | Sayfa | Sorun | Kanıt |
|---|---|---|---|---|---|
| 1 | **Kritik** | Personel, Şef | Mobil Ana Sayfa | Ekran **tamamen boş** (debug). `app_theme.dart:107/118/240/251` Elevated/OutlinedButton için `minimumSize: Size.fromHeight(48)` = **sonsuz minimum genişlik**; bu butonlar doğrudan `Row` içinde olunca "BoxConstraints forces an infinite width" hatası verir ve layout kırılır. Release'de assert kapalı olduğu için çiziliyor ama davranış tanımsız. | Canlı: personel1 ve ekiplideri ana sayfası; hata kaynağı `dashboard_screen.dart:779` ("Avans Talep Et") ve `widgets/clock_card.dart:160` (Puantaj "Giriş Yap") |
| 2 | **Kritik** | Patron | Mobil Denetim & Ayarlar → Veri Silme Talepleri (KVKK) | Aynı kök neden: Onayla/Reddet butonları doğrudan `Row` içinde (`data_deletion_screens.dart:453, 467`). DB'de 1 PENDING talep var, bu butonlar çizilecek. | Kod okuma; kök neden yukarıda iki kez canlıda doğrulandı |
| 3 | Orta | Tümü | Web + mobil Bildirimler | Tıklanınca **hiçbir yere gitmeyen** bildirim türleri (aktif olarak üretiliyorlar): `LeaveRequest` (180 kayıt), `CustomerComplaint` (126), `DataDeletionRequest` (444), `Staff` (186), `Contract` (3), `StaffBonus` (1). `AppointmentRequest` yalnızca web'de eşlemesiz. | `web/src/lib/notifications.ts:getNotificationHref`, `mobile/.../notifications_screen.dart:_screenForRelatedType`; canlı: personel1 "İzin talebiniz onaylandı" → açılmadı |
| 4 | Düşük | Patron, Müdür | Mobil Müşteri Etiketleri | "Pasife al / Geri al" butonu API'yi try/catch olmadan çağırıyor; hata durumunda kullanıcıya geri bildirim yok (yakalanmamış exception). | `customer_tags.dart:498` |
| 5 | Düşük | Personel, Şef | Mobil Değerlendirmelerim | Kartlarda dönem adı yok, hepsi aynı tarihi (kaydın oluşturulma tarihi) gösteriyor → hangi döneme ait olduğu anlaşılmıyor. | Canlı ekran görüntüsü: 4 kart, hepsi "22 Eyl 2026" |
| 6 | Düşük | Tümü | Mobil Ayarlar | Anahtar satırlarında dokunma dalgası görünmüyor (ListTile, arka plan renkli bir DecoratedBox içinde). Flutter debug uyarısı. | Konsol: "ListTile background color or ink splashes may be invisible" |
| 7 | Düşük | Müdür | Mobil kabuk (web + fare) | Çentikli `BottomAppBar` fareyle üzerine gelindiğinde `Scaffold.geometryOf()` assertion'ı (yüzlerce kez). Dokunmatik cihazda tetiklenmez; bilinen Flutter davranışı. | Konsol: `mouse_tracker.dart:199` + "Scaffold.geometryOf() must only be accessed during the paint phase" |

### 1.2 Sorunsuz doğrulananlar

- **Web**: 5 rol × tüm Sidebar sayfaları (Patron 22, Müdür 19, Şef 13, Personel 10, Müşteri 7): **0 API hatası (4xx/5xx), 0 konsol hatası**, hata kutusu yok, hiçbir sayfa başka yere yönlenmedi.
- **Web butonları**: `onClick`'siz/boş `<button>` yok (bulunan 5 aday, regex'in `page > 1` içindeki `>` işaretinde kesilmesinden kaynaklı yanlış pozitif). Tüm yazma çağrıları başarıda toast/yenileme, hatada `setError`/toast veriyor (doğrudan veya `run()`/`ReasonModal` üzerinden).
- **Mobil navigasyon**: her rolün tüm alt sekmeleri ve çekmece/“Daha Fazla” girişleri doğru ekranı açtı. Patron: 5 sekme + 22 giriş, Müdür: 4 + 19, Şef: 4 + 10, Personel: 4 + 8, Müşteri: 5 + 9.
- **Liste → detay**: İşler, Onaylar, Bildirimler, Müşteriler, Personel, Teklifler, Sözleşmeler, İş Şablonları, Müşteri Etiketleri, Şikayetler ve Mesajlar listelerinde ilk satır detayı açtı.
- **Mobil yazma çağrıları**: yazma çağrılarının hepsi try/catch + SnackBar/`_error` ile geri bildirim veriyor; tek istisna #4.

---

## Bölüm 2 — Veri doğruluğu

### 2.1 Hesaplamalar: API ile bağımsız SQL karşılaştırması

| Alan | Sonuç |
|---|---|
| Net kâr = bu ay tahsilat − aktif maaş tabanı − bu ay gider | ✓ 10.673 − 314.500 − 30.217 = **−334.044** (API ile birebir) |
| Bu ay / geçen ay tahsilat, tahsilat sayısı, bekleyen avans | ✓ 10.673 / 30.562 / 6 / 4.000 |
| Dashboard özeti (bugünkü iş, tamamlanan/iptal, yeni teklif, bekleyen rapor, aktif personel, tamamlama oranı) | ✓ 6 / 5 / 4 / 5 / 14 / 14 / %55,6 |
| Stok tükenme tahmini (21 ürün) | ✓ 21/21 eşleşti |
| İzin bakiyesi (14 personel) | ✓ 14/14 eşleşti (ama bkz. V-6) |
| Bordro (3 personel × 3 ay) | ✓ 9/9 eşleşti |
| Prim (değerlendirme dönemleri) | ✓ Eşiği geçen değerlendirme sayısı = oluşan prim sayısı (2 ve 3), tutarlar dönem tutarıyla aynı |

### 2.2 Bulgular

| # | Ciddiyet | Bulgu |
|---|---|---|
| V-1 | **Yüksek** | **Veritabanında test artığı veriler var.** 29–30 Ağustos'tan kalma 16 aktif test kullanıcısı (`staff_1788…@`, `Test Manager`, `E2E Staff`, `Staff B`…). 14 aktif personelin **7'si** testten; maaş yükünün **157.000 ₺'si** (314.500'ün yarısı) bunlara ait. Bu yüzden net kâr, "0/14 sahadaki personel", Şef'in ekip listesi ("Test Staff") ve Mesajlar'daki "Test Owner" yanlış görünüyor. Ayrıca 7 test adlı iş var. |
| V-2 | **Yüksek** | **Backend testleri gerçek kullanıcılara bildirim sızdırıyor.** `notifyManagement` ve Patron bildirimleri, testte oluşturulan kayıtlar için gerçek `owner@`/`manager@` kullanıcılarına bildirim yazıyor; cleanup yalnızca test kullanıcılarının bildirimlerini siliyor. Sonuç: Patron'da **1.210 okunmamış bildirim** (6 günde 954 "Yeni teklif talebi"), bunların hedef kayıtları silinmiş durumda. Bugünkü StaffRequest test koşusu da owner'a 6 bildirim bıraktı. |
| V-3 | Orta | **Açık bakiye negatif**: genel `totalOutstandingBalance` **−287.866 ₺**, 32 müşterinin **27'sinin** bakiyesi negatif. İki neden var: (a) demo ödemeleri (24 aylık trend için üretilmiş) işlere bağlı değil, müşteriler fatura edilenin 3–40 katı ödemiş görünüyor; (b) **formül hatası**: `paymentsController` ve `customersController` iptal edilen işlerin fiyatını da borca sayıyor (şu an 9.669 ₺). |
| V-4 | Orta | **Süresi geçmiş sözleşmeler ACTIVE kalıyor** (3 sözleşme; bitiş 1, 4 ve 15 Eylül). Otomatik EXPIRED geçişi yok. Daha önemlisi, `cron.ts:generateRecurringJobs` ne `status` ne `endDate` filtresi uyguluyor: 2026-09-04'te biten bir sözleşme **2026-11-20'de yeni iş üretecek** (DB'de mevcut kayıt). |
| V-5 | Orta | **Net kâr gerçekçi değil**: ayın ortasında kısmi tahsilat ile tam aylık maaş karşılaştırılıyor, ay başında her zaman büyük negatif çıkar. Demo ölçeği de tutarsız: aylık tahsilat 10–55 bin ₺, maaş yükü 314 bin ₺ → kâr marjı **−%3130**. |
| V-6 | Orta | **Çakışan izin çift sayılıyor**: personel1'de aynı tarihli (16–18 Eyl) iki onaylı izin var. Bakiye 3 gün yerine 6 gün düşüyor (kalan 11 yerine 8). İzin oluştururken çakışma kontrolü yok, hesap da tekrarı ayıklamıyor. |
| V-7 | Orta | **"Sahadaki personel" iş durumuyla senkron değil**: 5 iş IN_PROGRESS iken gösterge 0. Değer, elle güncellenen `Staff.status` alanından okunuyor. Ayrıca 1–2 gündür "Devam Ediyor"da kalan 5 iş ve 7 gecikmiş açık iş var; bunlar için bir uyarı yok. |
| V-8 | Düşük | **Stok defteri tutarsız**: 21 ürünün hiçbirinde `currentStock` = Σ(giriş − çıkış) değil (demo'da açılış hareketi yok). Ekranda koşan bakiye gösterilmediği için görünmüyor, ancak denetim/mutabakat yapılamaz. Negatif stok: **yok** ✓. |
| V-9 | Düşük | Avans, bordroya talep tarihiyle (`createdAt`) giriyor. `AdvanceRequest`'te onay tarihi alanı yok: ay sonunda istenip ertesi ay onaylanan avans önceki ayın bordrosuna düşer. |

### 2.3 Tarih ve saat dilimi

- **Orta — üretimde saat dilimi tanımlı değil**: `backend/Dockerfile` ve `docker-compose.prod.yml`'de `TZ` yok, konteyner UTC çalışır. Geliştirme ortamı İstanbul'da (DB ve Node). Ay sınırları (tahsilat özeti, bordro, izin yılı, cron zamanları) üretimde 3 saat kayar: ayın 1'inde 00:00–03:00 arası alınan tahsilat önceki aya yazılır.
- **Düşük — tarih-only alanlar karışık saklanıyor**: web `"YYYY-MM-DD"` gönderiyor, bu UTC gece yarısı (03:00 TR) olarak saklanıyor. Mobil 16 yerde `toIso8601String()` ile offset'siz yerel saat gönderiyor, sunucu bunu kendi saat dilimine göre yorumluyor. Aynı gün, web ve mobilde farklı anlara yazılıyor. Tohum verisinde de Expense/Contract tarihleri rastgele saatlerde.

### 2.4 Demo veri yeterliliği

| Durum | Tablolar ve etkilenen ekran |
|---|---|
| **Boş (0 kayıt)** | StaffRequest (Taleplerim / Personel Talepleri), AttendanceRecord (Puantaj), VehicleMaintenance, StaffCertification, **JobPhoto + PestDetection** (AI Analiz boş, işlerde fotoğraf yok), AppointmentRequest (Randevu Taleplerim), Announcement (duyuru şeridi), OnboardingChecklistItem, StaffUnavailability, **JobReportProduct** (saha raporları ürün tüketimi göstermiyor) |
| **Çok az** | LeaveRequest 2 (ikisi de "QA taraması testi", çakışan), Conversation 2 / Message 5, CustomerDocument 1, StockPurchaseRequest 1, Supplier 3, CustomerTag 3 |
| Yeterli | Job 99, Payment 238, Customer 32, QuoteRequest 30 (5 durumda dağılmış), Contract 18, Evaluation 27, Product 21, Expense 24, JobTemplate 6 |

---

## Bölüm 3 — Güvenlik ve yetki

| # | Ciddiyet | Bulgu |
|---|---|---|
| G-1 | **Yüksek** | **Genel rate limit tüm API için 300 istek / 15 dk / IP** (`app.ts:77`). Tek bir Patron, mobilde ~12 ekran gezdikten sonra 429 aldı (bu turda web taraması da aynı IP'den paralel çalışıyordu). Ofis NAT arkasında tüm çalışanlar aynı kovayı paylaşır, yoğun saatte herkes kilitlenir. Mobil uygulama 429'u ayırt etmiyor, genel "Bir hata oluştu" gösteriyor. (Giriş limitleri IP+e-posta ile tutulduğu için paylaşılmıyor, bu sorun yalnızca genel limitte.) |
| G-2 | Orta | **RBAC matrisinde eksik uçlar** (`rbac.test.ts`). Aşağıdaki yazma uçları için **hiçbir testte 403 kontrolü yok**. Kod değiştirme yasağı nedeniyle eklenmedi; eklenecek satırlar hazır: |

```ts
{ method: "get",    path: "/suppliers",               allowed: ["OWNER", "MANAGER"] },
{ method: "post",   path: "/suppliers",               allowed: ["OWNER", "MANAGER"], body: {} },
{ method: "patch",  path: `/suppliers/${NIL}`,        allowed: ["OWNER", "MANAGER"], body: {} },
{ method: "delete", path: `/suppliers/${NIL}`,        allowed: ["OWNER", "MANAGER"] },
{ method: "post",   path: "/districts",               allowed: ["OWNER"], body: {} },
{ method: "delete", path: `/districts/${NIL}`,        allowed: ["OWNER"] },
{ method: "post",   path: "/service-types",           allowed: ["OWNER"], body: {} },
{ method: "delete", path: `/service-types/${NIL}`,    allowed: ["OWNER"] },
{ method: "get",    path: "/sessions/report",         allowed: ["OWNER"] },
{ method: "get",    path: "/pest-detections",         allowed: ["OWNER", "MANAGER", "TEAM_LEAD", "STAFF"] },
```

StaffRequest'in 4 ucu matriste var. PestDetection'ın kapsam ve CUSTOMER 403 kontrolü kendi test dosyasında (`pestDetection.test.ts`) var, yalnızca matriste yok.

### 3.1 Kapsam denemeleri (canlı, curl): 27 deneme, 0 sızıntı ✓

- **Personel → başka personelin verisi**: iş, izin bakiyesi, profil, saha raporu, avans, atanmadığı müşteri, müşteri belgesi dosyası → hepsi 403/404. Tahsilat ve gider listeleri → 403.
- **Müşteri → başka müşterinin verisi**: iş, müşteri kaydı, ödeme, sözleşme, belge listesi, belge dosyası → hepsi 403/404. Personel listesi, personel talepleri, AI analizleri → 403.
- **Listelerde yabancı kayıt yok**: personel işleri (14), müşteri işleri (4), ödemeleri (8), sözleşmeleri (1), şikayetleri (2), izinler, talepler, AI analizleri.

### 3.2 Dosya servisi ✓

- Statik `/uploads` servisi yok. Tüm dosyalar `GET /files/:type/:id` üzerinden, 4 tipte kayıt bazlı yetkiyle sunuluyor.
- `lib/upload.ts` diske geçici yazıp `persistFile` (storage) üzerinden kaydediyor; storage katmanı atlanmıyor.
- Yeni PestDetection özelliği görseli `/files/job-photo/:id` üzerinden veriyor; token'sız yol açılmamış.

### 3.3 Tek giriş sonrası route guard'lar ✓

- **Web**: middleware yalnızca token varlığını kontrol ediyor; 20 sayfa `RequireRole` ile korunuyor. Korumasız 5 sayfa (/, bildirimler, isler, mesajlar, takvim) zaten tüm rollere açık. Sidebar rolleri, `RequireRole` ve backend birbiriyle tutarlı.
- **Mobil**: `RoleShell` yalnızca sunucudan dönen rolü kullanıyor.

---

## Bölüm 4 — Tasarım ve UX tutarlılığı

| # | Ciddiyet | Bulgu |
|---|---|---|
| U-1 | **Orta** | **Web 360px'te yatay taşma (gerileme)**: `web/src/app/(dashboard)/layout.tsx:21` içerik sütununda (`flex flex-1 flex-col`) `min-w-0` yok. Geniş bir tablo veya grafik tüm sütunu kendi genişliğine çekiyor, `Table`'daki `overflow-x-auto` devreye giremiyor. Sayfa ilk kez 360px'te açıldığında ölçülen taşmalar: Stok +1098px, Sözleşmeler +673, Performans +554, Para +422, Müşteriler +411, Kullanım İstatistikleri +328, Loglar +158, Personel +122, Mesajlar +110, Ayarlar +68. Tablo/grafik içermeyen sayfalar (Ana Sayfa, Bildirimler, Yönetici Özeti) taşmıyor. |
| U-2 | **Orta** | **Karanlık modda düşük kontrast**: `--primary-700` karanlık temada yeniden tanımlanmamış (47 82 51), `--primary-50` ise koyu (24 42 29). `text-primary-700` + `bg-primary-50` çifti **1,71:1** kontrast veriyor (WCAG en az 4,5:1). 44 kullanım var, yeni `StaffRequestsView` kategori rozeti de dahil. |
| U-3 | Düşük | **Mobil 360px**: Bildirimler ekranında 29px `RenderFlex` taşması; istatistik kartında "Okunmamış" kelimesi "Okunmamı / ş" diye bölünüyor. Diğer rollerin 360px'te gezilen ekranlarında (Patron 28, Müdür 24, Şef 15, Müşteri 15) taşma hatası yok. |
| U-4 | Düşük | **Sistem Durumu'nda yükleme durumu yok**: veri gelene kadar tüm kutucuklar sarı "uyarı" rengi ve "—" gösteriyor, sistem bir an sorunlu görünüyor. |
| U-5 | Düşük | Mobil gömülü kartlar (izin bakiyesi, değerlendirme trendi, onboarding) hata durumunda sessizce kayboluyor (`SizedBox.shrink`), kullanıcı hatayı fark etmiyor. |
| U-6 | Düşük | Mobil 429 yanıtını "Bir hata oluştu" olarak gösteriyor, "çok fazla istek, biraz bekleyin" demiyor (bkz. G-1). |

**Tutarlı bulunanlar**
- **Web**: 25 sayfanın tamamında yükleme (LoadingBlock, `Table`/`ChartCard` `loading`), boş durum ve hata durumu var. Tek istisna U-4. Taleplerim ve Personel Talepleri ortak bileşenleri kullanıyor.
- **Mobil**: veri yükleyen 52 ekranın 43'ü `LoadingView`/`ErrorRetryView`/`EmptyStateView` kullanıyor. Kalan 9'u form ekranı ya da gömülü kart (U-5).
- **Karanlık mod, yeni ekranlar (kod seviyesi)**: web Talep ekranları ve giriş sayfası tema token'ları kullanıyor (U-2'deki rozet hariç). Mobil Talep ekranı `context.colors` kullanıyor. Giriş ekranındaki sabit beyazlar yeşil marka bandında bilinçli olarak kullanılmış.

### 4.4 Logo kayması — **düzeltildi**

- **Kök neden**: `_BrandHeader` içindeki `Padding`, `Stack`'in konumlandırılmamış çocuğu olduğu için bant yüksekliği kadar gevşek kısıt alıyor. İçteki `Column` varsayılan `mainAxisSize.max` ile ~190px'e uzuyor, `Row` da 52px logoyu bu yüksekliğin ortasına indiriyordu.
- **Düzeltme**: `mobile/lib/auth/login_screen.dart`'ta ilgili `Column`'a `mainAxisSize: MainAxisSize.min` eklendi.
- **Doğrulama**: Flutter'ın kendi penceresinde (1536px) ve 360px'te logo başlıkla aynı hizada. `flutter test test/auth` geçiyor; `dart analyze` yeni uyarı vermiyor.

---

## Bölüm 5 — Geliştirme önerileri (uygulanmadı)

| # | Öneri | Ne işe yarar | Fayda sağlayan | Kapsam |
|---|---|---|---|---|
| 1 | **Biyosidal uygulama belgesi (PDF)** | Saha raporundan otomatik "Uygulama Belgesi": ürün ruhsat no, etken madde, doz, uygulama alanı, uygulayıcı sertifikası, müşteri imzası. Mevzuatın istediği kaydı elle tutma yükünü kaldırır, müşteriye anında gönderilir. | Patron, Personel, Müşteri | Orta (JobReportProduct verisi ve imza hazır) |
| 2 | **Tuzak/istasyon QR takibi** | Ticari müşterilerdeki yem istasyonlarına QR etiket. Ziyarette taranır, aktivite (tüketim/yakalama) girilir, istasyon bazlı trend oluşur. HACCP/BRC denetimlerinde istenen kayıt budur ve kurumsal müşteri kazanmada fark yaratır. | Personel, Patron, kurumsal Müşteri | Büyük |
| 3 | **SMS/WhatsApp randevu hatırlatma + onay/erteleme linki** | Randevudan bir gün önce mesaj; müşteri tek tıkla onaylar veya erteleme ister. Boşa giden ziyaretleri azaltır. SMTP deseni gibi "yapılandırılmamışsa sessizce atla" ile eklenebilir. | Müşteri, Müdür | Orta |
| 4 | **Günlük rota planlama ve harita** | Personelin günlük işlerini mesafeye göre sıralama, tek dokunuşla harita yol tarifi, Şef için ekip haritası. Yakıt ve zaman tasarrufu sağlar. | Personel, Şef | Orta |
| 5 | **Çevrimdışı saha modu** | Bodrum/çatı gibi çekim olmayan yerlerde saha raporu, fotoğraf ve imzayı kuyruğa alıp bağlantı gelince gönderme. Şu an bağlantı yoksa rapor kaybolur. | Personel | Büyük |
| 6 | **İş/hizmet bazında kârlılık** | Ürün tüketimi × birim maliyet + işçilik süresi ile her işin ve hizmet türünün gerçek kârı. Fiyatlandırma kararları için. (Önkoşul: V-3/V-5 düzeltmeleri ve ürün birim maliyeti alanı.) | Patron | Orta |
| 7 | **Online ödeme linki + e-Arşiv fatura** | Açık bakiyeye iyzico/PayTR ödeme linki; tahsilatta otomatik e-Arşiv fatura (entegratör). Tahsilat süresini kısaltır, muhasebe yükünü azaltır. | Patron, Müşteri | Büyük |
| 8 | **Sözleşme yenileme hunisi** | Bitişe 60/30/7 gün kala otomatik yenileme teklifi, "yenilenmedi → kayıp müşteri" raporu. Mevcut hatırlatmaların satış tarafı. (V-4 ile birlikte ele alınabilir.) | Patron, Müdür | Küçük–orta |
| 9 | **Konum doğrulamalı puantaj/varış** | Puantaj girişinde ve "işe başla"da iş adresine yakınlık kontrolü, müşteriye "ekibimiz yolda" bildirimi. KVKK açık rıza metni gerekir. | Şef, Patron, Müşteri | Orta |

---

## Özet: öncelik önerisi

1. **Hemen** (küçük, etkisi büyük): Bölüm 1 #1–2 (tema butonlarında `minimumSize`), U-1 (`min-w-0`), V-4 (cron'a `status`/`endDate` filtresi), G-1 (limit değeri ve 429 mesajı).
2. **Veri temizliği**: V-1 (test artıkları), V-2 (test bildirim sızıntısı ve mevcut ~3.600 bildirim), ardından V-3/V-5 için tutarlı demo verisi ve iptal edilen işleri hariç tutan formül.
3. **Sonra**: Bölüm 1 #3 (bildirim yönlendirmeleri), V-6 (izin çakışması), V-7, 2.3 (TZ), U-2, G-2 (RBAC satırları).
