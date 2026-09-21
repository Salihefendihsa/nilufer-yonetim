# Görsel Tasarım Denetimi (Design Audit) — 9 Tur Sonrası

Tarih: 2026-09-20. Kapsam: web (Next.js) + mobil (Flutter). Yöntem: yalnızca
kod okuma ve grep — kod değiştirilmedi, build/test koşulmadı. Bu belge bir
sonraki "tasarım yükseltmesi" turunun planıdır; her bulgu dosya adıyla
verilmiştir ki doğrudan iş kalemine dönüşebilsin.

Kısa hüküm: **Web'de navigasyon tam** (21 rota / 21 Sidebar girişi, hamburger
her sayfada); asıl açık **mobilde** — özellikle MANAGER ve CUSTOMER
kabuklarında son turlarda eklenen özelliklerin bir kısmına **hiç ulaşılamıyor**
ya da yalnızca "Daha Fazla" listesinin dibinde. Görsel dil web'de token
tabanlı ve tutarlı; mobilde 561 satır-içi `TextStyle`, 18 farklı yazı boyutu
ve **koyu modda çalışmayan** sabit `AppColors` deseni var (76 dosya).

---

## 0. Uygulama Durumu — Tasarım Yükseltmesi Turu (2026-09-21)

§4'teki öncelik listesi sırayla uygulanıyor. İşaretler: ✅ tamamlandı ·
🔄 kısmi (yüzde) · ⏸ kullanıcı kararı bekliyor · ⬜ başlanmadı.

