# Nilüfer mobil uygulaması

Mobil uygulama doğrudan backend REST API'sine bağlanır. Yerel geliştirmede
backend'i `backend/` dizininden `npm run dev` ile başlatın; varsayılan port
`4000`'dir. Postgres ve `backend/.env` ayarları hazır olmalıdır.

Backend'de reCAPTCHA açıksa mobil giriş için `backend/.env` içindeki
`MOBILE_APP_SECRET` boş olmamalıdır. Flutter'a **aynı değeri** derleme zamanı
tanımı olarak verin. Bu değer kullanıcı parolası, JWT veya rol yetkisi değildir;
yalnız mobil girişin reCAPTCHA yolunu seçer. Web girişi kendi reCAPTCHA
doğrulamasını kullanmaya devam eder.

`mobile/.env` dosyasını yerelde oluşturun (git tarafından yok sayılır):

```dotenv
API_URL=http://10.0.2.2:4000
MOBILE_APP_SECRET=<backend/.env içindeki aynı değer>
```

Ardından `mobile/` dizininden çalıştırın:

```bash
flutter run --dart-define-from-file=.env
```

`10.0.2.2`, Android emülatöründen bilgisayarın `localhost` adresine erişim
içindir. Gerçek cihazda `API_URL` değerini bilgisayarın cihazdan erişilebilen
yerel ağ adresiyle değiştirin. `.env` içindeki değeri repoya, ekran görüntüsüne
veya komut çıktısına kopyalamayın. Mobil anahtar olmadan, reCAPTCHA açıkken
giriş isteği 400 ile reddedilir.
