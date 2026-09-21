# Nilüfer İlaçlama Yönetim Sistemi — Mobil (Flutter) Aktarım Raporu

Bu doküman, mevcut backend'i kullanacak bir Flutter mobil uygulaması geliştirilebilmesi için hazırlanmıştır. İçerik doğrudan kod okunarak doğrulanmıştır; doğrulanamayan noktalar ayrı bir bölümde açıkça belirtilmiştir. Bu aşamada kod değiştirilmemiş, hiçbir servis çalıştırılmamıştır (test/build yapılmamıştır).

Git durumu: `main` dalı, çalışma kopyası temiz (commit edilmemiş değişiklik yok). Proje kökünde `CLAUDE.md`/`AGENTS.md` bulunmuyor (yalnızca `backend/node_modules/nodemailer/CLAUDE.md` var, o bir bağımlılığa ait, projeye özgü değil).

---

## 1. Klasör Yapısı, Teknolojiler, Sürümler

Monorepo değildir; `backend/` ve `web/` birbirinden bağımsız iki Node.js projesidir, kökte yalnızca `docker-compose.yml` (PostgreSQL) ve ortak `.env.example` bulunur.

```
nilufer-yonetim/
├── docker-compose.yml        (postgres:17 servisi)
├── .env.example               (docker-compose + backend değişkenlerinin birleşik örneği)
├── README.md
├── backend/
│   ├── prisma/schema.prisma, migrations/ (11 migration), seed.ts
│   ├── src/index.ts            (Express app girişi)
│   ├── src/controllers/        (24 dosya)
│   ├── src/routes/             (22 dosya)
│   ├── src/middleware/         (auth.ts, errorHandler.ts)
│   ├── src/lib/                (jwt, access, permissions, messaging, recurrence, cron, email, notify, reminders, upload, recaptcha, googleCalendar, metrics, auditLog, pagination, params, prisma)
│   ├── uploads/                (multer hedefi, .gitkeep dışında boş — gerçek dosya yok)
│   └── .env.example
└── web/
    └── src/
        ├── app/(dashboard)/     18 sayfa + app/giris (login)
        ├── components/          21 paylaşılan bileşen
        ├── lib/                 api.ts, auth.ts, AuthProvider.tsx, permissions.ts, format.ts, recaptcha.ts, notifications
        ├── middleware.ts        (cookie tabanlı route guard, sadece web için)
        └── .env.example
```

**Backend** (`backend/package.json`): Node.js + TypeScript 5.9, Express **5.2**, Prisma **6.19** (PostgreSQL ORM), `zod` 4.5 (doğrulama), `jsonwebtoken` 9 + `bcrypt` 6 (auth), `helmet` 8, `cors` 2.8, `express-rate-limit` 8, `multer` 2.3 (dosya yükleme), `pdfkit` 0.20, `exceljs` 4.4, `node-cron` 4.6, `nodemailer` 9. Çalıştırma: `ts-node-dev` (dev), `tsc` (build), `node dist/index.js` (prod).

**Web**: Next.js **14.2.35** (App Router), React 18, Tailwind CSS 3.4, `framer-motion` 13, `lucide-react`. State yönetimi Redux/Zustand değil; özel bir `AuthProvider` (React Context) + sayfa bazlı `useState`/`useEffect` + doğrudan `api.ts` fetch çağrıları.

