import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../theme/app_colors.dart';

/// web/src/app/sifremi-unuttum/page.tsx ile aynı akış — kullanıcı var/yok
/// fark etmeksizin aynı başarı mesajı gösterilir (email enumeration'ı
/// önlemek için). Gerçek sıfırlama bir sonraki adım — e-postadaki bağlantı
/// web panelinin /sifre-sifirla sayfasını açar (mobilde deep link YOK,
/// bu kasıtlı: token'lı bir web linki her platformdan açılabilir).
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiClient.instance.post(
        '/auth/forgot-password',
        body: {'email': _emailController.text.trim()},
      );
      setState(() => _sent = true);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'İstek gönderilemedi',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: const Text('Şifremi Unuttum')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _sent
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.mark_email_read_outlined,
                      size: 48,
                      color: AppColors.primary600,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Bu e-posta adresi sistemde kayıtlıysa, şifrenizi '
                      'sıfırlamak için bir bağlantı gönderildi. Gelen '
                      'kutunuzu kontrol edin.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Hesabınıza kayıtlı e-posta adresini girin, size bir '
                      'sıfırlama bağlantısı gönderelim.',
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 20),
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'E-posta'),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: AppColors.danger500, fontSize: 12.5)),
                    ],
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      child: Text(_loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
