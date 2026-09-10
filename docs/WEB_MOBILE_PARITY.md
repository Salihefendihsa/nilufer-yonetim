# Web ↔ Mobil Özellik Paritesi

## Gerçek Cihazda Bulunan Hatalar (2026-09-10)

Telefon Wi-Fi'ye bağlandığında Ali Kaya (personel1) hesabıyla gerçek cihazda (Samsung
SM-A266B) yapılan görsel doğrulama turu sırasında, parite listesindeki "eksik özellik"
maddelerinden BAĞIMSIZ, iki gerçek fonksiyon hatası bulundu:

1. **DÜZELTİLDİ — Kart içerikleri hiç çizilmiyordu (İşler listesi + Onaylar).**
   `jobs_list_screen.dart` (`_JobCard`) ve `approvals_screen.dart`'taki (`_QuoteCard`,
   `_AdvanceCard`, `_ExpiringContractCard`) kart widget'ları `BoxDecoration`'da
   **farklı renkli kenarlarla** (`Border(left: renkli, top/right/bottom: gri)`)
   **`borderRadius`'u birlikte** kullanıyordu — Flutter bunu paint() aşamasında bir
   assertion ile reddediyor ve etkilenen kartın TÜM içeriği (metin, ikon, rozet — her
   şey) sessizce hiç çizilmiyordu; yalnızca dıştaki beyaz köşeli kart şekli
   görünüyordu. Gerçek cihazda tekrar tekrar doğrulandı (ekran görüntüleri), önce/
   sonra karşılaştırıldı. **Düzeltme:** sol renkli şerit artık ayrı bir `Container`
   ile, tekdüze gri kenarlıktan (`Border.all`) bağımsız çiziliyor
   (`approvals_screen.dart`'a ortak `_AccentCard` widget'ı eklendi). Bu, TÜM
   rollerin İşler listesini ve OWNER/MANAGER'ın Onaylar sayfasını etkiliyordu —
   kapsam dışı bir tasarım hatası değil, gerçek bir görüntüleme hatasıydı.
   `dart analyze`/`flutter test` temiz, gerçek cihazda İşler listesi için
   düzeltme sonrası ekran görüntüsüyle doğrulandı.

2. **AÇIK — STAFF Ana Sayfa (Dashboard) tamamen boş geliyor.** Ali Kaya ile giriş
   yapıldığında Ana Sayfa sekmesi üst bar + alt navigasyon dışında **hiçbir içerik**
   göstermiyor (stat kartları, "Vardiya Durumu", görev listesi — hiçbiri). Kapsamlı
   canlı hata ayıklama yapıldı (6 yeniden derleme/kurulum döngüsü): `_load()`'un
   hatasız tamamlandığı doğrulandı (`loading=false error=null isStaff=true`),
   `_buildStaffBody()`'nin çağrıldığı ve **exception fırlatmadan** döndüğü
   `try/catch` ile doğrulandı (kırmızı "CAUGHT" ekranı hiç görünmedi), Impeller
   render motoru devre dışı bırakılıp test edildi (fark etmedi, geri alındı), aynı
   `border`+`borderRadius` hatası bu dosyada YOK (tüm kenarlıklar `Border.all` ile
   tekdüze, kontrol edildi). Basit statik içerik (mavi kutu + metin) AYNI body
   konumunda düzgün çiziliyor — yani sorun `RefreshIndicator`/`Scaffold`/
   `IndexedStack` yerleşiminde değil, spesifik olarak `_buildStaffBody()`'nin
   döndürdüğü GERÇEK widget ağacında. Kök neden **kesin olarak belirlenemedi**;
   bisection testi (ListView içine tek bir `Text` widget'ı koyup diğer her şeyi
   geçici olarak kaldırma) tam sonuçlanamadan cihaz bağlantısı koptu (USB/Wi-Fi).
   Kullanıcı talimatıyla telefon testine daha fazla zaman ayrılmadı; kod
   `_buildStaffBody`'nin özgün/temiz haline geri alındı (hata ayıklama kodu
   kalmadı, `dart analyze` temiz). **Sonraki adım (cihaz tekrar bağlandığında):**
   bisection testine kaldığı yerden devam et — ListView'e tek tek gerçek widget'lar
   geri eklenerek (StatCardGrid/AppStatCard → Vardiya Durumu kartı →
   EmptyStateView) hangi widget'ın paint aşamasında sessizce başarısız olduğu
   izole edilmeli.

## Kapsam ve Yöntem

Bu belge, `web/src/app/(dashboard)/` altındaki 17 sayfanın (isler, musteriler, personel,
stok, teklifler, sozlesmeler, para, raporlar, performans, bekleyen-onaylar, takvim,
bildirimler, mesajlar, ayarlar, loglar, sistem-durumu, kullanim-istatistikleri) her
birini, o sayfanın kullandığı her API çağrısı/form alanı/filtre/toplu işlem/grafik/
tablo düzeyinde `mobile/lib/` altındaki Flutter karşılıklarıyla karşılaştırır.
**17 sayfanın tamamı mevcuttur** (yeniden adlandırılmış/birleştirilmiş olan yok).

Yöntem: her web sayfasının `page.tsx` + o sayfaya özel modal/bileşenleri okunmuş,
her `fetch/api.` çağrısı ve buna karşılık gelen backend rotası (`backend/src/routes/*`,
`requireRole`/`RequireRole` ile) bulunmuş; mobil tarafta ise `mobile/lib/features/`
altındaki eşdeğer ekran(lar) ve `mobile/lib/navigation/` altındaki rol kabukları
(`role_shell.dart`, `manager_shell.dart`, `team_lead_shell.dart`, `staff_shell.dart`,
`more_menu_screen.dart`) okunarak hem "ekran var mı" hem "ekrana o rol için bir
navigasyon yolu var mı" ayrı ayrı doğrulanmıştır. Ayrıca proje içinde zaten var olan
`docs/STITCH_FEATURE_MATRIX.md` (912 satırlık, Faz 1-9 arası kod/karar kaydı) çapraz
referans olarak kullanılmıştır — bu belge onun yerini almaz, web-sayfası-merkezli ve
daha granüler bir kesit sunar.

Durum kodları: **Evet** = web'deki özelliğin tam karşılığı mobilde var ve o role
ulaşılabilir · **Kısmi** = altyapı/ekran var ama görünüm, filtre, veri alanı veya
navigasyon eksik · **Hayır** = mobilde hiç karşılığı yok veya o role kapalı bir
navigasyon nedeniyle erişilemez.

---

## 1. İşler (Jobs)