### Yerelde çalıştırma
1. PostgreSQL 17'nin çalıştığından emin olun. Bu geliştirme makinesinde **native (Windows servisi) PostgreSQL 17** kullanılır: `postgresql-x64-17` servisi otomatik başlar, `localhost:5432`'de dinler; `DATABASE_URL` buna işaret eder. Docker gerekmez. (Alternatif: `docker-compose up -d` ile `postgres:17` konteyneri, host portu `.env`'deki `POSTGRES_PORT` = `5433` — native ile çakışmaz; bkz. §12.2.)
2. `backend/`: `.env` oluştur (bkz. bölüm 3) → `npm install` → `npx prisma migrate dev` → `npm run db:seed` (opsiyonel demo veri) → `npm run dev` (varsayılan port `4000`, `GET /health` ile kontrol edilebilir).
3. `web/`: `.env.local` oluştur (`NEXT_PUBLIC_API_URL`, gerekirse `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`) → `npm install` → `npm run dev` (Next.js varsayılanı `3000`).

Flutter tarafı için gerekli olan tek servis backend'dir (port 4000); web arayüzü mobil geliştirme için şart değildir.

---

## 2. Ortam Değişkenleri (yalnızca ad ve amaç — gerçek değer yok)

Kaynak: `.env.example`, `backend/.env.example`, `web/.env.example`.

| Değişken | Nerede | Amaç |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | kök (docker-compose) | Lokal PostgreSQL konteyneri kimlik bilgileri |
| `DATABASE_URL` | backend | Prisma'nın bağlanacağı Postgres bağlantı dizesi |
| `JWT_SECRET` | backend | Giriş token'larının imzalanması/doğrulanması |
| `PORT` | backend | Express sunucu portu (varsayılan 4000) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | backend | E-posta bildirimleri (opsiyonel — boşsa gönderim sessizce atlanır, `backend/src/lib/email.ts`) |
| `RECAPTCHA_SECRET_KEY` | backend | Google reCAPTCHA v3 sunucu tarafı doğrulaması (opsiyonel) |
| `MOBILE_APP_SECRET` | backend (sonradan eklendi, bkz. §7) | Flutter mobil istemcisinin reCAPTCHA'yı atlaması için paylaşılan sır (`X-Mobile-App-Key` header'ıyla eşleştirilir) |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_ENDPOINT` | backend | S3-uyumlu nesne depolama (opsiyonel; boşsa yerel disk — bkz. §8.1) |
| `SENTRY_DSN` | backend | Sentry hata izleme (opsiyonel; boşsa no-op — bkz. §8.1) |
| `LOG_LEVEL` | backend | pino log seviyesi (varsayılan `info` — bkz. §8.1) |
| `NEXT_PUBLIC_API_URL` | web | Backend'in adresi |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | web (`.env.example`'da **listelenmemiş** ama `web/src/lib/recaptcha.ts:10`'da okunuyor) | reCAPTCHA v3 istemci site anahtarı |

**Güncelleme (sonraki oturum)**: Mobil için reCAPTCHA sorunu çözüldü — mobil istemci artık `X-Client-Type: mobile` + `X-Mobile-App-Key` (yukarıdaki `MOBILE_APP_SECRET` ile eşleşen) header'larıyla reCAPTCHA'yı atlıyor; bunun karşılığında mobil girişlere web'den daha sıkı bir rate limit (5 deneme/15dk) uygulanıyor. Detay ve kalan risk (sır APK'dan çıkarılabilir) için `docs/STITCH_FEATURE_MATRIX.md` → "Çözülen Karar: reCAPTCHA / Mobil Giriş" bölümüne bakın.

---

## 3. Kullanıcı Rolleri, Kişisel İzinler, Veri Erişim Kapsamları

`Role` enum (`backend/prisma/schema.prisma:10-16`): `OWNER, MANAGER, TEAM_LEAD, STAFF, CUSTOMER`.

Üç katmanlı yetkilendirme (`backend/src/middleware/auth.ts`):
1. `requireAuth` — `Authorization: Bearer <token>` başlığını zorunlu kılar, geçersiz/süresi dolmuşsa 401.
2. `requireRole(...roles)` — sabit rol listesi.
3. `requirePermission(key)` / `requireRoleOrPermission(roles, key)` — OWNER her zaman geçer; diğerleri `Permission` tablosunda `staffId+key=true` kaydı varsa geçer (CUSTOMER'ın Staff kaydı olmadığı için bu yola hiç giremez).

**Kişisel izin anahtarları** (`backend/src/lib/permissions.ts:1-10`, 8 adet): `view_finance, delete_customers, view_all_jobs, manage_contracts, manage_staff, approve_advances, edit_prices, export_reports`. Web'de `edit_prices` ve `view_all_jobs` dışındaki bazı anahtarların gerçek kullanım yeri kod içinde doğrulanmadı; kesin kullanılanlar: `delete_customers` (`routes/customers.ts:22`), `view_finance` (`routes/payments.ts:11`). Diğerleri şemada tanımlı ama route seviyesinde kullanıldığı doğrulanmadı — **doğrulanamayan nokta**.

**Kapsam (scope) mantığı** — merkezi dosya `backend/src/lib/access.ts`:
- `canAccessJob(user, job)`: OWNER/MANAGER → her iş; TEAM_LEAD → `getTeamStaffIds()` listesindeki personele atanmış işler; STAFF → yalnızca kendine atanan iş; CUSTOMER → yalnızca kendi işi.
- `getTeamStaffIds(userId)`: `Staff.supervisorId` alanına göre "kendisi + doğrudan raporlayanlar" (**tek seviye**, çok katmanlı alt ekipleri kapsamıyor).
- `hasPermission`, `getCustomerAssignedStaffUserId` (müşteri-personel mesajlaşma izni için).

**Rol × ekran/eylem erişim özeti** (route dosyalarından derlendi):

| Rol | Erişebildiği başlıca uçlar/eylemler |
|---|---|
| **OWNER** | Her şey: tüm CRUD'lar, `/admin/*` (demo veri temizleme, yedek), `/settings`, `/audit-logs`, `/sessions/report`, `/system/health`, `/staff/:id/permissions`, `/conversations/all` (tüm konuşmaları izleme) |
| **MANAGER** | OWNER ile hemen hemen aynı geniş yetki; **hariç**: `/admin/*`, `/settings`, `/audit-logs`, `/sessions/report`, `/system/health`, `/staff/:id/permissions`, `/conversations/all` — bunlar yalnızca OWNER'a açık |
| **TEAM_LEAD** | Kendi ekibinin personel/iş listesi ve detayı, ekip performans sıralaması, ekip içi iş ataması (`PATCH /jobs/:id` ile sadece `assignedStaffId`), ürün listesi (salt okunur) |
| **STAFF** | Kendine atanan işler, iş durumunu güncelleme, iş raporu oluşturma (`POST /jobs/:id/report`), avans talebi oluşturma, kendisine atanmış müşterileri (finans verisi hariç) görme, ürün listesi (salt okunur) |
| **CUSTOMER** | Kendi işleri (`/jobs` filtrelenmiş), kendi sözleşmeleri/ödemeleri, iş puanlama (`PATCH /jobs/:id/rate`, sadece COMPLETED işler için), atandığı personelle mesajlaşma |

---

## 4. Mevcut Özellikler ve Ekranlar — Gerçek/Kısmi/Mock Ayrımı

`web/src/app/(dashboard)/` altında 18 sayfa var: `page.tsx` (Komuta Merkezi/dashboard), `musteriler`, `personel`, `isler`, `sozlesmeler`, `stok`, `para`, `performans`, `takvim`, `mesajlar`, `bildirimler`, `bekleyen-onaylar`, `teklifler`, `raporlar`, `loglar`, `sistem-durumu`, `kullanim-istatistikleri`, `ayarlar`; ayrıca `app/giris` (login).

| Ekran/Özellik | Durum | Not |
|---|---|---|
| Müşteri/Personel/İş/Sözleşme/Ödeme CRUD | **Gerçek API** | Tam Prisma+Postgres destekli |
| Stok yönetimi, düşük stok bildirimi | **Gerçek API** | `checkLowStockAndNotify` gerçek eşik kontrolü yapıyor |
| PDF export (iş raporu, ödeme makbuzu) | **Gerçek** | `pdfkit` ile sunucu tarafında üretiliyor |
| Excel export (müşteri, ödeme) | **Gerçek** | `exceljs` |
| İş fotoğrafları (öncesi/sonrası) | **Gerçek** | `multer` disk depolama, `/uploads` altında statik servis |
| Dijital imza | **Gerçek** | Base64 PNG → sunucuda dosyaya yazılıyor (`saveBase64Image`) |
| Tekrarlayan iş üretimi (sözleşme bazlı) | **Gerçek**, cron ile | `node-cron`, her gece 02:00 |
| E-posta bildirimleri | **Gerçek ama opsiyonel** | SMTP boşsa sessizce atlanır (no-op), mock değil |
| reCAPTCHA v3 | **Gerçek** | Google API'sine sunucu tarafı doğrulama isteği |
| Bildirim merkezi (in-app) | **Gerçek, polling tabanlı** | Push bildirim (FCM/APNs) **yok** — sadece DB'den okunan `Notification` kaydı, istemci periyodik `GET /notifications/unread-count` çağırıyor |
| Google Takvim entegrasyonu | **Kısmi — sadece link üretimi** | `backend/src/lib/googleCalendar.ts` OAuth/senkronizasyon yapmıyor, sadece `calendar.google.com/calendar/render?...` deep-link'i üretiyor (kod içi yorumla doğrulandı: "no API key or OAuth needed") |
| Analitik raporlar (gelir trendi, hizmet dağılımı, ilçe kırılımı, müşteri sadakati) | **Gerçek** | `analyticsController.ts`, sadece OWNER/MANAGER |
| Oturum süre takibi | **Gerçek ama sınırlı** | `UserSession` kaydı tutuluyor, ancak login sonrası token'ın geçerliliği sunucu tarafında session durumuna bağlı DEĞİL (bkz. bölüm 6) |
| Personel sertifikaları + bitiş hatırlatması | **Gerçek** | Cron ile günlük kontrol |
| Avans talebi + onay akışı | **Gerçek** | `/advances` |
| **İzin talebi (personel izni)** | **Yok** | Şemada `LeaveRequest` benzeri bir model bulunamadı; `AdvanceRequest` yalnızca parasal avans talebidir. "bekleyen-onaylar" sayfası muhtemelen avans taleplerini (ve/veya teklif taleplerini) gösteriyor — ayrı bir izin/mazeret sistemi yok |
| WhatsApp entegrasyonu | **Bulunamadı** | Kod içinde herhangi bir WhatsApp API/kütüphane referansı yok; önceki raporda geçen ifade doğrulanamadı |
| Demo veri | **Gerçekçi ama sentetik** | `backend/prisma/seed.ts` — tüm isim/telefon/e-posta desenli ve uydurma (`personelN@nilufer.com`, `0533 xxx xx xx`, `@example.com`); gerçek kişisel veri değildir |

---

## 5. Veri Modeli (23 model, doğrulandı)

Önceki rapordaki "18 model" ifadesi **hatalıydı**; `backend/prisma/schema.prisma` içinde tam olarak **23 `model` bloğu** var:

`User, Customer, Staff, StaffCertification, Permission, AdvanceRequest, Job, JobPhoto, JobReport, Product, StockMovement, Contract, Payment, Conversation, Message, QuoteRequest, Notification, Setting, ServiceType, District, NotificationPreference, UserSession, AuditLog`

Enum'lar (6 adet): `Role, JobStatus (PENDING/SCHEDULED/COMPLETED/CANCELLED), AdvanceStatus (PENDING/APPROVED/REJECTED), StockMovementType (IN/OUT), RecurrenceType (MONTHLY/QUARTERLY), JobPhotoType (BEFORE/AFTER)`.

**Önemli ilişkiler**: `User` 1-1 `Customer`/`Staff`; `Staff.supervisorId` kendine referans (ekip hiyerarşisi); `Job` → `Customer` + opsiyonel `assignedStaffId` (Staff); `JobReport` 1-1 `StockMovement` (opsiyonel); `Contract.status` **enum değil, string** (`"ACTIVE"/"EXPIRED"` gibi serbest metin); `Conversation.participantAId/participantBId` (kanonik sıralı çift, unique).

**Doğrulanmış iş kuralları**:
- Tekrarlayan iş üretimi: `backend/src/lib/cron.ts:14-40` + `recurrence.ts` (MONTHLY +1 ay, QUARTERLY +3 ay).
- Stok düşürme: `backend/src/controllers/jobsController.ts:244-266`, tek `$transaction` içinde `JobReport` + `Product.currentStock` decrement + `StockMovement` (OUT) birlikte yazılıyor.
- Performans sıralaması: `backend/src/controllers/staffController.ts` (`getStaffLeaderboard`) — aylık tamamlanan iş sayısı + ortalama puan; TEAM_LEAD çağırırsa ekiple sınırlı.
- Mesajlaşma izin matrisi: `backend/src/lib/messaging.ts` (`canUsersMessage`) — OWNER/MANAGER üst rollerle her zaman, TEAM_LEAD-STAFF sadece aynı ekip, CUSTOMER-STAFF sadece o müşterinin en son atanan personeli.
- Denetim log: `backend/src/lib/auditLog.ts` + her controller'da **manuel** `recordAuditLog()` çağrısı — merkezi/otomatik bir middleware değil.

**Önceki rapordaki çelişkilerin netleştirilmesi**:
1. **Model sayısı**: 23 (yukarıda kanıtlandı), 18 değil.
2. **Tüm konuşmaları izleme**: `backend/src/routes/conversations.ts:19` → `router.get("/all", requireRole(Role.OWNER), listAllConversations)` — **yalnızca OWNER**, MANAGER'a açık değil. `conversationsController.ts:87`'deki tekil mesaj okuma izninde de kontrol `req.user!.role !== Role.OWNER` şeklinde, yine sadece OWNER.
3. **İzin talebi ile avans talebi**: Ayrı uygulanmamış — sistemde yalnızca `AdvanceRequest` (parasal avans) var, ayrı bir izin/mazeret (leave) modeli veya endpoint'i yok.
4. **Google Calendar**: Yalnızca bağlantı üretimi — `backend/src/lib/googleCalendar.ts` gerçek bir OAuth/API senkronizasyonu yapmıyor, kod yorumunda "no API key or OAuth needed" ifadesiyle bunu açıkça belirtiyor.

---

## 6. Kimlik Doğrulama Akışı

Kaynak: `backend/src/lib/jwt.ts`, `backend/src/controllers/authController.ts`, `backend/src/middleware/auth.ts`.

- **Giriş**: `POST /auth/login` — email+şifre+opsiyonel `recaptchaToken`. Başarılıysa yeni bir `UserSession` satırı açılır, JWT `{sub, role, email, sessionId}` payload'ıyla imzalanır.
- **Token süresi**: **7 gün** (`jwt.ts:20`, `expiresIn: "7d"`), sabit kodlanmış.
- **Yenileme (refresh)**: **Yok.** Refresh token mekanizması veya `/auth/refresh` gibi bir uç bulunamadı; token süresi dolunca kullanıcı yeniden giriş yapmak zorunda.
- **Kayıt**: `POST /auth/register` — `role` alanını **kabul etmiyor**, her zaman `CUSTOMER` oluşturuyor (güvenlik amaçlı, kod yorumuyla doğrulandı — `authController.ts:11-19`).
- **Çıkış**: `POST /auth/logout` — sadece `UserSession.logoutAt` alanını işaretler. **Önemli**: `requireAuth` middleware'i her istekte bu alanı kontrol ETMİYOR (`middleware/auth.ts:15-28`, sadece JWT imza/süre doğrulanıyor). Yani **logout, token'ı sunucu tarafında geçersiz kılmıyor** — aynı token, süresi (7 gün) dolana kadar başka bir cihazdan/istemciden geçerli kalmaya devam eder. Mobil tarafta bu, "cihazdan çıkış yap" beklentisiyle çelişebilir; şu anki backend bunu **sağlamıyor**.
- **Heartbeat**: `POST /auth/heartbeat` — `UserSession.lastActiveAt` günceller, oturum süre takibi/raporlama içindir (`web/src/lib/AuthProvider.tsx` her ~2 dakikada bir çağırıyor), auth doğrulaması için işlevsel bir etkisi yok.
- **/auth/me**: mevcut kullanıcı profilini döner.
- **401 davranışı**: `login`/`register` uçlarından gelen 401 özel olarak farklı ele alınıyor ("yanlış şifre" ile "oturum sona erdi" ayrımı için, `web/src/lib/api.ts:33-41`) — mobil tarafta da benzer bir ayrım yapılması önerilir (öneri değil, sadece mevcut davranışın not edilmesi — bu doküman geliştirme önermiyor).

