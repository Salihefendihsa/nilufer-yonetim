# Stitch → Mevcut Sistem Özellik Matrisi

## Genel Durum Özeti

Bu belge dört Stitch paketini kapsar:

1. **Patron (OWNER) paketi** — `stitch_nil_fer_i_la_lama_mobil_paneli_patron.zip`, **15 ekran** (§1-§15).
2. **Müdür (MANAGER) paketi** — `stitch_pest_control_manager_ui_mudur.zip`, **16 ekran dosyası = 15 sayfa** (bkz. "Faz 6").
3. **Şef (TEAM_LEAD) paketi** — `stitch_pest_control_team_lead_ui_ef.zip`, **8 ekran = 7 sayfa** (bkz. "Faz 8").
4. **Personel (STAFF) paketi** — `stitch_nil_fer_staff_mobile_app_personel.zip`, **8 ekran dosyası = 6 sayfa** (bkz. "Faz 9").

**Durum:** Her iki paketin de tüm ekranları backend + web + Flutter üçlüsünde gerçek
API'ye bağlıdır; hiçbir sekme/menü `ComingSoonScreen` veya sahte/statik veri değildir.

- **Patron paketi (Faz 1-5)**: 15 ekranın 14'ü tam bağlı, 1'i (Finans) kısmen — çekirdek
  işlev tam, yalnızca aylık trend **alan grafiği** bilinçli olarak kapsam dışı bırakıldı.
- **Müdür paketi (Faz 6)**: 15 sayfanın hepsi bağlı. Kategori A (yalnızca görsel/navigasyon)
  = 5 ekran, Kategori B (yeni özellik, uçtan uca uygulandı) = 10 ekran,
  **Kategori C (yetki çelişkisi) = 0 ekran** — Stitch'in müdür tasarımı mevcut yetki
  haritasıyla çelişmiyor (ayrıntılı doğrulama tablosu Faz 6 bölümünde).
- **Şef paketi (Faz 8)**: 7 sayfanın hepsi bağlı. Kategori A = 1 ekran (Ayarlar),
  Kategori B = 7 ekran, **Kategori C = 0 ekran uygulandı** — Stitch'in şef tasarımındaki
  yetki dışı öğeler (stok talebi, DESIGN.md'nin farklı çekmece listesi, canlı konum,
  sesli mesaj) koda **girmedi**, ayrı bölümde belgelendi.
- **Personel paketi (Faz 9)**: 6 sayfanın hepsi bağlı. Kategori A = 4 ekran (Takvim,
  Bildirimler, Mesajlar, Ayarlar — zaten var olan genel ekranlar), Kategori B = 2 ekran
  (Ana Sayfa, İşler, ikisi de uçtan uca doğrulandı), **Kategori C = 0 ekran uygulandı** —
  QR Kod Tara ve SMS Bildirimleri **[her ikisi de KAPSAM DIŞI]** koda girmedi. Ayrıca
  Stitch'ten bağımsız, önceden var olan bir personel maaş sızıntısı (`GET /staff`,
  `GET /staff/:id`) bu fazda kapatıldı. **Kod/karar tarafı tamamlandı**; yalnızca
  Ali Kaya (STAFF) hesabıyla telefonda görsel/dokunsal ekran turu, cihaz Wi-Fi'ye
  bağlı olmadığı için (2026-09-10 itibarıyla hâlâ mobil veride) **beklemede** —
  işlevsellik curl ile uçtan uca doğrulanmış durumda.
- **Açık sorular: YOK (kod/karar tarafında).** Faz 1-7'den gelen 16 maddenin tamamı
  (7 uygulandı, 8 kapsam dışı, 1 onaylandı), Faz 8'de açılan 3 madde (**1 uygulandı**:
  şefin stok takviye talebi; **2 kapsam dışı**: sesli mesaj, "Şef Notu") ve Faz 9'da
  açılan 3 madde (**2 kapsam dışı**: QR Kod Tara, SMS Bildirimleri; **1'i görsel
  doğrulama beklemede**: Ali Kaya telefon turu) karara bağlandı.

**Tek cümlelik özet**: Dört rolün tasarım seti de gerçek veriyle uçtan uca çalışır
durumda; kod/karar tarafında açık soru kalmadı, yalnızca Faz 9'un telefon üzerinde
görsel teyidi cihazın Wi-Fi'ye bağlanmasını bekliyor.

### Açık Soruların Durumu (16 maddenin tamamı)

Bu tablo tek doğruluk kaynağıdır; özetlerde sayı vermeden önce buradan sayın.

| # | Madde | Durum | Nerede |
|---|---|---|---|
| 1 | Gider (Expense) modeli | Kapsam dışı | Faz 7 — ertelendi; net kâr `tahsilat − personel maaş tabanı` olarak kalır |
| 2 | Teklif → Sözleşme otomatik dönüşümü | Kapsam dışı | Faz 7 — ertelendi; `convertQuote` yalnızca `Customer` oluşturur, sözleşme/iş manuel |
| 3 | Personel günlük kapasitesi | Uygulandı | Faz 6 — `Staff.dailyJobCapacity` (personel bazlı, opsiyonel; tanımsızsa gösterge gizlenir) |
| 4 | Performans hedefi | Uygulandı | Faz 6 — `Setting.monthly_job_target`, `lib/targets.ts` |
| 5 | SMS / e-fatura entegrasyonu | Kapsam dışı | Faz 7 — sağlayıcı seçimi yapılmadı |
| 6 | QR/barkod istasyon tarama | Kapsam dışı | Faz 7 — istasyon/trap modeli yok |
| 7 | İş numarası formatı | Uygulandı | Faz 6 — `Job.sequenceNo` (autoincrement) |
| 8 | Manuel (işe bağlı olmayan) stok çıkışı | Uygulandı | Faz 7 — fiili sayım mutabakatı (`POST /products/:id/count`) işe bağlı olmayan azalışı da kayda geçirir |
| 9 | Şube kavramı | Kapsam dışı | Faz 7 — `Customer.district` yeterli |
| 10 | Canlı GPS / harita takibi | Kapsam dışı | Faz 7 — konum altyapısı ayrı kapsam |
| 11 | Barkod / karekod tarama | Kapsam dışı | Faz 7 — istasyon/etiket modeli yok |
| 12 | Stok sayımı / mutabakat | Uygulandı | Faz 7 — `POST /products/:id/count` |
| 13 | Teklif öneri bütçesi / risk skoru | Kapsam dışı | Faz 7 — tanımlı formül yok |
| 14 | Teklif "Tarihçe" sekmesi | Uygulandı | Faz 7 — `GET /quotes/:id/history` |
| 15 | Bildirim sesi / titreşim (FCM) | Kapsam dışı | Faz 7 — push altyapısı yok |
| 16 | "%94 Başarı" formülü | Onaylandı | Faz 6 varsayımı kullanıcı tarafından kabul edildi: `tamamlanan / (tamamlanan + iptal)`, sonuçlanan iş yoksa `null` |

---

Bu doküman, `references/stitch/stitch_nil_fer_i_la_lama_mobil_paneli_patron/` altındaki **15 ekranın** (`code.html` + `screen.png`, doğrulandı: ZIP'te tam 15 çift var, bkz. §"Ekran Sayısı Doğrulaması") ve `field_bio_command/DESIGN.md` tasarım sisteminin, mevcut backend (`backend/`) ve web (`web/`) koduyla karşılaştırmasıdır. Kaynak: her iki tarafta da gerçek dosya okumasıyla doğrulanmıştır (bkz. her satırın "Doğrulama" sütunu). Stitch dosyaları **statik HTML prototipleridir** — hiçbirinde gerçek API çağrısı yoktur; tüm sayılar/isimler/yüzdeler tasarım örneğidir, gerçek veri değildir.

**Durum kodları (özellik olgunluğu)**: `Mevcut` = backend+web'de zaten çalışıyor, sadece Flutter'a taşınacak · `Kısmi` = altyapı var ama Stitch'in gösterdiği ayrıntı eksik · `Yeni` = backend'de hiç karşılığı yok, gerçek özellik olarak eklenmesi gerekiyor · `Belirsiz` = iş kararı gerektiriyor, açık soru olarak bırakıldı.

**Katman durumu (her modül için ayrı ayrı izlenir — bunları birbirine karıştırmayın)**:
- **Alan eklendi**: Yalnızca Prisma şemasında/veritabanında bir sütun/enum var. Hiçbir API davranışı, form veya ekran bunu henüz kullanmıyor olabilir.
- **API bağlandı**: Bir controller/endpoint bu alanı gerçekten okuyor/yazıyor, iş kuralı uyguluyor (zorunlu kontrol, hesaplama, bildirim vb.).
- **Arayüz bağlandı**: Web veya Flutter ekranında gerçek bir form/liste/aksiyon bu API'ye bağlı, kullanıcı gerçekten kullanabiliyor.
- **Uçtan uca doğrulandı**: Gerçek veritabanına karşı çalıştırılıp (script/tsc/test ile) sonucu gözlemlendi — bu oturumda yalnızca bunu iddia ettiğim yerlerde script çıktısı vardır.

Bir satırda "Alan eklendi" yazıyorsa bu **özelliğin tamamlandığı anlamına gelmez** — sadece ilk adımdır. `ComingSoonScreen` gösteren bir Flutter sekmesi de "tamamlanmış ekran" sayılmaz; yalnızca o modülün Faz sıramıza göre henüz bağlanmadığını gösterir.

Bu doküman canlı bir belgedir; her modül tamamlandıkça güncellenir. Son güncelleme: Faz 1-2 (altyapı + Komuta Merkezi) + iş durumu/personel durumu/bildirim bağlantısı düzeltmeleri.

---

## Ekran Sayısı Doğrulaması

Kullanıcı, sağlanan ZIP'te 15 `code.html`/`screen.png` çifti olduğunu belirtti; önceki ilerleme mesajımda sözlü olarak "14 ekran" denmişti. Bu, **yalnızca sohbet metnindeki bir sayım hatasıydı** — doğrulama:

```
unzip -l stitch_..._patron.zip | grep code.html   → 15 satır
find references/stitch -iname "code.html" | wc -l → 15
find references/stitch -iname "screen.png" | wc -l → 15
```

Matrisin kendisi (aşağıdaki §1-§15) baştan beri **15 ekranın tamamını** kapsıyordu — hiçbir ekran atlanmamıştı: Ana Sayfa, Bekleyen Onaylar, İşler, Müşteriler, Sözleşmeler, Teklifler, Personel, Takvim, Stok, Para&Finans, Bildirimler, Mesajlar, Performans, Raporlar, Denetim Logları&Ayarlar = 15. `field_bio_command/DESIGN.md` ayrı bir "§0 Tasarım Sistemi" olarak tutulur ve bu 15'e dahil edilmez (tasarım token'ları, bir ekran değil).

---

## Bu Oturumda Tamamlanan / Düzeltilen İşler (Katman Bazlı)

| Özellik | Backend | Web | Flutter |
|---|---|---|---|
| İş durumu geçiş kuralları (PENDING→SCHEDULED→IN_PROGRESS→COMPLETED, CANCELLED her aşamadan) | **Uçtan uca doğrulandı** — `isValidStatusTransition`, eşzamanlılık kilidi (`applyJobUpdate`), idempotent tamamlama, script ile test edildi (gerçek süre hesaplandı, tekrar istekte completedAt değişmedi, yarış durumunda tam 1 istek uygulandı) | **Arayüz bağlandı** — `web/src/lib/jobStatus.ts` aynı tabloyu paylaşıyor, dropdown yalnızca geçerli sonraki durumları gösteriyor | **Arayüz bağlandı** — `mobile/lib/models/job.dart:validJobStatusTransitions` aynı tablo; İş Detayı ekranında STAFF için "Rotayı Başlat"/"Tamamla" butonları, yönetim için geçerli sonraki durum çipleri |
| `Job.startedAt` (gerçek başlama zamanı) | **API bağlandı** — yalnızca gerçek `IN_PROGRESS` geçişinde set edilir, `COMPLETED`'a geçişte geriye dönük DOLDURULMAZ | Dolaylı (dropdown'dan IN_PROGRESS seçilebiliyor) — Stitch'teki özel "Rotayı Başlat" CTA'sı yok | **Arayüz bağlandı** — İş Detayı ekranı gerçek `actualDuration`'ı gösteriyor, ikisi de yoksa "bilinmiyor" yazıyor (sahte süre UYDURULMUYOR) |
| İş tamamlama/iptal audit log | **API bağlandı** — `recordJobStatusAuditLog`, yalnızca atanmış personeli olan işler için (audit log şeması targetUserId zorunlu tutuyor) | — | — |
| `Staff.status` / `statusUntil` (müsaitlik/mola/izin) | **Uçtan uca doğrulandı** — `PATCH /staff/:id/status`, süresi dolan durumları sıfırlayan cron (5dk) + okuma anında kendiliğinden düzeltme, STAFF'ın kendi kendine ON_LEAVE/ON_JOB seçmesi engellendi, durum değişikliği audit loglanıyor | **Yeni** — personel sayfası bu alanları hiç göstermiyor/güncellemiyor | **Yeni** |
| `Product.category` (biyosidal/sarf/ekipman) | **Alan eklendi** + liste filtresi (`?category=`) — **tam ekipman yönetimi DEĞİL**: seri no, zimmet, bakım takibi gibi hiçbir ekipmana özgü alan/iş kuralı yok, sadece bir sınıflandırma etiketi | **Yeni** — stok formunda kategori seçimi yok | **Yeni** |
| `Contract.amount` (dönem ücreti) | **Alan eklendi** — hiçbir hesaplama/rapor bu alanı henüz kullanmıyor | **Yeni** | **Yeni** |
| `QuoteRequest.amount` (teklif fiyatı) | **Alan eklendi** — **tamamlanmış bir fiyatlandırma/onay akışı DEĞİL**: fiyatı girecek form yok, onay durumuna hiçbir etkisi yok, sadece boş duran bir sütun | **Yeni** | **Yeni** |
| `Notification.relatedType/relatedId` (ilgili kayda yönlendirme) | **Uçtan uca doğrulandı** — iş tamamlama, kritik stok, avans talebi, teklif talebi bildirimlerinde dolduruluyor | **Arayüz bağlandı** — `getNotificationHref()` ile bildirime tıklayınca ilgili LİSTE ekranına yönlendiriyor (belirli kaydı otomatik seçip vurgulamıyor — bu ince bir sonraki adım); hedef ekranın kendi API çağrısı kendi yetki/kapsam kontrolünü zaten uyguluyor, ekstra kontrol eklenmedi çünkü gerekmiyor | **Yeni** — Bildirimler ekranı henüz kurulmadı |

## Faz 3: Müşteriler / Personel / İşler / Takvim (Flutter)

Bu modüller gerçek API'lere bağlandı (backend/web zaten mevcuttu, bu turda değişmedi — yalnızca Flutter tarafı eklendi):

