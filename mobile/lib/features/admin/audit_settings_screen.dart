import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';
import '../../widgets/stat_card.dart';
import '../customers/customer_tags.dart';
import 'data_deletion_screens.dart';
import 'job_templates_screen.dart';
import 'named_list_settings_screen.dart';

final _dateFormat = DateFormat('d MMM yyyy, HH:mm', 'tr_TR');

/// backend/src/routes/auditLogs.ts, settings.ts: ikisi de yalnızca OWNER.
/// Bu ekran role_shell.dart'ta yalnızca OWNER navigasyonunda görünür
/// (MANAGER dahi buraya erişemez — mevcut backend kısıtı korunuyor).
class AuditSettingsScreen extends StatefulWidget {
  const AuditSettingsScreen({super.key});

  @override
  State<AuditSettingsScreen> createState() => _AuditSettingsScreenState();
}

class _AuditSettingsScreenState extends State<AuditSettingsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Denetim & Ayarlar'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: cs.primary700,
          unselectedLabelColor: cs.textSecondary,
          indicatorColor: cs.primary600,
          tabs: const [
            Tab(text: 'Denetim Logları'),
            Tab(text: 'Ayarlar'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [_AuditLogTab(), _SettingsTab()],
      ),
    );
  }
}

class _AuditLogTab extends StatefulWidget {
  const _AuditLogTab();

  @override
  State<_AuditLogTab> createState() => _AuditLogTabState();
}