---

## 7. Mobil Bağlantısını Etkileyen Davranışlar

- **Cookie bağımlılığı yok, sadece Bearer token**: Gerçek API çağrıları (`backend/src/middleware/auth.ts`) yalnızca `Authorization: Bearer <token>` header'ına bakıyor. Web'deki `document.cookie` mirror'ı (`web/src/lib/auth.ts`) yalnızca Next.js `middleware.ts`'in (Edge runtime) route korumasını yapabilmesi içindir — backend API'sinin cookie ile hiçbir ilgisi yok. **Flutter için doğrudan Bearer token yeterli, cookie yönetimi gerekmiyor.**
- **Dosya yükleme**: `multer`, disk depolama, `backend/uploads/` altında, dosya adı `Date.now()-uuid.ext`; sadece `image/*` MIME tipine izin veriyor, boyut sınırı **10MB**. İmza (signature) ayrıca base64 data-URL olarak JSON body içinde de gönderilebiliyor (`saveBase64Image`), bunun için `express.json({limit:"5mb"})` özel olarak büyütülmüş.
- **Görsel/PDF erişimi**: Yüklenen dosyalar `GET /uploads/<dosya>` üzerinden statik servis ediliyor; `Cross-Origin-Resource-Policy: cross-origin` header'ı özellikle eklenmiş (`backend/src/index.ts:53-60`) — mobil istemciden doğrudan erişilebilir, ek bir auth kontrolü **yok** (dosya adını bilen herkes erişebilir — imza/fotoğraf URL'leri tahmin edilemez UUID içerdiği için pratikte korunuyor ama endpoint kendisi auth gerektirmiyor).
- **Sayfalama**: Tüm liste uçları aynı standart formatı kullanıyor (`backend/src/lib/pagination.ts`): query `?page=&limit=` (limit max 100, varsayılan 20), yanıt `{ data: [...], pagination: { page, limit, total, totalPages } }`.
- **Filtreleme**: Endpoint'e göre değişir — ör. `/jobs` için `staffId, customerId, status, date, from, to`; `/customers` için `search`; `/notifications` için `status=unread|read`. Genel bir filtre standardı yok, her controller kendi query parametrelerini tanımlıyor.
- **Tarih-saat biçimi**: API, tüm tarihleri Prisma'nın ürettiği standart ISO-8601 (`Date` → JSON serileştirmede `toISOString()`) formatında döner. Görüntüleme formatlaması (`tr-TR`, `gün ay yıl` / `saat:dakika`) yalnızca **web tarafında** `web/src/lib/format.ts` içinde yapılıyor — backend ham ISO string döner, mobilde aynı ham veriyi alıp yerelleştirme mobilde yapılmalıdır.
- **Hata yanıtları**: Tutarlı format `{ error: "Türkçe mesaj", details?: [...] }` (`backend/src/middleware/errorHandler.ts`). Zod doğrulama hataları 400 + `details` (zod issues), Prisma unique/foreign-key/not-found hataları sırasıyla 409/400/404'e çevriliyor, beklenmeyen hatalarda 500 + `err.message` (üretim ortamında bunun iç hata mesajlarını dışa sızdırabileceği not edilmelidir — bu doküman düzeltme önermiyor, sadece davranışı bildiriyor).
- **Bildirimlerin iletimi**: Push bildirim altyapısı (FCM/APNs) **yok**. Bildirimler yalnızca veritabanı satırı (`Notification` modeli) olarak oluşturuluyor; istemci `GET /notifications`, `GET /notifications/unread-count` ile **polling** yapıyor, `PATCH /notifications/:id/read` / `read-all` ile okundu işaretliyor. E-posta bildirimleri ayrıca SMTP üzerinden (opsiyonel) gönderiliyor. **Mobilde gerçek zamanlı/push bildirim için backend'e ek altyapı gerekecektir — mevcut sistemde bu yok.**
- **Rate limiting**: 15 dakikada IP başına 300 istek (`express-rate-limit`, `backend/src/index.ts:40-45`) — tüm uçlara global olarak uygulanıyor, mobil için ayrık bir limit yok.

