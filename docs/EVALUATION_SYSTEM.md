# Gözlemci Modu Sıkılaştırma + Formal Değerlendirme Sistemi

Bu belge iki yeni özelliğin tasarım kararlarını ve API sözleşmesini kaydeder.

## Özellik 1 — Gözlemci Modu Sıkılaştırma

### Problem

`GET /conversations/all` (yalnızca OWNER) önceden hiçbir kısıtlama olmadan
sistemdeki tüm konuşmaları döndürüyordu. Artık zamana bağlı, gerekçeli bir
izin (`ObserverAccessGrant`) gerekiyor.

### Model

`ObserverAccessGrant`: `requestedByUserId`, `reason` (zorunlu), `expiresAt`
(nullable), `isEmergency` (default false).

- `isEmergency=false` → `expiresAt` zorunlu ve gelecekte bir tarih olmalı.
  Web/mobile `duration` kısayolu (`1h`/`1d`/`1w`) sunar veya özel tarih girilir.
- `isEmergency=true` → `expiresAt` boş bırakılabilir (sınırsız), ama `reason`
  yine zorunludur ve ayrı, belirgin bir audit log action'ı ile işaretlenir.

### API

- `POST /observer-access` (OWNER) — `{ reason, isEmergency?, duration? |
  expiresAt? }`. Audit log: `observer.access_granted` veya
  `observer.emergency_access_granted`.
- `GET /observer-access/current` (OWNER) — aktif grant'ı (varsa) döner.
- `GET /conversations/all` (OWNER) — aktif grant yoksa `403 { error, requiresGrant:
  true }`. Her başarılı çağrı ayrıca `observer.access_used` audit log kaydı
  düşer (grant'ın veriliş anından bağımsız, KULLANIM izlenir).

"Aktif grant" = `expiresAt IS NULL OR expiresAt > now()`, en son oluşturulana
göre. Bir OWNER için aynı anda birden fazla grant biriktirebilir (geçmiş
kayıtlar silinmez) — bu kasıtlı: geçmiş talepler audit amaçlı durur.

### Web / Mobile

Gözlemci butonuna tıklanınca önce `GET /observer-access/current` kontrol
edilir; grant yoksa gerekçe+süre formu (web: modal, mobile: bottom sheet)
açılır. Grant varsa doğrudan "tüm konuşmalar" görünümüne geçilir ve bir bilgi
şeridinde gerekçe/bitiş gösterilir. `/conversations/all` sırasında 403 alınırsa
(süre tam o anda dolmuşsa) aynı forma düşülür.

## Özellik 2 — Formal Değerlendirme Sistemi

Mevcut basit Performans sayfası (tamamlanan iş + müşteri puanı)
DEĞİŞMEDİ — bu, ayrı bir sekme/bölüm olarak eklendi.

### Modeller

- `EvaluationCriterion` — kriter kataloğu (OWNER/MANAGER CRUD, Hizmet
  Türleri/Semtler ile aynı stil: soft-delete yerine `isActive`).
- `EvaluationPeriod` — dönem (`label`, `startDate`, `endDate`, `isLocked`).
- `Evaluation` — `evaluatorUserId` + `targetStaffId` + `periodId` (hiyerarşi
  şartı YOK — herhangi bir OWNER/MANAGER herhangi bir personeli
  değerlendirebilir), `status` (DRAFT/SUBMITTED/LOCKED), `comment`,
  `managerScore` (1-20, opsiyonel, averageScore'dan AYRI). `@@unique
  ([evaluatorUserId, targetStaffId, periodId])`.
- `EvaluationScore` — her kriter için 1-20 puan. `averageScore` ALANI
  TUTULMAZ; her GET yanıtında `EvaluationScore` satırlarından hesaplanır
  (tutarsızlık riski olmasın diye).

### İş kuralları

- `POST /evaluations`: aynı (evaluator, target, period) için ikinci kayıt
  409 döner (unique constraint → global errorHandler otomatik çevirir).
  Durum DRAFT başlar.
- `PATCH /evaluations/:id`: yalnızca kendi oluşturduğu DRAFT kaydını
  düzenleyebilir. LOCKED bir kayıt hiç kimse tarafından (OWNER dahil, ayrı
  bir "unlock" akışı olmadan) düzenlenemez.
- `POST /evaluations/:id/submit`: DRAFT → SUBMITTED, yalnızca sahibi.
  Zaten SUBMITTED/LOCKED ise 409.
- Dönem kilitlenince (`PATCH /evaluation-periods/:id { isLocked: true }`)
  o döneme ait TÜM Evaluation kayıtları tek transaction içinde LOCKED'a
  çekilir ve `lockedAt` damgalanır.
- STAFF/TEAM_LEAD, `GET /evaluations` ile yalnızca KENDİ değerlendirmelerini
  görebilir ve yanıtta `evaluatorUserId`/`evaluator` alanı HİÇ bulunmaz
  (`redactEvaluatorForRole` — `redactSalaryForRole` ile aynı desen).
  OWNER/MANAGER için tam bilgi döner.
- `managerScore` ve hesaplanan `averageScore` her zaman ayrı alanlar olarak
  durur; hiçbir yerde birleştirilmez/üzerine yazılmaz.

### Web / Mobile

- Ayarlar → "Değerlendirme Kriterleri" (Hizmet Türleri ile aynı CRUD stili).
- Performans sayfası → yeni "Değerlendirmeler" sekmesi: dönem seçici,
  personel listesi, değerlendirme formu (DRAFT'ta düzenlenebilir), gönder/
  kilitle aksiyonları.
- Personel detay / kendi profili → "Aldığım Değerlendirmeler": averageScore,
  comment, managerScore görünür; değerlendirenin kimliği hiçbir zaman
  render edilmez (backend zaten gizliyor).
