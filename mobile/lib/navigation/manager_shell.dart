import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
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
import '../features/settings/settings_screen.dart';
import '../features/staff/staff_list_screen.dart';
import '../features/stock/stock_list_screen.dart';
import '../theme/app_colors.dart';
import 'manager_nav.dart';

class _DrawerEntry {
  final String label;
  final IconData icon;
  final WidgetBuilder builder;
  const _DrawerEntry(this.label, this.icon, this.builder);
}

class _DrawerGroup {
  final String title;
  final List<_DrawerEntry> entries;
  const _DrawerGroup(this.title, this.entries);
}

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

  static const _groups = <_DrawerGroup>[
    _DrawerGroup('Genel', [
      _DrawerEntry(
        'Takvim',
        Icons.calendar_month_outlined,
        _buildCalendar,
      ),
      _DrawerEntry(
        'Bekleyen Onaylar',
        Icons.fact_check_outlined,
        _buildApprovals,
      ),
    ]),
    _DrawerGroup('Operasyon', [
      _DrawerEntry('Müşteriler', Icons.people_outline_rounded, _buildCustomers),
      _DrawerEntry('Personel', Icons.groups_outlined, _buildStaff),
      _DrawerEntry(
        'Performans',
        Icons.emoji_events_outlined,
        _buildPerformance,
      ),
      _DrawerEntry('Stok', Icons.inventory_2_outlined, _buildStock),
    ]),
    _DrawerGroup('Finans', [
      _DrawerEntry('Sözleşmeler', Icons.description_outlined, _buildContracts),
      _DrawerEntry('Teklifler', Icons.request_quote_outlined, _buildQuotes),
      _DrawerEntry('Para', Icons.payments_outlined, _buildFinance),
      _DrawerEntry('Raporlar', Icons.bar_chart_rounded, _buildReports),
    ]),
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

  void _open(WidgetBuilder builder) {
    Navigator.of(context).pop(); // çekmeceyi kapat
    Navigator.of(context).push(MaterialPageRoute(builder: builder));
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return ManagerNav(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppColors.surfacePage,
        drawer: Drawer(
          backgroundColor: AppColors.surfaceBase,
          child: SafeArea(
            bottom: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.primary700, Color(0xFF1E3521)],
                    ),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: Colors.white24,
                        child: Text(
                          (user?.fullName.trim().isNotEmpty ?? false)
                              ? user!.fullName.trim()[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.fullName ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                'Müdür',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      for (final group in _groups) ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
                          child: Text(
                            group.title.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              letterSpacing: 0.6,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textFaint,
                            ),
                          ),
                        ),
                        for (final entry in group.entries)
                          ListTile(
                            dense: true,
                            leading: Icon(
                              entry.icon,
                              size: 21,
                              color: AppColors.primary700,
                            ),
                            title: Text(
                              entry.label,
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            onTap: () => _open(entry.builder),
                          ),
                      ],
                      const Divider(height: 24),
                      ListTile(
                        dense: true,
                        leading: const Icon(
                          Icons.settings_outlined,
                          size: 21,
                          color: AppColors.textSecondary,
                        ),
                        title: const Text(
                          'Ayarlar',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        onTap: () => _open((_) => const SettingsScreen()),
                      ),
                      ListTile(
                        dense: true,
                        leading: const Icon(
                          Icons.logout_rounded,
                          size: 21,
                          color: AppColors.danger500,
                        ),
                        title: const Text(
                          'Çıkış Yap',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.danger500,
                          ),
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          context.read<AuthProvider>().logout();
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
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