Web: `web/src/app/(dashboard)/isler/page.tsx`, `JobFormModal.tsx`, `WeekCalendar.tsx` — roller: OWNER, MANAGER, TEAM_LEAD, STAFF, CUSTOMER (Sidebar.tsx:56).
Mobil: `mobile/lib/features/jobs/{jobs_list_screen.dart,job_form_screen.dart,job_detail_screen.dart}`.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| İşler | İş listesi kartları (sıra no, müşteri, hizmet, personel, saat, durum) | Evet | Hepsi | — |
| İşler | Liste/Takvim görünüm anahtarı | Kısmi — mobilde ayrı bir takvim ekranı var; CUSTOMER'ın menü yolu **TAMAMLANDI (2026-09-10)**, OWNER zaten "Daha Fazla"dan erişiyordu | Hepsi | — |
| İşler | Haftalık takvim grid'i (`WeekCalendar.tsx`) | Kısmi — mobilde aylık ısı haritası farklı bir tasarım, haftalık grid yok | Hepsi | Hepsi (tasarım farkı) |
| İşler | Arama kutusu (400ms debounce, `GET /jobs?search=`) | Evet | Hepsi | — |
| İşler | Durum dağılım şeridi (5 paralel sayım isteği) | Hayır | Hepsi | Hepsi |
| İşler | Durum filtre çipleri + sayaç rozetleri | Kısmi — çipler var, sayaç rozeti yok | Hepsi | Hepsi |
| İşler | Sayfalama (ileri/geri) | Kısmi — API destekliyor, mobil arayüzde sayfalama kontrolü yok | Hepsi | Hepsi |
| İşler | "Yeni İş" oluşturma modalı | Evet | OWNER, MANAGER | — |
| İşler | Yeni iş formunda Hizmet Türü seçici (`GET /service-types`) | Kısmi — mobilde serbest metin, `/service-types` hiç çağrılmıyor | OWNER, MANAGER | OWNER, MANAGER |
| İşler | Satır içi durum değiştirme dropdown'u (listede) | Kısmi — yalnızca İş Detayı ekranından yapılabiliyor, listede değil | OWNER, MANAGER, STAFF | OWNER, MANAGER, STAFF |
| İşler | İptal gerekçesi zorunlu modalı | Evet | OWNER, MANAGER, STAFF | — |
| İşler | İptal gerekçesinin liste kartında gösterimi | Kısmi — yalnızca detayda gösteriliyor | Hepsi | Hepsi |

---

## 2. Müşteriler (Customers)

