/// Ortam yapılandırması. API adresi build/run sırasında
/// `--dart-define=API_URL=http://10.0.2.2:4000` ile geçilebilir.
///
/// Varsayılan `10.0.2.2` Android emülatörünün host makinesindeki
/// localhost'a eriştiği özel adrestir (backend/.env örneğindeki PORT=4000 ile
/// eşleşir). Gerçek cihazda test edilecekse bilgisayarın LAN IP'si ile
/// override edilmelidir.
class AppConfig {
  AppConfig._();

  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );

  /// backend/src/controllers/authController.ts:isVerifiedMobileClient ile
  /// eşleşen paylaşılan sır — giriş isteğine `X-Mobile-App-Key` header'ı
  /// olarak eklenir, reCAPTCHA v3'ü (mobilde WebView olmadan üretilemez)
  /// atlamak için kullanılır.
  ///
  /// GÜVENLİK NOTU: Bu, gerçek bir gizli anahtar DEĞİLDİR — herhangi bir APK
  /// tersine mühendislikle (`strings`, decompile) bu değeri çıkarabilir. Bu
  /// yalnızca "rastgele bir bot değil, bizim derlediğimiz uygulama" ayrımını
  /// zorlaştıran ikinci bir savunma katmanıdır; asıl brute-force koruması
  /// backend'deki mobile-özel sıkı rate limit'tir (bkz.
  /// backend/src/middleware/loginRateLimit.ts). Bu değer HER ZAMAN
  /// `--dart-define=MOBILE_APP_SECRET=<backend/.env içindeki değer>` ile
  /// build/run sırasında geçilmelidir — kaynak kodda gerçek bir değer
  /// TUTULMAZ (gitignore'lu `.env` dosyasının aksine bu dosya repoya
  /// gider). Define geçilmezse aşağıdaki placeholder kullanılır ve giriş
  /// isteği backend tarafından reddedilir (bilerek — sessizce yanlış bir
  /// sırla eşleşmesin diye).
  static const String mobileAppSecret = String.fromEnvironment(
    'MOBILE_APP_SECRET',
    defaultValue: 'dev-secret-not-set-pass-via-dart-define',
  );
}
