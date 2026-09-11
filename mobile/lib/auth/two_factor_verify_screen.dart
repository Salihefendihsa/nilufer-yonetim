import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../theme/app_colors.dart';
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
                      color: AppColors.primary700,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: Colors.white,
                      size: 36,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'İki Adımlı Doğrulama',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _useRecoveryCode
                        ? 'Kurtarma kodlarınızdan birini girin.'
                        : 'Authenticator uygulamanızdaki 6 haneli kodu girin.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13.5,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 28),
                  TextFormField(
                    controller: _codeController,
                    autofocus: true,
                    textAlign: TextAlign.center,
                    keyboardType: _useRecoveryCode
                        ? TextInputType.text
                        : TextInputType.number,
                    style: const TextStyle(
                      fontFeatures: [FontFeature.tabularFigures()],
                      letterSpacing: 3,
                      fontSize: 18,
                    ),
                    decoration: InputDecoration(
                      labelText: _useRecoveryCode ? 'Kurtarma Kodu' : 'Doğrulama Kodu',
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
                        color: AppColors.danger50,
                        borderRadius: BorderRadius.circular(AppRadius.chip),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline_rounded,
                            color: AppColors.danger500,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              auth.loginError!,
                              style: const TextStyle(
                                color: AppColors.danger600,
                                fontSize: 13,
                              ),
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
                      style: const TextStyle(fontSize: 12.5),
                    ),
                  ),
                  TextButton(
                    onPressed: () => context.read<AuthProvider>().cancelTwoFactor(),
                    child: const Text(
                      'Vazgeç, tekrar giriş yap',
                      style: TextStyle(fontSize: 12.5, color: AppColors.textFaint),
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