| # | İş | Durum | Not |
|---|---|---|---|
| 1 | Mobil kabuk navigasyon boşlukları | ✅ | MANAGER: 4. sekme "Daha Fazla" (Bildirimler → çekmece/Daha Fazla "Genel" grubu; FAB simetrisi nedeniyle 5. sekme eklenmedi). TEAM_LEAD: çekmeceye Bekleyen Onaylar (ApprovalsScreen TEAM_LEAD için teklif/avans/sözleşme uçlarını çağırmaz — web ile aynı). OWNER çekmecesi: Şikayetler, Yönetici Özeti, Bildirimler, İş Şablonları, Etiketler, Org Şeması eklendi. CUSTOMER çekmecesi: Şikayetlerim, Verilerimi İndir eklendi. |
| 2 | Drawer / "Daha Fazla" tek kaynak | ✅ | `navigation/nav_items.dart` → `navGroupsFor(role)`; `AppDrawer` ve `MoreMenuScreen` (tüm roller için tek widget, gruplu başlıklar) aynı listeden beslenir. `customer_more_menu_screen.dart` silindi. Hamburger: `MoreMenuScreen` ve `StaffListScreen`'e `ManagerNav.maybeLeading` eklendi. |
| 3 | Duyuru şeridi + Arama kabuk seviyesine | ✅ | `navigation/shell_top_bars.dart` `MaterialApp.builder` içinde Navigator'ı sarar: impersonation + duyuru şeridi TÜM rotalarda (sekme + push edilen ekranlar). `AnnouncementStrip` salt görsel; Ana Sayfa gövdelerindeki 4 kopya kaldırıldı. Arama: `features/search/search_action.dart` tüm sekme AppBar'larında (Ana Sayfa, İşler, Onaylar, Mesajlar, Bildirimler, Takvim, Personel, Daha Fazla) + her rolün çekmecesinde "Ara". Çift status-bar boşluğu (eski `_AuthGate` Column) `MediaQuery.removePadding` ile giderildi. |
| 4 | Web Ayarlar 4 sekme | ✅ | `components/SegmentedTabs.tsx` (para/performans pill deseni tek bileşen, `role=tablist`). Sekmeler: **Hesap** (Görünüm, Bildirim, 2FA, Takvim ICS, KVKK indir/sil) · **İşletme** (Firma, Hedefler, Hizmet Türleri, Semtler) · **Operasyon** (İş Şablonları, Etiketler, Kriterler) · **Sistem** (Duyuru, KVKK talepleri, Yedek, Tehlikeli Bölge). Tek sekmeli roller çubuk görmez; `?tab=` derin link. |
| 5 | Web Personel kart yoğunluğu | ✅ | `components/ActionMenu.tsx` (genel ⋯ menüsü, ayraç/ton/Escape). Kart: 3 birincil (Düzenle · Belgeler [süresi dolan varsa kırmızı] · Puantaj) + ⋯ menü (Araç Bakımı, İşe Alım, Değerlendirmeler, Yetkiler · Şifre, Olarak Gir · Terfi, Şef/Personel Yap, İşten Çıkar · Sil). `RoleActionsMenu.tsx` bu menüye katlandı, silindi. Ayrı detay sayfası/sekme yapılmadı (madde "buton yoğunluğunu azalt" olarak yorumlandı). |
| 6 | Web tipografi bileşenleri | ✅ | `SectionTitle` (4 boyut × 3 ton) — 36 `<h2>` tek bileşene, 8 sınıf kombinasyonu → 0. `text-[9/10/11px]` 30 → 0 (`text-3xs` 10px tokenı eklendi, 11px → `text-2xs`). `rounded-3xl` bölüm kartları → `2xl` (Modal hariç). `LoadingBlock` + `ChartSkeleton`: düz "Yükleniyor..." 84 → 5 (kalanlar option/buton etiketi); `Table` loading iskelet satır; 4 grafik bileşenine `loading` prop (22 `emptyLabel={loading ? ...}` sadeleşti). |
| 7 | Web grafik paleti | ✅ | `lib/chartPalette.ts` + `--chart-success/warning/danger/danger-deep/info/purple/neutral/neutral-soft` (açık + iki koyu blok). 11 dosyada sabit hex → token (bekleyen-onaylar, kullanim-istatistikleri, musteriler, personel, raporlar, sistem-durumu, sozlesmeler, stok, teklifler, StatusBadge, TeamBriefingCard); yıldız `fill` → `currentColor`. Kalan hex kasıtlı: etiket preset renkleri (veri), hero nokta deseni, imza mürekkebi; hero `bg-white` yorumla kasıtlı bırakıldı. |
| 8 | Mobil AppTextStyles | ✅ (%90) | `theme/app_text_styles.dart` — `context.text.{display,stat,title,subtitle,body,bodySmall,caption,label,navLabel,button}`; renkler paletten (koyu modda doğru). Satır-içi `TextStyle(` **561 → 55** (kalanlar `fontSize` içermeyen `copyWith`-benzeri küçük ayarlar ve tema dosyası; yarım punto boyutları 0). 3 partide 73 dosya geçirildi. Kalan 55 kullanım aşamalı temizlenecek — işlevsel etkisi yok. |
| 9 | Mobil koyu mod | ✅ (%97) | `theme/app_palette.dart` — `AppPalette.light/dark`, `context.colors`, `accent/accentSoft` (koyu modda primary700 yerine primary400). Doğrudan `AppColors.*` kullanan dosya **76 → 2** (74/76 = %97); kalan ikisi kasıtlı: `customer_tags.colorFromHex` (bozuk hex için sabit fallback) ve `job_detail` imza mürekkebi (tuval her temada beyaz). Const renk tabloları (`_statusColors`, `_roleTones`, `_pieColors`, `toneColor` vb.) palet parametreli fonksiyonlara çevrildi. Gerçek cihazda koyu mod görsel doğrulaması bu turda yapılmadı (UI otomasyonu kapsam dışı). |
| 10 | Boş durumlar | ✅ | `ChartCard.EmptyChart` ikonlu/açıklamalı boş durum; `TrendChart`/`SimpleBarChart` tüm değerler 0 ise de boş sayar (boş eksen yok). `bordrom` (web) ve `payslip_screen` (mobil) boş ay satırı ("prim/avans yok — net = taban maaş"). `yonetici-ozeti` bölüm başına "henüz veri yok". `sistem-durumu` zaten "İlk örnekler toplanıyor…" etiketiyle yeni EmptyChart'ı kullanır. |
| 11 | Web bottom nav | ⏸ | Ürün kararı — kullanıcı kararı bekliyor, uygulanmadı. |


### Tur özeti (2026-09-21)