---

## 8. Periyodik Görevler ve Harici Servisler

`backend/src/lib/cron.ts` (`node-cron`, sunucu saat dilimine göre):
- **02:00** her gece — tekrarlayan iş üretimi (`generateRecurringJobs`).
- **Her 15 dakikada bir** — yaklaşan iş hatırlatması (~1 saat kala).
- **08:00** her gün — gecikmiş ödeme özeti, bekleyen onay hatırlatması, sözleşme bitiş hatırlatması, sertifika bitiş hatırlatması.
- **07:00** her gün — günlük özet e-postası.

Harici servisler: **SMTP** (nodemailer, opsiyonel), **Google reCAPTCHA v3** (giriş ve public teklif formu için sunucu tarafı doğrulama), **Google Takvim** (yalnızca link üretimi, API entegrasyonu yok). Başka bir üçüncü taraf servis (SMS, ödeme ağ geçidi, push bildirim sağlayıcısı) kodda bulunamadı.


### 8.1 İşletim araçları: S3 nesne depolama, Sentry, pino (2d45999 ile eklendi)

Üçü de **opsiyoneldir** — ilgili env değişkeni boşsa kod eski davranışına düşer; hiçbir gerçek anahtar repoda veya `.env` dosyalarında yoktur, yalnızca `.env.example`'da boş placeholder vardır.

| Araç | Ne işe yarar | Yapılandırma | Boşsa ne olur |
|---|---|---|---|
| **S3-uyumlu depolama** (`backend/src/lib/storage.ts`, `@aws-sdk/client-s3`) | İş fotoğrafı, imza, müşteri belgesi ve mesaj eklerini yerel disk (`backend/uploads/`) yerine AWS S3 / Cloudflare R2 / MinIO / Backblaze B2'ye yazar. Birden fazla backend instance'ı çalıştırılacaksa **zorunlu** (aksi hâlde instance'lar birbirinin dosyasını göremez). | `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (üçü de dolu olmalı) + `S3_REGION` (AWS için örn. `eu-central-1`, R2/MinIO için genelde `auto`) + `S3_ENDPOINT` (yalnızca AWS dışı servislerde; doluysa path-style adresleme açılır). Bucket **private** kalmalı — kod hiçbir public/presigned URL üretmez. | Dosyalar `backend/uploads/` altında yerel diskte kalır (tek instance dev/küçük kurulum için yeterli). |
| **Sentry** (`backend/src/lib/errorReporting.ts`, `@sentry/node`) | `errorHandler`'a düşen beklenmeyen 500 hatalarını Sentry'ye bildirir. `tracesSampleRate: 0` — yalnızca hata, performans izleme yok. `beforeSend` istek URL'indeki takvim token'ını (`/calendar/[REDACTED].ics`) maskeler, gövde/cookie'yi düşürür. | `SENTRY_DSN` (sentry.io → Project Settings → Client Keys). `initErrorReporting()` `src/instrument.ts` üzerinden `index.ts`'in **ilk** import'u olarak çağrılır (http enstrümantasyonu için zorunlu sıra). | Tamamen no-op; hata yalnızca konsola (pino) yazılır, dış servise hiçbir şey gitmez. |
| **pino** (`backend/src/lib/logger.ts`) | `errorHandler`'daki `console.error` yerine yapılandırılmış JSON log (`unhandled_error` + method/path/userId). Prod'da log toplayıcı (CloudWatch, Loki, Docker logs) `stdout`'u okur; ek servis gerekmez. | `LOG_LEVEL` (`fatal|error|warn|info|debug|trace`, varsayılan `info`). | Varsayılan `info` seviyesinde çalışır. |

Dosya erişim güvenlik modeli **değişmedi**: S3 yapılandırılsa da istemci dosyayı yine `GET /files/:type/:id` (Authorization header, kayıt bazlı yetki kuralı) üzerinden alır; backend S3'ten `GetObject` ile okuyup stream eder. Yükleme yolu `upload.single(...) → finalizeUpload → controller` şeklindedir: multer önce yerel diske yazar, `finalizeUpload` S3 açıksa dosyayı bucket'a taşıyıp yerel kopyayı siler.

Aynı commit'te gelen diğer işletim parçaları: `lib/distributedLock.ts` (Postgres advisory lock — cron görevleri çoklu instance'ta tekilleşir), `/v1` altında ikinci API mount'u (ADR-004; önek olmayan yollar aynen çalışır), `backend/Dockerfile`, `web/Dockerfile`, `docker-compose.prod.yml` (postgres+backend+web tam yığın) ve `.github/workflows/ci.yml` (typecheck+test+lint+build).

---

## 9. Web Tasarım Tokenları ve Ortak Bileşenler

Kaynak: `web/tailwind.config.ts`. Light tema, yeşil-beyaz palet:
- `primary` 50-900 skalası (500=`#3D8A4E` varsayılan aksiyon, 700=`#2F5233` marka koyu yeşili) + geriye dönük takma adlar (`green, greenLight, gold, red, redLight`).
- `neutral` 50-900 (hafif yeşilimsi gri), semantik `success/warning/danger/info` (her biri 50/100/500/600/700 tonları).
- `surface.*` (page/base/card/cardHover/sidebar/subtle/muted), `border.*` (DEFAULT/strong/accent), `text.*` (primary/secondary/faint/inverse).
- Tipografi ölçeği `2xs`→`4xl`, her boyut için satır yüksekliği+harf aralığı standartlaştırılmış; `boxShadow` (`card, cardHover, pop, inset`); `fade-rise`/`grow-bar` animasyon keyframe'leri.

Ortak React bileşenleri (`web/src/components/`, 21 adet): `PageHeader, StatCard, ChartCard, Table, StatusBadge, StatusStrip, Timeline, ActivityFeed, AlertBanner, ConfirmDialog, EmptyState, Header, MessageBubble, Modal, NotificationDrawer, PhotoLightbox, RequireRole, SignaturePad, StarRating, Sidebar, PageTransition, Toggle`.

Bu tasarım tokenları web'e özgüdür (Tailwind config); Flutter tarafında Stitch dosyalarındaki tasarım sistemiyle karşılaştırılıp bağımsız bir Flutter tema dosyası olarak yeniden üretilmesi gerekecektir — bu doküman bu eşlemeyi yapmaz, yalnızca mevcut web tokenlarını kayda geçirir.

---

## 10. Doğrulanamayan Noktalar (açıkça belirtilmiştir)

