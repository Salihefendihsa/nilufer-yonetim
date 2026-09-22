# Değişiklik Günlüğü

Kronolojik değil, konu bazlı — her girdi bir çalışma turunu özetler. Ayrıntılı
gerekçe/karar kaydı için `docs/STITCH_FEATURE_MATRIX.md` ve
`docs/WEB_MOBILE_PARITY.md`'ye bakın; bu dosya yalnızca "ne zaman ne
yapıldı"nın hızlı bir özeti.

## 2026-09-22 — Mobil canlı test hataları + kalıcı demo veri

**3 gerçek hata (Chrome'da canlı test sırasında bulundu), kök nedeni ortak:**
`mobile/lib/features/admin/named_list_settings_screen.dart`'taki "Ekle"
butonu bir `Row` içinde (Expanded(TextField) yanında) sarmalanmadan/stil
geçersiz kılınmadan duruyordu. Tema varsayılanı (`minimumSize:
Size.fromHeight(48)`, genişlik=sonsuz) Row'un esnek olmayan çocuklarına
verdiği sınırsız genişlik kısıtıyla çakışıp "BoxConstraints forces an
infinite width" layout exception'ı fırlatıyordu (kanıt: `flutter run`
konsol logu, tam olarak bu buton). Bu, aynı genel widget'ı kullanan
Değerlendirme Kriterleri (ve Semtler/Hizmet Türleri gibi diğer) ekranını
tamamen boş bırakıyordu; layout hatası sonrası Flutter'ın `MouseTracker`'ı
sürekli assertion fırlatmaya başlıyor (log'da yüzlerce tekrar), bu da o
sayfadaki geri tuşu dahil dokunma olaylarını güvenilmez hale getiriyordu.
- Düzeltme: butona sonlu `ElevatedButton.styleFrom(minimumSize: Size(64,
  48))` eklendi. Chrome'da canlı doğrulandı: ekran artık içerik gösteriyor,
  geri tuşu 5 kez art arda doğru çalıştı.
- `customer_detail_screen.dart`'ın Sözleşmeler sekmesindeki kartlara
  eksik olan `onTap` eklendi — tıklayınca durum/dönem/süre/tutar + "PDF
  İndir" gösteren bir bottom sheet açılıyor (ayrı bir sözleşme detay
  ekranı yok, `contracts_list_screen.dart`'taki "kart zaten tüm bilgiyi
  gösterir" deseniyle tutarlı).

**Kalıcı demo veri (`backend/prisma/seedDemo.ts`, YENİ, `npm run
db:seed:demo`):** `seed.ts`'in temel hesaplarının ÜZERİNE — silinmek üzere
DEĞİL, müşteriye/yatırımcıya gösterirken sistemin dolu görünmesi için.
Product 6→21, Customer 18→30, Job 36→76, Contract 10→18, QuoteRequest
6→16, artı sıfırdan: 8 ProductBatch (parti/SKT), 3 Supplier, 3 CustomerTag
(VIP/Kurumsal/Konut), 8 CustomerComplaint, 6 EvaluationCriterion, 3
EvaluationPeriod, 15 Evaluation+Score, 5 StaffBonus. Ayrıntı ve tablo
başına tam liste: `PROJECT_HANDOFF_TR.md` §12.2.2. Her bölüm kendi mevcut
satır sayısını kontrol ettiği için tekrar çalıştırmak güvenli (doğrulandı).

## 2026-09-10 — Production-hazırlık turu

**Bölüm A — STAFF Ana Sayfa boş ekran hatası (olası düzeltme, cihazda
doğrulanmadı):** `_buildStaffBody()`, dosyadaki diğer rol varyantlarıyla
karşılaştırıldı; tek genuine fark olan `Row + Expanded(flex:)` ile elle
çizilen segmentli ilerleme çubuğu (tüm kod tabanında yalnızca bu ekranda
kullanılıyordu) kaldırılıp, aynı dosyada zaten kanıtlanmış
`ClipRRect + LinearProgressIndicator` desenine çekildi. Ayrıntı:
`docs/WEB_MOBILE_PARITY.md`.

**Bölüm B — unutulmuş küçük parite maddeleri:**
- Müşteri detayında (web + mobile) geçmiş işlerden ortalama yıldız puanı.
- Bekleyen Onaylar (mobile) segment filtresi (Tümü/Raporlar/Teklifler/
  Avanslar/Sözleşmeler).

**Bölüm C — production-hazırlık denetimi:**
- Backend: `CORS_ORIGIN` env değişkeniyle isteğe bağlı origin kısıtlaması
  eklendi (boşsa mevcut dev davranışı korunur); `.env.example` güncellendi.
- Backend: `TRUST_PROXY` env değişkeni eklendi — reverse proxy arkasında
  deploy edilirse IP bazlı rate limiting'in gerçek istemci IP'sini görmesi
  için (varsayılan kapalı, doğrudan-internet deploy'u için güvenli).
- Rate limiting (300 req/15dk global + login'e özel daha sıkı limit) ve
  `helmet()` zaten yerinde, production için uygun bulundu.
- `npm run build` (web) ve `flutter build apk --release` (mobile) ikisi de
  başarıyla ve hatasız tamamlandı (release APK 59,8 MB — tree-shaking/R8
  sonrası debug'ın ~%31'i).
- Backend + mobile kaynak kodu test/debug sızıntısı için tarandı
  (`console.log`/`print`/hardcoded test hesabı/TODO-FIXME) — `seed.ts`
  dışında hiçbir şey bulunmadı.

**Önceki turlarda tamamlanan (aynı oturum):**
- Müdür'ün (`MANAGER`) organizasyon hiyerarşisine dahil edilmesi
  (STAFF/TEAM_LEAD → MANAGER doğrudan bağlanabiliyor).
- Tüm rollere ortak hamburger menü çekmecesi (`AppDrawer`).
- STAFF/İşler/Onaylar kart görüntüleme hatası (Border+borderRadius
  kombinasyonunun paint aşamasında sessizce başarısız olması) + dropdown
  taşmaları (`isExpanded`).
- Web↔mobil parite açıklarının kapatılması (yönetim ekranları, mesajlar,
  bildirimler, stok, finans, admin sayfaları).
- Backend N+1 sorgu düzeltmeleri (`getCustomerRetention`, `getTopDistricts`,
  `listConversations`), mobilde alan-gölgeleme (`overridden_fields`) riski.
- Web'de merkezi toast/snackbar bildirim sistemi (tüm CRUD akışlarına
  yayıldı: personel, müşteri, stok, ayarlar, iş, teklif, sözleşme).
- Mobilde kart/pill/chip köşe yarıçapının tek `AppRadius` kaynağına
  standardize edilmesi (35 dosya).
- Web'de klavye/tab navigasyonu: erişilemeyen bir `<div onClick>` gerçek
  `<button>`'a çevrildi, paylaşılan `Modal`'a odak tuzağı (focus trap)
  eklendi.
- Form validasyon mesajlarının tutarlılığı (mobil stok formu).

Doğrulama: her grup sonrası backend/web `tsc --noEmit`, `dart analyze`,
`flutter test`, ayrıca web için `npm run build` çalıştırıldı — hepsi temiz.
Test verisi ID bazlı temizlendi (tarih aralığıyla silme yapılmadı).

**Bilinen açık:** STAFF Ana Sayfa düzeltmesi gerçek cihazda henüz
doğrulanmadı (kullanıcı talimatıyla telefon/emülatör testine bu oturumda
hiç dokunulmadı).
