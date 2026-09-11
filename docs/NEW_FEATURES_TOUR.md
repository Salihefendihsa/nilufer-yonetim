# 6 Yeni Özellik Turu — Tasarım Kararları

Bu belge A→F sırasıyla eklenen 6 özelliğin tasarım kararlarını, API
sözleşmelerini ve varsayılan (spec'te belirtilmemiş) iş kurallarını kaydeder.

## Bölüm A — İzin Talep/Onay Sistemi

- `LeaveRequest`: `staffId`, `startDate`, `endDate`, `reason`, `status`
  (PENDING/APPROVED/REJECTED), `decidedByUserId`, `decisionNote`.
- `POST /leave-requests` (STAFF/TEAM_LEAD) — `startDate < endDate` ve
  geçmiş tarih olamaz zorunluluğu zod `.refine()` ile.
- `GET /leave-requests`: STAFF kendi, TEAM_LEAD ekibinin (+ kendisi,
  `getTeamStaffIds` kendi staffId'sini de içerir), OWNER/MANAGER tümü.
  **Varsayım (spec'te yoktu)**: `?mine=true` query param'ı eklendi — bir
  TEAM_LEAD'in "İzin Taleplerim" sayfasında yalnızca KENDİ geçmişini
  görmesi gerekiyordu (ekibinin değil); bu, onay kuyruğundaki (Bekleyen
  Onaylar) "ekibin talepleri" görünümünden ayrı bir ihtiyaç.
- `PATCH /leave-requests/:id/decide`: APPROVED olunca `Staff.status=ON_LEAVE`,
  `statusUntil=endDate` — **yeni bir cron GEREKMEDİ**, mevcut
  `resetExpiredStaffStatuses` (hem cron hem her `GET /staff` okuması)
  zaten herhangi bir `statusUntil` dolmuş durumu AVAILABLE'a çeviriyordu;
  canlı testle doğrulandı (statusUntil'i geçmişe çekip GET çağrısı sonrası
  AVAILABLE'a döndüğü görüldü).
- Web: Bekleyen Onaylar sayfası artık TEAM_LEAD'e de açık ama TEAM_LEAD
  için yalnızca izin talepleri + saha raporu onayı kaynakları çekiliyor
  (teklif/avans/sözleşme uçları backend'de zaten OWNER/MANAGER'a kapalı).
  Yeni `/izinlerim` sayfası (TEAM_LEAD/STAFF) — talep formu + geçmiş.
- Mobile: mevcut Onaylar ekranına (yalnızca OWNER/MANAGER erişimi var) 4.
  kaynak eklendi; TEAM_LEAD'in mobilde Onaylar ekranına hiç erişimi
  olmadığı için (bkz. team_lead_shell.dart), yeni "İzinlerim" ekranı hem
  STAFF'ın kendi taleplerini hem TEAM_LEAD'in ekibinin bekleyen taleplerini
  tek ekranda birleştirir.

## Bölüm B — Rapor/Sözleşme PDF İndirme

- `GET /analytics/export/pdf?months=` (OWNER/MANAGER) — Raporlar sayfasının
  4 kalemini (ciro trendi, hizmet dağılımı, bölge sıralaması, müşteri
  sadakati) tek bir PDF'te toplar.
- `GET /contracts/:id/pdf` (OWNER/MANAGER, ilgili CUSTOMER kendi sözleşmesi
  için — `getContract`'taki AYNI erişim kontrolü tekrar kullanıldı).
  `Contract.pdfUrl` şemada duruyor ama hâlâ hiç doldurulmuyor — mevcut
  job-report-pdf deseninde olduğu gibi ON-DEMAND üretilir, diske
  kaydedilmez.
- Refactor: `analyticsController.ts`'teki 4 hesaplama fonksiyonu
  (`getRevenueTrend` vb.) `compute*` yardımcılarına ayrıldı — hem mevcut
  JSON uçları hem yeni PDF export'u AYNI hesaplamayı kullanır, kopya
  mantık yok.
- Web: Raporlar sayfasına "PDF İndir" (seçili tarih aralığını `months`
  olarak geçirir), Sözleşmeler tablosundaki her satıra "PDF" butonu.
- Mobile: mevcut `downloadAndShare()` yardımcısı kullanıldı — Raporlar
  AppBar'ına bir ikon, Sözleşmeler listesindeki (hem OWNER/MANAGER hem
  CUSTOMER'ın "Sözleşmelerim" görünümü — dosyada iki ayrı State sınıfı
  var) her karta "PDF İndir" butonu.
- Doğrulama: her iki uç curl ile çağrıldı, `Content-Type: application/pdf`
  ve gerçek PDF byte'ları (`file` komutu "PDF document" doğruladı)
  teyit edildi. Salt okunur uçlar olduğu için test verisi oluşturulmadı,
  temizlik gerekmedi.

## Bölüm C — Gider (Expense) Takibi

- `Expense`: `category` (FUEL/CHEMICALS/EQUIPMENT/RENT/UTILITIES/OTHER),
  `amount`, `description?`, `date`, `recordedByUserId`, `receiptUrl?`.
  CRUD tamamı OWNER/MANAGER — `router.use(requireRole(OWNER, MANAGER))`
  ile tüm alt uçlar tek satırda korunuyor (leaveRequests/expenses ile
  aynı desen).
- `GET /expenses` — `category` ve `month` (`YYYY-MM`) query filtreleri;
  liste `date desc` sıralı, sayfalanmış.
- Net kâr formülü güncellendi: `netProfitThisMonth = thisMonthTotal -
  totalStaffSalaryBase - totalExpensesThisMonth` (bkz.
  `paymentsController.ts:getPaymentsSummary`). `view_finance` görünürlük
  kuralına dokunulmadı — formül yalnızca zaten görebilenler için hesaplanıyor.
  Yeni alan: `summary.totalExpensesThisMonth`.
- **Yan düzeltme (bug, bu değişikliği yaparken fark edildi)**: personel
  maaş toplamı (`staffSalaryAgg`) `archivedAt: null` filtrelemiyordu —
  terfi/işten çıkarma sonrası arşivlenen bir personelin maaşı net kârdan
  düşülmeye SONSUZA KADAR devam ediyordu. Artık yalnızca aktif personel
  sayılıyor.
- Web: Para sayfasına "Tahsilatlar | Giderler" sekme geçişi eklendi
  (personel sayfasındaki sekme deseniyle aynı). Giderler sekmesi:
  kategori bazlı StatCard özetleri, kategori filtre çipleri, liste,
  düzenle/sil, "Yeni Gider" formu (modal).
- Mobile: `finance_screen.dart` artık bir `TabController` ile
  "Tahsilatlar"/"Giderler" sekmelerine ayrıldı — AppBar'daki "+" butonu
  aktif sekmeye göre farklı form ekranı açar (Excel dışa aktarma yalnızca
  Tahsilatlar sekmesinde görünür, gider dışa aktarma spec'te yoktu).
- Doğrulama: birkaç test gideri eklenip net kârın tam beklenen miktarda
  (800₺ eklenince -800 delta) değiştiği curl ile doğrulandı; ardından
  test kayıtları (2 gider + 1 audit log) ID bazlı silinip net kârın tam
  eski değerine (`-314500`) döndüğü tekrar doğrulandı.

## Bölüm D — İki Adımlı Doğrulama (2FA)

- TOTP tabanlı (SMS/e-posta YOK — spec'te zaten dışlanmıştı), yalnızca
  OWNER/MANAGER. Kütüphane: `otplib` (v13, async fonksiyonel API —
  `generateSecret`/`generateURI`/`generate`/`verify`) + `qrcode` (QR'ı
  backend'de PNG data URL olarak üretip döner, istemcilerin ayrı bir QR
  kütüphanesine ihtiyacı olmaz — mobilde bu sayede yeni paket eklenmedi).
- `User`: `twoFactorSecret` (base32, yalnızca /setup ile yazılır),
  `twoFactorEnabled` (varsayılan false). Yeni modeller:
  `TwoFactorRecoveryCode` (10 adet, tek kullanımlık, `PasswordResetToken`
  ile aynı "yalnızca hash saklanır" prensibi) ve `TwoFactorChallenge`
  (login() sonrası JWT yerine dönen preToken'ın hash'i, 5 dk TTL, tek
  kullanımlık).
- **Tasarım kararı (spec'te detaylandırılmamıştı)**: pre-2FA token bir JWT
  DEĞİL — ayrı bir DB tablosunda (`TwoFactorChallenge`) hash'lenmiş rastgele
  bir string. Bu, `middleware/auth.ts`'in JWT/tokenVersion doğrulama
  mantığına hiç dokunulmadan (risk sıfır) tamamen izole bir akış kurmayı
  sağladı — PasswordResetToken deseninin bire bir tekrarı.
- `POST /auth/2fa/setup` → sır + `otpauthUri` + `qrCodeDataUrl` döner,
  `twoFactorEnabled`'ı henüz DEĞİŞTİRMEZ (yanlış kurulumda hesabın
  kilitlenmesini önler — kullanıcı gerçek bir kodu doğrulayana kadar 2FA
  aktif olmaz).
- `POST /auth/2fa/enable { code }` → kod doğrulanırsa `twoFactorEnabled=true`
  + 10 kurtarma kodu (ham hâlleri YALNIZCA bu yanıtta, bir kerelik).
- `POST /auth/2fa/disable { currentPassword }` → mevcut şifre zorunlu
  (çalıntı bir oturumun tek başına 2FA'yı kapatamaması için — `change-password`
  ile aynı prensip).
- `login()`: şifre doğru + `twoFactorEnabled=true` ise JWT yerine
  `{ twoFactorRequired: true, preToken }` döner. `POST /auth/2fa/verify
  { preToken, code | recoveryCode }` gerçek JWT'yi döner (session da bu
  aşamada açılır).
- **Yan düzeltme**: `GET /auth/me` yanıtına `twoFactorEnabled` eklendi —
  daha önce yoktu, web/mobil ayarlar ekranı mevcut durumu bundan okur.
  Ayarlar sayfasındaki eski "email yapılandırılmadığı için 2FA devre dışı"
  notu da YANLIŞTI (gerçek TOTP 2FA e-postaya hiç bağımlı değil) —
  metni SMTP'ye bağımlı diğer özelliklere (şifre sıfırlama, bildirim
  e-postaları) atıfta bulunacak şekilde düzeltildi.
- Web: Ayarlar → Kişisel bölümüne (yalnızca OWNER/MANAGER) kart — kurulum
  (QR + sır + kod doğrulama), kurtarma kodlarını bir kerelik gösterme,
  devre dışı bırakma (şifre modalı). Giriş sayfası artık `preToken`
  geldiğinde form yerine kod giriş ekranını gösteriyor (authenticator kodu
  veya kurtarma kodu seçilebilir).
- Mobile: Ayarlar ekranına aynı kart (QR görüntüleme `Image.memory` ile
  backend'in ürettiği base64 PNG'den — ek paket yok). `AuthProvider`'a
  yeni `AuthStatus.twoFactorRequired` durumu ve `verifyTwoFactor()` eklendi;
  `main.dart`'taki `_AuthGate` bu duruma göre yeni `TwoFactorVerifyScreen`'i
  gösteriyor (mustChangePassword ile aynı desen).
- Doğrulama: Node script içinde `otplib`'in kendisiyle GERÇEK TOTP kodları
  hesaplanıp uçtan uca test edildi (curl yerine fetch) — setup → enable →
  yanlış kod reddi → doğru kod ile giriş → preToken'ın tek kullanımlık
  olduğu (ikinci kullanım reddedildi) → kurtarma kodu ile giriş → aynı
  kurtarma kodunun tekrar kullanılamadığı → disable → disable sonrası
  normal (2FA'sız) girişin çalıştığı — hepsi doğrulandı (11/11 adım
  beklenen sonucu verdi).

## Bölüm E — Tedarikçi/Sipariş Yönetimi

- `Supplier`: `name`, `contactPerson?`, `phone?`, `email?`, `address?`,
  `isActive`. CRUD `/suppliers` — OWNER/MANAGER (ServiceType/District'ten
  farklı olarak OWNER-only değil, çünkü tedarikçi kaydı operasyonel bir iş,
  MANAGER'ın günlük akışının parçası — mevcut satın alma talebi akışıyla
  aynı rol seviyesinde tutuldu).
- Silme = `ServiceType`/`District` ile AYNI desen: kalıcı silmez,
  `isActive=false` yapar — geçmiş `StockPurchaseRequest.supplierId`
  referansları kırılmasın diye (bir tedarikçi pasifleşse bile eski
  siparişlerdeki adı görünmeye devam eder).
- `StockPurchaseRequest`'e iki opsiyonel alan eklendi: `supplierId` (FK) ve
  `orderTrackingNumber` (serbest metin, kargo/sipariş no). Mevcut talep
  akışına (PENDING → RECEIVED/CANCELLED, iyimser kilit, stok yalnızca mal
  kabulünde artar) hiç dokunulmadı — yalnızca `createPurchaseRequest`
  şemasına iki opsiyonel alan eklendi, `listPurchaseRequests`/
  `updatePurchaseRequest` yanıtlarına `supplier: {id, name}` include edildi.
- Web: Stok sayfasına açılır/kapanır "Tedarikçiler" paneli (ServiceType/
  District'teki satır-içi ekle/düzenle/pasifleştir deseniyle aynı) +
  Satın Alma Talebi formuna tedarikçi seçici ve takip no alanı.
- Mobile: Stok ekranı AppBar'ına yeni bir "Tedarikçiler" ikonu (yalnızca
  OWNER/MANAGER) → yeni `SuppliersScreen`; satın alma talebi bottom
  sheet'ine tedarikçi dropdown'u (yalnızca aktif tedarikçi varsa gösterilir)
  ve takip no alanı eklendi.
- Doğrulama: Node script ile tedarikçi oluşturuldu → ürüne bağlı satın alma
  talebine iliştirildi → listede `supplier`/`orderTrackingNumber` doğru
  döndüğü teyit edildi → tedarikçi güncellendi → talep iptal edildi →
  tedarikçi pasifleştirildi (`isActive:false` teyit edildi) → test
  kayıtları (1 tedarikçi + 1 satın alma talebi) ID bazlı kalıcı olarak
  silindi (StockPurchaseRequest'te hard-delete uç olmadığı için doğrudan
  Prisma script'iyle, normal CANCELLED durumunu değiştirmeden).

## Bölüm F — Push Bildirimleri (FCM)

**Kısıt (kullanıcı tarafından baştan belirtildi)**: gerçek push bildirimi göndermek
bir Firebase projesi/kimlik bilgileri gerektirir ve bunu tarafımdan oluşturmak mümkün
değildir (Firebase Console erişimi yok). Bu bölümde yalnızca ALTYAPI kuruldu; gerçek
Firebase kurulumu adım adım `PROJECT_HANDOFF_TR.md` §13'e yazıldı.

- Backend: `firebase-admin` paketi kuruldu (`backend/src/lib/push.ts`).
  `FIREBASE_SERVICE_ACCOUNT_KEY` env değişkeni (ham JSON veya base64) — boşsa
  `isPushConfigured()` false döner ve hiçbir Firebase çağrısı yapılmaz (`sendEmail`
  ile aynı "yapılandırılmamışsa sessizce atla" prensibi).
- `User.fcmTokens` (`String[]`, bir kullanıcının birden fazla cihazı olabileceği
  için dizi). `POST /users/me/fcm-token { token }` — herhangi bir giriş yapmış
  kullanıcı (rol kısıtı yok) kendi cihazının token'ını ekler; aynı token tekrar
  gönderilirse yinelenmez.
- `lib/notify.ts`'teki mevcut `notifyUser`/`notifyUsers`/`notifyManagement`
  fonksiyonları DEĞİŞTİRİLMEDİ (imzaları aynı) — içlerine, uygulama içi bildirim
  oluşturulduktan SONRA çağrılan yeni bir `pushToUsers()` yardımcı fonksiyonu
  eklendi. Böylece sistemdeki TÜM mevcut bildirim tetikleyicileri (iş atama, izin
  onayı, stok ikmal talebi, vb. — onlarca çağrı yeri) hiçbir değişiklik yapmadan
  otomatik olarak push'a da kavuştu.
- Geçersiz/süresi dolmuş FCM token'ları (`messaging/registration-token-not-registered`
  veya `messaging/invalid-argument` hatası) push gönderiminden sonra otomatik
  olarak `User.fcmTokens`'tan temizlenir — liste zamanla şişmez.
- Push payload'ına `relatedType`/`relatedId` (`data` alanı olarak) eklendi —
  mobil tarafta bildirime dokunulduğunda mevcut in-app yönlendirme deseniyle aynı
  şekilde ilgili ekrana gidilebilmesi için (bkz. PROJECT_HANDOFF_TR.md §13.4).
- `.env.example`'a `FIREBASE_SERVICE_ACCOUNT_KEY` eklendi (yorum satırlarıyla
  birlikte, nasıl alınacağına dair PROJECT_HANDOFF_TR.md'ye yönlendirme).
- **Mobile: kullanıcı kararıyla kod tarafı eklenmedi** — `firebase_core`/
  `firebase_messaging` paketleri pubspec.yaml'a eklenmedi, ilgili Dart kodu
  yazılmadı (yalnızca dokümantasyon). Gerekçe: gerçek Firebase config dosyaları
  (`google-services.json`/`GoogleService-Info.plist`) olmadan bu paketler
  projeye eklenirse `flutter analyze`/`flutter test`/derleme kırılabilir veya en
  azından çalışma zamanında `Firebase.initializeApp()` hata verir — kullanıcı bu
  riski almak yerine, kendi Firebase projesini kurduktan sonra
  PROJECT_HANDOFF_TR.md §13.4'teki adımları izlemeyi tercih etti.
- Doğrulama: **gerçek push bildirimi tarafımdan test EDİLEMEDİ** (Firebase
  projesi/cihaz erişimi yok — bu, kullanıcının baştan kabul ettiği bir sınır).
  Test edilen ve doğrulanan: (1) Firebase HİÇ yapılandırılmamışken backend'in
  hatasız başladığı ve çalıştığı, (2) `/users/me/fcm-token`'ın token kaydettiği
  ve tekrar gönderimde yinelemediği, (3) `notifyManagement` tetikleyen bir işlem
  (satın alma talebi oluşturma) yapıldığında hem hiçbir hata fırlatılmadığı hem
  de uygulama içi bildirimin normal şekilde oluşmaya devam ettiği (push'un
  sessizce atlandığı) — Node script ile uçtan uca doğrulandı, test verisi
  (fcmToken + satın alma talebi) temizlendi.