- `PERMISSION_KEYS` içindeki `view_all_jobs, manage_contracts, manage_staff, approve_advances, edit_prices, export_reports` anahtarlarının route seviyesinde gerçekten kullanıldığı yer yer yer doğrulanmadı (sadece `view_finance` ve `delete_customers` route dosyalarında `requireRoleOrPermission` ile açıkça görüldü); diğerleri şemada/etikette tanımlı ama çağrı noktası ayrıntılı taranmadı.
- `web/src/app/(dashboard)/bekleyen-onaylar/page.tsx` içeriği satır satır okunmadı — hangi veri kaynaklarını (avans, teklif, başka) birleştirdiği kesin doğrulanmadı, isimlendirmeden avans taleplerini kapsadığı çıkarıldı.
- WhatsApp entegrasyonundan önceki raporda bahsedilmişti; bu incelemede kodda hiçbir iz bulunamadı — **muhtemelen önceki rapor hatalıydı veya böyle bir özellik hiç uygulanmadı.**
- `backend/.env.example`'da `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` listelenmemiş olsa da kodda kullanıldığı görüldü; gerçek ortamda bu değişkenin nasıl sağlandığı (ayrı bir `.env.local` mı) doğrulanmadı.
- Testlerin varlığı: `backend/` ve `web/` içinde bir test klasörü/dosyası (`*.test.ts`, `__tests__`) bulunamadı — **proje test içermiyor görünüyor**, bu bir eksiklik değerlendirmesi değil, gözlem.

---

## 11. API Envanteri

Tüm yollar backend kök adresine (`http://localhost:4000` vb.) göre relatiftir. "Yetki" sütunu route dosyasındaki `requireRole`/`requirePermission` zincirini birebir yansıtır; ayrıca çoğu uçta controller içinde ek kapsam (scope) filtresi vardır (bkz. bölüm 3).