class _AuditLogTabState extends State<_AuditLogTab> {
  List<Map<String, dynamic>> _logs = [];
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
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/audit-logs',
        query: {'limit': 50},
      );
      setState(
        () => _logs = (json['data'] as List).cast<Map<String, dynamic>>(),
      );
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Loglar yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  /// web/src/app/(dashboard)/loglar/page.tsx: özet kartlar + "En Aktif
  /// Kullanıcılar" + "İşlem Türü Dağılımı" — hepsi filtreden bağımsız,
  /// istemcide zaten çekilen `_logs` kümesinden türetilir (web'de de aynı
  /// desen, backend'de ayrı bir özet ucu yok).
  Widget _buildLogSummary() {
    final cs = context.colors;
    final tx = context.text;
    final startOfToday = DateTime.now();
    final todayStart = DateTime(
      startOfToday.year,
      startOfToday.month,
      startOfToday.day,
    );
    final weekAgo = DateTime.now().subtract(const Duration(days: 7));

    final todayCount = _logs
        .where(
          (l) => DateTime.parse(l['createdAt'] as String).isAfter(todayStart),
        )
        .length;
    final weekCount = _logs
        .where((l) => DateTime.parse(l['createdAt'] as String).isAfter(weekAgo))
        .length;
    final actorCount = _logs
        .map(
          (l) =>
              (l['actor'] as Map<String, dynamic>?)?['id'] ?? l['actorUserId'],
        )
        .toSet()
        .length;

    final actorCounts = <String, int>{};
    for (final l in _logs) {
      final name =
          (l['actor'] as Map<String, dynamic>?)?['fullName'] as String? ??
          'Bilinmiyor';
      actorCounts[name] = (actorCounts[name] ?? 0) + 1;
    }
    final topActors = actorCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    final actionCounts = <String, int>{};
    for (final l in _logs) {
      final action = l['action'] as String;
      actionCounts[action] = (actionCounts[action] ?? 0) + 1;
    }
    final topActions = actionCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatCardGrid(
            children: [
              AppStatCard(
                label: 'Toplam Kayıt',
                value: '${_logs.length}',
                icon: Icons.history_rounded,
              ),
              AppStatCard(
                label: 'Bugün',
                value: '$todayCount',
                icon: Icons.today_rounded,
                iconColor: cs.info600,
                iconBackground: cs.info50,
              ),
              AppStatCard(
                label: 'Son 7 Gün',
                value: '$weekCount',
                icon: Icons.date_range_rounded,
                iconColor: cs.success600,
                iconBackground: cs.success50,
              ),
              AppStatCard(
                label: 'Farklı Kullanıcı',
                value: '$actorCount',
                icon: Icons.people_outline_rounded,
                iconColor: cs.warning600,
                iconBackground: cs.warning50,
              ),
            ],
          ),
          if (topActors.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'En Aktif Kullanıcılar',
              style: tx.body.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            ..._logBars(
              topActors.take(8).map((e) => (label: e.key, count: e.value)),
            ),
          ],
          if (topActions.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'İşlem Türü Dağılımı',
              style: tx.body.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            ..._logBars(
              topActions.take(6).map((e) => (label: e.key, count: e.value)),
            ),
          ],
          const SizedBox(height: 16),
          Text(
            'Son Kayıtlar',
            style: tx.body.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  List<Widget> _logBars(Iterable<({String label, int count})> rows) {
    final cs = context.colors;
    final tx = context.text;
    final list = rows.toList();
    final maxCount = list.fold(0, (m, r) => r.count > m ? r.count : m);
    return list
        .map(
          (r) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                SizedBox(
                  width: 110,
                  child: Text(
                    r.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: tx.caption,
                  ),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    child: LinearProgressIndicator(
                      value: maxCount == 0 ? 0 : r.count / maxCount,
                      minHeight: 8,
                      backgroundColor: cs.surfaceMuted,
                      color: cs.primary500,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 24,
                  child: Text(
                    '${r.count}',
                    textAlign: TextAlign.right,
                    style: tx.caption.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_logs.isEmpty)
      return const EmptyStateView(
        title: 'Log kaydı yok',
        icon: Icons.history_rounded,
      );

    return RefreshIndicator(
      onRefresh: _load,
      color: cs.accentSoft,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _logs.length + 1,
        separatorBuilder: (_, i) =>
            i == 0 ? const SizedBox.shrink() : const SizedBox(height: 8),
        itemBuilder: (context, index) {
          if (index == 0) return _buildLogSummary();
          final i = index - 1;
          final log = _logs[i];
          final actor =
              (log['actor'] as Map<String, dynamic>?)?['fullName'] as String? ??
              'Bilinmiyor';
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: cs.surfaceCard,
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: cs.borderDefault),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        log['action'] as String,
                        style: tx.bodySmall.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      _dateFormat.format(
                        DateTime.parse(log['createdAt'] as String),
                      ),
                      style: tx.label,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Aktör: $actor', style: tx.caption),
                if (log['detail'] != null)
                  Text(
                    log['detail'] as String,
                    style: tx.caption.copyWith(color: cs.textFaint),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SettingsTab extends StatefulWidget {
  const _SettingsTab();

  @override
  State<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<_SettingsTab> {
  Map<String, String> _settings = {};
  bool _loading = true;
  String? _error;
  bool _saving = false;

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
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/settings',
      );
      setState(
        () => _settings = (json['data'] as Map<String, dynamic>).map(
          (k, v) => MapEntry(k, v as String),
        ),
      );
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Ayarlar yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _save(String key, String value) async {
    setState(() => _saving = true);
    try {
      await ApiClient.instance.patch('/settings', body: {key: value});
      _load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Kaydedilemedi'),
          ),
        );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // web/src/app/(dashboard)/ayarlar/page.tsx: ServiceTypesSection +
        // DistrictsSection — mobilde daha önce hiç yoktu.
        Material(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          child: ListTile(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: BorderSide(color: cs.borderDefault),
            ),
            leading: Icon(Icons.dashboard_customize_outlined, color: cs.accent),
            title: const Text('Veri Silme Talepleri (KVKK)'),
            subtitle: Text(
              'Bölüm AD: onay geri alınamaz — anonimleştirme',
              style: tx.caption,
            ),
            trailing: Icon(Icons.chevron_right_rounded, color: cs.textFaint),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const DataDeletionRequestsScreen(),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          child: ListTile(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: BorderSide(color: cs.borderDefault),
            ),
            leading: Icon(Icons.label_outline_rounded, color: cs.accent),
            title: const Text('Müşteri Etiketleri'),
            subtitle: Text(
              'Bölüm X: VIP / Kurumsal / Konut segmentleri',
              style: tx.caption,
            ),
            trailing: Icon(Icons.chevron_right_rounded, color: cs.textFaint),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CustomerTagsScreen()),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          child: ListTile(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: BorderSide(color: cs.borderDefault),
            ),
            leading: Icon(Icons.dashboard_customize_outlined, color: cs.accent),
            title: const Text('İş Şablonları'),
            subtitle: Text(
              'Bölüm T: iş formunda "Şablondan Doldur"',
              style: tx.caption,
            ),
            trailing: Icon(Icons.chevron_right_rounded, color: cs.textFaint),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const JobTemplatesScreen()),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          child: ListTile(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: BorderSide(color: cs.borderDefault),
            ),
            leading: Icon(Icons.auto_awesome_outlined, color: cs.accent),
            title: const Text('Hizmet Türleri'),
            trailing: Icon(Icons.chevron_right_rounded, color: cs.textFaint),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const NamedListSettingsScreen(
                  title: 'Hizmet Türleri',
                  description:
                      'Yeni iş oluşturulurken seçilebilecek hizmet türleri.',
                  endpoint: '/service-types',
                  addHint: 'Yeni hizmet türü adı',
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          child: ListTile(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: BorderSide(color: cs.borderDefault),
            ),
            leading: Icon(Icons.map_outlined, color: cs.accent),
            title: const Text('Semtler'),
            trailing: Icon(Icons.chevron_right_rounded, color: cs.textFaint),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const NamedListSettingsScreen(
                  title: 'Semtler',
                  description:
                      'Müşteri/iş formlarında seçilebilecek semt listesi.',
                  endpoint: '/districts',
                  addHint: 'Yeni semt adı',
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: cs.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          child: ListTile(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: BorderSide(color: cs.borderDefault),
            ),
            leading: Icon(Icons.checklist_rtl_outlined, color: cs.accent),
            title: const Text('Değerlendirme Kriterleri'),
            trailing: Icon(Icons.chevron_right_rounded, color: cs.textFaint),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const NamedListSettingsScreen(
                  title: 'Değerlendirme Kriterleri',
                  description: 'Personel değerlendirme formunda kullanılacak kriterler (1-20 arası puanlanır).',
                  endpoint: '/evaluation-criteria',
                  addHint: 'Yeni kriter adı',
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        if (_settings.isEmpty)
          Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'Başka ayar bulunamadı.',
              style: tx.body.copyWith(color: cs.textFaint),
            ),
          )
        else ...[
          Text(
            'Diğer Ayarlar',
            style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          ..._settings.entries.map((e) {
            final controller = TextEditingController(text: e.value);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: controller,
                      decoration: InputDecoration(labelText: e.key),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.save_outlined),
                    onPressed: _saving
                        ? null
                        : () => _save(e.key, controller.text),
                  ),
                ],
              ),
            );
          }),
        ],
      ],
    );
  }
}
