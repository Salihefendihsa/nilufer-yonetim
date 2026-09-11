# Personel Rol Yönetimi — Tasarım Kararları

Bu belge, OWNER'ın personeli terfi ettirme/düşürme/rol değiştirme/işten
çıkarma akışının tasarım kararlarını ve API sözleşmesini kaydeder. Temel
kural: **hiçbir veri silinmez** — yalnızca `Staff.archivedAt` /
`User.isActive` bayraklarıyla gizlenir.

## Modeller

- `Staff.archivedAt` (DateTime?) — doluysa kayıt "arşivlenmiş" (terfi veya
  işten çıkarma sonucu). Aktif personel sorgularının hepsi `archivedAt: null`
  filtresi kullanır.
- `User.isActive` (Boolean, default true) — işten çıkarılan kullanıcı için
  `false`; login ve `requireAuth` bunu reddeder (`mustChangePassword`
  deseniyle aynı yerde, middleware/auth.ts).

## tokenVersion'ın rol değişikliklerinde de artırılması

Terfi/düşürme/rol değiştirme/işten çıkarma User.role'ü değiştirir, ama JWT
`role` claim'ini imza anında gömer — mevcut bir oturum yeni rolü göremez.
Bu, spec'te açıkça belirtilmemiş ama gerekli bir çıkarımdı: **her rol
değişikliği tokenVersion'ı da artırır** (şifre sıfırlamayla aynı mekanizma
— bkz. docs/SECURITY.md), böylece etkilenen kullanıcı yeni oturum açana
kadar eski rolle dolaşmaz. `reactivate` bunu ARTIRMAZ (rol değişmiyor,
yalnızca isActive geri açılıyor).

## Terfi/Düşürme akışı — Staff kaydının kaderi

- **Terfi** (`POST /staff/:id/promote-to-manager`): `Staff.archivedAt`
  doldurulur, `User.role = MANAGER`. Aynı Staff.id korunur.
- **Düşürme** (`POST /users/:id/demote-from-manager`): bu User.id'ye ait
  arşivlenmiş bir Staff kaydı varsa geri açılır (`archivedAt: null`) — eski
  maaş/pozisyon/şef bilgisi KORUNUR, yalnızca istekte verilirse üzerine
  yazılır. Hiç Staff geçmişi yoksa (MANAGER olarak işe başlamış biri)
  `position`+`salaryBase` ZORUNLUDUR, yeni bir Staff kaydı oluşturulur.
- **Rol değiştirme** (`PATCH /staff/:id/role`, STAFF↔TEAM_LEAD): arşivleme
  YOK, aynı Staff kaydı üzerinde yalnızca `User.role` değişir.
- **İşten çıkarma** (`POST /users/:id/terminate`): `User.isActive=false` +
  `tokenVersion++`; ilişkili Staff kaydı (henüz arşivlenmemişse) arşivlenir.
  OWNER hedef OLAMAZ (kendisi dahil — aktör zaten bir OWNER olduğu için tek
  bir "hedef OWNER mı" kontrolü ikisini de kapsar).
- **Geri aktif etme** (`POST /users/:id/reactivate`): `isActive=true`.
  Staff kaydı yalnızca kullanıcının rolü hâlâ STAFF/TEAM_LEAD'se geri açılır
  — bir MANAGER'ın (önce terfi edip SONRA işten çıkarılmış olabilir) eski
  arşivlenmiş Staff kaydı bu durumda YANLIŞLIKLA geri açılmaz (bu, açık
  spec'te yoktu ama veri tutarlılığı için gerekli bir korumaydı).

## Organizasyon şeması ve supervisorId normalizasyonu

Bir TEAM_LEAD terfi ettirildiğinde, eski ekibinin `supervisorId`'si hâlâ
onun (artık arşivlenmiş) `Staff.id`'sine işaret eder. `GET /staff/org-chart`
bunu normalize eder: arşivlenmiş bir Staff.id'ye işaret eden herhangi bir
`supervisorId`, o kişinin (artık MANAGER rolündeki) `User.id`'sine
yönlendirilir — aksi halde ekip sessizce "unassigned" listesine düşerdi.
Ekibin kendisinin `supervisorId`'sini elle güncellemesi GEREKMEZ.

## `GET /staff?includeArchived=true` semantiği

`includeArchived=true` (yalnızca OWNER) filtreyi TERSİNE çevirir — yalnızca
arşivlenmiş kayıtları döndürür (aktifleri DEĞİL). Bu, web/mobildeki
"Geçmiş Personel" sekmesinin ayrı, salt okunur bir görünüm olması
gerektiği için seçildi; "hem aktif hem arşivli birlikte" davranışı bu
sekmenin ihtiyacına uymazdı.

## Kapsam sınırı

Web'deki "Rol İşlemleri" menüsü ve mobildeki "Yönetici İşlemleri" popup'ı
yalnızca Personel sayfasındaki (STAFF/TEAM_LEAD) satırlarda mevcut; Müdür
listesi web'de ayrı bir "Müdürler" sekmesi olarak eklendi ("Personel'e
Düşür" + "İşten Çıkar" aksiyonlarıyla). Mobilde ayrı bir "Müdürler" ekranı
eklenmedi (spec'te istenmemişti) — mobil OWNER, bir müdürü düşürmek isterse
şimdilik web paneli kullanmalı.