| Metod | Route | İşlev | Yetki/Kapsam | İstek alanları | Yanıt özeti | Kaynak |
|---|---|---|---|---|---|---|
| POST | /auth/register | Müşteri kaydı | Herkese açık | email, password, fullName, phone? | `{token, user}`, role her zaman CUSTOMER | authController.ts |
| POST | /auth/login | Giriş | Herkese açık | email, password, recaptchaToken? | `{token, user}` | authController.ts |
| GET | /auth/me | Profil | Auth | — | Kullanıcı bilgisi | authController.ts |
| POST | /auth/heartbeat | Oturum canlılık sinyali | Auth | — | `{ok:true}` | authController.ts |
| POST | /auth/logout | Oturum kaydını kapatma (token'ı iptal etmez) | Auth | — | `{ok:true}` | authController.ts |
| GET | /customers | Müşteri listesi | OWNER, MANAGER, STAFF (kapsamlı) | ?page,limit,search | Sayfalı liste | customersController.ts |
| GET | /customers/:id | Müşteri detay | OWNER, MANAGER, STAFF (kapsamlı) | — | Detay (STAFF için payments hariç) | customersController.ts |
| POST | /customers | Müşteri oluştur | OWNER, MANAGER | fullName, phone, email?, address?, district?, userId? | Oluşturulan kayıt | customersController.ts |
| PATCH | /customers/:id | Müşteri güncelle | OWNER, MANAGER | (create alanlarının partial hali) | Güncel kayıt | customersController.ts |
| DELETE | /customers/:id | Müşteri sil | MANAGER+`delete_customers` izni veya OWNER | — | 204 | customersController.ts |
| GET | /customers/export/excel | Müşteri Excel export | OWNER, MANAGER | — | Excel dosyası | exportController.ts |
| GET | /staff | Personel listesi | OWNER, MANAGER, TEAM_LEAD (ekip), STAFF | ?page,limit | Sayfalı liste | staffController.ts |
| GET | /staff/:id | Personel detay | OWNER, MANAGER, TEAM_LEAD (ekip), STAFF | — | Detay | staffController.ts |
| POST | /staff | Personel oluştur | OWNER, MANAGER | — (kod detayı bu turda okunmadı) | Oluşturulan kayıt | staffController.ts |
| PATCH | /staff/:id | Personel güncelle | OWNER, MANAGER | — | Güncel kayıt | staffController.ts |
| DELETE | /staff/:id | Personel sil | OWNER, MANAGER | — | 204 | staffController.ts |
| GET/PATCH | /staff/:id/permissions | Kişisel izin görüntüle/güncelle | **Yalnızca OWNER** | key→boolean map | İzin listesi | staffController.ts |
| GET | /staff/leaderboard | Performans sıralaması | OWNER, MANAGER, TEAM_LEAD (ekip) | — | Aylık sıralama | staffController.ts |
| GET/POST/PATCH/DELETE | /staff/:id/certifications | Sertifika CRUD | OWNER, MANAGER | — | — | staffCertificationsController.ts |
| GET | /staff/certifications/expiring | Süresi yaklaşan sertifikalar | OWNER, MANAGER | — | Liste | staffCertificationsController.ts |
| GET | /jobs | İş listesi | Auth (rol bazlı kapsam) | ?page,limit,staffId,customerId,status,date,from,to | Sayfalı liste + calendarLink | jobsController.ts |
| GET | /jobs/:id | İş detay | Auth (`canAccessJob`) | — | Detay + calendarLink | jobsController.ts |
| POST | /jobs | İş oluştur | OWNER, MANAGER | customerId, assignedStaffId?, serviceType, scheduledAt?, notes?, price? | Oluşturulan iş | jobsController.ts |
| PATCH | /jobs/:id | İş güncelle | Auth (role'e göre farklı şema: yönetim/tam, TEAM_LEAD/sadece atama, STAFF/sadece status) | role'e göre değişir | Güncel iş | jobsController.ts |
| DELETE | /jobs/:id | İş sil | OWNER, MANAGER | — | 204 | jobsController.ts |
| POST | /jobs/:id/report | İş raporu oluştur (+ stok düşürme) | STAFF (kendi işine) | productId?, quantity?, productsUsed?, dosage, notes?, signatureUrl?/signatureBase64?, pdfUrl? | Oluşturulan rapor | jobsController.ts |
| GET | /jobs/:id/report | İş raporu görüntüle | Auth (`canAccessJob`) | — | Rapor | jobsController.ts |
| GET | /jobs/:id/report/pdf | İş raporu PDF | Auth | — | PDF dosyası | exportController.ts |
| PATCH | /jobs/:id/rate | İş puanlama | CUSTOMER (kendi işi, sadece COMPLETED) | rating(1-5), ratingComment? | Güncel iş | jobsController.ts |
| GET/POST/DELETE | /jobs/:id/photos | İş fotoğrafı (öncesi/sonrası) | Auth / upload multipart | multipart `photo` dosyası | Fotoğraf kaydı/URL | jobPhotosController.ts |
| GET | /contracts | Sözleşme listesi | OWNER, MANAGER, CUSTOMER | ?page,limit | Sayfalı liste | contractsController.ts |
| GET | /contracts/expiring | Süresi yaklaşan sözleşmeler | OWNER, MANAGER | — | Liste | contractsController.ts |
| GET | /contracts/:id | Sözleşme detay | OWNER, MANAGER, CUSTOMER | — | Detay | contractsController.ts |
| POST/PATCH | /contracts | Sözleşme oluştur/güncelle | OWNER, MANAGER | — | — | contractsController.ts |
| GET | /payments | Ödeme listesi | OWNER, MANAGER, CUSTOMER | ?page,limit | Sayfalı liste | paymentsController.ts |
| POST | /payments | Ödeme kaydı | OWNER, MANAGER | — | Oluşturulan kayıt | paymentsController.ts |
| GET | /payments/summary | Finansal özet | MANAGER+`view_finance` veya OWNER | — | Özet | paymentsController.ts |
| GET | /payments/export/excel | Ödeme Excel export | OWNER, MANAGER | — | Excel | exportController.ts |
| GET | /payments/:id/receipt/pdf | Makbuz PDF | OWNER, MANAGER, CUSTOMER | — | PDF | exportController.ts |
| POST | /quotes | Public teklif formu | Herkese açık | fullName, phone, email?, propertyType, serviceType, address?, district?, recaptchaToken? | Oluşturulan teklif | quotesController.ts |
| GET | /quotes | Teklif listesi | OWNER, MANAGER | ?page,limit,status | Sayfalı liste | quotesController.ts |
| PATCH | /quotes/:id | Teklif durumu güncelle | OWNER, MANAGER | status | Güncel kayıt | quotesController.ts |
| POST | /quotes/:id/convert | Teklifi müşteriye dönüştür | OWNER, MANAGER | — | Yeni müşteri | quotesController.ts |
| GET | /dashboard/summary, /dashboard/activity-feed | Komuta merkezi verisi | OWNER, MANAGER | — | Özet/akış | dashboardController.ts |
| GET | /users | Kullanıcı listesi | OWNER, MANAGER | ?page,limit | Sayfalı liste | usersController.ts |
| POST | /advances | Avans talebi oluştur | STAFF | amount, reason | Oluşturulan talep | advancesController.ts |
| GET | /advances | Avans talep listesi | OWNER, MANAGER, STAFF (kendi) | ?page,limit,status | Sayfalı liste | advancesController.ts |
| PATCH | /advances/:id | Avans onay/red | OWNER, MANAGER | status (APPROVED/REJECTED) | Güncel kayıt | advancesController.ts |
| GET | /conversations/available-contacts | Mesajlaşılabilir kişiler | Auth | — | Liste | conversationsController.ts |
| GET | /conversations/all | **Tüm** konuşmalar (gözlemci) | **Yalnızca OWNER** | ?page,limit | Sayfalı liste | conversationsController.ts |
| GET | /conversations | Kendi konuşmaları | Auth | ?page,limit | Sayfalı liste | conversationsController.ts |
| POST | /conversations | Konuşma başlat | Auth (`canUsersMessage` kontrolü) | participantId | Oluşturulan/var olan konuşma | conversationsController.ts |
| GET | /conversations/:id/messages | Mesajları getir | Auth (katılımcı veya OWNER) | ?page,limit | Sayfalı liste | conversationsController.ts |
| POST | /conversations/:id/messages | Mesaj gönder | Auth (katılımcı) | content | Oluşturulan mesaj | conversationsController.ts |
| PATCH | /conversations/:id/read | Okundu işaretle | Auth (katılımcı) | — | `{ok:true}` | conversationsController.ts |
| GET | /notifications | Bildirim listesi | Auth | ?page,limit,status | Sayfalı liste | notificationsController.ts |
| GET | /notifications/unread-count | Okunmamış sayısı | Auth | — | `{count}` | notificationsController.ts |
| PATCH | /notifications/:id/read, /read-all | Okundu işaretle | Auth | — | `{ok:true}` | notificationsController.ts |
| GET/PATCH | /notification-preferences | Bildirim tercihleri | Auth (kendi) | emailEnabled, dailyDigestEnabled | Tercih kaydı | notificationPreferencesController.ts |
| GET | /audit-logs | Denetim logları | **Yalnızca OWNER** | ?page,limit | Sayfalı liste | auditLogController.ts |
| GET | /system/health | Sistem sağlığı | **Yalnızca OWNER** | — | Metrik özeti | systemController.ts |
| GET | /search | Global arama | Auth | ?q= | Karma sonuç listesi | searchController.ts |
| POST | /admin/clear-demo-data, GET /admin/backup | Demo veri temizleme / yedek | **Yalnızca OWNER** | — | — | adminController.ts |
| GET/PATCH | /settings | Şirket ayarları | **Yalnızca OWNER** | key/value | Ayar listesi | settingsController.ts |
| GET/POST/PATCH/DELETE | /service-types | Hizmet türü referans verisi | GET: tüm roller, yazma: OWNER | name, isActive | Liste/kayıt | settingsController.ts |
| GET/POST/PATCH/DELETE | /districts | İlçe referans verisi | GET: tüm roller, yazma: OWNER | name, isActive | Liste/kayıt | settingsController.ts |
| GET | /analytics/revenue-trend, /service-breakdown, /top-districts, /customer-retention | Analitik raporlar | OWNER, MANAGER | ?date aralığı (detay okunmadı) | Grafik verisi | analyticsController.ts |
| GET | /sessions/report | Oturum süre raporu | **Yalnızca OWNER** | — | Rapor | sessionsController.ts |
| GET/POST/PATCH/DELETE, POST /:id/restock | /products | Stok/ürün yönetimi | GET: OWNER/MANAGER/TEAM_LEAD/STAFF, yazma: OWNER/MANAGER | name, unit, currentStock, criticalThreshold | Liste/kayıt | productsController.ts |
| GET | /products/low-stock | Kritik stok listesi | OWNER, MANAGER | — | Liste | productsController.ts |

*(`/staff`, `/service-types`, `/districts`, `/analytics` gibi bazı uçlarda tam istek şeması bu turda satır satır okunmadı; tabloda "detay okunmadı" notu bırakılan yerler kesin değildir, kaynak dosyaya bakılmalıdır.)*

### Sentetik örnek istek/yanıtlar (kurgusal veri, gerçek kayıt değildir)

**POST /auth/login**
```json
// İstek
{ "email": "ornek.kullanici@test.local", "password": "GecerliSifre1!", "recaptchaToken": "test-token" }
// Yanıt (200)
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "b3f1c9b0-0000-4a4a-9a9a-111111111111", "email": "ornek.kullanici@test.local", "fullName": "Örnek Kullanıcı", "role": "STAFF" }
}
```

**GET /jobs?page=1&limit=20&status=PENDING** (kod: `jobsController.ts:72-133`)
```json
{
  "data": [
    {
      "id": "2c1a5e00-0000-4b4b-8b8b-222222222222",
      "customerId": "b1a1a100-0000-4c4c-9c9c-333333333333",
      "assignedStaffId": null,
      "serviceType": "Genel İlaçlama",
      "status": "PENDING",
      "scheduledAt": null,
      "notes": null,
      "price": null,
      "customer": { "fullName": "Örnek Müşteri A.Ş." },
      "assignedStaff": null,
      "calendarLink": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**POST /jobs/:id/report** (kod: `jobsController.ts:215-273`)
```json
// İstek
{
  "productId": "9a0a0a00-0000-4d4d-8d8d-444444444444",
  "quantity": 2,
  "dosage": "50ml/L",
  "notes": "Mutfak ve bodrum uygulandı",
  "signatureBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
// Yanıt (201)
{
  "id": "5b5b5b00-0000-4e4e-8e8e-555555555555",
  "jobId": "2c1a5e00-0000-4b4b-8b8b-222222222222",
  "staffId": "6c6c6c00-0000-4f4f-8f8f-666666666666",
  "productId": "9a0a0a00-0000-4d4d-8d8d-444444444444",
  "quantity": 2,
  "dosage": "50ml/L",
  "signatureUrl": "/uploads/imza-1699999999999-uuid.png",
  "createdAt": "2026-09-09T10:15:00.000Z"
}
```

**Hata örneği (400, zod)**
```json
{ "error": "Girdiğiniz bilgilerde hata var", "details": [ { "path": ["dosage"], "message": "Required" } ] }
```

---

## 12. Yerel Çalıştırma Rehberi (Backend / Web / Mobile — Ayrı Ayrı)

Bu bölüm, projeyi kendi bilgisayarınızda üçüncü kişi olarak sıfırdan ayağa kaldırmak ve mobil APK'yı gerçek bir cihazda/emülatörde test etmek için tam adım adım komutları içerir. Sürüm/klasör bilgileri için §1'e, ortam değişkeni açıklamaları için §2'ye bakın; burada yalnızca **çalıştırma komutları** var.

### 12.1 Ön koşullar

- Node.js 18+ ve npm
- PostgreSQL 17 (native kurulum: `winget install PostgreSQL.PostgreSQL.17` veya EDB installer) — alternatif olarak Docker Desktop ile `docker-compose up -d` de kullanılabilir
- Flutter SDK 3.x (`flutter --version` ile kontrol edin) + Android SDK (Android Studio ile birlikte gelir)
- Fiziksel Android cihaz (USB hata ayıklama açık) **veya** Android Studio üzerinden bir AVD (emülatör) — **not**: bu geliştirme ortamının sanal makinesinde donanım hızlandırma olmadığı için emülatör pratikte açılamadı; kendi bilgisayarınızda donanım hızlandırma (Hyper-V/HAXM) etkinse bu sorun yaşanmaz.

### 12.2 Backend'i çalıştırma

```bash
# 1) PostgreSQL'in çalıştığını doğrula (native Windows servisi, otomatik başlar)
#    PowerShell: Get-Service postgresql-x64-17   → Running olmalı
#    Değilse:    Start-Service postgresql-x64-17
#    Sıfır kurulumda (rol/DB yoksa) bir kez:
#      psql -U postgres -c "CREATE ROLE nilufer LOGIN PASSWORD 'change_me' CREATEDB;"
#      psql -U postgres -c "CREATE DATABASE nilufer_yonetim OWNER nilufer;"
#    pg_hba.conf localhost için scram-sha-256 (şifreli) — DATABASE_URL'deki
#    kullanıcı/şifre (nilufer/change_me) gerçekten doğrulanır.
#    (Docker alternatifi: proje kökünde `docker-compose up -d` → port 5433;
#     o zaman DATABASE_URL'de 5433 kullanın.)

# 2) Backend bağımlılıklarını kur
cd backend
npm install

# 3) .env dosyasını oluştur (backend/.env.example'ı kopyalayıp değerleri doldurun)
#    Zorunlu: DATABASE_URL, JWT_SECRET
#    Opsiyonel: SMTP_*, RECAPTCHA_SECRET_KEY, MOBILE_APP_SECRET
#    MOBILE_APP_SECRET boş bırakılırsa mobil uygulama reCAPTCHA'yı atlayamaz
#    ve giriş RECAPTCHA_SECRET_KEY tanımlıysa başarısız olur — mobil testi
#    için bu değeri MUTLAKA doldurun (rastgele uzun bir metin yeterli, ör.
#    `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
#    ile üretebilirsiniz) ve AYNI değeri §12.4'teki mobil derleme adımında kullanın.

# 4) Veritabanı şemasını uygula
npx prisma migrate dev

# 5) (Opsiyonel) Demo veri yükle
npm run db:seed

# 6) Geliştirme sunucusunu başlat
npm run dev
```

Backend `http://localhost:4000` adresinde çalışır. `curl http://localhost:4000/health` → `{"status":"ok"}` dönmeli.

#### 12.2.1 Otomatik testler (ZORUNLU — her önemli değişiklikten önce)

```bash
cd backend
npm test              # vitest + supertest: auth, RBAC, iş durumu, personel yaşam döngüsü, finans, güvenlik (~40 sn)
npm run test:typecheck  # test dosyalarının tip kontrolü
cd ../mobile
flutter test          # model parse (Decimal serileşme) regresyon testleri + smoke test
```

**Kural: backend veya mobile'da herhangi bir önemli değişiklikten (özellikle
auth/yetki/finans/personel akışlarında) önce `npm test` (backend) ve
`flutter test` (mobile) çalıştırılmalı; kırmızı test varken commit/push
yapılmamalı.** CI yoktur (altyapı yok) — bu adım geliştiricinin elindedir.

Testler `.env`'deki gerçek dev veritabanına karşı koşar (ayrı test DB'si
yoktur): her test dosyası kendi `vt_` önekli, uuid'li verisini üretir ve
bitince ID bazlı siler (bkz. `backend/tests/helpers/fixtures.ts:TestContext`).
Test sırasında reCAPTCHA/SMTP/Firebase devre dışıdır (`tests/helpers/setup.ts`),
gerçek e-posta/push gitmez. Detay: `docs/NEW_FEATURES_TOUR_2.md` Bölüm H.

### 12.3 Web panelini çalıştırma (opsiyonel — mobil test için şart değil)

```bash
cd web
npm install
# web/.env.local oluşturun: NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev
```

Web paneli `http://localhost:3000` adresinde açılır.

### 12.4 Mobil uygulamayı (Flutter) çalıştırma / APK alma

**Zaten derlenmiş debug APK'nın tam dosya yolu** (bu oturumda üretildi):
```
C:\Users\SALİH\Desktop\nilufer-yonetim\mobile\build\app\outputs\flutter-apk\app-debug.apk
```

**A) Bu APK'yı doğrudan telefonunuza kurmak isterseniz:**
1. APK dosyasını telefonunuza aktarın (USB, e-posta, bulut vb.).
2. Telefonda "Bilinmeyen kaynaklardan yükleme"ye izin verin, dosyayı açıp kurun.
3. **Önemli**: Bu APK, backend adresini `http://10.0.2.2:4000` (yalnızca Android emülatöründen host makineye erişim adresi) olarak derlenmiş durumda. Gerçek bir telefonda çalışması için backend'in bilgisayarınızın **yerel ağ IP'sinden** (ör. `http://192.168.1.34:4000`) erişilebilir olması ve APK'nın o adresle **yeniden derlenmesi** gerekir — aşağıdaki B adımına bakın.

