import 'package:flutter/material.dart';

import '../features/admin/audit_settings_screen.dart';
import '../features/admin/data_deletion_screens.dart';
import '../features/admin/job_templates_screen.dart';
import '../features/admin/system_health_screen.dart';
import '../features/admin/usage_stats_screen.dart';
import '../features/appointment_requests/my_appointment_requests_screen.dart';
import '../features/approvals/approvals_screen.dart';
import '../features/calendar/calendar_screen.dart';
import '../features/complaints/complaints_screen.dart';
import '../features/contracts/contracts_list_screen.dart';
import '../features/customers/customer_data_export_screen.dart';
import '../features/customers/customer_tags.dart';
import '../features/customers/customers_list_screen.dart';
import '../features/customers/referral_screen.dart';
import '../features/evaluations/evaluations_screen.dart';
import '../features/executive/executive_summary_screen.dart';
import '../features/finance/finance_screen.dart';
import '../features/leave_requests/leave_requests_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/payslip/payslip_screen.dart';
import '../features/performance/performance_screen.dart';
import '../features/quotes/quotes_list_screen.dart';
import '../features/reports/reports_screen.dart';
import '../features/search/search_screen.dart';
import '../features/staff/org_chart_screen.dart';
import '../features/staff/staff_list_screen.dart';
import '../features/stock/stock_list_screen.dart';
import '../models/user.dart';
import 'app_drawer.dart';

