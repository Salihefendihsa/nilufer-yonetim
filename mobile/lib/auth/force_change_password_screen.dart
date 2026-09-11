import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../theme/app_colors.dart';
import 'auth_provider.dart';

/// web/src/app/sifre-degistir-zorunlu/page.tsx ile aynı akış — OWNER birinin
/// şifresini sıfırladığında (User.mustChangePassword=true) bu ekran hiçbir
/// başka sayfaya geçit vermeden zorunlu olarak gösterilir (bkz. main.dart:
/// _AuthGate). Backend zaten /auth/me, /auth/logout, /auth/change-password
/// dışındaki her uca 403 döner (bkz. middleware/auth.ts) — bu yalnızca
/// istemci tarafı rahatlık katmanı.
class ForceChangePasswordScreen extends StatefulWidget {
  const ForceChangePasswordScreen({super.key});

  @override
  State<ForceChangePasswordScreen> createState() =>
      _ForceChangePasswordScreenState();
}

class _ForceChangePasswordScreenState
    extends State<ForceChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit(AuthProvider auth) async {
    setState(() => _error = null);
    if (_newController.text != _confirmController.text) {
      setState(() => _error = 'Şifreler eşleşmiyor');
      return;
    }
    if (_newController.text.length < 8) {
      setState(() => _error = 'Şifre en az 8 karakter olmalıdır');
      return;
    }
    final ok = await auth.changePassword(
      currentPassword: _currentController.text,
      newPassword: _newController.text,
    );
    if (!ok && mounted) {
      setState(() => _error = auth.loginError ?? 'Şifre değiştirilemedi');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.shield_outlined,
                  size: 48,
                  color: AppColors.warning600,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Şifrenizi Değiştirin',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Hesabınızın şifresi bir yönetici tarafından sıfırlandı. '
                  'Devam etmeden önce yeni bir şifre belirlemeniz gerekiyor.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _currentController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Geçici Şifre'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _newController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Yeni Şifre'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _confirmController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Yeni Şifre (Tekrar)',
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(color: AppColors.danger500, fontSize: 12.5),
                  ),
                ],
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: auth.isBusy ? null : () => _submit(auth),
                  child: Text(
                    auth.isBusy ? 'Kaydediliyor...' : 'Şifreyi Değiştir ve Devam Et',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