**B) Kendi ortamınıza göre yeniden derlemek (önerilen — gerçek cihaz veya kendi emülatörünüz için):**

```bash
cd mobile
flutter pub get

# Bilgisayarınızın yerel ağ IP'sini bulun (Windows):
#   ipconfig  → "IPv4 Address" satırı (ör. 192.168.1.34)
# Backend'in dinlediği portla birleştirin (varsayılan 4000).

# Debug APK'yı kendi backend adresiniz ve mobil sırrınızla derleyin:
flutter build apk --debug ^
  --dart-define=API_URL=http://192.168.1.34:4000 ^
  --dart-define=MOBILE_APP_SECRET=<backend/.env'deki MOBILE_APP_SECRET ile AYNI değer>
```
(PowerShell'de satır sonu `^` yerine backtick `` ` `` kullanın; tek satırda da yazabilirsiniz.)

Yeni APK aynı yola üretilir: `mobile\build\app\outputs\flutter-apk\app-debug.apk`.

**C) Doğrudan bir cihaza/emülatöre bağlanıp çalıştırmak isterseniz** (kurulum + başlatmayı tek komutla yapar):
```bash
cd mobile
flutter devices          # bağlı cihaz/emülatörü listeler
flutter run --dart-define=API_URL=http://192.168.1.34:4000 --dart-define=MOBILE_APP_SECRET=<sır>
```

**D) adb ile mevcut APK'yı manuel kurma** (cihaz USB ile bağlıyken):
```bash
adb install "C:\Users\SALİH\Desktop\nilufer-yonetim\mobile\build\app\outputs\flutter-apk\app-debug.apk"
```

**Test için giriş bilgileri** (demo veri yüklüyse, `backend/prisma/seed.ts`): örn. `owner@nilufer.com` / `Test1234!` (tüm demo kullanıcılar aynı şifreyi kullanır — gerçek ortamda bunu değiştirin). Roller ve diğer örnek e-postalar için §3'e bakın.

