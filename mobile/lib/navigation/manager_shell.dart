import 'package:flutter/material.dart';

import '../features/approvals/approvals_screen.dart';
import '../features/calendar/calendar_screen.dart';
import '../features/contracts/contracts_list_screen.dart';
import '../features/customers/customers_list_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/finance/finance_screen.dart';
import '../features/jobs/job_form_screen.dart';
import '../features/jobs/jobs_list_screen.dart';
import '../features/messages/messages_list_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/performance/performance_screen.dart';
import '../features/quotes/quotes_list_screen.dart';
import '../features/reports/reports_screen.dart';
import '../features/staff/staff_list_screen.dart';
import '../features/stock/stock_list_screen.dart';
import '../theme/app_colors.dart';
import 'app_drawer.dart';
import 'manager_nav.dart';

/// MANAGER (Müdür) rolüne özel kabuk — Stitch "mudur" paketindeki 4 sekmeli
/// yüzen alt navigasyon + ortadaki 56px "yeni iş" butonu + kayan menü
/// çekmecesi düzeninin Flutter karşılığı.
///
/// Çekmecedeki sayfa listesi, Stitch'teki `data-path` değerleriyle ve müdürün
/// gerçek yetki haritasıyla birebir örtüşür: Denetim Logları / Sistem Durumu /
/// Kullanım İstatistikleri MANAGER'a kapalı olduğu için burada YOKTUR
/// (bkz. docs/STITCH_FEATURE_MATRIX.md — Faz 6).
class ManagerShell extends StatefulWidget {
  const ManagerShell({super.key});

  @override
  State<ManagerShell> createState() => _ManagerShellState();
}

class _ManagerShellState extends State<ManagerShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  int _index = 0;

  static const _tabs = <({String label, IconData icon, Widget screen})>[
    (
      label: 'Ana Sayfa',
      icon: Icons.dashboard_rounded,
      screen: DashboardScreen(),
    ),
    (label: 'İşler', icon: Icons.assignment_rounded, screen: JobsListScreen()),
    (
      label: 'Bildirimler',
      icon: Icons.notifications_rounded,
      screen: NotificationsScreen(),
    ),
    (
      label: 'Mesajlar',
      icon: Icons.chat_bubble_rounded,
      screen: MessagesListScreen(),
    ),
  ];

  static const _groups = <AppDrawerGroup>[
    AppDrawerGroup([
      AppDrawerEntry(
        'Takvim',
        Icons.calendar_month_outlined,
        _buildCalendar,
      ),
      AppDrawerEntry(
        'Bekleyen Onaylar',
        Icons.fact_check_outlined,
        _buildApprovals,
      ),
    ], title: 'Genel'),
    AppDrawerGroup([
      AppDrawerEntry('Müşteriler', Icons.people_outline_rounded, _buildCustomers),
      AppDrawerEntry('Personel', Icons.groups_outlined, _buildStaff),
      AppDrawerEntry(
        'Performans',
        Icons.emoji_events_outlined,
        _buildPerformance,
      ),
      AppDrawerEntry('Stok', Icons.inventory_2_outlined, _buildStock),
    ], title: 'Operasyon'),
    AppDrawerGroup([
      AppDrawerEntry('Sözleşmeler', Icons.description_outlined, _buildContracts),
      AppDrawerEntry('Teklifler', Icons.request_quote_outlined, _buildQuotes),
      AppDrawerEntry('Para', Icons.payments_outlined, _buildFinance),
      AppDrawerEntry('Raporlar', Icons.bar_chart_rounded, _buildReports),
    ], title: 'Finans'),
  ];

  static Widget _buildCalendar(BuildContext _) => const CalendarScreen();
  static Widget _buildApprovals(BuildContext _) => const ApprovalsScreen();
  static Widget _buildCustomers(BuildContext _) => const CustomersListScreen();
  static Widget _buildStaff(BuildContext _) => const StaffListScreen();
  static Widget _buildPerformance(BuildContext _) => const PerformanceScreen();
  static Widget _buildStock(BuildContext _) => const StockListScreen();
  static Widget _buildContracts(BuildContext _) => const ContractsListScreen();
  static Widget _buildQuotes(BuildContext _) => const QuotesListScreen();
  static Widget _buildFinance(BuildContext _) => const FinanceScreen();
  static Widget _buildReports(BuildContext _) => const ReportsScreen();

  @override
  Widget build(BuildContext context) {
    return ManagerNav(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppColors.surfacePage,
        drawer: const AppDrawer(roleLabel: 'Müdür', groups: _groups),
        body: IndexedStack(
          index: _index,
          children: _tabs.map((t) => t.screen).toList(),
        ),
        floatingActionButton: SizedBox(
          height: 56,
          width: 56,
          child: FloatingActionButton(
            heroTag: 'manager-new-job',
            backgroundColor: AppColors.primary500,
            foregroundColor: Colors.white,
            elevation: 4,
            shape: const CircleBorder(),
            tooltip: 'Yeni İş',
            onPressed: () async {
              await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => const JobFormScreen()),
              );
            },
            child: const Icon(Icons.add_rounded, size: 28),
          ),
        ),
        floatingActionButtonLocation:
            FloatingActionButtonLocation.centerDocked,
        bottomNavigationBar: BottomAppBar(
          color: AppColors.surfaceBase,
          elevation: 8,
          shape: const CircularNotchedRectangle(),
          notchMargin: 8,
          height: 68,
          padding: EdgeInsets.zero,
          child: Row(
            children: [
              _tabButton(0),
              _tabButton(1),
              const SizedBox(width: 56), // FAB oyuğu
              _tabButton(2),
              _tabButton(3),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tabButton(int i) {
    final tab = _tabs[i];
    final selected = _index == i;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _index = i),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              tab.icon,
              size: 22,
              color: selected ? AppColors.primary700 : AppColors.textSecondary,
            ),
            const SizedBox(height: 2),
            Text(
              tab.label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? AppColors.primary700
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
