# Güvenli Şifre/Erişim Yönetimi — Tasarım Kararları

Bu belge Bölüm B'nin (şifre sıfırlama, OWNER şifre sıfırlama, impersonation)
tasarım kararlarını ve API sözleşmesini kaydeder. Temel kural: **gerçek
şifre hiçbir özellikte görülemez/saklanamaz** — bcrypt hash'i dışında hiçbir
yerde şifre metni durmaz.

## Oturum iptali — `User.tokenVersion`

JWT'ler stateless'tı (7 gün geçerli, sunucu tarafında iptal mekanizması
yoktu). Şifre sıfırlama gibi güvenlik olaylarının "tüm mevcut oturumları
geçersiz kılması" gerektiği için bu proje kapsamında **ilk kez** gerçek bir
oturum iptali mekanizması eklendi:

- `User.tokenVersion` (Int, default 0) — her JWT bunu bir claim olarak taşır.
- `requireAuth` (middleware/auth.ts) her istekte DB'den güncel `tokenVersion`'ı
  okur, JWT'dekiyle eşleşmezse 401 döner.
- Yalnızca güvenlik olayları bunu artırır: `reset-password`, `change-password`,
  OWNER'ın birini sıfırlaması. **Normal logout artırmaz** — yalnızca o
  oturumu (UserSession.logoutAt) kapatır, diğer cihazları etkilemez.

Bu, her istekte bir ekstra DB okuması ekliyor (önceden tamamen stateless'tı).
Bu uygulamanın ölçeğinde (küçük/orta işletme paneli) kabul edilebilir bir
trade-off; yüksek trafikli bir sistemde bunun yerine bir cache (Redis) katmanı
düşünülebilir — şu an için gerek görülmedi.

## "Şifremi Unuttum" akışı

- `PasswordResetToken`: ham token asla DB'de durmaz, yalnızca SHA-256 hash'i.
- Süre: **1 saat** (makul bir varsayılan — kısa tutuldu çünkü e-posta linki
  ele geçirilirse pencere kısa kalsın).
- `POST /auth/forgot-password`: kullanıcı var/yok fark etmeksizin AYNI mesaj
  döner (email enumeration önleme). Rate limit: aynı IP+email için 15
  dakikada 3 istek.
- `POST /auth/reset-password`: token geçerliyse şifre günceller,
  `mustChangePassword=false` yapar (zaten yeni bir şifre seçildi),
  `tokenVersion` artırılır (tüm eski oturumlar geçersiz).

## OWNER'ın birinin şifresini sıfırlaması

- `POST /admin/users/:id/reset-password` (OWNER) — rastgele, kriptografik
  olarak güvenli bir geçici şifre üretir (12 karakter, karışık alfabe),
  hash'ler, `mustChangePassword=true` + `tokenVersion++` yapar.
- Geçici şifre **yalnızca bu API yanıtında** döner — hiçbir yerde loglanmaz.
  Web/mobile bunu bir kereliğine (kopyalanabilir) gösterir, ekrandan
  ayrılınca kaybolur.
- `mustChangePassword=true` iken `requireAuth`, `/auth/me` /`/auth/logout`
  /`/auth/change-password` DIŞINDA HER UCA 403 döner — "başka hiçbir sayfaya
  gidemesin" kuralı sunucu tarafında da uygulanır (istemci tarafı yönlendirme
  yalnızca bir rahatlık katmanıdır).

## Impersonation

- `ImpersonationSession`: `ownerUserId`, `targetUserId`, `reason` (zorunlu),
  `startedAt`, `endedAt`.
- Hedef bir **OWNER olamaz** (hesap verebilirlik zincirinin OWNER'ın OWNER'ı
  impersonate edip iz bırakmadan işlem yapmasını engellemesi için).
- Impersonation JWT'si **1 saatte** sona erer (normal oturumların 7 gününden
  kasıtlı olarak çok daha kısa — makul bir varsayılan, bir iş kararı değil).
  `POST /admin/impersonate/end` ile süresinden önce de anında iptal edilebilir
  (`ImpersonationSession.endedAt` set edilir, `requireAuth` bunu her istekte
  kontrol eder).
- **Audit zenginleştirme**: impersonation sırasında yapılan her audit-log'lu
  işlemde `actorUserId` zaten hedef kullanıcıyı gösterir (JWT'nin `sub`'ı
  budur) — `lib/requestContext.ts` (AsyncLocalStorage) ile hiçbir controller
  değiştirilmeden `detail` alanına "(Patron tarafından impersonate edilerek —
  gerçek aktör: <ownerId>)" notu otomatik eklenir.
- `admin.impersonation_started`/`admin.impersonation_ended` audit kayıtlarında
  ise actor=OWNER, target=impersonate edilen kullanıcı (bu iki olay OWNER'ın
  kendi eylemidir, "X olarak yapılan" bir eylem değil).

## Kapsam sınırı (bilinçli karar)

OWNER'ın şifre sıfırlama/impersonate butonları şu an yalnızca **Personel**
sayfasındaki (STAFF/TEAM_LEAD) satırlarda mevcut — sistemde MANAGER/CUSTOMER
hesapları için ayrı bir "tüm kullanıcılar" tablosu yok, bu yüzden oraya
genişletilmedi. Backend uçları (`/admin/users/:id/reset-password`,
`/admin/impersonate`) herhangi bir `userId` ile çalışır (rol kısıtı yok,
impersonate hariç — OWNER hedef olamaz), yalnızca web/mobile arayüzü şu an
Personel listesiyle sınırlı.