/// Rol bazlı ikincil navigasyonun TEK doğruluk kaynağı (tasarım denetimi
/// §1.2/§3.3): hem hamburger çekmecesi (`AppDrawer`) hem de alt
/// navigasyondaki "Daha Fazla" sekmesi (`MoreMenuScreen`) bu listeden
/// beslenir. Önceden drawer ve "Daha Fazla" iki ayrı listeydi ve senkron
/// değildi (OWNER drawer'ında Şikayetler/Yönetici Özeti yoktu, MANAGER'ın
/// "Daha Fazla" sekmesi hiç yoktu → Şikayetler ve Yönetici Özeti MANAGER
/// için mobilde erişilemezdi).
///
/// Alt navigasyonda sabit sekmesi olan ekranlar (Ana Sayfa, İşler, Mesajlar,
/// Bildirimler vb.) burada rol bazlı TEKRAR edilmez; yalnızca sekmesi
/// olmayan modüller listelenir. Kabuklar sekme setini kendileri tanımlar.
///
/// Yetki notları (backend ile birebir):
/// - Denetim & Ayarlar / Sistem Durumu / Kullanım İstatistikleri / Org
///   Şeması yalnızca OWNER (routes/auditLogs.ts, settings.ts, admin.ts).
/// - Şikayetler ve Yönetici Özeti OWNER + MANAGER (web Sidebar.tsx ile aynı).
/// - Bekleyen Onaylar OWNER/MANAGER/TEAM_LEAD (TEAM_LEAD yalnızca izin +
///   saha raporu kuyruğunu görür — bkz. approvals_screen.dart).
List<AppDrawerGroup> navGroupsFor(AppRole role) {
  switch (role) {
    case AppRole.owner:
      return [
        const AppDrawerGroup([
          AppDrawerEntry('Ara', Icons.search_rounded, _buildSearch),
          AppDrawerEntry(
            'Bildirimler',
            Icons.notifications_outlined,
            _buildNotifications,
          ),
          AppDrawerEntry('Takvim', Icons.calendar_month_outlined, _buildCalendar),
        ], title: 'Genel'),
        const AppDrawerGroup([
          AppDrawerEntry(
            'Müşteriler',
            Icons.people_outline_rounded,
            _buildCustomers,
          ),
          AppDrawerEntry('Personel', Icons.groups_outlined, _buildStaff),
          // Bölüm AO (9. tur): müşteri şikayetleri.
          AppDrawerEntry(
            'Şikayetler',
            Icons.report_problem_outlined,
            _buildComplaints,
          ),
          AppDrawerEntry('Stok', Icons.inventory_2_outlined, _buildStock),
          // Bölüm T / X: OWNER için "Denetim & Ayarlar" içinde de var; burada
          // doğrudan giriş MANAGER ile aynı derinlik için.
          AppDrawerEntry(
            'İş Şablonları',
            Icons.dashboard_customize_outlined,
            _buildJobTemplates,
          ),
          AppDrawerEntry(
            'Müşteri Etiketleri',
            Icons.label_outline_rounded,
            _buildCustomerTags,
          ),
        ], title: 'Operasyon'),
        const AppDrawerGroup([
          // Bölüm G (2. tur): tüm KPI'lar tek ekranda.
          AppDrawerEntry(
            'Yönetici Özeti',
            Icons.insights_outlined,
            _buildExecutiveSummary,
          ),
          AppDrawerEntry(
            'Teklifler',
            Icons.request_quote_outlined,
            _buildQuotes,
          ),
          AppDrawerEntry(
            'Sözleşmeler',
            Icons.description_outlined,
            _buildContracts,
          ),
          AppDrawerEntry('Para & Finans', Icons.payments_outlined, _buildFinance),
          AppDrawerEntry(
            'Performans',
            Icons.emoji_events_outlined,
            _buildPerformance,
          ),
          AppDrawerEntry('Raporlar', Icons.bar_chart_rounded, _buildReports),
        ], title: 'Finans & Raporlar'),
        const AppDrawerGroup([
          AppDrawerEntry(
            'Organizasyon Şeması',
            Icons.account_tree_outlined,
            _buildOrgChart,
          ),
          AppDrawerEntry(
            'Denetim & Ayarlar',
            Icons.admin_panel_settings_outlined,
            _buildAuditSettings,
          ),
          AppDrawerEntry(
            'Sistem Durumu',
            Icons.monitor_heart_outlined,
            _buildSystemHealth,
          ),
          AppDrawerEntry(
            'Kullanım İstatistikleri',
            Icons.query_stats_rounded,
            _buildUsageStats,
          ),
        ], title: 'Yönetici'),
      ];

    case AppRole.manager:
      return [
        const AppDrawerGroup([
          AppDrawerEntry('Ara', Icons.search_rounded, _buildSearch),
          AppDrawerEntry(
            'Bildirimler',
            Icons.notifications_outlined,
            _buildNotifications,
          ),
          AppDrawerEntry('Takvim', Icons.calendar_month_outlined, _buildCalendar),
          AppDrawerEntry(
            'Bekleyen Onaylar',
            Icons.fact_check_outlined,
            _buildApprovals,
          ),
        ], title: 'Genel'),
        const AppDrawerGroup([
          AppDrawerEntry(
            'Müşteriler',
            Icons.people_outline_rounded,
            _buildCustomers,
          ),
          AppDrawerEntry('Personel', Icons.groups_outlined, _buildStaff),
          AppDrawerEntry(
            'Şikayetler',
            Icons.report_problem_outlined,
            _buildComplaints,
          ),
          AppDrawerEntry('Stok', Icons.inventory_2_outlined, _buildStock),
          AppDrawerEntry(
            'İş Şablonları',
            Icons.dashboard_customize_outlined,
            _buildJobTemplates,
          ),
          AppDrawerEntry(
            'Müşteri Etiketleri',
            Icons.label_outline_rounded,
            _buildCustomerTags,
          ),
        ], title: 'Operasyon'),
        const AppDrawerGroup([
          AppDrawerEntry(
            'Yönetici Özeti',
            Icons.insights_outlined,
            _buildExecutiveSummary,
          ),
          AppDrawerEntry(
            'Teklifler',
            Icons.request_quote_outlined,
            _buildQuotes,
          ),
          AppDrawerEntry(
            'Sözleşmeler',
            Icons.description_outlined,
            _buildContracts,
          ),
          AppDrawerEntry('Para & Finans', Icons.payments_outlined, _buildFinance),
          AppDrawerEntry(
            'Performans',
            Icons.emoji_events_outlined,
            _buildPerformance,
          ),
          AppDrawerEntry('Raporlar', Icons.bar_chart_rounded, _buildReports),
        ], title: 'Finans & Raporlar'),
      ];

    case AppRole.teamLead:
      return [
        const AppDrawerGroup([
          AppDrawerEntry('Ara', Icons.search_rounded, _buildSearch),
          AppDrawerEntry('Takvim', Icons.calendar_month_outlined, _buildCalendar),
          // Web'de TEAM_LEAD izin taleplerini /bekleyen-onaylar'dan karara
          // bağlar; mobilde bu giriş eksikti (tasarım denetimi §1.2).
          AppDrawerEntry(
            'Bekleyen Onaylar',
            Icons.fact_check_outlined,
            _buildApprovals,
          ),
          AppDrawerEntry(
            'Performans',
            Icons.emoji_events_outlined,
            _buildPerformance,
          ),
          AppDrawerEntry('Stok', Icons.inventory_2_outlined, _buildStock),
        ], title: 'Ekip'),
        const AppDrawerGroup([
          AppDrawerEntry(
            'İzinlerim',
            Icons.event_busy_outlined,
            _buildLeaveRequests,
          ),
          // Bölüm AN (9. tur): kişisel bordro özeti (salt görüntüleme).
          AppDrawerEntry('Bordrom', Icons.receipt_long_outlined, _buildPayslip),
        ], title: 'Kişisel'),
      ];

    case AppRole.staff:
      return [
        const AppDrawerGroup([
          AppDrawerEntry('Ara', Icons.search_rounded, _buildSearch),
          AppDrawerEntry('Takvim', Icons.calendar_month_outlined, _buildCalendar),
          // Kendi aldığı değerlendirmeleri salt okunur görür; değerlendirenin
          // kimliği backend tarafından zaten gizlenir.
          AppDrawerEntry(
            'Değerlendirmelerim',
            Icons.checklist_rtl_outlined,
            _buildEvaluations,
          ),
          AppDrawerEntry(
            'İzinlerim',
            Icons.event_busy_outlined,
            _buildLeaveRequests,
          ),
          AppDrawerEntry('Bordrom', Icons.receipt_long_outlined, _buildPayslip),
        ]),
      ];

    case AppRole.customer:
      // "Para" burada YOKTUR — web'de de /para yalnızca OWNER/MANAGER'a açık.
      return [
        const AppDrawerGroup([
          AppDrawerEntry('Ara', Icons.search_rounded, _buildSearch),
          // Bölüm J (3. tur): müşteri kendi hesabından randevu talebi açar.
          AppDrawerEntry(
            'Randevu Taleplerim',
            Icons.event_available_outlined,
            _buildMyAppointments,
          ),
          // Bölüm AO (9. tur): şikayet/sorun bildirimi ve çözüm takibi.
          AppDrawerEntry(
            'Şikayetlerim',
            Icons.report_problem_outlined,
            _buildComplaints,
          ),
          AppDrawerEntry(
            'Sözleşmelerim',
            Icons.description_outlined,
            _buildMyContracts,
          ),
          AppDrawerEntry(
            'Bildirimler',
            Icons.notifications_outlined,
            _buildNotifications,
          ),
        ], title: 'Hizmetlerim'),
        const AppDrawerGroup([
          // Bölüm P (4. tur): davet kodu/linki — yalnızca takip.
          AppDrawerEntry(
            'Arkadaşını Davet Et',
            Icons.card_giftcard_outlined,
            _buildReferral,
          ),
          // Bölüm AJ (8. tur): KVKK veri taşınabilirliği.
          AppDrawerEntry(
            'Verilerimi İndir',
            Icons.download_outlined,
            _buildDataExport,
          ),
          // Bölüm AD (7. tur): KVKK veri silme talebi.
          AppDrawerEntry(
            'Hesabımı ve Verilerimi Sil',
            Icons.person_off_outlined,
            _buildDataDeletion,
          ),
        ], title: 'Hesap'),
      ];
  }
}

