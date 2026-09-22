import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../theme/app_colors.dart';
import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';
import 'auth_provider.dart';

class TwoFactorVerifyScreen extends StatefulWidget {
  const TwoFactorVerifyScreen({super.key});

  @override
  State<TwoFactorVerifyScreen> createState() => _TwoFactorVerifyScreenState();
}

class _TwoFactorVerifyScreenState extends State<TwoFactorVerifyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  bool _useRecoveryCode = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final value = _codeController.text.trim();
    await auth.verifyTwoFactor(
      code: _useRecoveryCode ? null : value,
      recoveryCode: _useRecoveryCode ? value : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: cs.primary700,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: Colors.white,
                      size: 36,
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Bölüm R (4. tur): ilerleme göstergesi — 2/2 (Hesap → Doğrulama).
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 5,
                          decoration: BoxDecoration(
                            color: cs.primary600,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Container(
                          height: 5,
                          decoration: BoxDecoration(
                            color: cs.primary600,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        '2/2 · Doğrulama',
                        style: tx.caption.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'İki Adımlı Doğrulama',
                    textAlign: TextAlign.center,
                    style: tx.display.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _useRecoveryCode
                        ? 'Kurtarma kodlarınızdan birini girin.'
                        : 'Authenticator uygulamanızdaki 6 haneli kodu girin.',
                    textAlign: TextAlign.center,
                    style: tx.body.copyWith(color: cs.textSecondary),
                  ),
                  const SizedBox(height: 28),
                  TextFormField(
                    controller: _codeController,
                    autofocus: true,
                    textAlign: TextAlign.center,
                    keyboardType: _useRecoveryCode
                        ? TextInputType.text
                        : TextInputType.number,
                    style: tx.title.copyWith(
                      fontFeatures: [FontFeature.tabularFigures()],
                      letterSpacing: 3,
                    ),
                    decoration: InputDecoration(
                      labelText: _useRecoveryCode
                          ? 'Kurtarma Kodu'
                          : 'Doğrulama Kodu',
                      hintText: _useRecoveryCode ? 'XXXXX-XXXXX' : '123456',
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Kod gerekli' : null,
                    onFieldSubmitted: (_) => _submit(),
                  ),
                  if (auth.loginError != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: cs.danger50,
                        borderRadius: BorderRadius.circular(AppRadius.chip),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.error_outline_rounded,
                            color: cs.danger500,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              auth.loginError!,
                              style: tx.bodySmall.copyWith(color: cs.danger600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: auth.isBusy ? null : _submit,
                    child: auth.isBusy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Doğrula'),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () {
                      setState(() => _useRecoveryCode = !_useRecoveryCode);
                      _codeController.clear();
                    },
                    child: Text(
                      _useRecoveryCode
                          ? 'Authenticator kodu kullan'
                          : 'Kurtarma kodu kullan',
                      style: tx.bodySmall,
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        context.read<AuthProvider>().cancelTwoFactor(),
                    child: Text(
                      'Vazgeç, tekrar giriş yap',
                      style: tx.bodySmall.copyWith(color: cs.textFaint),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