**Önemli kısıt**: Backend `192.168.x.x` üzerinden erişilebilir olmalı — Windows Güvenlik Duvarı'nın 4000 portuna gelen bağlantılara (yerel ağdan) izin verdiğinden emin olun, aksi halde telefon backend'e ulaşamaz.

---

## 13. Push Bildirimleri (FCM) — Firebase Kurulumu (yapılması gereken, sizin tarafınızdan)

Backend'de push bildirimi ALTYAPISI hazır (`backend/src/lib/push.ts`, `lib/notify.ts`'in
mevcut `notifyUser`/`notifyUsers`/`notifyManagement` fonksiyonlarına eklendi,
`POST /users/me/fcm-token` ile cihaz token'ı kaydediliyor) ve **Firebase yapılandırılmadan
sistem hatasız çalışmaya devam eder** — yalnızca uygulama içi bildirimler (mevcut
"Bildirimler" ekranı) çalışır, push bildirimleri sessizce atlanır. Gerçek push bildirimi
göndermek için bir Firebase projesine ve mobil tarafta ek paketlere ihtiyaç var; bu adımı
tarafımdan (asistan) tamamlamak mümkün değil çünkü bir Firebase Console hesabı/erişimi
gerektiriyor. Mobil tarafta `firebase_core`/`firebase_messaging` paketleri de HENÜZ
eklenmedi — bunlar da aşağıdaki adımlarla birlikte sizin tarafınızdan eklenmeli.

### 13.1 — Firebase projesi oluşturma

1. https://console.firebase.google.com adresine gidin, "Proje Ekle" ile yeni bir proje
   oluşturun (örn. "nilufer-ilaclama").
2. Google Analytics'i isteğe bağlı bırakabilirsiniz (push bildirimi için gerekmiyor).

### 13.2 — Android uygulaması ekleme

1. Firebase Console → Proje Ayarları → "Uygulama Ekle" → Android simgesi.
2. Paket adı: `mobile/android/app/build.gradle` (veya `build.gradle.kts`) içindeki
   `applicationId` değerini kullanın.
3. İndirilen **`google-services.json`** dosyasını `mobile/android/app/` klasörüne koyun
   (proje reposuna commit ETMEYİN — `.gitignore`'a ekleyin, gizli anahtar içermese de
   proje kimliği barındırdığı için genel pratik budur).
4. Android tarafında Google Services Gradle eklentisini etkinleştirmeniz gerekir —
   `flutterfire configure` komutu (aşağıda) bunu genelde otomatik yapar; elle
   yapacaksanız FlutterFire resmi dokümantasyonundaki "Add Firebase to your Android app"
   adımlarını izleyin.

### 13.3 — iOS uygulaması ekleme (yalnızca iOS'a dağıtım planlıyorsanız)

1. Firebase Console → aynı proje → "Uygulama Ekle" → iOS simgesi.
2. Bundle ID: `mobile/ios/Runner.xcodeproj` içindeki bundle identifier.
3. İndirilen **`GoogleService-Info.plist`** dosyasını `mobile/ios/Runner/` klasörüne
   ekleyin (Xcode üzerinden "Runner" hedefine sürükleyerek ekleyin, yalnızca dosya
   sistemine kopyalamak yetmez).

### 13.4 — Flutter tarafında paketler (bu adım henüz KOD OLARAK YAPILMADI)

```bash
cd mobile
dart pub global activate flutterfire_cli   # ilk kurulumda bir kez
flutterfire configure                       # Firebase projenizi seçip firebase_options.dart üretir
flutter pub add firebase_core firebase_messaging
```

Sonrasında:
- `main.dart`'ta `WidgetsFlutterBinding.ensureInitialized()`'dan hemen sonra
  `await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);` çağrılmalı.
- Giriş sonrası (örn. `AuthProvider.login()` başarılı olduktan sonra) FCM token'ı alınıp
  backend'e kaydedilmeli:
  ```dart
  final fcmToken = await FirebaseMessaging.instance.getToken();
  if (fcmToken != null) {
    await ApiClient.instance.post('/users/me/fcm-token', body: {'token': fcmToken});
  }
  FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
    ApiClient.instance.post('/users/me/fcm-token', body: {'token': newToken});
  });
  ```
- Bildirime dokununca ilgili ekrana gitmek için mevcut `relatedType`/`relatedId` deseni
  kullanılabilir (bkz. `notifications_screen.dart`'taki mevcut in-app yönlendirme mantığı)
  — `FirebaseMessaging.onMessageOpenedApp` içinde `message.data['relatedType']`/
  `message.data['relatedId']` okunarak aynı yönlendirme fonksiyonu çağrılabilir
  (backend zaten bu iki alanı `data` olarak push payload'ına ekliyor, bkz.
  `backend/src/lib/notify.ts:pushToUsers`).
- Android 13+ için bildirim izni istemeniz gerekir (`Permission.notification.request()`
  — `permission_handler` paketiyle, veya `firebase_messaging`'in kendi
  `requestPermission()` metoduyla).

### 13.5 — Backend'de servis hesabı anahtarı

1. Firebase Console → Proje Ayarları → "Hizmet Hesapları" sekmesi.
2. "Yeni Özel Anahtar Oluştur" → bir JSON dosyası iner.
3. Bu dosyanın TÜM içeriğini (JSON'ı) `backend/.env` dosyasındaki
   `FIREBASE_SERVICE_ACCOUNT_KEY` değişkenine TEK SATIR olarak yapıştırın — JSON
   satır sonu karakterleri barındırdığı için önce base64'e çevirmeniz daha güvenli
   olur:
   ```bash
   # PowerShell:
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("indirilen-dosya.json")) | Set-Clipboard
   # Sonra .env'e: FIREBASE_SERVICE_ACCOUNT_KEY=<panodaki base64 metni>
   ```
   (`lib/push.ts` değeri hem ham JSON hem base64 olarak kabul eder — `{` ile
   başlıyorsa ham JSON, değilse base64 olarak çözülür.)
4. Backend'i yeniden başlatın. Değer boşsa (varsayılan) sistem zaten hatasız çalışmaya
   devam eder — bu adım tamamen opsiyoneldir, yalnızca gerçek push bildirimi
   istiyorsanız gereklidir.
5. **Bu anahtarı asla git'e commit etmeyin** — `.env` zaten `.gitignore`'da.

### 13.6 — Doğrulama

Yukarıdaki adımları tamamladıktan sonra: bir kullanıcıyla mobil uygulamaya giriş yapın,
`/users/me/fcm-token`'ın çağrıldığını (backend loglarında veya bir network inceleyiciyle)
doğrulayın, ardından o kullanıcıya bir bildirim tetikleyen bir işlem yapın (örn. bir iş
atayın) — telefon kilitliyken bile bir push bildirimi düşmeli. **Bu son doğrulama adımı
gerçek bir Firebase projesi ve fiziksel/emülatör cihaz gerektirdiği için tarafımdan
test edilemedi** — yalnızca "Firebase yapılandırılmadan sistem hatasız çalışıyor" kısmı
(§Bölüm F doğrulaması, `docs/NEW_FEATURES_TOUR.md`) tarafımdan test edildi.

---

## Sonraki Adım

Flutter mobil uygulaması artık `mobile/` altında gerçek bir proje olarak mevcut ve backend/web ile birlikte 15 Stitch ekranının tamamı için (bkz. `docs/STITCH_FEATURE_MATRIX.md`) gerçek API'ye bağlı ekranlar içeriyor. Bu doküman artık yalnızca bir "aktarım analizi" değil, projeyi yerelde çalıştırmak için de kullanılabilir (bkz. §12). Kalan açık sorular ve bilinçli olarak kapsam dışı bırakılan tek ayrıntı (finans trend grafiği) için `docs/STITCH_FEATURE_MATRIX.md` başındaki "Genel Durum Özeti"ne bakın.
