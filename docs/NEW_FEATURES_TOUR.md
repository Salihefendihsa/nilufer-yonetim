# 6 Yeni Özellik Turu — Tasarım Kararları

Bu belge A→F sırasıyla eklenen 6 özelliğin tasarım kararlarını, API
sözleşmelerini ve varsayılan (spec'te belirtilmemiş) iş kurallarını kaydeder.

## Bölüm A — İzin Talep/Onay Sistemi

- `LeaveRequest`: `staffId`, `startDate`, `endDate`, `reason`, `status`
  (PENDING/APPROVED/REJECTED), `decidedByUserId`, `decisionNote`.
- `POST /leave-requests` (STAFF/TEAM_LEAD) — `startDate < endDate` ve
  geçmiş tarih olamaz zorunluluğu zod `.refine()` ile.
- `GET /leave-requests`: STAFF kendi, TEAM_LEAD ekibinin (+ kendisi,
  `getTeamStaffIds` kendi staffId'sini de içerir), OWNER/MANAGER tümü.
  **Varsayım (spec'te yoktu)**: `?mine=true` query param'ı eklendi — bir
  TEAM_LEAD'in "İzin Taleplerim" sayfasında yalnızca KENDİ geçmişini
  görmesi gerekiyordu (ekibinin değil); bu, onay kuyruğundaki (Bekleyen
  Onaylar) "ekibin talepleri" görünümünden ayrı bir ihtiyaç.
- `PATCH /leave-requests/:id/decide`: APPROVED olunca `Staff.status=ON_LEAVE`,
  `statusUntil=endDate` — **yeni bir cron GEREKMEDİ**, mevcut
  `resetExpiredStaffStatuses` (hem cron hem her `GET /staff` okuması)
  zaten herhangi bir `statusUntil` dolmuş durumu AVAILABLE'a çeviriyordu;
  canlı testle doğrulandı (statusUntil'i geçmişe çekip GET çağrısı sonrası
  AVAILABLE'a döndüğü görüldü).
- Web: Bekleyen Onaylar sayfası artık TEAM_LEAD'e de açık ama TEAM_LEAD
  için yalnızca izin talepleri + saha raporu onayı kaynakları çekiliyor
  (teklif/avans/sözleşme uçları backend'de zaten OWNER/MANAGER'a kapalı).
  Yeni `/izinlerim` sayfası (TEAM_LEAD/STAFF) — talep formu + geçmiş.
- Mobile: mevcut Onaylar ekranına (yalnızca OWNER/MANAGER erişimi var) 4.
  kaynak eklendi; TEAM_LEAD'in mobilde Onaylar ekranına hiç erişimi
  olmadığı için (bkz. team_lead_shell.dart), yeni "İzinlerim" ekranı hem
  STAFF'ın kendi taleplerini hem TEAM_LEAD'in ekibinin bekleyen taleplerini
  tek ekranda birleştirir.

## Bölüm B — Rapor/Sözleşme PDF İndirme

- `GET /analytics/export/pdf?months=` (OWNER/MANAGER) — Raporlar sayfasının
  4 kalemini (ciro trendi, hizmet dağılımı, bölge sıralaması, müşteri
  sadakati) tek bir PDF'te toplar.
- `GET /contracts/:id/pdf` (OWNER/MANAGER, ilgili CUSTOMER kendi sözleşmesi
  için — `getContract`'taki AYNI erişim kontrolü tekrar kullanıldı).
  `Contract.pdfUrl` şemada duruyor ama hâlâ hiç doldurulmuyor — mevcut
  job-report-pdf deseninde olduğu gibi ON-DEMAND üretilir, diske
  kaydedilmez.
- Refactor: `analyticsController.ts`'teki 4 hesaplama fonksiyonu
  (`getRevenueTrend` vb.) `compute*` yardımcılarına ayrıldı — hem mevcut
  JSON uçları hem yeni PDF export'u AYNI hesaplamayı kullanır, kopya
  mantık yok.
- Web: Raporlar sayfasına "PDF İndir" (seçili tarih aralığını `months`
  olarak geçirir), Sözleşmeler tablosundaki her satıra "PDF" butonu.
- Mobile: mevcut `downloadAndShare()` yardımcısı kullanıldı — Raporlar
  AppBar'ına bir ikon, Sözleşmeler listesindeki (hem OWNER/MANAGER hem
  CUSTOMER'ın "Sözleşmelerim" görünümü — dosyada iki ayrı State sınıfı
  var) her karta "PDF İndir" butonu.
- Doğrulama: her iki uç curl ile çağrıldı, `Content-Type: application/pdf`
  ve gerçek PDF byte'ları (`file` komutu "PDF document" doğruladı)
  teyit edildi. Salt okunur uçlar olduğu için test verisi oluşturulmadı,
  temizlik gerekmedi.

## Bölüm C — Gider (Expense) Takibi

- `Expense`: `category` (FUEL/CHEMICALS/EQUIPMENT/RENT/UTILITIES/OTHER),
  `amount`, `description?`, `date`, `recordedByUserId`, `receiptUrl?`.
  CRUD tamamı OWNER/MANAGER — `router.use(requireRole(OWNER, MANAGER))`
  ile tüm alt uçlar tek satırda korunuyor (leaveRequests/expenses ile
  aynı desen).
- `GET /expenses` — `category` ve `month` (`YYYY-MM`) query filtreleri;
  liste `date desc` sıralı, sayfalanmış.
- Net kâr formülü güncellendi: `netProfitThisMonth = thisMonthTotal -
  totalStaffSalaryBase - totalExpensesThisMonth` (bkz.
  `paymentsController.ts:getPaymentsSummary`). `view_finance` görünürlük
  kuralına dokunulmadı — formül yalnızca zaten görebilenler için hesaplanıyor.
  Yeni alan: `summary.totalExpensesThisMonth`.
- **Yan düzeltme (bug, bu değişikliği yaparken fark edildi)**: personel
  maaş toplamı (`staffSalaryAgg`) `archivedAt: null` filtrelemiyordu —
  terfi/işten çıkarma sonrası arşivlenen bir personelin maaşı net kârdan
  düşülmeye SONSUZA KADAR devam ediyordu. Artık yalnızca aktif personel
  sayılıyor.
- Web: Para sayfasına "Tahsilatlar | Giderler" sekme geçişi eklendi
  (personel sayfasındaki sekme deseniyle aynı). Giderler sekmesi:
  kategori bazlı StatCard özetleri, kategori filtre çipleri, liste,
  düzenle/sil, "Yeni Gider" formu (modal).
- Mobile: `finance_screen.dart` artık bir `TabController` ile
  "Tahsilatlar"/"Giderler" sekmelerine ayrıldı — AppBar'daki "+" butonu
  aktif sekmeye göre farklı form ekranı açar (Excel dışa aktarma yalnızca
  Tahsilatlar sekmesinde görünür, gider dışa aktarma spec'te yoktu).
- Doğrulama: birkaç test gideri eklenip net kârın tam beklenen miktarda
  (800₺ eklenince -800 delta) değiştiği curl ile doğrulandı; ardından
  test kayıtları (2 gider + 1 audit log) ID bazlı silinip net kârın tam
  eski değerine (`-314500`) döndüğü tekrar doğrulandı.
