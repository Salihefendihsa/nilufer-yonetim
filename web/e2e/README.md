# Yerel tarayıcı doğrulaması

`npm run test:e2e` temiz Playwright Chromium oturumu kullanır. Testler yalnız
`127.0.0.1:3000` web arayüzünü, yerel API hedefini ve `nilufer_yonetim` adlı
yerel Postgres veritabanını kabul eder. Backend'i `NODE_ENV=test` ile, cron ve
SMTP/push/S3 gibi dış entegrasyonlar kapalı olarak başlatın. Gerçek kayıtları
değiştirmeyin; E2E dosyalarının oluşturduğu hesap ve kayıtlar benzersiz
`e2e_` adlarıyla ayrılır ve yalnız kendi kimlikleriyle temizlenir.

## Ölçülen kapsam

| Rol | Tarayıcıda sınanan kontroller | Kalan işlem testleri |
| --- | --- | --- |
| OWNER | Giriş/çıkış, 22 menü bağlantısı, takvim/liste ve ortak filtreler, müşteri oluşturma/düzenleme/arama/iptal, A/B detay geçişi, belge yükleme/indirme, iş oluşturma/atama/durum, ayrılmış hesaba mesaj | Stok, ödeme, sözleşme, personel, onay kayıtları ve tüm ayrıntı işlemleri |
| MANAGER | Giriş/çıkış, 19 menü bağlantısı, ortak kontroller, altı yeni kayıt modalında iptal, yetki sınırı | Modal kaydetmeleri, belge/iş/mesaj ve diğer ayrıntı işlemleri |
| TEAM_LEAD | Giriş/çıkış, 13 menü bağlantısı, ortak kontroller, izin modalı iptali, yetki sınırı | İzin gönderme/onay, ekip ataması ve diğer ayrıntı işlemleri |
| STAFF | Giriş/çıkış, 10 menü bağlantısı, ortak kontroller, izin modalı iptali, yetki sınırı | İş başlatma/raporlama, fotoğraf, izin gönderme ve diğer ayrıntı işlemleri |
| CUSTOMER | Giriş/çıkış, 7 menü bağlantısı, ortak kontroller, şikâyet modalı iptali, yetki sınırı | Şikâyet gönderme, belge, mesaj ve diğer ayrıntı işlemleri |

Ana ekranlar her rol için 360, 390, 768 ve 1440 pikselde yatay taşma ve mobil
menü açısından kontrol edilir. Menü bağlantısının açılması o ekranın form ve
butonlarının çalıştığı anlamına gelmez. Test sonuçları Flutter cihaz davranışını
ve üretim reCAPTCHA akışını doğrulamaz.

Playwright `test-results/` ve `playwright-report/` dizinleri Git tarafından
yok sayılır; bunları, trace dosyalarını veya yerel demo giriş dosyasını
depoya eklemeyin.
