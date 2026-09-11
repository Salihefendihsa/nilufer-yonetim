# Tasarım Üst Seviyesi — Bölüm C Tasarım Kararları

## Grafik kütüphaneleri

- **Web**: `recharts` kurulumu bu turda BAŞARILI oldu (önceki oturumda
  `npm install` ağ zaman aşımına uğramıştı; bu turda ilk deneme de saatler
  süren bir gecikmeyle sonunda tamamlandı — network bu ortamda güvenilmez,
  `--offline` ile paketi tekrar `package.json`'a eklemek gerekti). `ChartCard.tsx`
  içindeki `SimpleBarChart`/`TrendChart`/`DonutChart` recharts'a geçirildi;
  dışa açılan API (prop şekilleri) birebir korundu, hiçbir çağıran sayfa
  değişmedi. `RankBars` bilinçli olarak recharts'a geçmedi — o bir eksen/
  tooltip gerektiren grafik değil, düz bir liste + doluluk çubuğu.
  `npx next build` ile tüm 26 route'un derlendiği doğrulandı.
- **Mobile**: `fl_chart: ^0.69.2` eklendi (pub.dev bu ortamda npm registry'nin
  aksine erişilebilirdi). Yeni `widgets/charts.dart`: `RevenueTrendChart`
  (LineChart, gradyan dolgulu alan) ve `CategoryPieChart` (PieChart + lejant).
  Raporlar ekranındaki "Ciro Trendi" ve "Hizmet Türü Dağılımı", Para & Finans
  ekranındaki "Ciro Trendi" bu yeni bileşenlere geçirildi (eski `_BarRow`/
  `_FinanceBarRow` kaldırıldı). "Bölge Bazında Yoğunluk" bilinçli olarak
  düz çubuk kaldı (küçük, sıralı bir liste — pasta/çizgi grafiğe uygun değil).

## Sayı animasyonları (0'dan sayarak artma)

- Web: `components/AnimatedStatValue.tsx`, `StatCard`'ın `value`'sine
  otomatik uygulandı (tek entegrasyon noktası, tüm sayfalar otomatik
  kazandı). Mobile: `widgets/animated_stat_value.dart`, `AppStatCard`'a
  aynı şekilde entegre edildi.
- **Bilinçli sınır**: yalnızca ondalık/binlik ayraç İÇERMEYEN saf tam
  sayılı değerler ("128", "%80", "12 iş") animasyonludur. Para birimi
  ("₺12.500") ve ondalıklı değerler ("4.5") animasyonsuz, olduğu gibi
  gösterilir — "12.500" binlik mi ondalık mı ayrımı güvenilir yapılamadığı
  için (yanlış parse → yanlış sayı gösterme riski), belirsizlik olan hiçbir
  yerde animasyon uygulanmadı.

## Shimmer loading (web)

- `.skeleton` utility class (tailwind.config.ts: `shimmer` keyframe/animation)
  eklendi. `StatCard`, `value === "—"` (kod tabanındaki yerleşik "yükleniyor"
  sentinel'i) olduğunda otomatik shimmer bar gösterir — hiçbir çağıran sayfa
  değişmedi (tüm sayfalar zaten bu sentinel'i kullanıyordu).

## Premium dokunuşlar

- Patron Ana Sayfa'daki "Komuta Merkezi" kartı, giriş sayfasıyla aynı
  gradyan + nokta deseni diline kavuşturuldu (önceden düz beyaz karttı).

## Mobil animasyon/geçiş gözden geçirmesi

- Buton geri bildirimi: proje zaten `ElevatedButton`/`TextButton`/`InkWell`
  gibi Material bileşenlerini tutarlı kullanıyor — bunlar platform ripple/
  scale geri bildirimini otomatik sağlar, ek bir şey gerekmedi.
- Sayfa geçişleri: `MaterialPageRoute` platforma uygun varsayılan geçişi
  zaten veriyor.
- Liste yüklenme animasyonu: yeni `widgets/staggered_fade_in.dart`
  (`StaggeredFadeIn`) İşler ve Personel listelerine uygulandı (temsili
  örnek — aynı desen ihtiyaç duyulan diğer listelere de uygulanabilir).

## Genel tutarlılık denetimi

Bu turda eklenen yeni sayfalar (Evaluation, Observer Access, Org Chart)
tarandı: gölge (`shadow-card`/`shadow-pop`), köşe yarıçapı (`rounded-2xl`/
`rounded-xl`/`rounded-full`) ve boşluk kullanımının hepsi mevcut ölçekle
birebir uyumlu bulundu — ek bir düzeltme gerekmedi.

## Yapılmayanlar (kapsam/zaman sınırı, kayıt için)

- `RankBars` ve mobildeki "Bölge Bazında Yoğunluk" bar listesi recharts/
  fl_chart'a geçirilmedi (yukarıda gerekçesi var).
- Performans ekranındaki (web+mobile) sıralama çubukları mevcut haliyle
  bırakıldı — zaten podyum + numara rozetiyle görsel bir hiyerarşi sunuyor.
- Staggered fade-in yalnızca İşler ve Personel listelerine uygulandı,
  uygulamadaki HER liste değil (temsili kapsam).
