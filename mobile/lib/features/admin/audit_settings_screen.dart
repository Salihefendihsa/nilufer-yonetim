import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

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
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(
        title: const Text('Denetim & Ayarlar'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary700,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary600,
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

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_logs.isEmpty)
      return const EmptyStateView(
        title: 'Log kaydı yok',
        icon: Icons.history_rounded,
      );

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _logs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final log = _logs[i];
          final actor =
              (log['actor'] as Map<String, dynamic>?)?['fullName'] as String? ??
              'Bilinmiyor';
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderDefault),
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
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Text(
                      _dateFormat.format(
                        DateTime.parse(log['createdAt'] as String),
                      ),
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: AppColors.textFaint,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Aktör: $actor',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                if (log['detail'] != null)
                  Text(
                    log['detail'] as String,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.textFaint,
                    ),
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
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_settings.isEmpty)
      return const EmptyStateView(
        title: 'Ayar bulunamadı',
        icon: Icons.settings_outlined,
      );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: _settings.entries.map((e) {
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
                onPressed: _saving ? null : () => _save(e.key, controller.text),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
