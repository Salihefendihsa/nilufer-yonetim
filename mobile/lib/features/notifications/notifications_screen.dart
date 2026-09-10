import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/app_notification.dart';
import '../../models/paginated.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../navigation/manager_nav.dart';
import '../../widgets/state_views.dart';
import '../../widgets/stat_card.dart';
import '../stock/stock_api.dart';
import '../jobs/jobs_list_screen.dart';
import '../messages/messages_list_screen.dart';
import '../quotes/quotes_list_screen.dart';
import '../stock/stock_list_screen.dart';
import 'notifications_api.dart';

final _dateFormat = DateFormat('d MMMM, HH:mm', 'tr_TR');

/// web/src/lib/notifications.ts: NOTIFICATION_CATEGORIES — aynı sıra/etiket/renk.
const List<({String key, String label, Color color})> _categoryOrder = [
  (key: 'job', label: 'İşler', color: AppColors.primary500),
  (key: 'payment', label: 'Ödemeler', color: AppColors.info500),
  (key: 'message', label: 'Mesajlar', color: AppColors.success500),
  (key: 'alert', label: 'Uyarılar', color: AppColors.warning500),
  (key: 'other', label: 'Diğer', color: AppColors.textFaint),
];

/// Bildirime dokununca ilgili ekrana yönlendirir (backend/src/lib/notify.ts:
/// NotificationLink ile birebir relatedType eşlemesi — web/src/lib/
/// notifications.ts:getNotificationHref ile aynı mantık, Flutter'da ekran
/// olarak). Hedef ekranın kendi API çağrısı kendi yetki/kapsam kontrolünü
/// zaten uyguluyor; burada ekstra bir kontrol EKLENMEDİ.
Widget? _screenForRelatedType(String? relatedType) {
  switch (relatedType) {
    case 'Job':
      return const JobsListScreen();
    case 'Product':
      return const StockListScreen();
    case 'AdvanceRequest':
    case 'QuoteRequest':
      return const QuotesListScreen();
    case 'Conversation':
      return const MessagesListScreen();
    default:
      return null;
  }
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = NotificationsApi();
  List<AppNotification> _notifications = [];
  NotificationSummary? _summary;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([_api.list(), _api.summary()]);
      setState(() {
        _notifications = (results[0] as Paginated<AppNotification>).data;
        _summary = results[1] as NotificationSummary;
      });
    } catch (e) {
      setState(
        () =>
            _error = e is ApiException ? e.message : 'Bildirimler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  /// Stok takviye talebi açma yetkisi — backend:
  /// POST /products/:id/purchase-requests → OWNER, MANAGER, TEAM_LEAD.
  /// Talebin sonuçlandırılması (mal kabul/iptal) OWNER/MANAGER'da kalır.
  bool get _canRequestPurchase {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner ||
        role == AppRole.manager ||
        role == AppRole.teamLead;
  }

  /// Stok uyarısı bildirimi üzerinden doğrudan takviye talebi açar
  /// (Stitch Şef → Bildirimler: "Talep Oluştur").
  Future<void> _requestPurchase(AppNotification n) async {
    final productId = n.relatedId;
    if (productId == null) return;

    final quantityController = TextEditingController();
    final noteController = TextEditingController();
    final quantity = await showModalBottomSheet<double>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 20,
          right: 20,
          top: 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Stok Takviye Talebi',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Text(
              n.body ?? '',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Talebi yönetim sonuçlandırır; stok mal kabulünde artar.',
              style: TextStyle(fontSize: 11.5, color: AppColors.textFaint),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: quantityController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'Talep miktarı'),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteController,
              decoration: const InputDecoration(labelText: 'Not (opsiyonel)'),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(
                ctx,
              ).pop(double.tryParse(quantityController.text.trim())),
              child: const Text('Talep Oluştur'),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (quantity == null || quantity <= 0) return;

    try {
      await StockApi().createPurchaseRequest(
        productId,
        quantity,
        note: noteController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Takviye talebi oluşturuldu')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Talep oluşturulamadı',
            ),
          ),
        );
      }
    }
  }

  Future<void> _onTap(AppNotification n) async {
    if (n.readAt == null) {
      try {
        await _api.markRead(n.id);
        setState(() {
          _notifications = _notifications
              .map((x) => x.id == n.id ? _withRead(x) : x)
              .toList();
          final s = _summary;
          if (s != null) {
            _summary = NotificationSummary(
              total: s.total,
              unread: (s.unread - 1).clamp(0, s.total),
              today: s.today,
              byCategory: s.byCategory,
            );
          }
        });
      } catch (_) {}
    }
    final screen = _screenForRelatedType(n.relatedType);
    if (screen != null && mounted) {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    }
  }

  AppNotification _withRead(AppNotification n) => AppNotification(
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    relatedType: n.relatedType,
    relatedId: n.relatedId,
    readAt: DateTime.now().toIso8601String(),
    createdAt: n.createdAt,
  );

  Future<void> _markAllRead() async {
    try {
      await _api.markAllRead();
      _load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'İşlem başarısız'),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        leading: ManagerNav.maybeLeading(context),
        title: const Text('Bildirimler'),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all_rounded),
            onPressed: _markAllRead,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  /// web/src/app/(dashboard)/bildirimler/page.tsx: özet kartlar (Toplam/
  /// Okunmamış/Bugün) + "Tip Dağılımı" — backend'in kendi `byCategory`
  /// hesaplamasından (bkz. notifications_api.dart:summary()), ek bir
  /// istemci-taraflı türetme YAPILMAZ.
  Widget _buildSummary() {
    final s = _summary;
    if (s == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatCardGrid(
            crossAxisCount: 3,
            children: [
              AppStatCard(
                label: 'Toplam',
                value: '${s.total}',
                icon: Icons.notifications_outlined,
              ),
              AppStatCard(
                label: 'Okunmamış',
                value: '${s.unread}',
                icon: Icons.mark_email_unread_outlined,
                iconColor: AppColors.danger500,
                iconBackground: AppColors.danger50,
              ),
              AppStatCard(
                label: 'Bugün',
                value: '${s.today}',
                icon: Icons.today_rounded,
                iconColor: AppColors.info600,
                iconBackground: AppColors.info50,
              ),
            ],
          ),
          if (s.total > 0) ...[
            const SizedBox(height: 14),
            const Text(
              'Tip Dağılımı',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
            ),
            const SizedBox(height: 8),
            for (final c in _categoryOrder)
              if ((s.byCategory[c.key] ?? 0) > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 70,
                        child: Text(
                          c.label,
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: (s.byCategory[c.key] ?? 0) / s.total,
                            minHeight: 8,
                            backgroundColor: AppColors.surfaceMuted,
                            color: c.color,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 24,
                        child: Text(
                          '${s.byCategory[c.key] ?? 0}',
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_notifications.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary600,
        child: ListView(
          children: [
            _buildSummary(),
            const EmptyStateView(
              title: 'Bildirim yok',
              icon: Icons.notifications_none_rounded,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
      child: ListView.separated(
        itemCount: _notifications.length + 1,
        separatorBuilder: (_, i) => i == 0 ? const SizedBox.shrink() : const Divider(height: 1),
        itemBuilder: (context, index) {
          if (index == 0) return _buildSummary();
          final i = index - 1;
          final n = _notifications[i];
          final unread = n.readAt == null;
          final linked = _screenForRelatedType(n.relatedType) != null;
          return ListTile(
            leading: Icon(
              unread ? Icons.circle : Icons.circle_outlined,
              size: 10,
              color: unread ? AppColors.primary600 : AppColors.textFaint,
            ),
            title: Text(
              n.title,
              style: TextStyle(
                fontWeight: unread ? FontWeight.w800 : FontWeight.w600,
                fontSize: 13.5,
              ),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (n.body != null)
                  Text(
                    n.body!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5),
                  ),
                Text(
                  _dateFormat.format(DateTime.parse(n.createdAt)),
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textFaint,
                  ),
                ),
              ],
            ),
            trailing: n.relatedType == 'Product' && _canRequestPurchase
                // Stok uyarısında doğrudan takviye talebi açılabilir.
                ? TextButton.icon(
                    onPressed: () => _requestPurchase(n),
                    icon: const Icon(Icons.shopping_cart_outlined, size: 15),
                    label: const Text(
                      'Talep Oluştur',
                      style: TextStyle(fontSize: 11.5),
                    ),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      minimumSize: const Size(0, 0),
                      visualDensity: VisualDensity.compact,
                    ),
                  )
                : linked
                ? const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textFaint,
                  )
                : null,
            onTap: () => _onTap(n),
          );
        },
      ),
    );
  }
}
