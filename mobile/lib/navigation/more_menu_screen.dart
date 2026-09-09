import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../features/admin/audit_settings_screen.dart';
import '../features/contracts/contracts_list_screen.dart';
import '../features/customers/customers_list_screen.dart';
import '../features/finance/finance_screen.dart';
import '../features/performance/performance_screen.dart';
import '../features/quotes/quotes_list_screen.dart';
import '../features/reports/reports_screen.dart';
import '../features/staff/staff_list_screen.dart';
import '../features/calendar/calendar_screen.dart';
import '../features/stock/stock_list_screen.dart';
import '../models/user.dart';
import '../theme/app_colors.dart';

class _MoreItem {
  final String label;
  final IconData icon;
  final WidgetBuilder builder;
  const _MoreItem(this.label, this.icon, this.builder);
}

/// OWNER/MANAGER için alt navigasyonda sabit sekmesi olmayan modüllerin
/// listesi. "Denetim & Ayarlar" backend'de yalnızca OWNER'a açık olduğu
/// için (routes/auditLogs.ts, settings.ts) MANAGER'a bu menüde hiç
/// gösterilmez — mevcut backend kısıtı Flutter'da da yansıtılır.
class MoreMenuScreen extends StatelessWidget {
  const MoreMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isOwner = context.watch<AuthProvider>().user?.role == AppRole.owner;

    final items = <_MoreItem>[
      _MoreItem(
        'Müşteriler',
        Icons.people_outline_rounded,
        (_) => const CustomersListScreen(),
      ),
      _MoreItem(
        'Personel',
        Icons.groups_outlined,
        (_) => const StaffListScreen(),
      ),
      _MoreItem(
        'Takvim',
        Icons.calendar_month_outlined,
        (_) => const CalendarScreen(),
      ),
      _MoreItem(
        'Stok',
        Icons.inventory_2_outlined,
        (_) => const StockListScreen(),
      ),
      _MoreItem(
        'Teklifler',
        Icons.request_quote_outlined,
        (_) => const QuotesListScreen(),
      ),
      _MoreItem(
        'Sözleşmeler',
        Icons.description_outlined,
        (_) => const ContractsListScreen(),
      ),
      _MoreItem(
        'Para & Finans',
        Icons.payments_outlined,
        (_) => const FinanceScreen(),
      ),
      _MoreItem(
        'Performans',
        Icons.emoji_events_outlined,
        (_) => const PerformanceScreen(),
      ),
      _MoreItem(
        'Raporlar',
        Icons.bar_chart_rounded,
        (_) => const ReportsScreen(),
      ),
      if (isOwner)
        _MoreItem(
          'Denetim & Ayarlar',
          Icons.admin_panel_settings_outlined,
          (_) => const AuditSettingsScreen(),
        ),
    ];

    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: const Text('Diğer Modüller')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final item = items[i];
          return Material(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(14),
            child: ListTile(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: AppColors.borderDefault),
              ),
              leading: Icon(item.icon, color: AppColors.primary700),
              title: Text(
                item.label,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              trailing: const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textFaint,
              ),
              onTap: () =>
                  Navigator.of(context)
                      .push(MaterialPageRoute(builder: item.builder)),
            ),
          );
        },
      ),
    );
  }
}