- **Tam:** #1 #2 #3 #4 #5 #6 #7 #10 · **Kısmi (ölçülü):** #8 (%90) #9 (%97) · **Kullanıcı kararı bekliyor:** #11 (web bottom nav — ürün kararı; uygulanmadı).
- **Değişen dosyalar:** web ≈ 75 (5 yeni bileşen: `SegmentedTabs`, `ActionMenu`, `SectionTitle`, `LoadingBlock`, `lib/chartPalette`; `RoleActionsMenu` silindi) · mobil ≈ 80 (3 yeni: `nav_items`, `shell_top_bars`, `search_action`; `app_palette`, `app_text_styles`; `customer_more_menu_screen` silindi) · docs 1.
- **Regresyon kontrolü:** web `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓ (web'de `npm test` betiği yok); mobil `dart analyze` 78 info (tur başı 80, yeni uyarı/hata yok), `flutter test` 76/76 ✓; backend `npm test` 314/314 ✓ (tur ortasında, proje Postgres container'ı ile). **Not:** tur sırasında uzak main'e gelen `2d45999` commit'i backend'e `pino`/`@sentry/node`/`@aws-sdk/client-s3` ekledi; npm registry bu oturumda ECONNRESET verdiği için bu paketler kurulamadı → backend `tsc` o üç import'ta hata veriyor (bu turun değişiklikleriyle ilgisi yok; `npm install` başarılı olunca kendiliğinden düzelir).
- **Aşamalı devam eden işler:** mobil satır-içi `TextStyle` kalan 55 kullanım (fontSize'sız küçük ayarlar); `Colors.white` (~60, renkli zeminlerde kasıtlı) ve `Colors.red` (~13, onay diyalogları) palet dışı — bir sonraki cila turunda `cs.textInverse`/`cs.danger500`'e alınabilir. Koyu mod gerçek cihaz görsel doğrulaması yapılmadı.
- **Kapsam dışı bırakılanlar (bilinçli):** Stok satırı 6 buton (→ `ActionMenu` ile aynı kalıp uygulanabilir), Personel için ayrı detay sayfası/sekmeler, web modal derin link.

---

## 1. Navigasyon Eksiklikleri (ÖNCELİKLİ)

### 1.1 Web

- Kabuk: `web/src/app/(dashboard)/layout.tsx` her sayfada `Sidebar` (md+) +
  `MobileSidebar` (drawer) + `Header` hamburger (`md:hidden`) render eder.
  **Tüm 21 rota Sidebar'da mevcut** (`components/Sidebar.tsx` NAV_ITEMS ile
  `app/(dashboard)/*` klasörleri birebir eşleşiyor). Eksik sayfa yok.
- Web'de **alt navigasyon (bottom nav) yok** — mobil genişlikte tek giriş
  hamburger. Kullanıcı "alt menü her yerde" istiyorsa bu bilinçli bir boşluk.
- Rota-dışı özellikler (yalnızca modal/bölüm içinden ulaşılır — arama, derin
  link ve keşfedilebilirlik zayıf):

| Özellik | Nerede gizli | Sorun | Öneri |
|---|---|---|---|
| Belge kasası (AB) | `musteriler/CustomerDetailPanel` → `CustomerDocuments` | Müşteri detay paneli açılmadan görünmez | Müşteri detayında sekme başlığı + sayı rozeti |
| Müşteri etiketleri (X) | Ayarlar → `CustomerTagsSection` + detay paneli | Yönetim sayfası Ayarlar'ın 5. bölümü | Müşteriler sayfasında "Etiketler" alt sekmesi |
| İş şablonları (T) | Ayarlar → `JobTemplatesSection` | Operasyon özelliği Ayarlar'da | İşler sayfası araç çubuğuna taşı |
| Duyuru şeridi yönetimi (AK) | Ayarlar → `AnnouncementSection` | 9. bölüm, sayfa ortası | Ayarlar'ı sekmelere böl (bkz. §3.3) |
| KVKK silme talepleri (AD) | Ayarlar → `DataDeletionRequestsSection` | OWNER iş kuyruğu Ayarlar'da | Bekleyen Onaylar'a "KVKK" kuyruğu ya da ayrı sayfa |
| Takvim dışa aktarma (AP) | Ayarlar → `CalendarExportSection` | Personel için kritik ama Ayarlar'da | Takvim sayfasına "Takvimime Ekle" butonu (aynı bileşen) |
| Personel alt özellikleri (Belgeler, Puantaj, Araç Bakımı, İşe Alım, Değerlendirmeler, Yetkiler, Şifre, Olarak Gir) | `personel/page.tsx` kartında **8–10 buton** | Kart aşırı yoğun, buton hiyerarşisi yok | Personel **detay sayfası/paneli** + sekmeler (bkz. §3.3) |
| Stok satır aksiyonları (Hareketler, Partiler, Fiili Sayım, Talep, Stok Ekle, Sil) | `stok/page.tsx` satırda 6 buton | Geniş ekranda bile taşıyor | Satırda 2 birincil + "⋯" menüsü |
| Gözlemci erişimi (observer) | `mesajlar/ObserverAccessModal` | Yalnızca Mesajlar içinden | Kabul edilebilir; not olarak kalsın |

### 1.2 Mobil — kabuk envanteri

Her kabukta hamburger drawer **ve** alt navigasyon var; sorun içerikte:

| Kabuk | Alt nav | Drawer | Tespit |
|---|---|---|---|
| OWNER (`role_shell.dart`) | Ana Sayfa, İşler, Onaylar, Mesajlar, **Daha Fazla (17 öğe)** | 12 giriş (Op./Finans/Yönetici) | Drawer'da **Yönetici Özeti, Şikayetler, Bildirimler, İş Şablonları, Etiketler, Org Şeması yok** — hepsi "Daha Fazla"da |
| MANAGER (`manager_shell.dart`) | Ana Sayfa, İşler, Bildirimler, Mesajlar | 12 giriş | **"Daha Fazla" sekmesi YOK** → drawer'da olmayan hiçbir şeye ulaşılamıyor: **Şikayetler (AO) ve Yönetici Özeti (G) MANAGER için mobilde erişilemez** (web'de ikisi de MANAGER'a açık) |
| TEAM_LEAD (`team_lead_shell.dart`) | Ana Sayfa, İşler, Bildirimler, Mesajlar | Takvim, Performans, Stok, İzinlerim, Bordrom | **Bekleyen Onaylar yok** (web'de TEAM_LEAD izin taleplerini `/bekleyen-onaylar`dan karara bağlar; mobilde `ApprovalsScreen` yalnızca OWNER/MANAGER'a bağlı). Ekibim (StaffList) yok — web'de de yok, parite tamam |
| STAFF (`staff_shell.dart`) | Ana Sayfa, İşler, Bildirimler, Mesajlar | Takvim, Değerlendirmelerim, İzinlerim, Bordrom | Tam; Puantaj (ClockCard) Ana Sayfa'da ✓, Takvim dışa aktarma Ayarlar'da ✓ |
| CUSTOMER (`role_shell.dart`) | Ana Sayfa, İşlerim, Takvim, Mesajlar, Daha Fazla (7) | 5 giriş | Drawer'da **Şikayetlerim (AO) ve Verilerimi İndir (AJ) yok** — yalnızca "Daha Fazla"da. Drawer ile "Daha Fazla" listesi senkron değil |

Hamburger butonu sekme ekranlarında `ManagerNav.maybeLeading` ile çıkıyor;
**`staff_list_screen.dart`, `more_menu_screen.dart`,
`customer_more_menu_screen.dart`** bunu kullanmıyor (Daha Fazla sekmesinde
hamburger yok — kullanıcı "her yerde olsun" diyor).

### 1.3 Mobil — 9 turda eklenen özelliklerin bulunabilirliği

| Özellik | OWNER | MANAGER | TEAM_LEAD | STAFF | CUSTOMER | Not |
|---|---|---|---|---|---|---|
| Yönetici Özeti (G) | Daha Fazla | **YOK** | — | — | — | web MANAGER'a açık |
| Bekleyen Onaylar | Tab | Drawer | **YOK** | — | — | web TEAM_LEAD'e açık |
| Şikayetler (AO) | Daha Fazla (dip) | **YOK** | — | — | Daha Fazla (drawer'da yok) | en kritik |
| Bordrom (AN) | — | — | Drawer ✓ | Drawer ✓ | — | ✓ |
| Araç Bakımı (AQ) | Personel detayı ✓ | ✓ | (kendi kaydı: detay ekranına giriş yok) | (aynı) | — | STAFF kendi personel detayını açamıyor → kartı göremez |
| Puantaj (AR) | Personel detayı ✓ | ✓ | Ana Sayfa ✓ | Ana Sayfa ✓ | — | STAFF aylık özetini göremez (yalnızca bugünkü kart) |
| Takvim ICS (AP) | — | — | Ayarlar ✓ | Ayarlar ✓ | — | Takvim ekranında kısayol yok |
| Parti/SKT (AM) | Stok içi ✓ | ✓ | Stok salt-okunur, parti listesi OWNER/MANAGER | — | — | ✓ |
| Duyuru şeridi (AK) | Yalnızca **Ana Sayfa** | aynı | aynı | aynı | aynı | Web'de tüm sayfalarda (layout); mobilde 4 dashboard gövdesinde — diğer ekranlarda görünmez. **Yönetim ekranı mobilde yok** |
| Belge kasası (AB) | Müşteri detayı sekmesi ✓ | ✓ | — | — | — | ✓ |
| Etiketler (X) | Denetim&Ayarlar içi | Drawer ✓ | — | — | — | OWNER için 2 seviye derinde |
| İş Şablonları (T) | Denetim&Ayarlar içi | Drawer ✓ | — | — | — | aynı |
| KVKK silme talepleri (AD) | Denetim&Ayarlar içi | — | — | — | Daha Fazla+Drawer ✓ | OWNER kuyruğu 2 seviye derinde |
| Veri dışa aktarım (AJ) | — | — | — | — | Daha Fazla (drawer'da yok) | |
| Arama (I) | Ana Sayfa'daki ikon | aynı | aynı | aynı | aynı | Diğer ekranlardan erişilemez |
| Ayarlar (Firma bilgisi, Hedefler, Yedekleme, Duyuru, Tehlikeli Bölge) | **YOK** (web-only) | — | — | — | — | Bilinçli olabilir; not |

---

## 2. Tipografi ve Renk Tutarlılığı

### 2.1 Web — tipografi

- Ölçek: `tailwind.config.ts` yalnızca `2xs` ekler; geri kalan Tailwind
  varsayılanı. Sayfa başlıkları `PageHeader` ile tutarlı (`text-2xl font-bold
  tracking-tight`). Bölüm başlıkları (`<h2>`) **8 farklı sınıf kombinasyonu**:
  `text-base font-semibold` (16), `text-sm font-semibold` (5), `text-2xl font-bold`
  (3, PageHeader dışı), `text-lg`, `text-xl`, `uppercase tracking-wide`… →
  bir `SectionTitle` bileşeni yok.
- **Keyfi boyutlar:** `text-[9px]` ×3, `text-[10px]` ×11, `text-[11px]` ×16
  (30 yer, 15 dosya). En yoğun: `mesajlar/page.tsx` (6), `Header.tsx` (3),
  `stok/page.tsx` (3), `stok/ExpiringBatchesPanel.tsx` (3), `takvim/page.tsx`
  (2), `stok/PurchaseRequestsPanel.tsx` (2), `sikayetler/page.tsx` (2),
  `personel/page.tsx` (2), `MessageBubble.tsx`, `giris/page.tsx`,
  `teklifler/QuoteHistoryModal.tsx`, `stok/SuppliersPanel.tsx`,
  `stok/BatchesModal.tsx`, `personel/VehicleMaintenanceModal.tsx`,
  `musteriler/page.tsx`. Hepsi rozet/pill metni — `text-2xs` (11px) zaten var;
  10/9px için `3xs` tanımlanmalı veya rozetler `Badges.tsx`'e taşınmalı.

### 2.2 Web — renk / dil

- Renk sistemi CSS custom property + `withOpacity` (primary/neutral/success/
  warning/danger/info, surface/text/border tokenları) — **iyi**. Koyu mod
  `[data-theme="dark"]` + sistem tercihi, `globals.css`'te 218 token satırı.
- Sabit hex yalnızca **grafik/segment renklerinde**: `bekleyen-onaylar`
  (QUEUE_COLORS), `kullanim-istatistikleri` (ROLE_COLORS), `raporlar`,
  `sistem-durumu`, `musteriler`, `sozlesmeler`, `personel` (StatusStrip
  segmentleri), `CustomerTagsSection` PRESET_COLORS, `CustomerDetailPanel`
  yıldız `fill`. Koyu modda kontrast zayıflar; ortak bir `chartPalette`
  (CSS var okuyan) önerilir.
- `bg-white`: `(dashboard)/page.tsx:272` hero butonu ve `ayarlar/page.tsx:384`
  QR (kasıtlı, yorumlu). Hero butonu koyu modda **beyaz kutu** kalır.
- Köşe yarıçapı: `rounded-2xl` 406, `rounded-xl` 154, `rounded-full` 171,
  `rounded-3xl` 7 (yalnızca 9. tur panelleri: ExpiringBatchesPanel,
  PurchaseRequestsPanel, sikayetler, bordrom, ClockCard), `rounded-lg` 16,
  `rounded-md` 3. **`rounded-3xl` yeni ve tek başına** — bölüm kartı için
  `2xl` standardına çekilmeli ya da tüm bölüm kartları 3xl yapılmalı.
- Hızlı eklenen özellikler (Şikayetler, Bordro, Duyuru, Etiketler, Parti):
  token kullanımı **doğru** (`bg-surface-*`, `text-text-*`, `*-50/100/500/600`).
  Sapmalar: `rounded-3xl`, rozet için `text-[11px]`, bölüm başlığı için
  `text-sm` (diğer bölümler `text-base`).

### 2.3 Mobil — tipografi

- **Merkezi tipografi yok** (`AppTextStyles`/`AppTypography` sınıfı yok).
  `TextStyle(` **561 kez, 76 dosyada**, `fontSize` için **18 farklı değer**
  (12.5 ×85, 11.5 ×85, 12 ×75, 13 ×58, 13.5 ×45, 11 ×38, 15 ×34, 10.5 ×33,
  14.5 ×31, 14 ×20, 20, 10, 18, 16, 28, 22, 17, 15.5). Yarım puntolar (10.5,
  11.5, 12.5, 13.5, 14.5, 15.5) sistemin 'hislenmiş' değerler olduğunu
  gösteriyor. `Theme.of(context).textTheme` neredeyse hiç kullanılmıyor.

### 2.4 Mobil — renk / koyu mod (en büyük yapısal sorun)

- `AppColors` (açık tema sabitleri) **76 dosyada doğrudan** kullanılıyor;
  `AppDarkColors` yalnızca 6 dosyada (tema + 3 kabuk indicator).
  `Theme.of(context).colorScheme` yalnızca 4 dosyada. `app_colors.dart:75-81`
  bunu "bilinen sınır" olarak belgeliyor: **koyu modda kart zemini
  `AppColors.surfaceCard` (beyaz) ve metin `AppColors.textPrimary` (koyu)
  açık tema renginde kalır** → koyu modda ekranların çoğu fiilen açık kartlar
  gösterir, scaffold koyu olur (yamalı görünüm).
- Sabit renkler: `Colors.white` ×60, `Colors.red` ×13 (onay/sil diyalogları),
  `Colors.white70/60/24`, `Colors.grey` ×2, `Colors.black` ×1; `Color(0x…)`
  tema dışında: `customer_tags.dart`, `chat_screen.dart`,
  `performance_screen.dart` ×3, `app_drawer.dart`.
- 9 turda eklenen mobil ekranların **hepsi** bu desende (AppColors sabit):
  `complaints_screen.dart` (15), `payslip_screen.dart`,
  `product_batches_screen.dart` (15), `vehicle_maintenance_card.dart`,
  `attendance_card.dart`, `clock_card.dart`, `calendar_export_card.dart`,
  `announcement_banner.dart`, `leave_balance_card.dart`, `onboarding_card.dart`,
  `evaluation_trend_card.dart`, `customer_documents_tab.dart`,
  `customer_tags.dart`, `data_deletion_screens.dart`,
  `customer_data_export_screen.dart`, `referral_screen.dart`,
  `executive_summary_screen.dart`, `usage_stats_screen.dart`,
  `system_health_screen.dart`, `org_chart_screen.dart`, `search_screen.dart`.
  Koyu mod için **tek tek düzeltmek yerine** `AppColors`'ı
  `BuildContext` üzerinden çözen bir `context.colors` uzantısına (ya da
  `ThemeExtension`) geçirmek gerekir — mekanik ama geniş (76 dosya).

---

## 3. Kullanılabilirlik Sorunları

### 3.1 Boş durumlar
- Web `EmptyState` bileşeni kullanmayan sayfalar: `ayarlar` (bölüm bazlı
  metinler var, ok), `bordrom` (boş ay → yalnızca 0 ₺ kartları; "Bu ay prim/
  avans yok" satırı yok), `raporlar`, `sistem-durumu`, `yonetici-ozeti` (grafik
  sayfaları; veri yokken boş eksen). `LeaveBalanceCard` ve `ClockCard` boş/
  hata metni yok (ClockCard hata satırı var).
- Mobil `EmptyStateView` olmayan ekranlar: `payslip_screen.dart` (boş ay için
  metin yok), `executive_summary_screen.dart` (grafik), `referral_screen.dart`,
  `customer_data_export_screen.dart` (tek aksiyon, kabul), form ekranları
  (kabul).
- Metin tutarsızlığı: web boş metinleri "… yok." / "Henüz … yok" / "…
  bulunmuyor." üç kalıp; mobilde `EmptyStateView(title, subtitle)` tutarlı.

### 3.2 Yükleme durumları
- Web: **84 yerde düz "Yükleniyor..." metni**, yalnızca 2 `Skeleton` + 2
  `animate-pulse`. Tablolar `Table loading` prop'u ile iskelet gösteriyor ama
  paneller/modallar düz metin. Tek bir `LoadingBlock`/skeleton standardı yok.
- Mobil: `LoadingView()` 49, çıplak `CircularProgressIndicator(` 39 — iki
  desen karışık (kartlarda küçük spinner, ekranlarda LoadingView; kabul
  edilebilir ama kart spinner'ı da bir `InlineLoading` widget'ı olmalı).

### 3.3 Aşırı yoğun sayfalar
- **Web Ayarlar** (`ayarlar/page.tsx`, 1.240+ satır): OWNER için **18 bölüm**
  tek dikey sayfada (Görünüm, Bildirim, 2FA, İş Şablonları, Etiketler, Duyuru,
  KVKK Talepleri, Firma, Hedefler, Hizmet Türleri, Semtler, Kriterler, Yedek,
  Tehlikeli Bölge + rol-özel 4). Sekmeye bölünmeli: **Hesap** (Görünüm,
  Bildirim, 2FA, Takvim/Veri) · **İşletme** (Firma, Hedefler, Hizmet Türleri,
  Semtler) · **Operasyon** (Şablonlar, Etiketler, Kriterler) · **Sistem**
  (Duyuru, KVKK, Yedek, Tehlikeli Bölge).
- **Web Personel kartı**: kart başına 8–10 aksiyon butonu + izin bakiyesi
  kartı (`personel/page.tsx` ~330-480). Kart → liste + **detay paneli/sayfası**
  (Genel · Belgeler · Puantaj · Araç · İşe Alım · Değerlendirme · Yetkiler).
- **Web Stok satırı**: 6 aksiyon + 3 rozet/sütun; ayrıca sayfa altında 3
  panel (Süresi Yaklaşan, Satın Alma, Tedarikçiler). Paneller sekme olmalı.
- **Web Ana Sayfa (dashboard)** `page.tsx` 1.000+ satır, 5 rol tek dosyada —
  bakım yükü; rol başına dosya.
- **Mobil "Daha Fazla" (OWNER)**: **17 öğe**, gruplanmamış düz liste; drawer'ı
  (12, 3 grup) tekrar eder ama ikisi farklı kümeler. Tek doğruluk kaynağı
  (aynı grup listesi) + kategori başlıkları gerekli. CUSTOMER "Daha Fazla" 7
  öğe (kabul) ama drawer 5 — senkron değil.
- **Mobil Ayarlar (OWNER)**: web'deki 18 bölümün ~6'sı var (`Denetim &
  Ayarlar` içinde), duyuru yönetimi/firma/hedef/yedek yok — bilinçli mi belge
  yok.

### 3.4 Diğer
- Web `AnnouncementBanner` tüm sayfalarda; mobilde yalnızca Ana Sayfa
  gövdelerinde → duyuru başka sekmedeyken görünmez. Kabuk seviyesine (Scaffold
  body üstü) alınmalı.
- Mobil `Arama` yalnızca Ana Sayfa AppBar'ında.
- 27 `*Modal.tsx` — web'de detay/edit akışlarının çoğu modal; derin link ve
  geri tuşu desteği yok (ör. `/personel?staff=id` yok).

---

## 4. Öncelik Sırası (yarın için)

| # | İş | Etki | Dosya (tahmini) | Boyut |
|---|---|---|---|---|
| 1 | **Mobil MANAGER'a "Daha Fazla" sekmesi veya drawer'a Şikayetler + Yönetici Özeti; TEAM_LEAD'e Bekleyen Onaylar; CUSTOMER drawer'ına Şikayetlerim + Verilerimi İndir; OWNER drawer'ına Şikayetler/Yönetici Özeti/Bildirimler** | Erişilemeyen özellikler (fonksiyonel eksik) | `manager_shell.dart`, `team_lead_shell.dart`, `role_shell.dart`, `more_menu_screen.dart`, `customer_more_menu_screen.dart` (5) | Küçük |
| 2 | **Drawer ve "Daha Fazla"yı tek listeden besle + grupla**; "Daha Fazla"/Ekibim ekranlarına hamburger (`maybeLeading`) | "Hamburger + alt menü her yerde" isteği | `app_drawer.dart`, iki more_menu, `staff_list_screen.dart`, yeni `nav_items.dart` (5–6) | Küçük–orta |
| 3 | **Mobil `AnnouncementBanner`'ı kabuk seviyesine al**; Arama'yı drawer'a ekle | Duyuru/arama her ekranda | 4 kabuk + `dashboard_screen.dart` (5) | Küçük |
| 4 | **Web Ayarlar'ı 4 sekmeye böl** | En yoğun sayfa, tüm roller | `ayarlar/page.tsx` + 7 section (bölünmüş dosyalar) (~9) | Orta |
| 5 | **Web Personel detay paneli** (kart butonlarını sekmelere taşı) | Yönetimin en sık kullandığı ekran | `personel/page.tsx` + 8 modal → panel (~10) | Orta–büyük |
| 6 | **Web tipografi bileşenleri**: `SectionTitle`, rozet `Badge` (`text-2xs`/`3xs`), `LoadingBlock` skeleton; `rounded-3xl`→`2xl` | Tutarlılık, 30 keyfi boyut, 84 düz "Yükleniyor" | ~25 dosya mekanik | Orta |
| 7 | **Web grafik paleti tokenlaştır** (`chartPalette` CSS var okuyan) + hero `bg-white` | Koyu mod kontrastı | 8 dosya | Küçük |
| 8 | **Mobil `AppTextStyles`** (6–7 stil) ve yarım punto temizliği | 561 TextStyle, 18 boyut | 76 dosya, mekanik (aşamalı: önce 9. tur ekranları ~12) | Büyük |
| 9 | **Mobil koyu mod**: `AppColors` → `context.colors` (`ThemeExtension`) | Koyu mod fiilen çalışmıyor | 76 dosya + `app_colors.dart`/`app_theme.dart` | Büyük (aşamalı yapılabilir: kabuklar + kartlar önce) |
| 10 | Web boş durumlar: `bordrom` boş ay satırı, grafik sayfalarına "veri yok"; mobil `payslip_screen` boş ay | Cila | 5 dosya | Küçük |
| 11 | Web mobil genişlik için **bottom nav** (rol bazlı 4–5 sekme) | "alt menü her yerde" (web) | `layout.tsx` + yeni `BottomNav.tsx` (2) | Küçük–orta; ürün kararı gerekir |

**Tahmini toplam kapsam:** 1–3 (navigasyon) ≈ 12 dosya, yarım gün; 4–7 (web
bilgi mimarisi + tutarlılık) ≈ 45 dosya, 1–1.5 gün; 8–9 (mobil tipografi +
koyu mod) ≈ 76 dosya, mekanik ama geniş — aşamalı, 1.5–2 gün; 10–11 küçük.
Navigasyon ve Ayarlar/Personel işleri kullanıcıyı en çok etkileyen kalemler;
mobil koyu mod en büyük teknik borç ama tema kullanımı düşükse ertelenebilir.
