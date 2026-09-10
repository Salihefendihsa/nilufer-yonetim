import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

/// Stitch Müdür → Ayarlar.
///
/// Müdürün gerçekten yetkili olduğu tek ayar grubu kendi bildirim
/// tercihleridir (`/notification-preferences`, tüm rollere açık). Firma
/// bilgileri, hizmet türleri, bölgeler, yedekleme ve aylık hedefler
/// `/settings` altındadır ve backend'de OWNER'a kısıtlıdır
/// (backend/src/routes/settings.ts) — bu ekran onları düzenlenebilir gibi
/// GÖSTERMEZ, yalnızca kimin yönettiğini bilgilendirir. Stitch tasarımı da
/// bu satırı içerdiği için ek bir yetki çelişkisi yoktur.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;
  bool _emailEnabled = false;
  bool _dailyDigestEnabled = false;

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
      final data = await ApiClient.instance.get<Map<String, dynamic>>(
        '/notification-preferences',
      );
      if (!mounted) return;
      setState(() {
        _emailEnabled = data['emailEnabled'] == true;
        _dailyDigestEnabled = data['dailyDigestEnabled'] == true;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _update(String field, bool value) async {
    final previousEmail = _emailEnabled;
    final previousDigest = _dailyDigestEnabled;
    setState(() {
      _saving = true;
      if (field == 'emailEnabled') {
        _emailEnabled = value;
      } else {
        _dailyDigestEnabled = value;
      }
    });
    try {
      await ApiClient.instance.patch<Map<String, dynamic>>(
        '/notification-preferences',
        body: {field: value},
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      // Başarısız olursa iyimser güncelleme geri alınır.
      setState(() {
        _emailEnabled = previousEmail;
        _dailyDigestEnabled = previousDigest;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: const Text('Ayarlar')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _Card(
                  title: 'Profil',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _row('Ad Soyad', user?.fullName ?? '—'),
                      _row('E-posta', user?.email ?? '—'),
                      _row(
                        'Rol',
                        user != null ? roleLabelTr(user.role) : '—',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _Card(
                  title: 'Bildirim Tercihleri',
                  child: Column(
                    children: [
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _emailEnabled,
                        onChanged: _saving
                            ? null
                            : (v) => _update('emailEnabled', v),
                        title: const Text('E-posta bildirimleri'),
                        subtitle: const Text(
                          'Size ait bildirimler e-posta olarak da gönderilsin.',
                        ),
                        activeThumbColor: AppColors.primary600,
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _dailyDigestEnabled,
                        onChanged: _saving
                            ? null
                            : (v) => _update('dailyDigestEnabled', v),
                        title: const Text('Günlük özet'),
                        subtitle: const Text(
                          'Her sabah günün işlerini özetleyen e-posta.',
                        ),
                        activeThumbColor: AppColors.primary600,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSubtle,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(color: AppColors.borderDefault),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.info_outline_rounded,
                        size: 18,
                        color: AppColors.textSecondary,
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Firma bilgileri, hizmet türleri, bölgeler, aylık hedefler '
                          've yedekleme gibi diğer sistem ayarları yalnızca işletme '
                          'sahibi tarafından yönetilebilir.',
                          style: TextStyle(
                            fontSize: 12.5,
                            height: 1.45,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            color: AppColors.textSecondary,
          ),
        ),
        const Spacer(),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ],
    ),
  );
}

class _Card extends StatelessWidget {
  final String title;
  final Widget child;
  const _Card({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}