| Ekran | Flutter durumu | Bilinen sınırlamalar (uydurulmadı, açıkça not edildi) |
|---|---|---|
| Müşteriler | **Arayüz bağlandı** — liste (arama+sayfalama), detay (İşler/Sözleşmeler/Ödemeler sekmeleri), oluştur/düzenle formu (`customers_list_screen.dart`, `customer_detail_screen.dart`, `customer_form_screen.dart`) | STAFF için ödeme/bakiye sekmesi backend zaten veriyi çıkardığı için "kilitli" gösteriliyor; ayrı bir yetki kontrolü Flutter'da tekrarlanmadı (tek doğruluk kaynağı backend) |
| Personel | **Arayüz bağlandı** — liste (durum rozeti ile), detay (durum değiştirme, sertifikalar) (`staff_list_screen.dart`, `staff_detail_screen.dart`) | Sertifikalar yalnızca OWNER/MANAGER için çekiliyor çünkü `GET /staff/:id/certifications` backend'de zaten (bu oturumdan önce) yalnızca bu rollere açık — personelin KENDİ sertifikalarını görememesi önceden var olan bir backend kısıtı, bu turda değiştirilmedi (kapsam dışı, açık soru olarak not edildi) |
| İşler | **Uçtan uca doğrulandı** — liste (durum filtresi **+ arama kutusu**, backend'e `GET /jobs?search=` eklendi: müşteri adı/hizmet türünde arar, curl ile "Genel" araması 5 sonuç döndürdüğü doğrulandı), detay (durum geçişi, rapor+imza, fotoğraf, **TEAM_LEAD personel yeniden atama** — `PATCH /jobs/:id {assignedStaffId}` gerçek bir TEAM_LEAD hesabıyla (ekiplideri@nilufer.com) uçtan uca test edildi ve geri alındı), oluşturma formu (`jobs_list_screen.dart`, `job_detail_screen.dart:_ReassignStaffCard`, `job_form_screen.dart`) | Web `isler` sayfasına da aynı arama kutusu eklendi (`isler/page.tsx`, 400ms debounce) |
| Takvim | **Arayüz bağlandı** — aylık ısı haritası + seçili gün iş listesi, web'deki aynı mantık (`calendar_screen.dart`) | Ekip filtresi (OWNER/MANAGER için personel seçimi) yok, yalnızca backend'in role göre zaten filtrelediği liste gösteriliyor |

## Faz 4: Stok / Teklifler / Sözleşmeler / Finans / Onaylar

| Modül | Backend | Web | Flutter |
|---|---|---|---|
| Stok | **API bağlandı** — `GET /products/:id/movements` eklendi (Stitch "Son Depo Hareketleri" karşılığı), `product.restock`/`product.delete` artık audit loglanıyor | **Arayüz bağlandı** — `ProductFormModal`'a kategori seçimi, `stok` sayfasına kategori filtre çipleri + kategori sütunu eklendi | **Arayüz bağlandı** — liste (kategori filtresi, kritik stok göstergesi), stok girişi (bottom sheet), yeni ürün formu, **hareket geçmişi ekranı** (`stock_movements_screen.dart`, ürün kartındaki "Hareketler" butonundan açılır) |
| Teklifler | **API bağlandı** — `convertQuote` artık eşzamanlılık kilitli (iki eşzamanlı dönüştürme isteğinde yalnızca biri uygulanır, transaction içinde), `quote.update`/`quote.convert` audit loglanıyor | **Arayüz bağlandı** — fiyat girme/gösterme alanı + "Revize Edilecek" durumu eklendi (`teklifler/page.tsx`) | **Arayüz bağlandı** — durum filtresi, fiyat girme (dialog), dönüştürme aksiyonu (`quotes_list_screen.dart`) |
| Sözleşmeler | **API bağlandı** — `contract.create`/`contract.update` audit loglanıyor | **Arayüz bağlandı** — `ContractFormModal`'a "Dönem Ücreti" alanı, tabloya "Dönem Ücreti" sütunu eklendi | **Arayüz bağlandı** — liste + süresi yaklaşan uyarı şeridi + oluşturma formu (`contracts_list_screen.dart`); CUSTOMER için ayrı salt-okunur `MyContractsScreen` |
| Finans (Para) | Değişmedi (mevcut `/payments/summary` zaten doğru hesaplıyor — bkz. §10 sınırlama notu) | Değişmedi (zaten mevcuttu) | **Kısmi — bilinçli olarak kapsam dışı bırakıldı**: özet kartları, son tahsilatlar listesi, yeni tahsilat formu tam çalışıyor (`finance_screen.dart`); Stitch'teki 6 aylık alan (area) grafiği eklenmedi çünkü (a) veri zaten `/analytics/revenue-trend`'de doğrulanmış durumda ve sayısal özet olarak gösteriliyor, (b) bir grafik kütüphanesi eklemek (`fl_chart` vb.) yeni bir bağımlılık + bakım yükü getirir, tek bir ekran için orantısız görüldü — istenirse ayrı bir iş kalemi olarak eklenebilir |
| Onaylar | Değişmedi (mevcut 3 uç zaten doğru) | Değişmedi (zaten mevcuttu — `bekleyen-onaylar`) | **Arayüz bağlandı** — web ile aynı 3 kaynağı birleştiren kuyruk (teklif/avans/süresi yaklaşan sözleşme), her biri bağımsız hata toleranslı (`approvals_screen.dart`) |

**Uçtan uca doğrulanan yeni davranışlar (gerçek backend'e karşı script/curl ile test edildi)**: `GET /products/:id/movements` gerçek stok hareketini döndürüyor; `POST /contracts` `amount` alanını gerçekten kaydediyor; her iki işlem de `audit-logs`'ta görünüyor.

## Faz 5: Mesajlar / Bildirimler / Performans / Raporlar / Denetim & Ayarlar

| Modül | Backend | Web | Flutter |
|---|---|---|---|
| Mesajlar | **API bağlandı** — yeni mesaj bildirimine `relatedType: "Conversation"` eklendi (tutarlılık için, diğer bildirimlerle aynı desen) | Değişmedi (zaten mevcuttu) | **Arayüz bağlandı** — konuşma listesi (okunmamış rozeti), sohbet ekranı (gönder/al, okundu işaretleme), yeni konuşma başlatma (kişi seçici) (`messages_list_screen.dart`, `chat_screen.dart`) |
| Bildirimler | Değişmedi (relatedType/relatedId önceki oturumda eklenmişti) | Değişmedi (link'leme önceki oturumda eklenmişti) + `Conversation` eşlemesi eklendi | **Arayüz bağlandı** — liste, okundu işaretleme, tümünü okundu işaretleme, **tıklayınca ilgili ekrana yönlendirme** (Job→İşler, Product→Stok, Advance/QuoteRequest→Teklifler, Conversation→Mesajlar) (`notifications_screen.dart`) |
| Performans | Değişmedi (`GET /staff/leaderboard` zaten doğru) | Değişmedi (zaten mevcuttu) | **Arayüz bağlandı** — sıralama listesi, ortalama puan, madalya renkleri (`performance_screen.dart`) |
| Raporlar | Değişmedi (analytics uçları zaten doğru) | Değişmedi (zaten mevcuttu) | **Arayüz bağlandı** — hizmet dağılımı ve bölge yoğunluğu yatay çubuklarla, müşteri sadakati özet kartları (`reports_screen.dart`) — **grafik kütüphanesi kullanılmadı** (kapsam dışı bağımlılık), veriler backend'de zaten doğrulanmış hesaplamalar |
| Denetim & Ayarlar | Değişmedi | Değişmedi | **Arayüz bağlandı** — iki sekmeli ekran: denetim log listesi (salt okunur) + ayarlar (anahtar/değer düzenleme, genel amaçlı) (`audit_settings_screen.dart`) — yalnızca OWNER navigasyonunda görünür (MANAGER'a backend zaten kapalı, Flutter'da da menüden gizlendi) |

**Not**: Raporlar ve Performans ekranlarında Stitch'in gösterdiği "hedef" (20 iş/ay), "dakiklik %100" gibi göstergeler **eklenmedi** — bunlar Açık Sorular §3-4'te kayıtlı, backend'de hiçbir karşılığı yok, uydurulmadı.

---

## 0. Tasarım Sistemi (field_bio_command/DESIGN.md)

| Özellik | Stitch kanıtı | Mevcut karşılık | Durum | İş |
|---|---|---|---|---|
| Renk paleti (yeşil-beyaz, primary #3D8A4E/#2F5233, surface #F4F7F4/#FFFFFF, border #E3E8E3, text #16211A/#5A6B5E) | `DESIGN.md` Colors bölümü | `web/tailwind.config.ts` — **neredeyse birebir aynı hex değerleri** | Mevcut (web'de) | Flutter: aynı token'larla `ThemeData` kur |
| Tipografi (Plus Jakarta Sans başlık, Inter gövde) | `DESIGN.md` Typography | Web'de font tanımlı değil (sistem fontu) | Yeni (Flutter'a özgü) | Flutter: `google_fonts` ile iki fontu yükle |
| Kart/buton/pill radius, gölge ölçeği | `DESIGN.md` Shapes/Elevation | `tailwind.config.ts` boxShadow/borderRadius ile örtüşüyor | Mevcut (web'de) | Flutter: aynı radius/gölge değerleri |
| Floating bottom nav (pill, ortada FAB) | Tüm ekranlarda ortak alt nav | Web'de yok (web sidebar kullanıyor, mobil nav farklı bir paradigma) | Yeni (Flutter'a özgü) | Flutter: özel `BottomNavigationBar`/custom widget |

---

## 1. Ana Sayfa / Komuta Merkezi

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Bugünkü iş sayısı + durum dağılımı (donut) | 8 kartlı grid, "Bugün 24 İş" segment bar, durum donut | `GET /dashboard/summary` → `todaysJobsCount` (backend/src/controllers/dashboardController.ts:15-26); durum kırılımı (PENDING/SCHEDULED/COMPLETED/CANCELLED) **dönmüyor**, sadece toplam sayı | Kısmi | `todaysJobsByStatus` alanı eklenmeli (job.groupBy status, bugün) | Dashboard'a donut eklenebilir (opsiyonel) | Bağla + eksik kırılım için backend'e ek alan iste |  backend/src/controllers/dashboardController.ts:5-35 |
| Toplam müşteri sayısı | "1.428" kartı | `prisma.customer.count()` yok bu uçta; `/customers` sayfalı listeden `pagination.total` alınabilir | Kısmi | `/dashboard/summary`'ye `totalCustomers` eklenebilir | — | `/customers?limit=1` ile total oku (ek endpoint gerekmeden) | backend/src/controllers/customersController.ts:46-49 |
| Bekleyen onay sayısı (teklif+avans) | "Bekleyen Onay: 5" | Web `/bekleyen-onaylar` zaten `quotes?status=NEW` + `advances?status=PENDING` + `contracts/expiring` topluyor | Mevcut | — | — | Aynı 3 çağrıyı birleştirip say | web/src/app/(dashboard)/bekleyen-onaylar/page.tsx:40-58 |
| Toplam tahsilat (bu ay) | "₺184.650" | `GET /dashboard/summary` → `thisMonthPaymentsTotal` | Mevcut | — | — | Bağla | backend/src/controllers/dashboardController.ts:17-20,30 |
| Tamamlanan iş (bu ay) + yüzde | "312", "%72" | `completedJobsThisMonth` alanı var; toplam işe oranı (%) **hesaplanmıyor**, sadece sayı | Kısmi | `todaysJobsCount` ile oran türetilebilir (frontend'de hesapla) | — | Flutter'da oranı client-side hesapla | backend/src/controllers/dashboardController.ts:23-25,33 |
| Aktif personel (X/Y, izin/molada sayısı) | "14/16", "2 teknisyen izinli/molada" | `activeStaffCount` = `prisma.staff.count()` (toplam personel, "aktif" ayrımı yok); izin/mola verisi **hiç yok** | Kısmi/Yeni | `Staff.status` alanı eklendi (bkz. §7 Personel) → sayaç bu alandan türetilebilir | Personel sayfasına durum göstergesi eklenmeli | Bağla (yeni alan geldikçe) | backend/src/controllers/dashboardController.ts:22,32 |
| Bu ay net kâr (+trend %) | "₺68.420", "+%14" | `GET /payments/summary` → `netProfitThisMonth` (sadece OWNER veya `view_finance` izni) — **trend (%14) hesaplanmıyor**, önceki ay karşılaştırması yok | Kısmi | Önceki ay net kârını da hesaplayıp `netProfitTrend` döndür | Para sayfasına trend eklenebilir | Bağla, trend alanı gelince göster | backend/src/controllers/paymentsController.ts:79-86 |
| Ort. tamamlama süresi (48 dk, "İYİ") | KPI kartı | **Hiç hesaplanmıyor** — Job modelinde gerçek "başlama" zamanı yok (sadece scheduledAt/completedAt), süre hesaplaması güvenilir değil | Yeni | `Job.startedAt` alanı eklendi (bkz. §3 İşler) → `AVG(completedAt-startedAt)` ile gerçek ortalama hesaplanabilir | Raporlar sayfasına eklenebilir | Backend'e yeni analytics endpoint istenene kadar gösterme | backend/prisma/schema.prisma (Job modeli, önceki tam okuma) |
| "API: Aktif" / "DB: Senkron" rozetleri | Ana sayfa üst şerit | **Tamamen dekoratif metin**, gerçek sağlık kontrolü değil | Yeni (ama önerilmiyor) | `/health` ve `/system/health` (OWNER) zaten var, gerçek durum gösterilebilir | — | Flutter'da bunu **sabit "aktif" yazısı olarak KOPYALAMA** — ya gerçek `/health` pingine bağla ya da hiç gösterme | backend/src/index.ts:51; backend/src/routes/system.ts |
| 7 günlük iş grafiği (bar chart) | SVG bar chart | Backend'de günlük kırılım endpoint'i yok (`analytics/revenue-trend` aylık) | Yeni | Basit bir `/analytics/jobs-last-7-days` eklenebilir (opsiyonel, düşük öncelik) | — | Faz 5'e ertelendi | backend/src/routes/analytics.ts |
| "Onaylar (3)" hızlı buton | Hero panel | Bekleyen onay sayısına tıklayınca /bekleyen-onaylar'a git | Mevcut (rota var) | — | — | Bağla (navigasyon) | — |
| "Tara" / karekod okuma | Quick dispatch bar | Backend'de QR/barkod ile iş/istasyon eşleme **hiç yok** | Belirsiz | Kapsam kararı gerekiyor (bkz. Açık Sorular) | — | Faz dışı bırakıldı, açık soru | — |

---

## 2. Bekleyen Onaylar

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Teklif onay/dönüştürme | Teklif kartı "Teklife Dönüştür & Onayla" | `PATCH /quotes/:id` (status) + `POST /quotes/:id/convert` — **zaten çalışıyor**, web'de uygulanmış | Mevcut | — | — | Aynı 2 uca bağla | backend/src/controllers/quotesController.ts:37-83; web bekleyen-onaylar sayfası |
| Avans onay/red | Avans kartı "Onayla"/"Reddet" | `PATCH /advances/:id` (status APPROVED/REJECTED) | Mevcut | — | — | Bağla | backend/src/controllers/advancesController.ts:65-93 |
| Sözleşme yenileme onayı | "Yenileme Teklifi Gönder"/"İncele", "₺48.000" tutarlı buton | `contracts/expiring` listesi var ama **sözleşmede ücret alanı yok** (bkz. §5) ve "yenileme teklifi gönderme" aksiyonu backend'de yok | Kısmi/Yeni | Contract'a `amount` alanı eklendi (bkz. §5); "yenileme" ayrı bir iş akışı değil, `PATCH /contracts/:id` ile endDate/durationMonths güncellenmesi yeterli | Sözleşmeler sayfasına "yenile" aksiyonu eklenebilir | Sözleşme detayından güncelle | backend/src/controllers/contractsController.ts:60-72 |
| Filtre pilleri (Tümü/Teklif/Avans/Sözleşme) | Chip filtreleri | Web'de zaten 3 ayrı liste birleşik gösteriliyor, chip filtresi yok ama kavramsal karşılığı var | Kısmi | — | — | Flutter'da chip filtreleri client-side (zaten çekilen 3 listeyi filtrele) | web/src/app/(dashboard)/bekleyen-onaylar/page.tsx |
| KPI kartları (toplam bekleyen, hacim ₺) | 2x2 grid | Client-side türetilebilir (listelerin toplamı) | Mevcut (türetilebilir) | — | — | Flutter'da hesapla | — |

---

## 3. İşler / Saha Operasyonları

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| İş listesi + durum filtreleri | Chip: Tümü/Bekliyor/Planlandı/Tamamlandı/İptal | `GET /jobs?status=` zaten filtreliyor | Mevcut | — | — | Bağla | backend/src/controllers/jobsController.ts:72-133 |
| Arama (müşteri/adres/iş no) | Arama kutusu | `/jobs` uçta arama parametresi **yok** (sadece customerId/staffId/status/date filtreleri) | Yeni | `/jobs`'a `search` parametresi ekle (customer.fullName/address contains) | — | Backend'e eklenene kadar client-side filtrele (aynı sayfa) | backend/src/controllers/jobsController.ts:72-133 |
| **İş başlatma ("Rotayı Başlat")** | Bekliyor kartı aksiyonu | **Yok** — JobStatus'ta IN_PROGRESS yok, sadece PENDING/SCHEDULED/COMPLETED/CANCELLED; STAFF direkt COMPLETED'a geçiyor | **Yeni — eklendi** | `JobStatus.IN_PROGRESS` enum değeri + `Job.startedAt` alanı eklendi (migration: `add_job_in_progress_and_started_at`); STAFF artık PENDING/SCHEDULED→IN_PROGRESS (startedAt set) →COMPLETED geçişi yapabilir | Web `isler` sayfasına "Başlat" aksiyonu eklenmeli (Faz 3) | "Rotayı Başlat" butonu → status=IN_PROGRESS | backend/prisma/schema.prisma (Job, JobStatus) — bu oturumda değiştirildi |
| **Tamamlanma süresi** | "48 dk" gibi süre gösterimi | `startedAt` eklenmeden önce hesaplanamıyordu | Yeni — altyapı eklendi | `completedAt - startedAt` ile hesaplanabilir hale geldi; ayrı bir raporlama endpoint'i (ortalama süre) Faz 5'te eklenecek | — | İş detayında `completedAt-startedAt` farkını göster (varsa) | backend/prisma/schema.prisma |
| İş kartı: müşteri, hizmet türü, saat aralığı, tutar, personel, durum | Kart şablonu | `GET /jobs` include ile customer.fullName + assignedStaff.user.fullName dönüyor; **saat aralığı yok** (sadece tek `scheduledAt`, bitiş saati/`endedAt` tahmini yok), **ödeme yöntemi job'a bağlı değil** (Payment ayrı model, job'a referans yok) | Kısmi | Ödeme yöntemi job kartında gösterilecekse Payment→Job ilişkisi gerekir (Belirsiz, bkz. Açık Sorular) | — | Mevcut alanlarla göster, saat aralığı/ödeme yöntemini gösterme (veri yok) | backend/src/controllers/jobsController.ts:18-21 |
| Fotoğraf (öncesi/sonrası) | (Bu ekranda yok ama iş akışının parçası) | `GET/POST/DELETE /jobs/:id/photos`, multer upload | Mevcut | — | — | Bağla (kamera + galeri seçimi, multipart upload) | backend/src/routes/jobs.ts:33-35 |
| İş raporu + PDF | "PDF Rapor" aksiyonu | `POST /jobs/:id/report`, `GET /jobs/:id/report/pdf` | Mevcut | — | — | Bağla | backend/src/routes/jobs.ts:28-30 |
| Dijital imza | Rapor akışının parçası | `signatureBase64` → `saveBase64Image` | Mevcut | — | — | `signature` paketiyle çiz, base64 gönder | backend/src/lib/upload.ts:36-45 |
| İş no formatı (#İS-4092) | Tüm kartlarda | Job.id UUID, insan-okunur sıra no yok | Belirsiz (kozmetik) | Açık soru: sıralı görünür no eklensin mi? | — | UUID'nin son 6 hanesini `#İS-XXXXXX` gibi göster (geçici çözüm) | backend/prisma/schema.prisma (Job.id) |
| QR/barkod tarama (istasyon) | Arama kutusu yanında ikon | Yok | Belirsiz | Kapsam dışı (açık soru) | — | Faz dışı | — |

---

## 4. Müşteriler / Portföy & Bakiye

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Müşteri listesi + arama + bölge filtresi | Arama + bölge chip'leri | `GET /customers?search=` (fullName/phone/email/district) var; bölge bazlı **sayaçlı** chip yok ama `district` ile filtrelenebilir | Mevcut/Kısmi | `/districts` zaten var, sayaç için client-side sayım yeterli | — | Bağla, bölge chip'lerini `/districts` + client sayım ile oluştur | backend/src/controllers/customersController.ts:21-52 |
| Müşteri bakiye (₺-4.250 vb.) | Kırmızı/yeşil bakiye pill | `GET /customers/:id` → `outstandingBalance` (OWNER/MANAGER); STAFF için **gizli** (payments hariç tutuluyor) | Mevcut | — | — | Role göre göster/gizle (STAFF'a bakiye gösterme) | backend/src/controllers/customersController.ts:54-85 |
| İşler/Sözleşmeler/Ödemeler sekmeleri (müşteri detayında) | Segment tabs | `GET /customers/:id` include ile jobs+contracts+payments zaten dönüyor | Mevcut | — | — | 3 sekmeli detay ekranı, tek API çağrısından besle | backend/src/controllers/customersController.ts:54-62 |
| Yıldız puanı (müşteri bazında ort.) | "4.9 (24 İş)" | Job.rating var ama müşteri bazında ortalama **hesaplanmıyor** | Kısmi | Frontend'de customer.jobs'tan client-side ortalama al | — | Client-side hesapla | backend/prisma/schema.prisma (Job.rating) |
| "Doğrulanmış müşteri" rozeti | verified ikonu | Karşılığı yok, anlamı da belirsiz | Belirsiz | Açık soru | — | Gösterme | — |
| Yeni müşteri ekleme | "Yeni Müşteri Ekle" | `POST /customers` | Mevcut | — | — | Form + bağla | backend/src/controllers/customersController.ts:87-91 |
| Yeni iş oluşturma (müşteri detayından) | "Yeni İş Oluştur" | `POST /jobs` (customerId ile) | Mevcut | — | — | Bağla | backend/src/controllers/jobsController.ts:148-152 |

---

## 5. Sözleşmeler / Periyodik Anlaşmalar

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Sözleşme listesi + filtre (Aktif/Yenileme Yaklaşan/Süresi Dolan) | Chip filtreleri | `GET /contracts?status=` var; `GET /contracts/expiring` (30 gün) var; "süresi dolan" ayrı bir sorgu yok ama `status` string alanıyla (`"EXPIRED"`) yapılabilir | Mevcut/Kısmi | — | — | 3 ayrı çağrıyı (all/expiring/status=EXPIRED) birleştir | backend/src/controllers/contractsController.ts:32-72 |
| **Sözleşme ücreti (₺/Ay, ₺/Yıl)** | Her kartta aylık+yıllık tutar | **Yoktu** — Contract modelinde hiç fiyat alanı yoktu | **Yeni — eklendi** | `Contract.amount Decimal?` (dönem başına ücret) eklendi; `billingAmount` yerine mevcut `recurrenceType` (MONTHLY/QUARTERLY) + `durationMonths` ile yıllık toplam client-side türetilebilir | Sözleşme formuna "ücret" alanı eklenmeli (Faz 4) | Formda göster, gönder | backend/prisma/schema.prisma (Contract) — bu oturumda değiştirildi |
| Yenileme teklifi gönderme | "Yenileme Teklifi Gönder" | Ayrı bir "gönderme" mekanizması yok; `notifyUser`/email altyapısı var, sözleşmeye özel şablon yok | Belirsiz | Kapsam kararı: otomatik hatırlatma zaten var (`sendContractExpiryReminders`), "teklif gönder" ayrı bir aksiyon mu olacak, yoksa mevcut hatırlatma yeterli mi? | — | Şimdilik `PATCH /contracts/:id` ile yenileme (yeni endDate) | backend/src/lib/reminders.ts:148-176 |
| Sözleşme PDF | "Sözleşme PDF İndir" | `Contract.pdfUrl` alanı var (string), ama **PDF üretim endpoint'i yok** (elle yüklenen bir URL) | Kısmi | Contract PDF export'u backend'de yok (Job report PDF var ama contract için yok) | — | Varsa `pdfUrl`'i göster/indir, yoksa gizle | backend/prisma/schema.prisma (Contract.pdfUrl); backend/src/controllers/exportController.ts (contract yok) |
| Sol drawer (Yönetim modülü linkleri) | Hamburger menü | Web'de zaten Sidebar var (farklı ama eşdeğer) | Mevcut (kavram) | — | — | Flutter'da role göre nav drawer/tab | web/src/components/Sidebar.tsx |

---

## 6. Teklifler / Fiyatlandırma

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Teklif listesi + durum filtreleri | Tümü/Bekleyen/Onaylanan/Revize/Reddedilen | `GET /quotes?status=` var ama sadece `NEW/CONTACTED/CONVERTED/REJECTED` (web'de tanımlı), "Revize" durumu yok | Kısmi | `status` zaten serbest string — "REVISION" değeri eklenmesi şema değişikliği gerektirmiyor, sadece web/Flutter'da yeni bir sabit değer olarak kullan | Web'e "REVISION" durumu eklenebilir | Aynı serbest string'i kullan | backend/prisma/schema.prisma (QuoteRequest.status: String) |
| **Teklif fiyatlandırma (tutar girme)** | Her kartta "₺18.500 (KDV Dahil)" | **Yoktu** — QuoteRequest modelinde hiç fiyat alanı yoktu, web'de de fiyat girme UI'ı yok | **Yeni — eklendi** | `QuoteRequest.amount Decimal?` eklendi (OWNER/MANAGER teklife fiyat girebilir, `PATCH /quotes/:id`) | Teklif detayına fiyat girme formu eklenmeli (Faz 4) | Form + bağla | backend/prisma/schema.prisma (QuoteRequest) — bu oturumda değiştirildi |
| Teklifi sözleşmeye dönüştürme | "Teklife Dönüştür & Sözleşme Hazırla" | `POST /quotes/:id/convert` sadece **Customer** oluşturuyor, Contract/Job oluşturmuyor | Kısmi | `convertQuote` genişletilmeli: artık `amount` varsa opsiyonel olarak bir Contract da oluşturabilir (Belirsiz — otomatik mi, manuel mi karar gerekiyor, bkz. Açık Sorular) | — | Şimdilik: dönüştür → müşteri oluşur → kullanıcı ayrıca sözleşme/iş oluşturur (mevcut akış) | backend/src/controllers/quotesController.ts:63-83 |
| "Hatırlat (SMS)" | Müşteri onayı bekleyen kart | SMS entegrasyonu **hiç yok** (sadece email) | Yeni (Belirsiz kapsam) | SMS sağlayıcı seçimi gerekiyor (açık soru) | — | Gösterme / "yakında" | — |
| Dönüşüm oranı, aylık hacim KPI'ları | KPI kartları | Client-side türetilebilir (quotes listesinden) | Mevcut (türetilebilir) | — | — | Flutter'da hesapla | — |

---

## 7. Personel / İş Yükü & Sertifikalar

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Personel listesi + filtre (rol/ekip) | Chip: Tüm Ekipler/Saha Teknisyenleri/Takım Liderleri | `GET /staff?role=` var | Mevcut | — | — | Bağla | backend/src/controllers/staffController.ts:28-62 |
| Bugünkü iş yükü (X/5 görev, %) | "İş Yükü: 4/5 Görev — %80" | Web zaten `todaysJobsCount` hesaplıyor (`/jobs?staffId&date=bugün`); **sabit bir "kapasite" (5) yok**, % hesaplaması varsayımsal olur | Kısmi | Açık soru: sabit günlük kapasite kaç kabul edilecek? (Belirsiz) | — | Kapasite netleşene kadar sadece "X görev" say, yüzde gösterme | web/src/app/(dashboard)/personel/page.tsx:44-69 |
| **Müsaitlik/izin/mola durumu** | "Molada", "Mola Bitişi: 14:15", "İzin/Mola" sayacı, online noktası | **Hiç yoktu** — Staff modelinde durum alanı yok | **Yeni — eklendi** | `StaffStatus` enum (AVAILABLE, ON_JOB, ON_BREAK, ON_LEAVE, OFFLINE) + `Staff.status` + `Staff.statusUntil DateTime?` eklendi; `PATCH /staff/:id/status` endpoint'i eklendi (kendi durumunu STAFF güncelleyebilir, OWNER/MANAGER/TEAM_LEAD herkesinkini) | Personel sayfasına durum rozeti + değiştirme eklenmeli (Faz 3) | Durum göster + kendi durumunu değiştirme (STAFF için) | backend/prisma/schema.prisma (Staff) — bu oturumda değiştirildi |
| Sertifikalar (ad, belge no, geçerlilik, bitiş uyarısı) | 3 sertifika kartı, "22 Gün Kaldı" uyarısı | `StaffCertification` modeli **zaten birebir bu alanları içeriyor** (name, issuedDate, expiryDate, documentUrl) + `GET /staff/certifications/expiring` | Mevcut | — | Web'de CertificationsModal zaten var | Bağla (liste + bitiş rengi client-side hesapla) | backend/prisma/schema.prisma:111-124; backend/src/routes/staff.ts:37-40 |
| Kişisel izin (permission) yönetimi | (Bu ekranda yok ama ilişkili) | `GET/PATCH /staff/:id/permissions` (yalnızca OWNER) | Mevcut | — | — | Bağla | backend/src/routes/staff.ts:34-35 |
| Ort. puan + yorum sayısı | "4.92/5, 128 yorum" | `getStaffLeaderboard` averageRating hesaplıyor ama yorum **sayısı** (ratingComment dolu olanlar) ayrı sayılmıyor | Kısmi | leaderboard'a `ratedJobsCount` eklenebilir | — | Mevcut `averageRating` ile göster, yorum sayısı için ek alan iste | backend/src/controllers/staffController.ts:231-245 |

---

## 8. Takvim / Saha Görev Dağılımı

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Aylık ısı haritası (gün başına iş yoğunluğu) | Renkli takvim grid | Web `takvim` sayfası **zaten birebir bunu yapıyor** (`heatLevel`, `jobsByDay`) | Mevcut | — | — | Aynı mantığı Flutter'da uygula (`GET /jobs?from&to`) | web/src/app/(dashboard)/takvim/page.tsx:22-100 |
| Seçili günün görev listesi | Gün altında kart listesi | Web'de zaten var (`jobsByDay.get(selectedDate)`) | Mevcut | — | — | Bağla | web/src/app/(dashboard)/takvim/page.tsx |
| Durum bazlı görev kartı (Devam Ediyor/Yolda/Bekliyor/Tamamlandı) | 4 durum rengi | JobStatus'a IN_PROGRESS eklendi (§3); "Yolda" gibi bir ara durum **yok ve eklenmedi** (GPS/konum takibi kapsam dışı) | Kısmi | "Yolda" durumu GPS gerektirir, kapsam dışı bırakıldı (açık soru) | — | 3 durumla göster (Bekliyor/Devam Ediyor/Tamamlandı), "Yolda" gösterme | — |
| Ekip filtresi ("Tüm Ekipler" dropdown) | Filtre chip | `GET /jobs?staffId=` var, TEAM_LEAD zaten ekibiyle sınırlı geliyor (backend kapsam) | Mevcut | — | — | TEAM_LEAD için otomatik, OWNER/MANAGER için personel seçimi ekle | backend/src/lib/access.ts (getTeamStaffIds) |
| Personel bazlı müsaitlik görünümü (kim boşta/dolu, ayrı liste) | Stitch'te de **yok** (agent notu: sadece o günün atanmış görevleri var, ayrı müsaitlik listesi yok) | Personel sayfasındaki yeni `Staff.status` ile kısmen karşılanabilir | Kısmi | — | — | Faz 3'te personel durumu + takvim birlikte gösterilebilir (opsiyonel) | — |

---

## 9. Stok / Biyosidal & Ekipman

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Ürün listesi + arama | Arama kutusu | `GET /products?search=` | Mevcut | — | — | Bağla | backend/src/controllers/productsController.ts:26-38 |
| **Kategori ayrımı (Kimyasal/Kemirgen Yemi/Ekipman)** | 3 filtre chip'i, net ayrım | **Yoktu** — Product modelinde kategori alanı yoktu, tek düz liste | **Yeni — eklendi** | `ProductCategory` enum (BIOCIDAL, CONSUMABLE, EQUIPMENT) + `Product.category` (default BIOCIDAL, mevcut kayıtlar bozulmadan geçerli) eklendi | Stok formuna kategori seçimi eklenmeli (Faz 4) | Filtre chip'leri + form alanı | backend/prisma/schema.prisma (Product) — bu oturumda değiştirildi |
| Kritik eşik / min seviye göstergesi | "Mevcut: 4L / Min: 10L, %40" | `Product.currentStock` + `criticalThreshold`, `GET /products/low-stock` | Mevcut | — | — | Bağla, yüzdeyi client-side hesapla | backend/src/controllers/productsController.ts:40-44 |
| Ruhsat no, SKT, depo konumu | Meta grid (ruhsat no, SKT, konum) | **Yoktu** — Product modelinde bu alanlar yoktu | Yeni | Açık soru: bu alanlar şimdi mi eklensin (küçük ek migration) yoksa Faz 4'e mi bırakılsın? Bu turda eklenmedi (düşük öncelik, iş kuralı gerektirmiyor, veri girişi alanı) | — | Alanlar gelene kadar gösterme | backend/prisma/schema.prisma (Product) |
| Stok çıkışı (ekibe/teknisyene) | "Ekibe Çıkış Yap", "Teknisyene Ver" | `POST /jobs/:id/report` içinde otomatik OUT hareketi var (iş raporuyla bağlı); **iş dışı serbest stok çıkışı** (elden teslim) endpoint'i yok | Kısmi | Açık soru: iş bağlantısız manuel stok çıkışı gerekli mi? (StockMovement zaten `relatedJobReportId` olmadan da oluşturulabilir bir controller eklenirse) | — | Şimdilik sadece restock (giriş) + iş raporu üzerinden çıkış | backend/src/routes/products.ts |
| Stok girişi (restock) | "Giriş" | `POST /products/:id/restock` | Mevcut | — | — | Bağla | backend/src/controllers/productsController.ts:74-93 |
| Son depo hareketleri listesi | Hareket geçmişi | `StockMovement` modeli var ama **listeleme endpoint'i yok** (sadece create) | Yeni | `GET /products/:id/movements` veya `GET /products/movements` eklenmeli (Faz 4, düşük risk) | — | Backend'e eklenene kadar gösterme | backend/prisma/schema.prisma (StockMovement) |

---

## 10. Para & Finans / Tahsilat

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Bu ay toplam tahsilat, tüm zamanlar | KPI kartları | `GET /payments/summary` → `thisMonthTotal`, `allTimeTotal` | Mevcut | — | — | Bağla | backend/src/controllers/paymentsController.ts:49-89 |
| Aylık ciro/tahsilat trendi (area chart) | 6 aylık grafik | `GET /analytics/revenue-trend?months=` | Mevcut | — | — | Bağla | backend/src/controllers/analyticsController.ts:14-37 |
| Ödeme türü dağılımı (donut) | Nakit/POS/Havale dilimleri | `paymentType` alanı var ama **dağılım endpoint'i yok** (sadece toplam) | Kısmi | `/analytics`'e `payment-type-breakdown` eklenebilir (Faz 5, düşük risk — service-breakdown ile aynı desen) | — | Backend'e eklenene kadar gösterme | backend/src/controllers/analyticsController.ts (yok) |
| **Net kâr marjı (gider düşülmüş)** | "%37", "Malzeme & yakıt sonrası" | `netProfitThisMonth = thisMonthTotal - totalStaffSalaryBase` — **sadece personel maaşı düşülüyor**, malzeme/yakıt/diğer giderler hiç modellenmiyor | **Kısmi — önemli sınırlama** | Gerçek bir Gider (Expense) modeli yok; bu bir **iş kararı gerektiriyor** (bkz. Açık Sorular) — bu turda eklenmedi | — | Mevcut (eksik) hesaplamayı olduğu gibi göster, ama Stitch'teki "malzeme & yakıt sonrası" ibaresini KULLANMA (yanlış izlenim verir) | backend/src/controllers/paymentsController.ts:79-86 |
| **Gider satırları (malzeme alımı, yakıt, personel avansı)** | "Son Hareketler" listesinde eksi tutarlar | Backend'de tek "gider" kaynağı `AdvanceRequest` (personel avansı); malzeme/yakıt alımı gibi **satın alma giderleri hiç kayıtlı değil** | **Yeni (büyük kapsam, ertelendi)** | Bir `Expense` modeli mi, yoksa `Payment` modelinin işaretli (income/expense) genel bir "Transaction" modeline mi dönüştürüleceği karar gerektiriyor (Açık Sorular) | — | Şimdilik sadece Payment (gelir) + Advance (personel gideri) göster | backend/prisma/schema.prisma (Payment, AdvanceRequest) |
| Fiş/makbuz/fatura görüntüleme | "Fiş Görüntüle" vb. | `Payment.receiptUrl`, `JobReport.pdfUrl`, `AdvanceRequest`'te belge yok | Kısmi | — | — | Varsa URL'i göster/aç | backend/prisma/schema.prisma (Payment.receiptUrl) |
| Excel/PDF finansal rapor indirme | "Tüm Finansal Raporu İndir" | `GET /payments/export/excel` var; **PDF özet raporu yok** (sadece tek makbuz PDF var) | Kısmi | Genel finansal PDF raporu Faz 5'e ertelendi | Web zaten Excel export'u kullanıyor | Excel indir, PDF'i gösterme | backend/src/routes/payments.ts:12,15 |

---

## 11. Bildirimler

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Bildirim listesi + okundu/okunmadı | Kart listesi | `GET /notifications?status=`, `PATCH /notifications/:id/read`, `/read-all` | Mevcut | — | — | Bağla + polling (push altyapısı yok, bkz. PROJECT_HANDOFF_TR.md §7) | backend/src/routes/notifications.ts |
| Kategori filtresi (İş/Ödeme/Mesaj/Uyarı) | Chip filtreler + sayaç | Web'de `categorizeNotification()` ile **başlık metninden tahmin ediliyor** (gerçek tip alanı yok) | Kısmi | — | — | Aynı client-side heuristiği Flutter'da tekrar kullan (backend değişene kadar) | web/src/lib/notifications.ts:8,55-61 |
| **Bildirime tıklayınca ilgili kayda gitme** | "Rapor #OZK-44", "Dekont #TR-9821" gibi referanslar | **Yoktu** — Notification modelinde ilgili kayda referans (relatedType/relatedId) hiç yoktu | **Yeni — eklendi** | `Notification.relatedType String?`, `Notification.relatedId String?` eklendi; `notifyUser`/`notifyUsers` imzaları opsiyonel `related` parametresi alacak şekilde genişletildi; **iş tamamlama, düşük stok, ödeme alma bildirimlerinde bu alanlar dolduruldu** (jobsController, reminders.ts) | Web bildirim kartına "git" linki eklenebilir (Faz 5) | Bildirime dokununca relatedType'a göre ilgili ekrana git | backend/prisma/schema.prisma (Notification) — bu oturumda değiştirildi; backend/src/lib/notify.ts |
| Bildirim türü dağılımı (donut) | Haftalık dağılım grafiği | Client-side hesaplanabilir (mevcut liste üzerinden) | Mevcut (türetilebilir) | — | Web'de zaten var (DonutChart) | Aynı mantığı uygula | web/src/app/(dashboard)/bildirimler/page.tsx |

---

## 12. Mesajlar / Saha İletişimi

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Konuşma listesi + okunmamış sayaç | Liste + rozet | `GET /conversations`, mesaj `readAt` alanı | Mevcut | — | — | Bağla | backend/src/controllers/conversationsController.ts |
| Mesaj gönderme/alma | Mini-chat | `POST /conversations/:id/messages`, `GET /conversations/:id/messages` | Mevcut | — | — | Bağla (polling; gerçek zamanlı WebSocket yok) | backend/src/routes/conversations.ts |
| Kimlerle mesajlaşılabileceği kısıtı | (Dolaylı) | `canUsersMessage` matrisi (messaging.ts) — TEAM_LEAD-STAFF sadece aynı ekip, CUSTOMER-STAFF sadece son atanan personel | Mevcut | — | — | `available-contacts` ucundan liste al | backend/src/lib/messaging.ts |
| OWNER tüm konuşmaları izleme | (Bu ekranda değil, ama ilişkili yetki) | `GET /conversations/all` — **yalnızca OWNER** | Mevcut (mevcut haliyle korunacak) | Görev talimatı gereği bu yetki MANAGER'a **açılmayacak** (yalnızca OWNER'a özel kalacak, PROJECT_HANDOFF_TR.md'de doğrulanmıştı) | — | OWNER rolü için ayrı bir "tüm mesajlar" ekranı | backend/src/routes/conversations.ts:19 |
| Online durumu, hızlı durum etiketleri ("Ali yola çıktı") | Avatar üzeri nokta, tag butonlar | Presence/online-status takibi **hiç yok**; hızlı etiketler tamamen Stitch'in dekoratif UI'ı | Yeni (Belirsiz, düşük öncelik) | Kapsam dışı bırakıldı (kullanıcı listesinde "özellikle kontrol et" maddeleri arasında yok) | — | Gösterme | — |
| Fotoğraf/dosya ekleme | Ataç ikonu | Mesaj modelinde `content` sadece metin, dosya eki **yok** | Yeni (Belirsiz) | Mesaja dosya eki eklenmesi ayrı bir karar (açık soru) | — | Şimdilik sadece metin mesajı | backend/prisma/schema.prisma (Message.content: String) |

---

## 13. Performans / Liderlik Kürsüsü

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Aylık tamamlanan iş sayısı sıralaması | Podyum + bar chart | `GET /staff/leaderboard` → `completedJobsThisMonth`, sıralı | Mevcut | — | Web'de zaten `/performans` sayfası var | Bağla | backend/src/controllers/staffController.ts:208-250 |
| Ortalama müşteri puanı | "4.98" | `averageRating` | Mevcut | — | — | Bağla | backend/src/controllers/staffController.ts:232-236 |
| Hedef karşılaştırma ("Hedef: 20", "%11.5 hedef üstü") | KPI kartı | **Hedef sayısı hiç tanımlı değil** | Belirsiz | Sabit bir hedef mi (örn. Setting tablosunda), yoksa gösterilmeyecek mi? (açık soru) | — | Hedef netleşene kadar gösterme | backend/prisma/schema.prisma (Setting) — genel amaçlı kullanılabilir ama şimdi eklenmedi |
| Dakiklik yüzdesi ("%100 Dakiklik") | Podyum rozeti | Hiç ölçülmüyor (zamanında varış verisi yok, GPS/check-in yok) | Belirsiz/Yeni | Kapsam dışı (açık soru) | — | Gösterme | — |

---

## 14. Raporlar / Operasyonel Analitik

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Hizmet türü dağılımı (donut) | "%42 HACCP..." | `GET /analytics/service-breakdown` | Mevcut | — | Web `/raporlar` sayfası zaten kullanıyor | Bağla | backend/src/controllers/analyticsController.ts:39-64 |
| Bölge bazlı yoğunluk (ranked bar) | "1. Nilüfer %45.5..." | `GET /analytics/top-districts` | Mevcut | — | Mevcut | Bağla | backend/src/controllers/analyticsController.ts:66-84 |
| Müşteri sadakati (yeni vs tekrar) | Segment bar | `GET /analytics/customer-retention` | Mevcut | — | Mevcut | Bağla | backend/src/controllers/analyticsController.ts:86-113 |
| Ort. müdahale süresi | "48 Dk" | `startedAt` eklendi (§3) ama **ortalama süre hesaplayan endpoint yok** | Kısmi | `/analytics`'e `avg-job-duration` eklenmeli (Faz 5) | — | Backend'e eklenene kadar gösterme | — |
| Tarih aralığı filtresi (Hafta/Ay/3 Ay/Yıl) | Chip filtre | `months` query param var (`revenue-trend`, `service-breakdown`) ama gün bazlı "Bu Hafta" yok | Kısmi | — | — | Mevcut ay/3ay/yıl aralıklarını kullan, "Bu Hafta" için client-side günlük filtre | backend/src/controllers/analyticsController.ts:9-12 |
| PDF/XLS rapor indirme | "PDF İndir"/"XLS Döküm" | Genel analitik raporu için export endpoint'i **yok** (sadece customer/payment excel, job report PDF var) | Yeni | Faz 5'e ertelendi | — | Gösterme | backend/src/routes/*.ts (export yok) |

---

## 15. Denetim Logları & Ayarlar (OWNER)

| Özellik | Stitch kanıtı | Mevcut kod/API karşılığı | Durum | Backend işi | Web işi | Flutter işi | Doğrulama |
|---|---|---|---|---|---|---|---|
| Denetim log zaman çizelgesi | Timeline (aktör, aksiyon, hedef, zaman) | `GET /audit-logs` (OWNER) — `actorUserId, action, targetType, targetId, detail, createdAt` | Mevcut | — | Web `/loglar` sayfası var | Bağla | backend/src/routes/auditLogs.ts; backend/src/lib/auditLog.ts |
| Sistem/cron kaynaklı olaylar da loglanması | "Sistem Cron (Daemon)" logu | `recordAuditLog` **targetUserId zorunlu olduğu için sistem/cron olayları (ör. otomatik iş üretimi) hiç loglanmıyor** | Kısmi | Açık soru: cron olayları için targetUserId null'a izin veren ayrı bir log tipi mi gerekir? (bu turda değiştirilmedi, riskli/kapsam dışı) | — | Mevcut logları göster | backend/src/lib/auditLog.ts:12-19 |
| Bildirim/alarm tercihleri (kritik stok SMS, sözleşme uyarısı, otomatik fatura) | 3 toggle | `NotificationPreference` sadece `emailEnabled`/`dailyDigestEnabled` (kişisel); SMS ve "otomatik fatura" **hiç yok** | Yeni (Belirsiz — SMS sağlayıcı ve e-fatura entegrasyonu büyük kapsam) | Kapsam dışı bırakıldı (açık soru) | Mevcut email tercihleri `/ayarlar`'da zaten var | Mevcut email toggle'ı göster, SMS/fatura'yı gösterme | backend/prisma/schema.prisma (NotificationPreference) |
| Biyosidal ruhsat & firma bilgisi | Ticari unvan, ruhsat no, adres | `Setting` (key/value) modeliyle **saklanabilir** ama şu an bu key'ler dolu değil, web ayarlar sayfasında hangi key'lerin kullanıldığı bu turda incelenmedi | Kısmi/Belirsiz | Web `/ayarlar` sayfası zaten `Setting` kullanıyor; hangi key'lerin eklenmesi gerektiği Faz 5'te netleştirilecek | Var olan ayarlar formuna alan eklenebilir | Salt okunur göster (varsa) | backend/prisma/schema.prisma (Setting) |
| Yedekleme/arşivleme | "Sistem Loglarını Arşivle" | `GET /admin/backup` gerçek; **90 günden eski logları "soğuk depolamaya" arşivleme** özelliği yok (Stitch'teki confirm/alert tamamen sahte) | Kısmi | Log arşivleme Faz 5'e ertelendi, düşük öncelik | — | Gösterme | backend/src/routes/admin.ts |

---

## Bu Oturumda Yapılan Backend Değişiklikleri (Özet)

Aşağıdaki 5 alan, "özellikle kontrol et" listesindeki maddelerle **doğrudan eşleşen ve additive (veri kaybı yaratmayan) migration** olarak eklendi — detaylar için `backend/prisma/migrations/` altındaki yeni migration'a bakın:

1. `JobStatus` enumuna `IN_PROGRESS` eklendi + `Job.startedAt DateTime?` — iş başlangıç zamanı ve gerçek tamamlanma süresi için.
2. `Staff.status StaffStatus @default(AVAILABLE)` + `Staff.statusUntil DateTime?` (+ yeni `StaffStatus` enum: AVAILABLE/ON_JOB/ON_BREAK/ON_LEAVE/OFFLINE) — personel müsaitlik/izin/mola için.
3. `Product.category ProductCategory @default(BIOCIDAL)` (+ yeni `ProductCategory` enum: BIOCIDAL/CONSUMABLE/EQUIPMENT) — biyosidal/sarf/ekipman ayrımı için.
4. `Contract.amount Decimal?` — sözleşme dönem ücreti için.
5. `QuoteRequest.amount Decimal?` — teklif fiyatlandırması için.
6. `Notification.type String?`, `Notification.relatedType String?`, `Notification.relatedId String?` — bildirimden ilgili kayda yönlendirme için.

Tüm alanlar **nullable veya varsayılan değerli** — mevcut satırlar bozulmaz, mevcut API sözleşmeleri kırılmaz.

## Çözülen Karar: reCAPTCHA / Mobil Giriş

**Durum: karar verildi ve uygulandı.** Önceki oturumda açık bir soru olarak bırakılan "mobil istemci reCAPTCHA v3 üretemiyor" çelişkisi şöyle çözüldü:

- **Karar**: Mobil istemci reCAPTCHA doğrulamasından muaf tutuluyor; web akışı reCAPTCHA korumasını **aynen** koruyor.
- **Uygulama** (backend/src/controllers/authController.ts:`isVerifiedMobileClient`): `X-Client-Type: mobile` header'ı TEK BAŞINA yeterli değil — ayrıca `.env`'deki `MOBILE_APP_SECRET` ile zamanlama-güvenli (`timingSafeEqual`, sha256 ile normalize edilmiş) karşılaştırılan bir `X-Mobile-App-Key` header'ı da zorunlu. Sır tanımlı değilse bypass hiç çalışmaz (fail-closed).
- **Kısmi telafi**: `backend/src/middleware/loginRateLimit.ts` — mobil girişler (X-Client-Type: mobile beyan edenler) IP+e-posta bazında 5 deneme/15dk ile sınırlı; web girişleri 10 deneme/15dk. Sahte "mobile" beyanı yalnızca daha sıkı limite düşürür, hiçbir avantaj sağlamaz (bypass için ayrıca doğru sır gerekir).
- **Doğrulandı** (gerçek backend'e karşı, sır hiçbir çıktıda gösterilmeden): (1) web isteği token'sız → reddedildi, (2) mobil header + doğru sır, reCAPTCHA token'sız → başarılı giriş, (3) mobil header + yanlış sır → reddedildi, (4) 6. ardışık mobil deneme → 429 (limit çalışıyor), (5) 11. ardışık web denemesi → 429.
- **Kalan risk (uydurulmadı, açıkça yazılıyor)**: `MOBILE_APP_SECRET`, mobil derlemenin (APK/IPA) içine gömülü olduğu için `strings`/decompile ile çıkarılabilir. Bu sır **gerçek bir kimlik doğrulaması değildir** — yalnızca "rastgele bir bot değil, bizim uygulamamız" ayrımını zorlaştıran ikinci bir katmandır. Sır çıkarılırsa saldırgan mobil rate limit'ine (5/15dk) tabi olarak reCAPTHA'sız deneme yapabilir — bu artık bir "reCAPTCHA'sız sınırsız erişim" değil, "reCAPTCHA'sız ama sıkı hız sınırlı erişim" riskidir. Üretimde bu sırrın periyodik rotasyonu ve/veya reCAPTCHA Enterprise'ın mobil SDK'sına geçiş ayrı bir karar/iş kalemi olarak değerlendirilebilir.
- Flutter tarafı (`mobile/lib/core/app_config.dart`, `api_client.dart`): sır yalnızca `/auth/login` isteğine ekleniyor; üretim derlemesi için `--dart-define=MOBILE_APP_SECRET=...` ile override edilmesi gerektiği kod içi yorumla belirtildi — dosyadaki varsayılan yalnızca yerel geliştirme içindir.

---

## Açık Sorular (İş Kararı Gerektiren, Uydurulmadı)

1. **Gider (Expense) modeli** **[KAPSAM DIŞI — Faz 7: ertelendi, net kâr mevcut haliyle (tahsilat − maaş tabanı) kalır]**: Net kâr hesaplaması şu an yalnızca `tahsilat - personel maaş tabanı`. Malzeme/yakıt/diğer işletme giderlerini kim, nasıl, hangi kategorilerle girecek? Yeni bir `Expense` modeli mi, yoksa `Payment`'ı genel bir `Transaction` (income/expense yönlü) modeline mi genişletmeli?
2. **Teklif → Sözleşme otomatik dönüşümü** **[KAPSAM DIŞI — Faz 7: ertelendi, sözleşme/iş manuel oluşturulmaya devam eder]**: `convertQuote` şu an sadece `Customer` oluşturuyor. Fiyatlandırılmış bir teklif onaylandığında otomatik `Contract`/`Job` da mı oluşturulmalı, yoksa kullanıcı ayrıca mı oluşturmalı?
3. **Personel günlük kapasitesi** **[UYGULANDI — Faz 6: `Staff.dailyJobCapacity`]**: "İş Yükü %" göstergesi için sabit bir "günde kaç iş" kapasitesi tanımlanmalı mı (herkes için sabit mi, pozisyona göre mi)?
4. **Performans hedefi** **[UYGULANDI — Faz 6: `Setting.monthly_job_target`]**: "Kişi başı hedef: 20 iş/ay" gibi bir hedef sistemde nereden gelecek (sabit mi, ayarlanabilir mi)?
5. **SMS bildirimleri ve e-fatura entegrasyonu** **[KAPSAM DIŞI — Faz 7: sağlayıcı seçimi yapılmadan uygulanmayacak]**: Stitch'in ayarlar ekranında var, ancak hangi sağlayıcı (İleti Merkezi, Netgsm vb. / hangi e-fatura entegratörü) kullanılacağı iş kararı gerektiriyor — kapsam dışı bırakıldı.
6. **QR/barkod istasyon tarama** **[KAPSAM DIŞI — Faz 7: istasyon/trap modeli yok]**: Ana sayfa ve işler ekranında görünüyor ama karşılığında hiçbir backend kavramı (istasyon/trap modeli) yok — yeni bir kapsam, kullanıcıdan onay gerekiyor.
7. **İş numarası formatı** **[UYGULANDI — Faz 6: `Job.sequenceNo`]**: `#İS-4092` gibi sıralı, insan-okunur iş numarası üretimi için `Job` modeline sıra no eklenmeli mi (ör. `sequence Int @default(autoincrement())`)?
8. **Manuel (işe bağlı olmayan) stok çıkışı** **[UYGULANDI — Faz 7: fiili sayım mutabakatı]**: Şu an stok sadece iş raporu üzerinden veya restock ile hareket ediyor; elden teslim gibi bağlantısız çıkışlar için ayrı bir endpoint gerekli mi?

Bu sorular geliştirmeyi bloklamıyor. Güncel durum için yukarıdaki "Açık Soruların Durumu"
tablosuna bakın — bu listedeki 8 maddenin 4'ü uygulandı, 4'ü kalıcı olarak kapsam dışı
bırakıldı. Karar bekleyen madde kalmadı.

---

## Faz 6: Müdür (Manager) Özel Tasarımı

Kaynak: `references/stitch/mudur/stitch_pest_control_manager_ui_mudur/`

**Ekran sayısı (gerçek dosya sayımı, sözlü tahmin değil):**

```
unzip -l stitch_pest_control_manager_ui_mudur.zip | grep -c code.html   → 16
unzip -l stitch_pest_control_manager_ui_mudur.zip | grep -c screen.png  → 16
unzip -l stitch_pest_control_manager_ui_mudur.zip | grep -c DESIGN.md   → 1
find references/stitch/mudur -iname code.html | wc -l                   → 16
find references/stitch/mudur -iname screen.png | wc -l                  → 16
```

**16 ekran dosyası = 15 sayfa.** Fark, "Mesajlar"ın iki ekrana bölünmüş olmasıdır
(`mesajlar_liste` + `mesajla_ma_sohbet`). Klasörler: ana_sayfa_m_d_r_paneli, ayarlar,
bekleyen_onaylar, bildirimler, i_ler, m_teriler, mesajla_ma_sohbet, mesajlar_liste, para,
performans, personel, raporlar, s_zle_meler, stok, takvim, teklifler (+ tasarım sistemi
için `nil_fer_pest_control_manager/DESIGN.md`, bir ekran değildir).

**Sayfa listesi doğrulaması:** 16 ekranın tamamındaki hamburger çekmecesi `data-path`
değerleri okundu; hepsi tutarlı olarak şunları içeriyor: dashboard, calendar,
pending-approvals, customers, staff, performance, inventory, contracts, proposals,
finance, reports, settings, logout (+ alt navigasyon: dashboard, jobs, new-job,
notifications, messages). Bu, kullanıcının verdiği müdür sayfa listesiyle **birebir
aynıdır**. Stitch'in müdür paketinde **Denetim Logları / Sistem Durumu / Kullanım
İstatistikleri ekranı YOKTUR** — dolayısıyla beklenen yetki çelişkisi ortaya çıkmadı.

### Kategori tablosu

| Ekran | Kategori | Açıklama | Durum |
|---|---|---|---|
| Ana Sayfa (Müdür Paneli) | B | Bugünün durum dağılımı, hizmet türü kırılımı, sahadaki personel oranı, bu ay tamamlama oranı, onay bekleyen saha raporu sayısı — hepsi `/dashboard/summary`'ye eklendi (mevcut alanlar korunarak) | Uçtan uca doğrulandı (backend+web+Flutter) |
| Takvim | A | Mevcut takvim ekranı; müdür temasına/navigasyonuna alındı, veri akışı değişmedi | Arayüz bağlandı |
| Bildirimler | A | Mevcut bildirim merkezi; müdür alt navigasyonunda 3. sekme oldu | Arayüz bağlandı |
| Mesajlar (liste + sohbet) | A | Mevcut mesajlaşma; müdür alt navigasyonunda 4. sekme. OWNER'a özel `/conversations/all` izleme yetkisi **açılmadı** (403 doğrulandı) | Arayüz bağlandı |
| Bekleyen Onaylar | B | Saha raporu onayı kuyruğa eklendi: `POST /jobs/:id/report/approve` + `GET /jobs?pendingReportApproval=true`; iyimser kilit (mükerrer onay 409), personele bildirim, `job.report.approve` denetim kaydı | Uçtan uca doğrulandı |
| Müşteriler | B | Satır başına bekleyen bakiye / iş sayısı / aktif sözleşme / son iş tarihi sunucu tarafında (`groupBy`) hesaplanır; `sort=newest\|name\|balance`. Web'deki müşteri başına N+1 detay isteği kaldırıldı | Uçtan uca doğrulandı |
| Personel | B | `Staff.vehiclePlate`, `Staff.dailyJobCapacity` alanları; liste yanıtına bugünkü iş sayısı, süresi dolan belge sayısı, ortalama puan, puanlanan iş sayısı eklendi (web'deki personel başına N+1 `/jobs` isteği kaldırıldı). Kapasite tanımlı değilse doluluk çubuğu **hiç gösterilmez** (uydurma üst sınır yok) | Uçtan uca doğrulandı |
| Performans | B | Liderlik tablosuna geçen ay karşılaştırması, puanlanan iş sayısı, `targetCompletionPercent` ve `summary` bloğu eklendi; aylık hedef OWNER'ın `/settings`'teki `monthly_job_target` değerinden okunur, tanımsızsa hedef göstergesi gizlenir | Uçtan uca doğrulandı |
| Stok | B | `Product.code`, `Product.description`, 4. kategori `DISINFECTANT`; liste yanıtında son hareket + sipariş bekleyen miktar. Yeni `StockPurchaseRequest` modeli: talep oluştur / listele / mal kabul-iptal. Mal kabulü **tek transaction** içinde stoğu artırır + `StockMovement(IN)` yazar; `status: PENDING` koşullu `updateMany` ile mükerrer mal kabulü 409 döner | Uçtan uca doğrulandı |
| İşler | B | `Job.sequenceNo` (insan-okunur iş no), `Job.scheduledEndAt` (randevu penceresi), `Job.cancelledAt` + `Job.cancellationReason` (iptal gerekçesiz kaydedilemez) | Uçtan uca doğrulandı |
| Sözleşmeler | B | `POST /contracts/:id/renew` (eski dönem EXPIRED, yeni dönem eski bitiş tarihinden başlar; iyimser kilitle mükerrer yenileme 409). `GET /contracts/summary` → MRR (periyot aylığa normalize), aktif sayısı, 30 günde bitecek sayısı. `RecurrenceType`'a `SEMIANNUAL` ve `ANNUAL` eklendi | Uçtan uca doğrulandı |
| Teklifler | B | `QuoteRequest.note` (yönetim notu), `surveyAt` (keşif randevusu), `convertedAt`; `GET /quotes/summary` → durum kırılımı, bekleyen teklif tutarı, dönüşüm oranı; listede arama | Uçtan uca doğrulandı |
| Para | B | `Payment.referenceNo` (dekont/işlem no), `Payment.collectedByStaffId` (tahsil eden personel); özet uca ay-üstü-ay değişim, tahsilat türü kırılımı (ayın tamamından, sayfadaki kayıtlardan değil) ve `monthly_revenue_target` hedefi eklendi. **Net kâr alanı MANAGER'a gönderilmemeye devam ediyor** (`view_finance` izni yoksa) | Uçtan uca doğrulandı |
| Raporlar | A | Mevcut analitik uçları (ciro trendi, hizmet kırılımı, bölge, müşteri sadakati) yeterliydi; yeni uç gerekmedi | Arayüz bağlandı |
| Ayarlar | A | Müdür için yeni Flutter ekranı: profil + bildirim tercihleri (`/notification-preferences`, tüm rollere açık). Firma bilgileri / hizmet türleri / bölgeler / hedefler / yedekleme OWNER'a kısıtlı kalır ve ekranda **düzenlenebilir gibi gösterilmez**, yalnızca bilgilendirme satırı vardır — Stitch tasarımı da aynı satırı içerir | Arayüz bağlandı |

**Özet:** Kategori A = 5 ekran (Takvim, Bildirimler, Mesajlar, Raporlar, Ayarlar),
Kategori B = 10 ekran, Kategori C = 0 ekran.

### Yetki Çelişkileri (Kategori C)

**Bu turda uygulanmayan bir yetki çelişkisi bulunamadı.** Müdür Stitch paketi mevcut
yetki haritasına uyumludur; kontrol edilen ve doğrulanan sınırlar (MANAGER hesabıyla
canlı olarak test edildi, hepsi **403**):

| Uç | MANAGER sonucu | Kaynak |
|---|---|---|
| `GET /audit-logs` | 403 | `backend/src/routes/auditLogs.ts` (OWNER-only) |
| `GET /settings` | 403 | `backend/src/routes/settings.ts` (OWNER-only) |
| `GET /sessions/report` | 403 | `backend/src/routes/sessions.ts` |
| `GET /admin/system-health` | 403 | `backend/src/routes/admin.ts` |
| `GET /conversations/all` | 403 | `backend/src/routes/conversations.ts` (patron gözlemci) |
| `netProfitThisMonth` alanı | yanıtta yok | `paymentsController.ts:getPaymentsSummary` — `view_finance` izni gerekli |

Stitch müdür tasarımı bu sınırların hiçbirini zorlamıyor: "Para" ekranında net kâr
kartı yok, "Ayarlar" ekranı "Diğer sistem ayarları… yalnızca işletme sahibi tarafından
yönetilebilir" satırını kendisi içeriyor ve çekmecede denetim/sistem sayfası yok.

**Hedefler için uygulanan çözüm:** Müdür `/settings`'e erişemediği hâlde panelde
"Hedef: X iş/ay" ve "Tahsilat Hedefi" göstergelerinin gerçek veriden beslenmesi
gerekiyordu. Hedefler OWNER'ın yönettiği `Setting` satırlarında tutulur
(`monthly_job_target`, `monthly_revenue_target`) ve `backend/src/lib/targets.ts`
üzerinden **iş uçlarının yanıtına gömülerek** sunulur (`/staff/leaderboard`,
`/payments/summary`). Böylece yetki sınırı korunur, gösterge uydurulmaz. Hedef
tanımlı değilse ilgili alanlar `null` döner ve arayüz göstergeyi **hiç göstermez**.

### Navigasyon farkları (MANAGER'a özel)

`mobile/lib/navigation/manager_shell.dart` — MANAGER artık `RoleShell`'in 5 sekmeli
patron düzenini değil, kendi kabuğunu kullanır:

- **Alt navigasyon (4 sekme + ortada 56px FAB)**: Ana Sayfa · İşler · **[+ Yeni İş]** · Bildirimler · Mesajlar
- **Hamburger çekmecesi** (`#2F5233` → `#1E3521` gradyan başlık, avatar + "Müdür" rozeti), gruplu:
  - **Genel**: Takvim, Bekleyen Onaylar
  - **Operasyon**: Müşteriler, Personel, Performans, Stok
  - **Finans**: Sözleşmeler, Teklifler, Para, Raporlar
  - Ayarlar · Çıkış Yap
- Toplam: 4 sekme + 11 çekmece girişi = **15 sayfa**, kullanıcının verdiği listeyle birebir.
- Çekmece, sekme ekranlarının kendi `Scaffold`'ları olduğu için `ManagerNav`
  (`mobile/lib/navigation/manager_nav.dart`) InheritedWidget'ı üzerinden açılır;
  bu widget yalnızca müdür kabuğunda bulunduğundan diğer roller etkilenmez
  (`ManagerNav.maybeLeading` orada `null` döner).

### Yeni/değişen backend uçları (Faz 6)

| Uç | Yetki | Not |
|---|---|---|
| `POST /jobs/:id/report/approve` | OWNER, MANAGER | İyimser kilit (`approvedAt: null` koşullu `updateMany`), personele bildirim, denetim kaydı |
| `GET /jobs?pendingReportApproval=true` | (rol kapsamı korunur) | Onaysız raporu olan işler |
| `POST /products/:id/purchase-requests` | OWNER, MANAGER | Talep oluşturur, stok artmaz |
| `GET /products/purchase-requests` | OWNER, MANAGER | Durum filtreli liste |
| `PATCH /products/purchase-requests/:id` | OWNER, MANAGER | RECEIVED → transaction içinde stok + hareket; mükerrer 409 |
| `GET /contracts/summary` | OWNER, MANAGER | MRR + portföy sayıları |
| `POST /contracts/:id/renew` | OWNER, MANAGER | Gövdesiz de çalışır; mükerrer 409 |
| `GET /quotes/summary` | OWNER, MANAGER | Huni özeti + dönüşüm oranı |

### Faz 6 açık soruları (uydurulmadı) — **hepsi Faz 7'de karara bağlandı, açık madde kalmadı**

9. **Şube kavramı** **[KAPSAM DIŞI — Faz 7: `Customer.district` yeterli]**: Müdür iş kartlarında "X Şube" ve çekmecede şube satırı görünüyor,
   ancak sistemde `Branch` diye bir varlık yok. Şu an `Customer.district` (semt) bu
   bilgiyi karşılıyor. Gerçek bir şube/lokasyon hiyerarşisi mi isteniyor, yoksa semt
   yeterli mi?
10. **Canlı GPS/harita takibi** **[KAPSAM DIŞI — Faz 7: konum altyapısı ayrı kapsam]**: Müdür ana sayfasında "sahadaki ekipler" haritası var;
    sistemde konum kaydı (koordinat alanı, konum bildirimi) hiç yok. Ayrı bir kapsam.
11. **Barkod/karekod tarama** **[KAPSAM DIŞI — Faz 7: istasyon/etiket modeli yok]** (Faz 5'teki 6. maddenin müdür karşılığı): stok ekranında
    "tara" ikonu var, istasyon/etiket modeli yok.
12. **Stok sayımı ("son sayım" tarihi)** **[UYGULANDI — Faz 7: `POST /products/:id/count`]**: Stitch stok kartlarında "son sayım" bilgisi
    var; sistemde envanter sayımı (stock count/adjustment) kavramı yok. `StockMovement`
    üzerine bir `ADJUSTMENT` türü mü eklenmeli?
13. **Teklif "Sistem Öneri Bütçesi" / "Risk Skoru"** **[KAPSAM DIŞI — Faz 7: tanımlı formül yok]**: Stitch teklif ekranında otomatik
    fiyat önerisi ve risk rozeti var; hangi formülle hesaplanacağı tanımlı değil.
14. **Teklif "Tarihçe" sekmesi** **[UYGULANDI — Faz 7: `GET /quotes/:id/history`]**: Bir teklifin geçmiş değişikliklerini gösteriyor. Bu
    veri `AuditLog`'ta mevcut ama `/audit-logs` **OWNER'a kısıtlı**. Müdüre yalnızca
    `targetType=QuoteRequest` kayıtlarını gösteren daraltılmış bir uç açılsın mı?
    (Yetki genişletmesi olduğu için **uygulanmadı**, karar bekliyor.)
15. **Bildirim sesi/titreşim ayarı** **[KAPSAM DIŞI — Faz 7: FCM altyapısı yok]**: Stitch ayarlar ekranında var; push altyapısı
    (FCM) henüz kurulmadığı için karşılığı yok.
16. **"%94 Başarı" rozetinin formülü**: Stitch'te tanımsız. Uygulanan varsayım
    açıkça belgelendi: `tamamlanan / (tamamlanan + iptal)`, bu ay için; hiç sonuçlanan
    iş yoksa `null` döner ve yüzde **gösterilmez**
    (`backend/src/controllers/dashboardController.ts`).

### Faz 6 doğrulama çıktıları

| Kontrol | Sonuç |
|---|---|
| `backend: npx tsc --noEmit` | Temiz (çıktı yok) |
| `web: npx tsc --noEmit` | Temiz |
| `web: npx next build` | Başarılı, 20 rota derlendi |
| `mobile: dart analyze` | 0 error / 0 warning (yalnızca önceden var olan lint `info` kayıtları) |
| `mobile: flutter test` | `All tests passed!` |
| Canlı uç testleri (MANAGER hesabı, gerçek DB) | Tümü beklendiği gibi; ayrıntı aşağıda |
| Debug APK | `mobile/build/app/outputs/flutter-apk/app-debug.apk` yeniden derlendi |

Canlı yazma testlerinde doğrulananlar:
stok talebi → "sipariş bekleyen" görünür ama stok artmaz → mal kabulünde stok tam olarak
talep kadar artar → mükerrer mal kabul **409**; saha raporu onayı **200**, tekrarı **409**,
`approvedAt` + onaylayan adı dolu; sözleşme yenileme **201** (yeni dönem) ve tekrarı **409**,
eski kayıt EXPIRED; tahsilat dekont no + tahsil eden personelle kaydedilip listede geri
okundu; yeni iş `sequenceNo` ve `scheduledEndAt` ile oluşturuldu, gerekçeli iptalde
`cancelledAt` + `cancellationReason` yazıldı; teklif notu ve keşif randevusu kaydedildi.
**Testte oluşturulan tüm kayıtlar sonradan geri alındı** (bkz. rapor).

---

## Faz 7: Açık Soruların Kapatılması (kullanıcı kararı)

Kullanıcı 16 açık sorudan 2'sini uygulamaya, 6'sını kalıcı olarak kapsam dışına aldı.
Bu bölüm o kararların uygulanmış hâlidir; **kapsam dışı maddeler bir daha açık soru
olarak sorulmayacaktır.**

### Uygulandı

| # | Madde | Uygulama | Durum |
|---|---|---|---|
| 12 | **Stok sayımı / mutabakat** | `POST /products/:id/count` — kullanıcı sayılan gerçek miktarı girer; fark = sayılan − mevcut. Fark pozitifse `IN`, negatifse `OUT` yönünde **tek** bir `StockMovement` üretilir (`note: "Fiili sayım mutabakatı, önceki: X, sayılan: Y"`) ve `currentStock` sayılan değere **eşitlenir**. Denetim kaydı: `stock.count_adjustment`. Fark sıfırsa hiçbir hareket/denetim kaydı yazılmaz, yanıt `adjusted: false` döner ve arayüz bunu açıkça söyler. Eşzamanlılık: `currentStock` koşullu `updateMany` iyimser kilidi — sayım formu açıkken başka biri stok girişi yaparsa istek **409** döner ve taze hareket sessizce ezilmez. | Uçtan uca doğrulandı (backend + web + Flutter) |
| 14 | **Teklif tarihçesi** | `GET /quotes/:id/history` — sorgu `targetType="QuoteRequest" AND targetId=:id` ile **sabitlenmiştir**; istemci hiçbir filtre parametresi geçiremez. Yalnızca OWNER+MANAGER. `/audit-logs` **OWNER'a kısıtlı kalmaya devam eder** (MANAGER için hâlâ 403). | Uçtan uca doğrulandı (backend + web + Flutter) |

Arayüzler: web'de `stok` sayfasında satır aksiyonu "Fiili Sayım Gir" (fark önizlemeli
modal) ve `teklifler` sayfasında "Tarihçe" düğmesi; Flutter'da stok kartında "Sayım"
aksiyonu (canlı fark önizlemeli alt sayfa) ve teklif kartında "Tarihçe" ekranı.

### Kalıcı olarak kapsam dışı bırakıldı (yeniden sorulmayacak)

| # | Madde | Gerekçe |
|---|---|---|
| 9 | Şube kavramı | Kullanıcı kararı: ayrı bir `Branch` varlığı kurulmayacak; `Customer.district` (semt) bu ihtiyacı karşılıyor. |
| 10 | Canlı GPS / harita takibi | Kullanıcı kararı: konum kaydı altyapısı (koordinat alanı, izin akışı, arka plan konumu) ayrı ve büyük bir kapsam; ertelendi. |
| 11 | Barkod / karekod istasyon tarama | Kullanıcı kararı: istasyon/etiket (trap) modeli olmadığı için anlamlı bir karşılığı yok; ertelendi. |
| 13 | Teklif "Sistem Öneri Bütçesi" / risk skoru | Kullanıcı kararı: fiyat önerisi ve risk skoru için tanımlı bir formül yok; uydurulmayacak. |
| 15 | Bildirim sesi / titreşim (FCM) | Kullanıcı kararı: push altyapısı kurulmadan ayar ekranına sahte anahtar konmayacak. |
| 5 | SMS / e-fatura entegrasyonu | Kullanıcı kararı: sağlayıcı seçimi yapılmadan uygulanmayacak (Faz 5'ten devreden madde). |

### Bu turda bulunan ve düzeltilen hata: Prisma `Decimal` alanları JSON'da string

Sayım özelliğini test ederken ortaya çıktı: Prisma `Decimal` sütunları API yanıtında
**string** olarak serileşiyor (`"currentStock": "-8"`), `Int`/`Float` alanları ise sayı
olarak. Bunun yol açtığı, benim önceki fazlarda yazdığım iki gerçek hata düzeltildi:

- **Flutter**: `(json['currentStock'] as num)` bir String üzerinde çalışma anında
  `TypeError` fırlatır — yani stok/finans/personel modelleri gerçek veriyle çökerdi.
  Yeni `mobile/lib/models/decimal.dart` (`decimalOrNull` / `decimalOr`) her iki
  gösterimi de kabul eder; tüm Decimal alanları (amount, price, currentStock,
  criticalThreshold, quantity, salaryBase …) buna taşındı.
- **Web**: `web/src/app/(dashboard)/stok/page.tsx` içindeki
  `row.currentStock <= row.criticalThreshold` **string sıralaması** yapıyordu —
  `"13" <= "4"` doğru dönerek stoğu yeterli olan ürünü "Kritik" gösterebilirdi.
  `web/src/lib/format.ts:decimalValue()` eklendi, ilgili alanlar
  `types.ts:ApiDecimal` (`number | string`) olarak dürüstçe tiplendi ve tüm
  karşılaştırmalar bu yardımcıdan geçirildi.

### Faz 7 doğrulama çıktıları

| Kontrol | Sonuç |
|---|---|
| `backend: npx tsc --noEmit` | Temiz |
| `web: npx tsc --noEmit` | Temiz |
| `web: npx next build` | Başarılı |
| `mobile: dart analyze` | 0 error / 0 warning |
| `mobile: flutter test` | All tests passed |

Canlı testler (MANAGER hesabı, gerçek DB):

- Fiili sayım **+5**: `adjusted=true`, `difference=5`, stok 13 → 18, `IN 5` hareketi.
- Fiili sayım **−7**: `adjusted=true`, `difference=-7`, stok 18 → 11, `OUT 7` hareketi.
- Fiili sayım **fark yok**: `adjusted=false`, hiçbir hareket/denetim kaydı yazılmadı.
- Teklif tarihçesi: ilgili teklif için 3 kayıt döndü; **başka bir teklifin** tarihçesi 0
  kayıt (kapsam sızıntısı yok). STAFF → **403**. MANAGER `/audit-logs` → **hâlâ 403**.

**Test verisi temizliği (ID bazlı, tarih aralığı kullanılmadı):** stok 13'e geri alındı;
`e0e05b5d…`, `b1b730b0…` stok hareketleri silindi; `44c046da…`, `a8bd0e1f…`,
`2db12c6a…`, `d6850259…` denetim kayıtları silindi; teklif `70d2711f…` notu null
yapıldı. Toplam 6 silme + 2 geri alma, hepsi tek tek ID ile.

---

## Faz 8: Şef (Team Lead) Özel Tasarımı

Kaynak: `references/stitch/sef/stitch_pest_control_team_lead_ui_ef/`

**Ekran sayısı (gerçek dosya sayımı):**

```
unzip -l stitch_pest_control_team_lead_ui_ef.zip | grep -c code.html   → 8
unzip -l stitch_pest_control_team_lead_ui_ef.zip | grep -c screen.png  → 8
unzip -l stitch_pest_control_team_lead_ui_ef.zip | grep -c DESIGN.md   → 1
find references/stitch/sef -iname code.html | wc -l                    → 8
find references/stitch/sef -iname screen.png | wc -l                   → 8
```

**8 ekran = 8 dosya çifti.** Klasörler: ana_sayfa, takvim, bildirimler, mesajlar,
mesaj_detay, i_ler, ekip_performans, ayarlar (+ tasarım sistemi için
`nil_fer_field_ops/DESIGN.md`, bir ekran değildir).

**Sayfa listesi doğrulaması:** Çekmecesi olan 6 ekranın tamamındaki `data-path`
değerleri okundu ve hepsi tutarlı: `ana-sayfa | takvim | bildirimler | mesajlar |
ekip-performansi | isler | ayarlar` = **tam 7 sayfa**, kullanıcının verdiği şef yetki
haritasıyla birebir. Bekleyen Onaylar, Müşteriler, Personel yönetimi, Stok yazma,
Sözleşmeler, Teklifler, Para, Raporlar, Denetim/Sistem ekranları çekmecede **yoktur**.

### Kategori tablosu

| Ekran | Kategori | Açıklama | Durum |
|---|---|---|---|
| Ana Sayfa | B | Yeni `GET /team/summary`: bugünkü ekip işleri, durum kırılımı, tamamlama oranı, sahadaki teknisyen sayısı ve kişi bazlı iş yükü (kapasiteli). Kapsam sunucuda `getTeamStaffIds` ile tek seviyeye sınırlı; şirket geneli `/dashboard/summary` TEAM_LEAD'e **açılmadı** (403 doğrulandı) | Uçtan uca doğrulandı |
| Takvim | B | Yeni `GET /team/calendar`: aylık gün bazlı yoğunluk, bugünün slot doluluğu, haftalık toplam/kapasite, en yoğun gün. Kapasite = ekip üyelerinin `Staff.dailyJobCapacity` toplamı; hiçbirinde tanımlı değilse `null` döner ve **doluluk yüzdesi hiç gösterilmez** | Uçtan uca doğrulandı |
| Bildirimler | B | Yeni `GET /notifications/summary` (toplam/okunmamış/bugün + kategori dağılımı) ve `?category=` filtresi. Kategori eşlemesi `Notification.type` üzerinden tek yerde tutulur (`lib/notificationCategories.ts`); başlık metnine bakan eski yöntem yalnızca `type` alanı boş ESKİ kayıtlar için yedek kaldı. Ayrıca yeni `job_assigned` bildirimi: bir işe personel atandığında **onun ekip lideri** bilgilendirilir. Stok uyarısı bildiriminde **"Talep Oluştur"** aksiyonu (şefe açık) | Uçtan uca doğrulandı |
| Mesajlar | B | Yeni `POST /conversations/broadcast`: şef, doğrudan ekibinin tamamına aynı mesajı gönderir. Grup konuşması kavramı olmadığı için her üyeyle ayrı birebir konuşma kullanılır (yoksa açılır); tüm yazma **tek transaction** içinde — bir alıcı başarısız olursa yarım duyuru oluşmaz. Denetim kaydı: `conversation.team_broadcast` | Uçtan uca doğrulandı |
| Mesaj Detayı | B | `Message.attachmentUrl` + `Message.attachmentType` alanları; sohbete saha fotoğrafı eki (iş fotoğraflarıyla aynı depolama altyapısı). Flutter'da `image_picker` ile seçim + önizleme, web'de balon içinde gösterim | Uçtan uca doğrulandı |
| İşler | B | Arama artık **iş numarası** (`sequenceNo`, `#` önekli de kabul) ve **müşteri adresi/semti** üzerinde de çalışıyor. Ekip içi yeniden atama artık iyimser kilitli (eşzamanlı atamada 409), atanan personele bildirim gider ve `job.reassign` denetim kaydı yazılır; aynı kişiye tekrar atama idempotent no-op | Uçtan uca doğrulandı |
| Ekip Performansı | B | `GET /staff/leaderboard?period=this_month\|last_month\|this_year` dönem desteği; kişi ve ekip bazında **zamanında tamamlama oranı**, önceki dönemle karşılaştırma. Mevcut alan adları korundu, Müdür/Patron ekranları bozulmadı | Uçtan uca doğrulandı |
| Ayarlar | A | Faz 6'da müdür için yazılan `SettingsScreen` yeniden kullanıldı: profil + bildirim tercihleri gerçek uca bağlı; diğer sistem ayarlarının işletme sahibinde olduğu bilgilendirme satırı Stitch tasarımıyla birebir | Arayüz bağlandı |

**Özet:** Kategori A = 1 ekran (Ayarlar), Kategori B = 7 ekran, Kategori C = 0 ekran.
Kategori C'de başlangıçta 4 madde vardı; kullanıcı kararı sonrası **1'i uygulandı**
(şefin stok takviye talebi), 3'ü kalıcı olarak kapsam dışında kaldı.

### Zamanında tamamlama oranının tanımı (Stitch'te belirtilmemişti)

Stitch'teki "Zamanında %98" sütunu için formül tanımlı değildi; **uydurulmadı**, açıkça
belgelenerek uygulandı (`backend/src/controllers/staffController.ts:isOnTime`):

- `scheduledEndAt` doluysa: `completedAt <= scheduledEndAt`.
- Değilse: `completedAt`, `scheduledAt` ile **aynı takvim gününde** ise zamanında sayılır
  (yalnızca başlangıç saatini son tarih kabul etmek, 09:00'a planlanmış işi 09:05'te
  bitirince "geciken" gösterirdi).
- `scheduledAt` hiç yoksa iş bu ölçüme **dahil edilmez** (paydada da yoktur).
- Ölçülebilir iş yoksa `null` döner ve arayüz oranı **hiç göstermez**.

### Yetki Çelişkileri (Kategori C — uygulanmadı)

| Stitch ne gösteriyor | Gerçek yetki haritası | Kontrolün yeri | Karar |
|---|---|---|---|
| `DESIGN.md` çekmece metni: "Kimyasal & Ekipman Stoğu", "Müşteri & Lokasyon Dizini", "Ekip Yetkilendirme & Takip", "Acil Müdahale Kayıtları", "Sistem & Cihaz Ayarları" (7 maddelik farklı bir liste) | Şef stok **yazamaz**, müşteri listesine **erişemez**, personel yetkilendirmesi **yapamaz**, sistem ayarlarını **değiştiremez** | `routes/products.ts` (yazma OWNER/MANAGER), `routes/customers.ts`, `routes/staff.ts` (permissions OWNER), `routes/settings.ts` (OWNER) | **Uygulanmadı.** Gerçek 8 ekranın `data-path` çekmecesinde bu maddeler zaten YOK; yalnızca DESIGN.md düzyazısında geçiyor. Kod, gerçek ekranları esas aldı. |
| Bildirimler → stok uyarısında **"Talep Oluştur"** düğmesi (jel ilaç takviyesi) | Talep AÇMA artık şefe açık; **sonuçlandırma** (listeleme/mal kabul/iptal) OWNER/MANAGER'da | `routes/products.ts`: `POST /:id/purchase-requests` → `requireRole(OWNER, MANAGER, TEAM_LEAD)`; `GET /purchase-requests` ve `PATCH /purchase-requests/:id` OWNER/MANAGER'da kaldı | **UYGULANDI** (kullanıcı onayı). Dar kapsamlı yetki genişletmesi: şef yalnızca talep açar, kendi talebini sonuçlandıramaz. |
| Bildirimler → **"Ödeme"** kategori sekmesi | Şef finansal veriye erişemez (`/payments`, `/payments/summary` → 403) | `routes/payments.ts` | Kategori altyapısı tüm roller için ortak; şefte sayaç doğal olarak **0** kalır, finans verisi sızmaz. Ayrı bir kısıt gerekmedi. |
| Takvim → **"Canlı Ekip Rotaları / Haritada Gör"**, Mesaj Detayı → **"Canlı Konum"** | Sistemde konum/koordinat kavramı yok | — | **Uygulanmadı** — Faz 7'de madde 10 (GPS/harita) kalıcı olarak kapsam dışı bırakıldı. |
| Mesaj Detayı → **sesli mesaj** (kayıt/oynatma, 0:08/0:24) | Sistemde ses kaydı/oynatma altyapısı yok | — | **Uygulanmadı.** Yeni bir native kayıt bağımlılığı + mikrofon izni gerektirir; fotoğraf eki uygulandı, ses eki açık madde olarak aşağıda. |

**Doğrulanan yetki sınırları (TEAM_LEAD hesabıyla canlı test, hepsi 403):**
`/dashboard/summary`, `/dashboard/activity-feed`, `/payments`, `/payments/summary`,
`/customers`, `/contracts`, `/quotes`, `/advances`, `/audit-logs`, `/settings`,
`/admin/system-health`, `/conversations/all`, `/sessions/report`,
`/products/purchase-requests`, `/analytics/revenue-trend`.

**Ekip kapsamı sızıntı testi:** şef 4 personel / 21 iş görüyor, yönetim 7 personel / 36 iş
görüyor; ekip **dışı** bir personelin detayı (`GET /staff/:id`) şefe **403** dönüyor
(önceki oturumda kapatılan açık kapalı kaldı); ekip dışı birine atama denemesi **400**.

### Navigasyon (TEAM_LEAD'e özel)

`mobile/lib/navigation/team_lead_shell.dart` — şef artık patron/müdür kabuğunu değil
kendi kabuğunu kullanır:

- **Alt navigasyon (4 sekme)**: Ana Sayfa · İşler · Bildirimler · Mesajlar
- **Çekmece**: Takvim, Performans + Ayarlar, Çıkış Yap
- Toplam **7 sayfa**, Stitch `data-path` listesiyle birebir; fazla/eksik sekme yok.
- Çekmece, Faz 6'da yazılan `ManagerNav` InheritedWidget'ı üzerinden açılır; bu widget
  yalnızca müdür/şef kabuklarında bulunduğu için diğer roller etkilenmez.

### Yeni/değişen backend uçları (Faz 8)

| Uç | Yetki | Not |
|---|---|---|
| `GET /team/summary` | OWNER, MANAGER, TEAM_LEAD | Kapsam her zaman çağıranın kendi ekibi |
| `GET /team/calendar?month=YYYY-MM` | OWNER, MANAGER, TEAM_LEAD | Yoğunluk + kapasite |
| `GET /notifications/summary` | Tüm roller (kendi bildirimleri) | Kategori dağılımı |
| `GET /notifications?category=` | Tüm roller | `type` bazlı filtre |
| `POST /conversations/broadcast` | OWNER, MANAGER, TEAM_LEAD | Transaction + denetim kaydı |
| `POST /conversations/:id/messages` | (mevcut) | `attachmentBase64` alanı eklendi |
| `GET /staff/leaderboard?period=` | (mevcut) | Dönem + zamanında oranı eklendi |
| `PATCH /jobs/:id` (TEAM_LEAD) | (mevcut) | İyimser kilit + bildirim + denetim kaydı eklendi |
| `POST /products/:id/purchase-requests` | OWNER, MANAGER, **TEAM_LEAD** | Rol genişletildi (kullanıcı onayı); talep açma şefe açık, sonuçlandırma değil |

### Faz 8 doğrulama çıktıları

| Kontrol | Sonuç |
|---|---|
| `backend: npx tsc --noEmit` | Temiz |
| `web: npx tsc --noEmit` | Temiz |
| `web: npx next build` | Başarılı |
| `mobile: dart analyze` | 0 error / 0 warning |
| `mobile: flutter test` | All tests passed |
| Canlı yetki testleri | 15 uçta 403, 9 uçta 200 — yukarıdaki tablo |
| Canlı yazma testleri | Duyuru 3 alıcı · fotoğraf eki kaydedildi · atama 200 / ekip dışı 400 / tekrar idempotent |
| Debug APK | Yeniden derlendi |

**Test verisi temizliği (ID bazlı, tarih aralığı KULLANILMADI):** 4 mesaj, 5 bildirim,
2 denetim kaydı silindi (11/11), 1 yüklenen dosya silindi, iş #35'in ataması özgün
personele geri alındı. Silinecek kayıtların tam listesi silme öncesinde raporlandı.

### Faz 8 açık soruları

**Üçü de karara bağlandı; açık madde kalmadı.**

1. **Sesli mesaj (sohbette ses kaydı/oynatma)** **[KAPSAM DIŞI — native ses kaydı/mikrofon
   izni gerektiriyor, ayrı bir iş kalemi]**: Stitch mesaj detayında var; sistemde ses
   altyapısı yok. Sohbete **fotoğraf** eki uygulandı, ses ertelendi.
2. **Şefin stok takviye talebi açabilmesi** **[UYGULANDI — `POST /products/:id/purchase-requests`
   rolü OWNER/MANAGER/TEAM_LEAD'e genişletildi]**: Şef talebi AÇAR; listeleme, mal kabul ve
   iptal OWNER/MANAGER'da kalır (403 doğrulandı). Talebi açanın adı yönetime giden
   bildirimde gösterilir.
3. **"Şef Notu" alanı** **[KAPSAM DIŞI — kim yazar/görür belirsiz, iş kuralı netleşmeden
   uygulanmayacak]**: Ekip Performansı ekranındaki serbest metin notu; veri modeli
   tanımlanmadan uydurulmadı.

## Faz 9: Personel (Staff) Özel Tasarımı

Kaynak: `references/stitch/personel/stitch_nil_fer_staff_mobile_app_personel/`

**Ekran sayısı (gerçek dosya sayımı):**

```
unzip -l stitch_nil_fer_staff_mobile_app_personel.zip | grep -c code.html   → 8
unzip -l stitch_nil_fer_staff_mobile_app_personel.zip | grep -c screen.png  → 8
unzip -l stitch_nil_fer_staff_mobile_app_personel.zip | grep -c DESIGN.md   → 1
```

**8 ekran = 8 dosya çifti.** Klasörler: `ana_sayfa_personel_paneli_1`,
`ana_sayfa_personel_paneli_2` (aynı ekranın iki görsel varyasyonu — aynı işlevsellik,
farklı Tailwind/inline-SVG üslubu; varyant 2'nin daha net kart sınırları/gölgeleri
esas alındı), `takvim_g_rev_izelgesi`, `bildirimler`, `mesajlar_sohbet_listesi`,
`mesaj_detay_ef_mehmet_demir`, `i_ler_g_revler_ve_raporlama`, `ayarlar` (+ tasarım
sistemi için `nil_fer_field_operative/DESIGN.md`, bir ekran değildir).

**Sayfa listesi doğrulaması:** Çekmecesi olan tüm ekranlardaki `data-path` değerleri
okundu ve hepsi tutarlı: `ana-sayfa | takvim | bildirimler | mesajlar | isler | ayarlar`
= **tam 6 sayfa**, kullanıcının verdiği personel yetki haritasıyla birebir. Müşteriler,
Personel yönetimi, Stok (ayrı sekme olarak), Para & Finans, Teklifler, Sözleşmeler,
Raporlar, Performans, Denetim/Ayarlar (sistem geneli) çekmecede **yoktur**.

### Kategori tablosu

| Ekran | Kategori | Açıklama | Durum |
|---|---|---|---|
| Ana Sayfa | B | Karşılama + 3 stat kartı + "Vardiya Durumu" segmentli dağılım artık gerçek veriden (backend zaten STAFF'ı `/jobs?date=` ile kendi işlerine sınırlıyor, istemci özetliyor — `/dashboard/summary` STAFF'a kapalı olduğu için ayrı bir yönetim ucu açılmadı). Görev kartlarında **gerçek** ara/yol tarifi/İşe Başla/Tamamla-ve-Raporla aksiyonları (önceden mobilde STAFF ana sayfası yalnızca 1 sayaç gösteriyordu). **"Avans Talep Et"** modalı yeni eklendi — backend zaten `POST /advances`'i STAFF'a açık tutuyordu ama mobilde hiç arayüzü yoktu | Uçtan uca doğrulandı |
| Takvim | A | Mevcut `CalendarScreen` zaten rol bazlı `/jobs` üzerinden çalışıyordu, personel için ek değişiklik gerekmedi | Arayüz zaten bağlıydı |
| Bildirimler | A | Mevcut `NotificationsScreen` zaten role-agnostic ve gerçek uca bağlı | Arayüz zaten bağlıydı |
| Mesajlar / Mesaj Detayı | A | Mevcut sohbet akışı zaten `canUsersMessage` ile hiyerarşiye (Şef/Müdür/Patron) kısıtlı geliyordu; Stitch'in statik "Yalnızca hiyerarşik amirlerinize mesaj başlatabilirsiniz" uyarısı yerine GERÇEK, zaten çalışan `available-contacts` akışı korundu (statik uyarı gerçek işlevden daha kısıtlayıcı olurdu) | Arayüz zaten bağlıydı |
| İşler | B | **Çoklu ürün seçimi**: yeni `JobReportProduct` tablosu — bir saha raporunda BİRDEN FAZLA ürün, her biri kendi miktarıyla seçilebiliyor (eski şema yalnızca tekli `productId`/`quantity` destekliyordu, mobilde bu alan hiç arayüze bile bağlanmamıştı). Her ürün satırı kendi `StockMovement(OUT)` kaydını üretir. Web `JobReportModal`'a da aynı çoklu ürün desteği eklendi (tutarlılık için). Ayrıca `GET /jobs` artık müşteri telefon/adres/semt bilgisini de döndürüyor (ara/yol tarifi aksiyonları için gerekliydi, önceden yalnızca isim vardı) | Uçtan uca doğrulandı |
| Ayarlar | A | Faz 6/8'de yazılan `SettingsScreen` yeniden kullanıldı: profil + e-posta bildirim tercihi gerçek uca bağlı | Arayüz zaten bağlıydı |

**Özet:** Kategori A = 4 ekran (Takvim, Bildirimler, Mesajlar, Ayarlar — hepsi
zaten var olan genel ekranlardı), Kategori B = 2 ekran (Ana Sayfa, İşler),
Kategori C = 0 ekran (aşağıdaki 3 madde Stitch'te ayrı bir "ekran" değil, ekran
İÇİ tekil öğe olduğu için ayrı ekran sayılmadı, Yetki Çelişkileri altında listelendi).

### Ek bulgu — mevcut yetki sızıntısı (Stitch'ten bağımsız, bu fazda kapatıldı)

Faz 9 doğrulaması sırasında ("başka personelin verilerine erişemediğini doğrula")
Stitch'le **ilgisiz**, önceden var olan iki gerçek yetki açığı bulundu ve düzeltildi:

- `GET /staff` (liste) — STAFF için hiç kapsam filtresi yoktu, **tüm personelin
  maaşı dahil tam listesi** dönüyordu (yalnızca TEAM_LEAD için ekip filtresi vardı).
  Canlı test: Ali Kaya (personel1) çağrısında Burak Aydın'ın (personel5) maaşı
  (`salaryBase: 18500`) görünüyordu.
- `GET /staff/:id` — aynı sebeple herhangi bir personelin detayına (maaş dahil)
  erişilebiliyordu.

**Düzeltme:** `backend/src/controllers/staffController.ts` — STAFF rolü için her
iki uç da artık yalnızca **kendi** kaydını döndürüyor (`getStaffIdForUser` ile).
Mobilde STAFF için bu uçları çağıran hiçbir ekran olmadığından (Ekibim/Personel
sekmesi StaffShell'de yok) davranış değişikliği kullanıcı tarafından hissedilmez;
yalnızca gizli bir veri sızıntısı kapatıldı. Canlı doğrulama: personel1 artık
`GET /staff` çağrısında yalnızca kendi kaydını görüyor, personel5'in id'siyle
`GET /staff/:id` 403 dönüyor.

### Navigasyon (STAFF'a özel)

`mobile/lib/navigation/staff_shell.dart` — personel artık genel `RoleShell`'in
zayıf 5-sekmeli (Ayarlar'ı hiç içermeyen) listesini değil kendi kabuğunu kullanır:

- **Alt navigasyon (4 sekme)**: Ana Sayfa · İşler · Bildirimler · Mesajlar
- **Çekmece**: Takvim + Ayarlar, Çıkış Yap
- Toplam **6 sayfa**, Stitch `data-path` listesiyle birebir; fazla/eksik sekme yok.
- Önceki `RoleShell` listesi STAFF için Ayarlar'ı hiç içermiyordu (gerçek bir eksik
  sayfa) — bu artık `ManagerNav`/`TeamLeadShell` ile aynı desende düzeltildi.

### Yeni/değişen backend uçları (Faz 9)

| Uç | Yetki | Not |
|---|---|---|
| `POST /jobs/:id/report` | (mevcut) | `products: [{productId, quantity}]` dizisi eklendi — eski tekli `productId`/`quantity` geriye dönük uyumlu kalır |
| `GET /jobs/:id/report` | (mevcut) | Yanıta `products` (her satırda ürün adı/birimi ile) eklendi |
| `GET /jobs`, `GET /jobs/:id` | (mevcut) | `customer` include'una `phone`, `address`, `district` eklendi (ara/yol tarifi aksiyonları için) |
| `GET /staff`, `GET /staff/:id` | (mevcut, kapsam daraltıldı) | STAFF artık yalnızca kendi kaydını görür (önceki sızıntı kapatıldı) |

### Yetki Çelişkileri (Kategori C — uygulanmadı)

| Stitch ne gösteriyor | Gerçek yetki haritası | Kontrolün yeri | Karar |
|---|---|---|---|
| Alt navigasyon ortası — **"QR Kod Tara"** yüzen aksiyon butonu (`hizli-islem`) **[KAPSAM DIŞI — kullanım senaryosu netleşmeden uygulanmayacak]** | Sistemde QR kod tabanlı bir check-in/tarama akışı (ne için tarandığı, hangi veriyi değiştirdiği) tanımlı değil | — | **Uygulanmadı, karara bağlandı: ertelendi.** Anlamı belirsiz — iş başlangıcı için mi, ürün/barkod okuma için mi, envanter sayımı için mi? İş kuralı netleşmeden uygulanmayacak. |
| Bildirimler → Depo uyarısı kartında **"Merkez Depodan Talep Et"** düğmesi | Satın alma (stok takviye) talebi açma STAFF'a değil yalnızca OWNER/MANAGER/TEAM_LEAD'e açık (Faz 8'de şefe genişletilmişti, personele değil) | `backend/src/routes/products.ts`: `POST /:id/purchase-requests` → `requireRole(OWNER, MANAGER, TEAM_LEAD)` | **Uygulanmadı.** Düğme gerçek bir aksiyona bağlanmadı; personelin stok takviyesi talep etme yetkisi yok. |
| Ayarlar → **"SMS Bildirimleri"** aç/kapa anahtarı **[KAPSAM DIŞI — sağlayıcı seçimi yapılmadan uygulanmayacak]** | Sistemde SMS gönderme altyapısı hiç yok (`NotificationPreference` modelinde yalnızca `emailEnabled`/`dailyDigestEnabled` var, `lib/notify.ts`'de SMS sağlayıcı entegrasyonu yok) | `backend/prisma/schema.prisma:NotificationPreference` | **Uygulanmadı, karara bağlandı: ertelendi.** Sağlayıcı seçimi yapılmadan (İleti Merkezi, Netgsm vb. bir iş kararı) uygulanmayacak; Stitch'teki bu anahtar koda girmedi. |

**Doğrulanan yetki sınırları (personel1/Ali Kaya hesabıyla canlı test, hepsi
403):** `/dashboard/summary`, başka bir personelin işi (`GET /jobs/:id`), başka bir
personelin iş raporu (`GET /jobs/:id/report`), başka bir personelin işine rapor
gönderme (`POST /jobs/:id/report`), başka bir personelin kaydı (`GET /staff/:id`),
kendi kendine `ON_LEAVE` durumu atama.

**Doğrulanan izinli erişim (200):** `GET /jobs` (yalnızca kendi işleri), `GET
/products` (salt okuma — rapor formunda ürün seçmek için), `GET /customers`
(yalnızca kendisine atanmış işlerdeki müşteriler, finansal veri hariç — bu zaten
önceki bir fazda doğru kurulmuştu), `POST /advances` (kendi adına), `PATCH
/staff/:id/status` → `AVAILABLE`/`ON_BREAK` (kendi kaydı).

### Faz 9 doğrulama çıktıları

| Kontrol | Sonuç |
|---|---|
| `backend: npx tsc --noEmit` | Temiz |
| `web: npx tsc --noEmit` | Temiz |
| `web: npx next build` | Başarılı (23 sayfa) |
| `mobile: dart analyze` | 0 error / 0 warning (58 önceden var olan "info" seviyeli stil notu, bu fazda dokunulmayan dosyalarda) |
| `mobile: flutter test` | All tests passed |
| Canlı yetki testleri (personel1 + personel5) | Yukarıdaki iki tabloda özetlenen tüm uçlarda beklenen 403/200 |
| Canlı çoklu-ürün raporu testi | 2 ürün (K-Othrine 2 Litre, Fendona 1 Litre) tek raporda gönderildi, her biri ayrı `StockMovement` ile stoktan düştü (11→9, -6→-7), `GET /jobs/:id/report` her iki satırı da ürün adı/birimiyle döndürdü |
| Debug APK | Yeniden derlendi (gerçek IP + `MOBILE_APP_SECRET` ile); OWNER hesabıyla telefonda regresyon yok doğrulandı |
| Debug APK — STAFF canlı ekran testi | **Yarım kaldı** — bkz. aşağıdaki not |

**Test verisi temizliği (ID bazlı, tarih aralığı KULLANILMADI):** 1 test işi
(`4d45bf65-92a1-4208-8318-729342b6a199`, "TEST_STAFF_PHASE_MULTIPRODUCT"), 1 iş
raporu (`241f4366-e07c-47cb-a096-6f7ec42303de`), 2 `JobReportProduct` satırı, 2
`StockMovement` kaydı, 1 avans talebi (`255fd3a6-1283-4dc8-804b-e3383bb1e3ec`)
silindi; K-Othrine SC 25 ve Fendona 6SC stokları test öncesi değerlerine (11 ve
-6) geri alındı. Silinecek kayıtların tam listesi silme öncesinde raporlandı.

**Not — telefonda canlı STAFF ekran turu tamamlanamadı:** Doğrulama sırasında
test cihazının Wi-Fi bağlantısı koptu (telefon mobil veriye düştü — `adb shell ip
addr` ile doğrulandı, `wlan0` durumu `DORMANT/NO-CARRIER`) ve neredeyse eşzamanlı
olarak bilgisayarın Wi-Fi IP'si de değişti (`10.99.80.181` → `10.3.0.35`). APK
doğru IP ile yeniden derlenip kuruldu ve OWNER hesabıyla regresyon yokluğu telefon
üzerinde doğrulandı, ancak personel1 (Ali Kaya) ile canlı ekran turu telefonun
Wi-Fi'ye yeniden bağlanmasını gerektiriyor — bu, benim ortamımın dışında bir ağ
sorunu. STAFF tarafının TÜM işlevselliği (giriş, kendi işleri, çoklu ürünlü
rapor, avans talebi, durum değişikliği, izolasyon) yukarıdaki curl testleriyle
uçtan uca doğrulandı; eksik olan yalnızca görsel/dokunsal bir teyittir.

### Faz 9 açık soruları (karara bağlandı: 2/3 ertelendi, 1/3 beklemede)

1. **QR Kod Tara hızlı işlemi** — **[KAPSAM DIŞI — kullanım senaryosu netleşmeden
   uygulanmayacak]**. Ne için kullanılacağı (iş check-in'i mi, ürün/barkod okuma mı,
   envanter sayımı mı?) belirsiz kaldığı için ertelendi; iş kuralı netleşmeden kod
   yazılmayacak.
2. **SMS Bildirimleri** — **[KAPSAM DIŞI — sağlayıcı seçimi yapılmadan
   uygulanmayacak]**. Sağlayıcı seçimi (İleti Merkezi, Netgsm vb.) bir iş kararı;
   bu karar verilmeden ertelendi.
3. **Ali Kaya STAFF hesabıyla telefonda canlı ekran turu** — yukarıda açıklanan ağ
   kopması nedeniyle tamamlanamadı; kullanıcı telefonu Wi-Fi'ye yeniden bağladığında
   tekrar denenebilir (APK zaten doğru IP ile hazır ve kurulu). **2026-09-10 tekrar
   denendi: telefon hâlâ Wi-Fi'ye değil mobil veriye bağlı** (`adb shell ip addr
   show wlan0` → `NO-CARRIER,DORMANT`, aktif arayüz `rmnet0`), bu yüzden görsel tur
   yine yapılamadı — hâlâ açık.

**Sonuç:** Madde 1 ve 2 iş kararıyla kapsam dışı bırakıldığı için Faz 9'un kod/karar
tarafı tamamlandı; yalnızca madde 3 (görsel/dokunsal teyit) telefon Wi-Fi'ye
bağlandığında yapılacak, işlevsellik zaten curl ile uçtan uca doğrulanmış durumda.
