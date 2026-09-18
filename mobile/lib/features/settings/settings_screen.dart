import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/theme_controller.dart';
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
  /// Bölüm AF (7. tur): haftalık yönetici özeti (OWNER).
  bool _weeklyDigestEnabled = true;

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
        _weeklyDigestEnabled = data['weeklyDigestEnabled'] != false;
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
    final previousWeekly = _weeklyDigestEnabled;
    setState(() {
      _saving = true;
      if (field == 'emailEnabled') {
        _emailEnabled = value;
      } else if (field == 'weeklyDigestEnabled') {
        _weeklyDigestEnabled = value;
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
        _weeklyDigestEnabled = previousWeekly;
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
                const _ThemeCard(),
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
                      // Bölüm AF (7. tur): haftalık yönetici özeti (yalnızca OWNER'a gönderilir).
                      if (user?.role == AppRole.owner)
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _weeklyDigestEnabled,
                          onChanged: _saving
                              ? null
                              : (v) => _update('weeklyDigestEnabled', v),
                          title: const Text('Haftalık özet e-postası'),
                          subtitle: const Text(
                            'Her Pazartesi 08:00 — geçen haftanın yönetici özeti.',
                          ),
                          activeThumbColor: AppColors.primary600,
                        ),
                    ],
                  ),
                ),
                if (user?.role == AppRole.owner || user?.role == AppRole.manager) ...[
                  const SizedBox(height: 12),
                  const _TwoFactorCard(),
                ],
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

/// TOTP tabanlı 2FA — yalnızca OWNER/MANAGER (backend/src/routes/auth.ts).
/// Backend QR kodu hazır bir PNG data URL olarak döndürdüğü için mobilde
/// ek bir QR paketi gerekmez (`qrcode` npm paketi ile üretilir).
class _TwoFactorCard extends StatefulWidget {
  const _TwoFactorCard();

  @override
  State<_TwoFactorCard> createState() => _TwoFactorCardState();
}

class _TwoFactorCardState extends State<_TwoFactorCard> {
  bool _loading = true;
  bool? _enabled;
  String? _error;
  bool _busy = false;

  String? _secret;
  String? _qrCodeDataUrl;
  final _codeController = TextEditingController();
  List<String>? _recoveryCodes;

  final _passwordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _codeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final me = await ApiClient.instance.get<Map<String, dynamic>>('/auth/me');
      if (!mounted) return;
      setState(() {
        _enabled = me['twoFactorEnabled'] == true;
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

  Future<void> _startSetup() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.post<Map<String, dynamic>>('/auth/2fa/setup');
      if (!mounted) return;
      setState(() {
        _secret = res['secret'] as String;
        _qrCodeDataUrl = res['qrCodeDataUrl'] as String;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _enable() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.post<Map<String, dynamic>>(
        '/auth/2fa/enable',
        body: {'code': _codeController.text.trim()},
      );
      if (!mounted) return;
      setState(() {
        _recoveryCodes = (res['recoveryCodes'] as List).cast<String>();
        _secret = null;
        _qrCodeDataUrl = null;
        _codeController.clear();
        _enabled = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _disable() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiClient.instance.post<Map<String, dynamic>>(
        '/auth/2fa/disable',
        body: {'currentPassword': _passwordController.text},
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      setState(() {
        _enabled = false;
        _passwordController.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('İki adımlı doğrulama devre dışı bırakıldı.')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openDisableSheet() {
    _passwordController.clear();
    setState(() => _error = null);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: StatefulBuilder(
          builder: (ctx, setSheetState) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Devam etmek için mevcut şifrenizi girin.',
                style: TextStyle(fontSize: 13.5, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mevcut şifre'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: AppColors.danger500, fontSize: 12.5)),
              ],
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _busy
                    ? null
                    : () async {
                        await _disable();
                        setSheetState(() {});
                      },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger500),
                child: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Devre Dışı Bırak'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const _Card(title: 'İki Adımlı Doğrulama', child: LoadingView());
    }

    return _Card(
      title: 'İki Adımlı Doğrulama',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null && _recoveryCodes == null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(_error!, style: const TextStyle(color: AppColors.danger500, fontSize: 12.5)),
            ),
          if (_recoveryCodes != null) ...[
            const Text(
              'Kurtarma Kodlarınız — bir daha gösterilmeyecek',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
            const SizedBox(height: 6),
            const Text(
              'Authenticator cihazınıza erişemediğinizde bu kodlardan birini kullanabilirsiniz.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _recoveryCodes!
                  .map(
                    (c) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(c, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => setState(() => _recoveryCodes = null),
              child: const Text('Kaydettim, kapat'),
            ),
          ] else if (_secret != null) ...[
            const Text(
              'Authenticator uygulamanızla QR kodu okutun veya sırrı manuel girin, ardından 6 haneli kodu yazın.',
              style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            Center(
              child: Image.memory(
                base64Decode(_qrCodeDataUrl!.split(',').last),
                width: 160,
                height: 160,
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: SelectableText(
                _secret!,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12.5),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _codeController,
              textAlign: TextAlign.center,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '6 haneli kod'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() {
                      _secret = null;
                      _qrCodeDataUrl = null;
                    }),
                    child: const Text('Vazgeç'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _busy ? null : _enable,
                    child: _busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Etkinleştir'),
                  ),
                ),
              ],
            ),
          ] else ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    _enabled == true
                        ? 'Girişte authenticator uygulamanızdan bir kod istenir.'
                        : 'Girişte şifrenize ek olarak bir doğrulama kodu istensin.',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _enabled == true ? AppColors.primary50 : AppColors.surfaceSubtle,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    _enabled == true ? 'Etkin' : 'Devre dışı',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: _enabled == true ? AppColors.primary600 : AppColors.textFaint,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_enabled == true)
              OutlinedButton(
                onPressed: _openDisableSheet,
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger500),
                child: const Text('Devre Dışı Bırak'),
              )
            else
              ElevatedButton(
                onPressed: _busy ? null : _startSetup,
                child: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Kurulumu Başlat'),
              ),
          ],
        ],
      ),
    );
  }
}

/// Bölüm D (2. tur): açık/koyu/sistem — bkz. theme/theme_controller.dart.
class _ThemeCard extends StatelessWidget {
  const _ThemeCard();

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<ThemeController>();
    final options = <(ThemeMode, String, IconData)>[
      (ThemeMode.light, 'Açık', Icons.light_mode_outlined),
      (ThemeMode.dark, 'Koyu', Icons.dark_mode_outlined),
      (ThemeMode.system, 'Sistem', Icons.smartphone_outlined),
    ];
    return _Card(
      title: 'Görünüm',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final (mode, label, icon) in options)
            ChoiceChip(
              label: Text(label),
              avatar: Icon(icon, size: 16),
              selected: controller.mode == mode,
              onSelected: (_) => context.read<ThemeController>().setMode(mode),
              selectedColor: AppColors.primary600,
              labelStyle: TextStyle(
                color: controller.mode == mode ? Colors.white : AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }
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