// `const AppDrawerEntry` içinde kullanılabilmesi için üst düzey (top-level)
// builder fonksiyonları — closure'lar const olamaz.
Widget _buildSearch(BuildContext _) => const SearchScreen();
Widget _buildNotifications(BuildContext _) => const NotificationsScreen();
Widget _buildCalendar(BuildContext _) => const CalendarScreen();
Widget _buildApprovals(BuildContext _) => const ApprovalsScreen();
Widget _buildCustomers(BuildContext _) => const CustomersListScreen();
Widget _buildStaff(BuildContext _) => const StaffListScreen();
Widget _buildComplaints(BuildContext _) => const ComplaintsScreen();
Widget _buildStock(BuildContext _) => const StockListScreen();
Widget _buildJobTemplates(BuildContext _) => const JobTemplatesScreen();
Widget _buildCustomerTags(BuildContext _) => const CustomerTagsScreen();
Widget _buildExecutiveSummary(BuildContext _) =>
    const ExecutiveSummaryScreen();
Widget _buildQuotes(BuildContext _) => const QuotesListScreen();
Widget _buildContracts(BuildContext _) => const ContractsListScreen();
Widget _buildFinance(BuildContext _) => const FinanceScreen();
Widget _buildPerformance(BuildContext _) => const PerformanceScreen();
Widget _buildReports(BuildContext _) => const ReportsScreen();
Widget _buildOrgChart(BuildContext _) => const OrgChartScreen();
Widget _buildAuditSettings(BuildContext _) => const AuditSettingsScreen();
Widget _buildSystemHealth(BuildContext _) => const SystemHealthScreen();
Widget _buildUsageStats(BuildContext _) => const UsageStatsScreen();
Widget _buildLeaveRequests(BuildContext _) => const LeaveRequestsScreen();
Widget _buildPayslip(BuildContext _) => const PayslipScreen();
Widget _buildEvaluations(BuildContext _) => const EvaluationsScreen();
Widget _buildMyAppointments(BuildContext _) =>
    const MyAppointmentRequestsScreen();
Widget _buildMyContracts(BuildContext _) => const MyContractsScreen();
Widget _buildReferral(BuildContext _) => const ReferralScreen();
Widget _buildDataExport(BuildContext _) => const CustomerDataExportScreen();
Widget _buildDataDeletion(BuildContext _) => const CustomerDataDeletionScreen();