Web: `web/src/app/(dashboard)/musteriler/page.tsx` — roller: OWNER, MANAGER (Sidebar.tsx:52).
Mobil: `mobile/lib/features/customers/{customers_list_screen.dart,customer_detail_screen.dart,customer_form_screen.dart}`.
**Not:** backend `GET /customers` STAFF'a kapsamlı (kendi işlerindeki müşteriler) izin veriyor, ancak TEAM_LEAD ve STAFF'ın mobilde hiç Müşteriler ekranı yok (`team_lead_shell.dart`, `staff_shell.dart` bilerek hariç tutmuş) — API yetkisi olan bir rol mobilde bu ekrana hiç ulaşamıyor.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Müşteriler | Sayfalı liste | Evet (sonsuz kaydırma ile) | OWNER, MANAGER | — |
| Müşteriler | Arama (ad/telefon/e-posta/semt) | Evet | OWNER, MANAGER | — |
| Müşteriler | Sıralama (Yeni/İsim/Bakiye) | Evet | OWNER, MANAGER | — |
| Müşteriler | Tablo sütunu: "Son İş" tarihi | Kısmi — kartta gösterilmiyor | OWNER, MANAGER | OWNER, MANAGER |
| Müşteriler | Bakiye dağılım şeridi + toplamlar | Hayır | OWNER, MANAGER | OWNER, MANAGER |
| Müşteriler | Excel'e aktar | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Müşteriler | "Yeni Müşteri" oluşturma formu | Evet | OWNER, MANAGER | — |
| Müşteriler | Formda Semt seçici (`GET /districts`) | Kısmi — serbest metin, `/districts` çağrılmıyor | OWNER, MANAGER | OWNER, MANAGER |
| Müşteriler | Müşteri detayı (İşler/Sözleşmeler/Ödemeler sekmeleri) | Evet | OWNER, MANAGER (+STAFF kapsamlı) | — |
| Müşteriler | Bekleyen bakiye kartı | Evet (STAFF-kapsamı doğru gizleniyor) | OWNER, MANAGER | — |
| Müşteriler | Müşteri düzenleme | Evet | OWNER, MANAGER | — |
| Müşteriler | Müşteri silme + onay | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Müşteriler | Tamamlanmış iş için "PDF İndir" (iş raporu) | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Müşteriler | Müşteriler ekranına TEAM_LEAD/STAFF erişimi (backend STAFF'a kapsamlı izin veriyor) | Hayır — mobilde bu rollere ekran/menü yolu yok | (backend: OWNER/MANAGER/STAFF-kapsamlı) | TEAM_LEAD, STAFF |

---

## 3. Personel (Staff)

Web: `web/src/app/(dashboard)/personel/page.tsx`, `StaffFormModal.tsx`, `CertificationsModal.tsx`, `PermissionsModal.tsx` — roller: OWNER, MANAGER (Sidebar.tsx:53).
Mobil: `mobile/lib/features/staff/{staff_list_screen.dart,staff_detail_screen.dart}`.
**Güvenlik notu — DÜZELTİLDİ (2026-09-10):** `staffController.ts`'deki `GET /staff` ve `GET /staff/:id`, TEAM_LEAD kapsamı için satır filtrelemesi yapıyordu ama **maaş alanını (`salaryBase`) çıkarmıyordu**. Bulgu doğrulandığında ayrıca ortaya çıktı: mobilde bu uçları çağıran ekran YOKTUR iddiası **yanlıştı** — TEAM_LEAD'in iş yeniden atama seçicisi (`mobile/lib/features/jobs/job_detail_screen.dart` → `StaffApi.list()`) tam olarak bu ucu çağırıyor, yani maaş verisi gerçekten TEAM_LEAD'in cihazına gidiyordu (UI'da gösterilmese de ağ yanıtında vardı). Düzeltme: `redactSalaryForRole()` eklendi (`backend/src/controllers/staffController.ts`), yalnızca OWNER/MANAGER için `salaryBase` döndürülüyor, TEAM_LEAD ve STAFF için alan yanıttan tamamen çıkarılıyor. Canlı doğrulama: TEAM_LEAD (ekiplideri@nilufer.com) → `GET /staff` ve `GET /staff/:id` artık `salaryBase` içermiyor; STAFF (personel1) → kendi kaydında da içermiyor; OWNER → `salaryBase` hâlâ doğru geliyor (regresyon yok). `backend: npx tsc --noEmit` temiz.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Personel | Özet kartlar (toplam personel, bugün işi olan vb.) | Kısmi — mobilde yalnızca satır bazlı rozetler, toplam kart yok | OWNER, MANAGER | OWNER, MANAGER |
| Personel | Personel kartı (puan, sertifika bitiş rozeti, kapasite çubuğu) | Evet (mobil ayrıca canlı durum noktası ekliyor) | OWNER, MANAGER | — |
| Personel | Yeni personel oluşturma (rol, pozisyon, maaş, plaka, günlük kapasite, amir) | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Personel | Personel düzenleme | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Personel | Personel silme | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Personel | Taban maaş alanı (formda) | Hayır (mobilde form yok) | OWNER, MANAGER | OWNER, MANAGER |
| Personel | Araç plakası — düzenleme | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Personel | Günlük iş kapasitesi — düzenleme | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Personel | Amir/Şef atama dropdown'u | Hayır | OWNER, MANAGER | OWNER, MANAGER |
| Personel | Sertifikalar modalı — ekleme/silme | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Personel | İzin/Yetki (permissions) modalı | Hayır | OWNER (yalnızca) | OWNER |
| Personel | Arama/filtre | Hayır (web'de de yok — ortak eksik, mobilde kullanılmayan bir `search` parametresi var) | — | — |

---

## 4. Stok (Stock)

Web: `web/src/app/(dashboard)/stok/page.tsx` + 5 modal — roller: OWNER, MANAGER, TEAM_LEAD (Sidebar.tsx:55; TEAM_LEAD yalnızca okuma + satın alma talebi açabiliyor).
Mobil: `mobile/lib/features/stock/stock_list_screen.dart`.
**Rol boşluğu — TAMAMLANDI (2026-09-10):** `team_lead_shell.dart` çekmecesine "Stok" eklendi (`StockListScreen` zaten TEAM_LEAD'i doğru kısıtlıyordu — yalnızca satın alma talebi, yönetim aksiyonları gizli; backend `GET /products` ile canlı doğrulandı).

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Stok | Ürün listesi/tablosu | Evet | OWNER, MANAGER, TEAM_LEAD | — |
| Stok | Arama kutusu | Hayır — API destekliyor, arayüzde yok | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Stok | Kategori filtre çipleri | Evet | OWNER, MANAGER, TEAM_LEAD | — |
| Stok | Sayfalama | Hayır | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Stok | Özet kartlar (ürün çeşidi, kritik, yeterli) | Kısmi — yalnızca satır rozetleri | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Stok | Durum dağılım şeridi | Hayır | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Stok | "Stok Seviyeleri" çubuk grafiği (en düşük 8 ürün) | Hayır | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Stok | "Yeni Ürün" oluşturma | Evet | OWNER, MANAGER | — |
| Stok | Ürün silme + düzenleme | **TAMAMLANDI (2026-09-10)** (düzenleme de aynı turda eklendi — daha önce hiç yoktu) | OWNER, MANAGER | — |
| Stok | "Stok Ekle" (restock) — not alanı | Kısmi — miktar var, opsiyonel not alanı yok | OWNER, MANAGER | OWNER, MANAGER |
| Stok | "Satın Alma Talebi" modalı | Evet (ama TEAM_LEAD için menü yolu olmadığından erişilemiyor) | OWNER, MANAGER, TEAM_LEAD | TEAM_LEAD |
| Stok | "Fiili Sayım Gir" (fark önizlemeli) | Evet | OWNER, MANAGER | — |
| Stok | "Hareketler" geçmişi | Kısmi — ilişkili iş raporunun müşteri/personel bilgisi eksik | OWNER, MANAGER | OWNER, MANAGER |
| Stok | Bekleyen Satın Alma Talepleri paneli (onay/iptal) | Evet | OWNER, MANAGER | — |
| Stok | Boş durum "ürün ekle" CTA'sı | Kısmi — mobil boş ekranda CTA yok | OWNER, MANAGER | OWNER, MANAGER |

---

## 5. Teklifler (Quotes)

Web: `web/src/app/(dashboard)/teklifler/page.tsx`, `QuoteHistoryModal.tsx` — roller: OWNER, MANAGER (backend `backend/src/routes/quotes.ts` tüm yönetim uçlarında `requireRole(OWNER,MANAGER)`).
Mobil: `mobile/lib/features/quotes/{quotes_list_screen.dart,quote_history_screen.dart}`.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Teklifler | Durum filtreli liste | Evet | OWNER, MANAGER | — |
| Teklifler | Özet kartlar (yeni talep sayısı, bekleyen tutar, dönüşüm %) | Kısmi — yalnızca dönüşüm % başlıkta, diğer 2 kart yok | OWNER, MANAGER | OWNER, MANAGER |
| Teklifler | Durum dağılım şeridi (5 segment) | Hayır | OWNER, MANAGER | OWNER, MANAGER |
| Teklifler | Durum değiştirme dropdown'u (serbest) | Kısmi — yalnızca "dönüştür" aksiyonu var, keyfi durum değişikliği arayüzü yok | OWNER, MANAGER | OWNER, MANAGER |
| Teklifler | Fiyat girme/düzenleme | Evet | OWNER, MANAGER | — |
| Teklifler | Yönetim notu düzenleme | Evet | OWNER, MANAGER | — |
| Teklifler | Keşif randevusu (`surveyAt`) belirleme | Evet | OWNER, MANAGER | — |
| Teklifler | Tarihçe modalı | Evet | OWNER, MANAGER | — |
| Teklifler | Müşteriye dönüştürme | Evet | OWNER, MANAGER | — |
| Teklifler | Telefon araması (tel: linki) | Evet (mobil web'den ileri — gerçek arama butonu) | OWNER, MANAGER | — |

Not: Bu sayfada web'de de export/PDF/Excel yok; backend'de de teklifler için export ucu yok — bu ortak bir boşluk, mobile özgü değil.

---

## 6. Sözleşmeler (Contracts)

Web: `web/src/app/(dashboard)/sozlesmeler/page.tsx`, `ContractFormModal.tsx` — roller: OWNER, MANAGER (Sidebar.tsx:57); backend `GET /contracts` ayrıca CUSTOMER'a kendi kapsamıyla açık ama web navigasyonunda CUSTOMER'a link yok.
Mobil: `mobile/lib/features/contracts/contracts_list_screen.dart` (+ CUSTOMER için ayrı `MyContractsScreen`).

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Sözleşmeler | Sayfalı sözleşme tablosu | Kısmi — API sayfalamayı destekliyor ama mobil arayüz yalnızca ilk sayfayı yüklüyor, sayfalama kontrolü yok | OWNER, MANAGER | OWNER, MANAGER |
| Sözleşmeler | Süresi yaklaşan liste/uyarı şeridi | Kısmi — web ayrıntılı müşteri+tarih listesi gösteriyor, mobil yalnızca sayı rozeti gösteriyor | OWNER, MANAGER | OWNER, MANAGER |
| Sözleşmeler | Özet kartlar (aktif sayısı, MRR, 30 günde bitecek, tekrarlayan sayısı — 4 kart) | Kısmi — yalnızca 2/4 kart var (Aktif, MRR); "30 günde bitiyor" ve "Tekrarlayan" kartları yok | OWNER, MANAGER | OWNER, MANAGER |
| Sözleşmeler | Durum dağılım şeridi | Hayır | OWNER, MANAGER | OWNER, MANAGER |
| Sözleşmeler | Sözleşme oluşturma formu (tüm alanlar dahil "Dönem Ücreti") | Evet | OWNER, MANAGER | — |
| Sözleşmeler | Sözleşme yenileme | Evet | OWNER, MANAGER | — |
| Sözleşmeler | CUSTOMER salt-okunur sözleşme görünümü | Evet (`MyContractsScreen`, web'de karşılığı yok zaten) | (backend: CUSTOMER-kapsamlı) | — |

Not: Sözleşme PDF export'u ne web'de ne backend'de var (`exportController.ts`'de contract export yok) — ortak boşluk.

---

## 7. Para (Payments/Finance)

Web: `web/src/app/(dashboard)/para/page.tsx`, `PaymentFormModal.tsx` — roller: OWNER, MANAGER (backend `/payments/summary` → `requireRoleOrPermission([MANAGER],"view_finance")`, yani OWNER her zaman, MANAGER her zaman).
Mobil: `mobile/lib/features/finance/finance_screen.dart`.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Para | Özet kartlar (bu ay toplam+trend%+hedef, bu ay sayısı+ortalama, tüm zamanlar, bekleyen bakiye, bekleyen avans sayısı, net kâr) | Evet | OWNER, MANAGER | — |
| Para | Sayfalı ödeme tablosu | Kısmi — yalnızca ilk sayfa, sayfalama kontrolü yok, tam tablo yerine basit liste | OWNER, MANAGER | OWNER, MANAGER |
| Para | Bekleyen avanslar listesi (Para sayfası içinde) | Kısmi — Para ekranında hiç yok, ayrı Onaylar ekranına taşınmış | OWNER, MANAGER | OWNER, MANAGER |
| Para | Aylık ciro/tahsilat trend grafiği (6 ay, alan grafiği) | Hayır — `/analytics/revenue-trend` mobil Finans ekranından hiç çağrılmıyor | OWNER, MANAGER | OWNER, MANAGER |
| Para | Ödeme türü dağılım donut grafiği | Kısmi — düz liste olarak gösteriliyor, donut değil | OWNER, MANAGER | OWNER, MANAGER |
| Para | Avans onay/red butonları (Para sayfası içinde) | Kısmi — yalnızca ayrı Onaylar ekranında var | OWNER, MANAGER | OWNER, MANAGER |
| Para | Tahsilat kaydetme formu (müşteri, tutar, tür, fiş linki, dekont no, tahsil eden personel) | Kısmi — "Fiş/Makbuz Linki" alanı formda yok | OWNER, MANAGER | OWNER, MANAGER |
| Para | **Excel'e Aktar** butonu | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Para | **Tek ödeme için PDF makbuz indirme** | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER, CUSTOMER (backend) | — |

---

## 8. Raporlar (Reports)

Web: `web/src/app/(dashboard)/raporlar/page.tsx` — roller: OWNER, MANAGER (backend `backend/src/routes/analytics.ts`: tüm router `requireRole(OWNER,MANAGER)`).
Mobil: `mobile/lib/features/reports/reports_screen.dart`.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Raporlar | Tarih aralığı seçici (30 gün/3 ay/6 ay) | Hayır | OWNER, MANAGER | OWNER, MANAGER |
| Raporlar | Özet kartlar (toplam ciro, aylık ortalama, geçen ay+trend%, en çok hizmet %) | Hayır — mobilde bu 4 kart yok | OWNER, MANAGER | OWNER, MANAGER |
| Raporlar | Ciro trend grafiği (aylık alan/çizgi) | Hayır — `/analytics/revenue-trend` mobil Raporlar ekranından hiç çağrılmıyor | OWNER, MANAGER | OWNER, MANAGER |
| Raporlar | Hizmet türü dağılım donut grafiği | Kısmi — yatay çubuklarla gösteriliyor, donut değil, ay filtresine bağlı değil | OWNER, MANAGER | OWNER, MANAGER |
| Raporlar | Bölge bazlı sıralama grafiği | Kısmi — aynı veri, çubuk olarak (kavramsal olarak yakın) | OWNER, MANAGER | OWNER, MANAGER |
| Raporlar | Müşteri sadakati donut + 2 özet kart | Kısmi — 2 mini istatistik var, donut grafik yok | OWNER, MANAGER | OWNER, MANAGER |
| Raporlar | PDF/XLS rapor indirme | Hayır (web'de de yok, backend'de de export ucu yok) — ortak boşluk | — | — |

---

## 9. Performans (Leaderboard)

Web: `web/src/app/(dashboard)/performans/page.tsx` — roller: OWNER, MANAGER, TEAM_LEAD (`backend/src/routes/staff.ts:27` → `requireRole(OWNER,MANAGER,TEAM_LEAD)`).
Mobil: `mobile/lib/features/performance/performance_screen.dart`. Rol erişimi mobilde web ile birebir aynı (STAFF'ın dışlanması `staff_shell.dart` içinde bilinçli olarak belgelenmiş).

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Performans | Dönem filtresi (Bu Ay/Geçen Ay/Bu Yıl) | Evet | OWNER, MANAGER, TEAM_LEAD | — |
| Performans | "Tamamlanan iş" kartı + önceki döneme göre trend | Kısmi — düz metin, trend %/StatCard yok | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Performans | "Ortalama müşteri puanı" kartı + ilerleme çubuğu | Kısmi — yalnızca metin | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Performans | "Aktif personel" sayısı kartı | Hayır — veri çekiliyor ama hiç gösterilmiyor | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Performans | "Zamanında tamamlama" % + ilerleme çubuğu | Kısmi — yalnızca renkli metin | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Performans | "Hedef gerçekleşme" % | Kısmi — ham hedef sayısı gösteriliyor, gerçekleşme % hesaplanmıyor | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Performans | Podyum (ilk 3 madalya kartı) | Hayır | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Performans | "Personel Bazında Tamamlanan İş" çubuk grafiği | Hayır | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Performans | "Müşteri Puanı Sıralaması" sıralı çubuk grafiği | Hayır | OWNER, MANAGER, TEAM_LEAD | Hepsi |
| Performans | Detaylı liderlik tablosu (avatar, satır içi ilerleme çubukları, sıralanabilir sütun) | Kısmi — kart/liste, avatar ve satır içi çubuk yok | OWNER, MANAGER, TEAM_LEAD | Hepsi |

---

## 10. Bekleyen Onaylar (Pending Approvals)

Web: `web/src/app/(dashboard)/bekleyen-onaylar/page.tsx` — roller: OWNER, MANAGER (Sidebar.tsx:51).
Mobil: `mobile/lib/features/approvals/approvals_screen.dart`. Rol erişimi web ile birebir aynı (TEAM_LEAD hariç tutulması `team_lead_shell.dart` içinde belgelenmiş).

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Bekleyen Onaylar | 4 kaynağı birleştiren kuyruk (teklif/avans/sözleşme/saha raporu) | Evet | OWNER, MANAGER | — |
| Bekleyen Onaylar | Özet kartlar (Toplam/Teklif/Avans/Rapor/Bitmek üzere) | Kısmi — yalnızca toplam sayı, kart grid'i yok | OWNER, MANAGER | OWNER, MANAGER |
| Bekleyen Onaylar | Aciliyet/kategori dağılım şeridi + "Acil kalem" rozeti | Hayır | OWNER, MANAGER | OWNER, MANAGER |
| Bekleyen Onaylar | Saha raporu onayı | Evet | OWNER, MANAGER | — |
| Bekleyen Onaylar | Süresi yaklaşan sözleşme kartı + "Sözleşmeye Git" linki | Kısmi — aciliyet renklendirmesi, gün sayısı rozeti ve navigasyon linki yok | OWNER, MANAGER | OWNER, MANAGER |
| Bekleyen Onaylar | Avans onay/red | Evet | OWNER, MANAGER | — |
| Bekleyen Onaylar | Teklif "İletişime Geçildi" aksiyonu | **TAMAMLANDI (2026-09-10)** | OWNER, MANAGER | — |
| Bekleyen Onaylar | Teklifi dönüştürme | Evet | OWNER, MANAGER | — |
| Bekleyen Onaylar | Kısmi yükleme hata bandı | Kısmi — hatalar sessizce yutuluyor, kullanıcıya gösterilmiyor | OWNER, MANAGER | OWNER, MANAGER |

---

## 11. Takvim (Calendar)

Web: `web/src/app/(dashboard)/takvim/page.tsx` — roller: hepsi (backend `GET /jobs` yalnızca `requireAuth`, satır bazlı kapsam).
Mobil: `mobile/lib/features/calendar/calendar_screen.dart`.
**Rol boşluğu — DÜZELTİLDİ (2026-09-10):** OWNER `RoleShell`'in "Daha Fazla" menüsünden, MANAGER/TEAM_LEAD/STAFF kendi çekmecelerinden ulaşıyor; CUSTOMER artık kendi 5 sekmesinde doğrudan "Takvim" sekmesine sahip (`role_shell.dart` → `AppRole.customer` case güncellendi, `CalendarScreen` yeniden kullanıldı — yeni ekran yazılmadı).

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Takvim | Aylık iş verisi çekme + ay navigasyonu | Evet | Hepsi | — |
| Takvim | Isı haritası renklendirmesi (5 kademeli) | Kısmi — 2 renkli geçiş, 5 kademeli skala ve yoğunluk lejantı yok | Hepsi | Hepsi (tasarım farkı) |
| Takvim | Seçili günün iş listesi | Evet | Hepsi | — |
| Takvim | "Takvime Ekle" (Google Calendar linki) | Hayır — alan modelde var ama hiç kullanılmıyor | Hepsi | Hepsi |
| Takvim | Özet kartlar (bugünkü iş, bu haftaki iş, tamamlanma oranı, en yoğun gün) | Kısmi/Hayır — yalnızca TEAM_LEAD, ayrı `/team/calendar` ucu üzerinden benzer bir kapasite kartı görüyor; OWNER/MANAGER/STAFF hiçbirini görmüyor | Hepsi | OWNER, MANAGER, STAFF (TEAM_LEAD kısmi) |
| Takvim | Durum dağılım şeridi | Hayır | Hepsi | Hepsi |
| Takvim | "Haftalık Dağılım" çubuk grafiği | Hayır | Hepsi | Hepsi |
| Takvim | CUSTOMER'ın Takvim'e erişimi | **TAMAMLANDI (2026-09-10)** | CUSTOMER | — |

---

## 12. Bildirimler (Notifications)

Web: `web/src/app/(dashboard)/bildirimler/page.tsx`, `NotificationDrawer.tsx` — roller: hepsi (backend `requireAuth` yeterli, kullanıcıya özel kapsam).
Mobil: `mobile/lib/features/notifications/notifications_screen.dart`.
**Rol boşluğu — DÜZELTİLDİ (2026-09-10):** OWNER için `more_menu_screen.dart`'a "Bildirimler" eklendi; CUSTOMER için `CustomerMoreMenuScreen` (yeni, "Daha Fazla" sekmesi altında) içine eklendi. İkisi de mevcut `NotificationsScreen`'i yeniden kullanıyor — yeni ekran yazılmadı.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Bildirimler | Bildirim listesi (sayfalı) | Evet | Hepsi | — |
| Bildirimler | Tekini okundu işaretleme | Evet | Hepsi | — |
| Bildirimler | Tümünü okundu işaretle | Evet | Hepsi | — |
| Bildirimler | Durum filtre sekmeleri (Tümü/Okunmadı/Okundu) | Hayır | Hepsi | Hepsi (erişimi olanlar için de eksik) |
| Bildirimler | Kategori filtre çipleri (İşler/Ödemeler/Mesajlar/Uyarılar) | Hayır | Hepsi | Hepsi |
| Bildirimler | Özet kartlar (Toplam/Okunmamış/Okunmuş/Bugün) | Hayır | Hepsi | Hepsi |
| Bildirimler | "Tip Dağılımı" donut grafiği | Hayır | Hepsi | Hepsi |
| Bildirimler | Sayfalama kontrolleri | Kısmi — yalnızca ilk sayfa (30 kayıt), ileri/geri yok | Hepsi | Hepsi |
| Bildirimler | Bildirime tıklayınca ilgili kayda gitme | Kısmi — Avans/Teklif bildirimleri özel Onaylar ekranına değil, genel teklif listesine yönlendiriyor | Hepsi | Hepsi (kısmi) |
| Bildirimler | Header'daki bildirim çekmecesi (arama, kategori sekmeleri) | Hayır | Hepsi | Hepsi |
| Bildirimler | OWNER'ın Bildirimler'e erişimi | **TAMAMLANDI (2026-09-10)** | OWNER | — |
| Bildirimler | CUSTOMER'ın Bildirimler'e erişimi | **TAMAMLANDI (2026-09-10)** | CUSTOMER | — |

---

## 13. Mesajlar (Messages)

Web: `web/src/app/(dashboard)/mesajlar/page.tsx`, `BroadcastModal.tsx`, `NewConversationModal.tsx` — roller: hepsi (Sidebar.tsx:50).
Mobil: `mobile/lib/features/messages/{messages_list_screen.dart,chat_screen.dart}`.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Mesajlar | Konuşma listesi | Evet | Hepsi | — |
| Mesajlar | OWNER "Gözlemci" modu — sistemdeki tüm konuşmaları izleme (`GET /conversations/all`) | Hayır — mobilde bu uca hiç referans yok | OWNER | OWNER |
| Mesajlar | "Konuşmalarım/Gözlemci" sekme anahtarı | Hayır (yukarıdakinin doğal sonucu) | OWNER | OWNER |
| Mesajlar | Konuşma mesajlarını görüntüleme + 5sn polling | Kısmi — mobil yalnızca açılışta yüklüyor, otomatik yenileme/polling yok | Hepsi | Hepsi |
| Mesajlar | Konuşmayı okundu işaretleme | Evet | Hepsi | — |
| Mesajlar | Metin mesajı gönderme | Evet | Hepsi | — |
| Mesajlar | Yeni konuşma başlatma | Evet | Hepsi | — |
| Mesajlar | Ekibe duyuru (broadcast) modalı | Evet | OWNER, MANAGER, TEAM_LEAD | — |
| Mesajlar | Özet kartlar (Toplam konuşma, Okunmamış, Son 7 gün aktif) | Hayır | Hepsi | Hepsi |
| Mesajlar | Mesaj zaman çizelgesinde gün ayırıcılar (Bugün/Dün) | Hayır | Hepsi | Hepsi |
| Mesajlar | Okundu bilgisi (checkmark) baloncuklarda | Hayır | Hepsi | Hepsi |
| Mesajlar | Kişi/konuşma listesinde rol rozeti | Kısmi — yalnızca yeni konuşma seçicisinde var, liste/başlıkta yok | Hepsi | Hepsi |

---

## 14. Ayarlar (Settings)

Web: `web/src/app/(dashboard)/ayarlar/page.tsx` — roller: hepsi; yalnızca OWNER firma/hedef/hizmet türü/semt/yedekleme bölümlerini görüyor.
Mobil: `mobile/lib/features/settings/settings_screen.dart` (kişisel bildirim tercihleri, hepsi) + `mobile/lib/features/admin/audit_settings_screen.dart` (OWNER-only, `more_menu_screen.dart` üzerinden — ayrı, bağlantısız bir ekran).

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Ayarlar | E-posta bildirim tercihi anahtarı | Evet | Hepsi | — |
| Ayarlar | Günlük özet (daily digest) anahtarı — yalnızca OWNER'a görünür olmalı | Kısmi — mobilde bu anahtar rol farkı gözetmeksizin herkese gösteriliyor (web'in tersine, over-exposure) | OWNER | (fazladan gösterim — güvenlik değil UI tutarsızlığı) |
| Ayarlar | E-posta yapılandırılmamış uyarı bandı | Hayır | OWNER | OWNER |
| Ayarlar | Firma bilgileri formu (ad/telefon/e-posta/adres) | Kısmi — `audit_settings_screen.dart` tüm `/settings` anahtarlarını ham bir liste olarak gösteriyor, ayrı/etiketli bir form yok | OWNER | OWNER |
| Ayarlar | Aylık hedefler formu | Kısmi — aynı ham liste | OWNER | OWNER |
| Ayarlar | Hizmet türleri CRUD | **TAMAMLANDI (2026-09-10)** | OWNER | — |
| Ayarlar | Semtler CRUD | **TAMAMLANDI (2026-09-10)** | OWNER | — |
| Ayarlar | Yedekleme/JSON dışa aktarma | Hayır | OWNER | OWNER |
| Ayarlar | "Tehlikeli Bölge" — demo verisini temizleme | Hayır | OWNER | OWNER |
| Ayarlar | Tek, birleşik Ayarlar ekranı | Kısmi — OWNER'ın deneyimi iki ayrı, bağlantısız ekrana bölünmüş (Ayarlar + Denetim&Ayarlar) | OWNER | OWNER (parçalanmış deneyim) |

---

## 15. Denetim Logları (Loglar) — yalnızca OWNER

Web: `web/src/app/(dashboard)/loglar/page.tsx` — backend `GET /audit-logs` `requireRole(OWNER)`.
Mobil: `mobile/lib/features/admin/audit_settings_screen.dart` içindeki "Denetim Logları" sekmesi.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Loglar | Log listesi çekme | Evet | OWNER | — |
| Loglar | Özet kartlar (Toplam/Bugün/Son 7 gün/İşlem yapan kişi) | Hayır | OWNER | OWNER |
| Loglar | "En Aktif Kullanıcılar" sıralı çubuk grafiği | Hayır | OWNER | OWNER |
| Loglar | "İşlem Türü Dağılımı" donut grafiği | Hayır | OWNER | OWNER |
| Loglar | Tarih aralığı filtresi | Hayır | OWNER | OWNER |
| Loglar | İşlem türü filtre dropdown'u | Hayır | OWNER | OWNER |
| Loglar | Kullanıcı arama (ad/e-posta) | Hayır | OWNER | OWNER |
| Loglar | "Filtreleri Temizle" | Hayır (filtre olmadığı için) | OWNER | OWNER |
| Loglar | İşlem türüne göre ikon/renk ile zaman çizelgesi | Kısmi — düz kart listesi, ikon/renk ayrımı yok | OWNER | OWNER |

---

## 16. Sistem Durumu (System Health) — yalnızca OWNER — **TAMAMLANDI (2026-09-10)**

Web: `web/src/app/(dashboard)/sistem-durumu/page.tsx` — backend `GET /system/health` `requireRole(OWNER)`.
Mobil: `mobile/lib/features/admin/system_health_screen.dart` (yeni) — `more_menu_screen.dart`'a yalnızca OWNER için eklendi. Grafik kütüphanesi kullanılmadan (mevcut proje deseni — bkz. `reports_screen.dart`), canlı trafik basit çubuk satırlarıyla gösteriliyor.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Sistem Durumu | 10sn'de bir canlı `GET /system/health` polling | Evet | OWNER | — |
| Sistem Durumu | API sağlık göstergesi | Evet | OWNER | — |
| Sistem Durumu | Veritabanı sağlık göstergesi | Evet | OWNER | — |
| Sistem Durumu | E-posta/SMTP yapılandırma göstergesi | Evet | OWNER | — |
| Sistem Durumu | Yedekleme durum göstergesi | Evet | OWNER | — |
| Sistem Durumu | Çalışma süresi (uptime) kartı | Evet | OWNER | — |
| Sistem Durumu | Bugünkü toplam istek kartı | Evet | OWNER | — |
| Sistem Durumu | Son 24 saatte hata sayısı kartı + kritik/temiz rozeti | Evet | OWNER | — |
| Sistem Durumu | Canlı trafik trend grafiği (istek/hata) | Evet (alan grafiği yerine çubuk liste — kapsam dışı bağımlılık eklenmedi) | OWNER | — |

**Doğrulama:** `dart analyze` 0 error/0 warning (yeni dosyada), `flutter test` geçti. Canlı cihazla görsel test cihaz Wi-Fi/USB'ye bağlandığında yapılacak.

---

## 17. Kullanım İstatistikleri (Usage Stats) — yalnızca OWNER — **TAMAMLANDI (2026-09-10)**

Web: `web/src/app/(dashboard)/kullanim-istatistikleri/page.tsx` — backend `GET /sessions/report` `requireRole(OWNER)`.
Mobil: `mobile/lib/features/admin/usage_stats_screen.dart` (yeni) — `more_menu_screen.dart`'a yalnızca OWNER için eklendi.

| Sayfa | Web'deki Özellik | Mobile Karşılığı Var mı | Hangi Roller Web'de Görüyor | Mobile'da Hangi Roller İçin Eksik |
|---|---|---|---|---|
| Kullanım İstatistikleri | Gün aralığı seçici (7/30/90) | Evet | OWNER | — |
| Kullanım İstatistikleri | Özet kartlar (Toplam kullanıcı, Toplam oturum, Son 7 günde aktif %, Ortalama oturum süresi) | Evet | OWNER | — |
| Kullanım İstatistikleri | "Kullanım Trendi" alan grafiği | Kısmi — trend grafiği yerine yalnızca özet kartlar + detaylı liste (alan grafiği kapsam dışı bağımlılık gerektirir) | OWNER | OWNER (trend grafiği görsel biçimi) |
| Kullanım İstatistikleri | "Rol Dağılımı" donut grafiği | Evet (donut yerine çubuk liste, aynı veri) | OWNER | — |
| Kullanım İstatistikleri | "En Çok Oturum Açanlar" sıralı çubuk grafiği | Evet | OWNER | — |
| Kullanım İstatistikleri | Detaylı tablo (Kullanıcı/Rol/Toplam Oturum/Ortalama Süre/Son Giriş) | Evet | OWNER | — |

**Doğrulama:** `dart analyze` 0 error/0 warning (yeni dosyada), `flutter test` geçti. Canlı cihazla görsel test cihaz Wi-Fi/USB'ye bağlandığında yapılacak.

---

## Rol Bazlı Fark Analizi

Bu bölüm, o rolün **web'de erişebildiği ama mobilde HİÇ karşılığı olmayan** (kısmi değil, tam "Hayır") sayfa/özellikleri listeler — kaynak dosya belirtilerek.

### OWNER

- ~~**Sistem Durumu**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §16.
- ~~**Kullanım İstatistikleri**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §17.
- ~~**Bildirimler**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §12.
- ~~**Hizmet Türleri / Semtler yönetimi (Ayarlar içinde)**~~ — **TAMAMLANDI (2026-09-10)**, bkz. madde 22.
- **Yedekleme / Demo veri temizleme (Ayarlar → Tehlikeli Bölge)** — `/admin/backup` ve `/admin/clear-demo-data` uçlarına mobilde hiç referans yok.
- **Mesajlar → Gözlemci modu** (`GET /conversations/all`) — mobilde hiç uygulanmadı.

### MANAGER

- Web'de erişebildiği tüm sayfaların mobil kabuğu (`mobile/lib/navigation/manager_shell.dart`) zaten Ayarlar dahil 15 sayfayı kapsıyor (Faz 6'da doğrulanmış) — MANAGER için **tam "Hayır" (menü yolu tamamen eksik) sayfa bulunamadı**. MANAGER'ın boşlukları bu belgede "Kısmi" olarak işaretlenen özellik eksiklikleridir (örn. Para sayfasındaki Excel/PDF export, Raporlar'daki tüm grafikler, Performans podyum/grafikleri).

### TEAM_LEAD

- ~~**Stok**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §9.
- **Müşteriler** — `team_lead_shell.dart` bilerek hariç tutmuş (dosya içi yorum: "Müşteriler ... yetkisi yok, bilerek eklenmedi"); web'de de zaten TEAM_LEAD'e kapalı (yalnızca OWNER/MANAGER), bu yüzden bu bir web-mobil parite boşluğu değil, ortak bir kısıt.
- **Bekleyen Onaylar, Sözleşmeler, Teklifler, Para/Finans, Raporlar, Denetim/Sistem** — web'de zaten TEAM_LEAD'e kapalı; mobilde de yok — parite sorunu değil, tutarlı bir kısıt.

### STAFF

- **Müşteriler** — `mobile/lib/navigation/staff_shell.dart` bu ekranı hiç içermiyor; ancak backend `GET /customers` STAFF'a kendi işlerindeki müşterilerle sınırlı bir görünüm sunuyor (web'de de STAFF'a bu sayfa kapalı olduğundan web-mobil parite açısından sorun değil — ama backend yetkisi mobilde tamamen kullanılmıyor).
- **Personel** — `staff_shell.dart`'ta yok; web'de de STAFF'a kapalı, tutarlı.
- **Performans, Para, Teklifler, Sözleşmeler, Raporlar, Stok (yazma/tam liste), Denetim/Ayarlar (sistem geneli)** — web'de zaten STAFF'a kapalı; mobilde de yok — parite sorunu değil.

### CUSTOMER

- ~~**Takvim**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §11.
- ~~**Bildirimler**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §12.
- **Para (kendi ödeme/makbuz görünümü)** — backend `GET /payments` CUSTOMER'a kapsamlı erişim veriyor (kendi ödemeleri + makbuz PDF), ancak mobilde CUSTOMER için hiçbir Finans/Ödeme ekranı yok. **Henüz yapılmadı** — Para export/PDF modülüyle birlikte ele alınacak.

---

## Öncelikli Eksik Listesi

Aşağıdaki liste, yukarıdaki "Kısmi"/"Hayır" bulgularının tamamını numaralandırır; sıralama görev tanımındaki önceliğe göredir: (1) detaylı filtre/arama, (2) export/PDF/paylaşım, (3) toplu işlemler, (4) grafik/rapor detayları. Her madde için backend'de uç zaten var mı (yalnızca Flutter işi) yoksa backend/web tarafında da eksik mi olduğu belirtilmiştir.

### Grup 1 — Detaylı filtre/arama eksiklikleri (mobilde yok, web'de var)

1. **İşler** — Arama kutusu var ama durum dağılım şeridi, sayaç rozetli filtre çipleri ve sayfalama eksik. Roller: OWNER/MANAGER/TEAM_LEAD/STAFF/CUSTOMER. Backend zaten destekliyor (`GET /jobs?search=&status=&page=`) — yalnızca Flutter işi.
2. **Müşteriler** — Semt seçici (`/districts`) formda kullanılmıyor, "Son İş" sütunu ve bakiye dağılım şeridi yok. Roller: OWNER/MANAGER. Backend uçları (`/districts`) hazır — yalnızca Flutter işi.
3. **Stok** — Arama kutusu arayüze bağlı değil (API destekliyor), sayfalama yok. Roller: OWNER/MANAGER/TEAM_LEAD. Yalnızca Flutter işi.
4. **Teklifler** — Durum dağılım şeridi ve keyfi durum değiştirme dropdown'u yok. Roller: OWNER/MANAGER. Backend zaten hazır — yalnızca Flutter işi.
5. **Sözleşmeler** — Sayfalama kontrolü yok (API destekliyor), durum dağılım şeridi yok. Roller: OWNER/MANAGER. Yalnızca Flutter işi.
6. **Raporlar** — Tarih aralığı seçici (30 gün/3 ay/6 ay) hiç yok; grafikler sabit varsayılan aralıkla çalışıyor. Roller: OWNER/MANAGER. Backend `?months=` parametresini zaten destekliyor — yalnızca Flutter işi.
7. **Loglar** — Tarih aralığı filtresi, işlem türü dropdown'u, kullanıcı arama, "Filtreleri Temizle" — hiçbiri mobilde yok. Rol: OWNER. Backend `/audit-logs` ham veriyi zaten döndürüyor; filtreleme web'de olduğu gibi client-side yapılabilir — yalnızca Flutter işi.
8. **Bildirimler** — Durum filtre sekmeleri ve kategori filtre çipleri yok. Roller: hepsi (erişimi olan MANAGER/TEAM_LEAD/STAFF için). Backend `?status=&category=` zaten destekliyor — yalnızca Flutter işi.
9. ~~**Kullanım İstatistikleri**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §17.
10. **Personel** — Arama/filtre ne web'de ne mobilde var (ortak eksik, öncelik dışı).

### Grup 2 — Export/PDF/paylaşım eksiklikleri (backend zaten var, mobilde indirme/paylaşma yok)

11. ~~**Para → Excel'e Aktar**~~ — **TAMAMLANDI (2026-09-10).** `downloadAndShare()` ortak yardımcı fonksiyonu eklendi (`mobile/lib/core/file_download.dart`, `path_provider`+`share_plus` paketleriyle — cihazın paylaşım sayfasını açar). Para AppBar'ına indirme butonu eklendi.
12. ~~**Para → Tek ödeme PDF makbuzu**~~ — **TAMAMLANDI (2026-09-10).** Her ödeme satırına makbuz ikonu eklendi, aynı `downloadAndShare()` kullanılıyor.
13. ~~**Müşteriler → İş raporu PDF indirme**~~ — **TAMAMLANDI (2026-09-10).** Müşteri detayı İşler sekmesinde tamamlanmış işlere PDF indirme ikonu eklendi.
14. ~~**Müşteriler → Excel'e Aktar**~~ — **TAMAMLANDI (2026-09-10).** Müşteriler listesi AppBar'ına (yalnızca OWNER/MANAGER) indirme butonu eklendi.
15. **Raporlar → PDF/XLS rapor indirme** — Ne web'de ne backend'de bir export ucu var (`exportController.ts`'de analytics/raporlar için export fonksiyonu yok). **Backend + web işi de gerekiyor**, salt Flutter işi değil.
16. **Sözleşmeler → PDF indirme** — `Contract.pdfUrl` alanı var ama üretim ucu yok; ne web'de ne backend'de gerçek bir export akışı var. **Backend işi gerekiyor.**

### Grup 3 — Toplu işlem / yönetim eksiklikleri

17. **Personel → Oluşturma/Düzenleme/Silme** — ~~mobilde tamamen salt-okunur~~ **TAMAMLANDI (2026-09-10).** `staff_form_screen.dart` (yeni) ile `POST/PATCH/DELETE /staff` bağlandı; `mobile/lib/features/staff/staff_api.dart`'a `create/update/delete/listUnlinkedUsers` eklendi. Canlı uçtan uca doğrulandı (curl ile create→update→delete döngüsü, mevcut bir "bağlanmamış" test kullanıcısıyla, sonunda tekrar bağlanmamış duruma döndü). **İzin yönetimi (`PATCH /staff/:id/permissions`, yalnızca OWNER) hâlâ eksik** — ayrı, daha küçük bir iş kalemi olarak kaldı.
18. ~~**Personel → Sertifika ekleme/silme**~~ — **TAMAMLANDI (2026-09-10)**.
19. ~~**Müşteriler → Silme**~~ — **TAMAMLANDI (2026-09-10).** Müşteri detayına Sil butonu eklendi, backend curl ile create→delete döngüsüyle doğrulandı.
20. ~~**Stok → Ürün silme**~~ — **TAMAMLANDI (2026-09-10).** Ayrıca fark edildi: ürün **düzenleme** de hiç yoktu (yalnızca oluşturma vardı) — o da aynı turda eklendi (`_ProductFormScreen` artık edit modunu destekliyor). Backend curl ile create→update→delete döngüsüyle doğrulandı.
21. ~~**Bekleyen Onaylar → Teklif "İletişime Geçildi" aksiyonu**~~ — **TAMAMLANDI (2026-09-10).** `updateQuoteStatus(id, 'CONTACTED')` bağlandı (aynı desen zaten dönüştürme aksiyonunda çalışıyordu). Backend şeması (`status: z.string().min(1).optional()`) serbest string kabul ediyor, kod incelemesiyle doğrulandı. Canlı testte yeni bir teklif talebi oluşturamadım (`POST /quotes` public uçu gerçek reCAPTCHA token'ı istiyor, dev ortamında üretilemez) — bu backend'in kasıtlı tasarımı, mobil uygulamayı ilgilendirmiyor.
22. ~~**Ayarlar → Hizmet Türleri / Semtler CRUD**~~ — **TAMAMLANDI (2026-09-10).** Yeni `named_list_settings_screen.dart` (tek genel ekran, hem `/service-types` hem `/districts` için) eklendi, `audit_settings_screen.dart`'ın Ayarlar sekmesine iki giriş linki eklendi. Backend'de "silme" aslında yumuşak pasifleştirme (`isActive:false`) — ekran bunu "Pasifleştir/Aktifleştir" olarak gösteriyor, web ile birebir aynı. Canlı curl ile create→rename→pasifleştir→aktifleştir döngüsü doğrulandı, test kaydı sonunda pasifleştirilerek temizlendi (kalıcı silme ucu backend'de yok — web de aynı kısıtla çalışıyor).
23. **Ayarlar → Yedekleme / Demo veri temizleme** — `/admin/backup`, `/admin/clear-demo-data` hazır; mobilde yok. Rol: OWNER. **Yalnızca Flutter işi**, ama hassas/yıkıcı bir aksiyon olduğu için dikkatli UI gerektirir.
24. **Personel → maaş alanı gizliliği (`GET /staff` / `GET /staff/:id`)** — ~~Bu bir "eksik özellik" değil, bir **güvenlik açığı**~~ **DÜZELTİLDİ (2026-09-10).** TEAM_LEAD'in mobil iş yeniden atama seçicisi bu ucu gerçekten çağırıyordu, dolayısıyla maaş verisi TEAM_LEAD'in cihazına gidiyordu. Backend'de `redactSalaryForRole()` eklendi, yalnızca OWNER/MANAGER için `salaryBase` dönüyor; canlı testle doğrulandı (TEAM_LEAD/STAFF'ta yok, OWNER'da var).
25. **Müşteriler → Silme yetkisi tutarsızlığı** — `DELETE /customers/:id`, `requireRoleOrPermission([MANAGER],"delete_customers")` ile korunuyor; OWNER'ın bu izne doğrudan rol üzerinden değil, atanmış izin üzerinden sahip olması gerekiyor — seed/izin tablosunun doğrulanması gerekiyor (**backend/veri işi**, Flutter'ı ilgilendirmiyor).

### Grup 4 — Grafik/rapor detay sayfaları (mobilde yalnızca özet sayı, web'de tam grafik)

26. ~~**Performans → Podyum + 2 çubuk grafik**~~ — **TAMAMLANDI (2026-09-10).** Rank rozetleri (altın/gümüş/bronz) zaten podyum görseli sağlıyordu; "Tamamlanan İşe Göre" ve "Müşteri Puanına Göre" iki çubuk-satır sıralaması eklendi (mevcut projenin "grafik kütüphanesi eklenmeyecek" kararıyla tutarlı, `LinearProgressIndicator` tabanlı).
27. ~~**Performans → Aktif personel / Hedef gerçekleşme % kartları**~~ — **TAMAMLANDI (2026-09-10).** `staffCount` özet karta eklendi (hedef gerçekleşme %'si zaten her personel satırında gösteriliyordu — `targetCompletionPercent`, daha önceki bir fazda eklenmişti, madde yanlış "eksik" işaretlenmiş). Backend `staffCount:14` ile canlı doğrulandı.
28. ~~**Raporlar → Ciro trend grafiği**~~ — **TAMAMLANDI (2026-09-10).** Mevcut çubuk-satır desenine (`_BarRow`) uygun şekilde eklendi. Backend'den canlı veriyle doğrulandı.
29. ~~**Raporlar → Hizmet dağılımı / müşteri sadakati donut grafikleri**~~ — **Zaten mevcuttu, gerçek bir eksik değildi.** Çubuk/mini-kart olarak gösterilmesi kasıtlı bir tasarım kararı (grafik kütüphanesi eklenmedi), veri doğru — madde yanlış "eksik" işaretlenmiş.
30. ~~**Para → Ciro trend grafiği**~~ — **TAMAMLANDI (2026-09-10)**, aynı çubuk-satır deseniyle eklendi (`_FinanceBarRow`), canlı veriyle doğrulandı. **Ödeme türü dağılımı zaten liste olarak vardı** (donut yerine, mevcut proje deseniyle tutarlı — kapsam dışı bağımlılık eklenmedi).
31. ~~**Takvim → Özet kartlar + haftalık dağılım grafiği**~~ — **TAMAMLANDI (2026-09-10).** Tüm roller için (Bugünkü İş/Bu Hafta/Tamamlanma %/En Yoğun Gün) özet kartları + haftalık (Pzt-Paz) dağılım çubukları eklendi, zaten çekilen aylık `/jobs` verisinden istemcide türetildi — ek API çağrısı gerekmedi. TEAM_LEAD'in `/team/calendar` kapasite kartı ayrıca korundu.
32. ~~**Bildirimler → Özet kartlar + "Tip Dağılımı" donut grafiği**~~ — **TAMAMLANDI (2026-09-10).** Backend'in hazır `/notifications/summary` ucu (`{total,unread,today,byCategory}`) bağlandı; özet kartlar + kategori dağılım çubukları eklendi, canlı veriyle doğrulandı. **Header çekmecesi (arama, kategori sekmeleri) hâlâ eksik** — mobilde zaten "header" kavramı yok (ayrı bir sayfa), düşük öncelikli kaldı.
33. ~~**Loglar → Özet kartlar + "En Aktif Kullanıcılar" + "İşlem Türü Dağılımı" grafikleri**~~ — **TAMAMLANDI (2026-09-10).** Web'deki gibi backend'de ayrı bir özet ucu yok — istemcide zaten çekilen log listesinden türetildi (aynı desen), canlı veriyle doğrulandı.
34. ~~**Sistem Durumu (sayfanın tamamı)**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §16.
35. ~~**Kullanım İstatistikleri (sayfanın tamamı)**~~ — **TAMAMLANDI (2026-09-10)**, bkz. §17.
36. ~~**Mesajlar → Özet kartlar + gün ayırıcılar + okundu bilgisi (checkmark) + Gözlemci modu**~~ — **TAMAMLANDI (2026-09-10).** Dördü de eklendi: özet kartlar (istemci türetimi), sohbet ekranına gün ayırıcı çipleri + tek/çift tik okundu göstergesi, ve yeni `observer_conversations_screen.dart` (yalnızca OWNER, `GET /conversations/all`) — seçilen konuşma OWNER'ın kendi konuşması değilse `ChatScreen` salt-okunur modda açılıyor (`readOnly`, gönderme kutusu gizli, backend zaten katılımcı olmayanın mesaj/okundu isteğini 403 ile reddediyor). Canlı `/conversations/all` yanıtıyla doğrulandı.
