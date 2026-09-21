import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../theme/app_colors.dart';
import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';
import '../theme/theme_controller.dart';
import 'auth_provider.dart';
import 'forgot_password_screen.dart';

/// Bölüm R (4. tur): Giriş ekranı yeniden tasarımı — web giriş sayfasıyla
/// aynı ilkeler: üstte marka alanı (logo + slogan + ince desen), ikonlu rol
/// seçici kartlar (seçim rolü doğrular — bkz. AuthProvider.login expectedRole),
/// form, sakin hata kutusu, tema düğmesi. 2FA/şifre sıfırlama geçişleri
/// main.dart'taki AnimatedSwitcher ve fade rotalarla yumuşatıldı.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _RoleOption {
  final AppRole role;
  final String label;
  final IconData icon;
  final String hint;
  const _RoleOption(this.role, this.label, this.icon, this.hint);
}

const _roleOptions = <_RoleOption>[
  _RoleOption(
    AppRole.owner,
    'Patron',
    Icons.workspace_premium_rounded,
    'Şirketin tüm görünümü',
  ),
  _RoleOption(
    AppRole.manager,
    'Müdür',
    Icons.work_outline_rounded,
    'Operasyon ve finans',
  ),
  _RoleOption(
    AppRole.teamLead,
    'Şef',
    Icons.groups_outlined,
    'Ekip planlama ve takip',
  ),
  _RoleOption(
    AppRole.staff,
    'Personel',
    Icons.build_outlined,
    'Günlük işler ve raporlar',
  ),
  _RoleOption(
    AppRole.customer,
    'Müşteri',
    Icons.home_outlined,
    'Hizmetler ve randevular',
  ),
];

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;
  _RoleOption _selected = _roleOptions.first;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    // reCAPTCHA v3 mobilde üretilemediği için ApiClient, /auth/login isteğine
    // X-Client-Type/X-Mobile-App-Key header'larını otomatik ekler; backend bu
    // ikisini doğrularsa reCAPTCHA kontrolünü atlar (bkz.
    // backend/src/controllers/authController.ts:isVerifiedMobileClient).
    await auth.login(
      _emailController.text.trim(),
      _passwordController.text,
      expectedRole: _selected.role,
    );
  }

  void _openForgotPassword() {
    Navigator.of(context).push(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 240),
        reverseTransitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (_, _, _) => const ForgotPasswordScreen(),
        transitionsBuilder: (_, animation, _, child) => FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position:
                Tween<Offset>(
                  begin: const Offset(0.06, 0),
                  end: Offset.zero,
                ).animate(
                  CurvedAnimation(parent: animation, curve: Curves.easeOut),
                ),
            child: child,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final auth = context.watch<AuthProvider>();
    final themeController = context.watch<ThemeController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          // Üst marka bandı — ince noktalı desen + yumuşak halka dekoru.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: _BrandHeader(topInset: MediaQuery.of(context).padding.top),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 12,
            child: IconButton(
              tooltip: isDark ? 'Açık tema' : 'Koyu tema',
              style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: 0.15),
                foregroundColor: Colors.white,
              ),
              icon: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                transitionBuilder: (child, anim) => RotationTransition(
                  turns: anim,
                  child: FadeTransition(opacity: anim, child: child),
                ),
                child: Icon(
                  isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                  key: ValueKey(isDark),
                  size: 20,
                ),
              ),
              onPressed: () => themeController.setMode(
                isDark ? ThemeMode.light : ThemeMode.dark,
              ),
            ),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 150, 20, 24),
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                decoration: BoxDecoration(
                  color: cs.surfaceCard,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: cs.borderDefault),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Rol seçici — ikonlu kartlar, seçili olan yumuşakça vurgulanır.
                      SizedBox(
                        height: 78,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _roleOptions.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 8),
                          itemBuilder: (context, i) {
                            final o = _roleOptions[i];
                            final active = o.role == _selected.role;
                            return GestureDetector(
                              onTap: auth.isBusy
                                  ? null
                                  : () {
                                      setState(() => _selected = o);
                                      context.read<AuthProvider>().loginError =
                                          null;
                                    },
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                curve: Curves.easeOut,
                                width: 76,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: active
                                      ? cs.primary600
                                      : cs.surfaceSubtle,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: active
                                        ? cs.primary600
                                        : cs.borderDefault,
                                  ),
                                  boxShadow: active
                                      ? [
                                          BoxShadow(
                                            color: cs.primary600.withValues(
                                              alpha: 0.28,
                                            ),
                                            blurRadius: 12,
                                            offset: const Offset(0, 4),
                                          ),
                                        ]
                                      : null,
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      o.icon,
                                      size: 22,
                                      color: active
                                          ? Colors.white
                                          : cs.textSecondary,
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      o.label,
                                      style: tx.caption.copyWith(
                                        fontWeight: FontWeight.w700,
                                        color: active
                                            ? Colors.white
                                            : cs.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 14),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 180),
                        child: Column(
                          key: ValueKey(_selected.role),
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${_selected.label} Girişi',
                              style: tx.display.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(_selected.hint, style: tx.bodySmall),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          labelText: 'E-posta',
                          prefixIcon: Icon(Icons.mail_outline_rounded),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return 'E-posta gerekli';
                          }
                          if (!v.contains('@')) {
                            return 'Geçerli bir e-posta girin';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscure,
                        autofillHints: const [AutofillHints.password],
                        decoration: InputDecoration(
                          labelText: 'Şifre',
                          prefixIcon: const Icon(Icons.lock_outline_rounded),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                          ),
                        ),
                        validator: (v) =>
                            (v == null || v.isEmpty) ? 'Şifre gerekli' : null,
                        onFieldSubmitted: (_) => _submit(),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: _openForgotPassword,
                          child: Text('Şifremi Unuttum', style: tx.bodySmall),
                        ),
                      ),
                      // Sakin hata kutusu — ne olduğunu ve ne yapılacağını söyler.
                      AnimatedSize(
                        duration: const Duration(milliseconds: 180),
                        curve: Curves.easeOut,
                        child: auth.loginError == null
                            ? const SizedBox.shrink()
                            : Container(
                                margin: const EdgeInsets.only(top: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: cs.danger50,
                                  borderRadius: BorderRadius.circular(
                                    AppRadius.chip,
                                  ),
                                  border: Border.all(
                                    color: cs.danger500.withValues(alpha: 0.25),
                                  ),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(
                                      Icons.info_outline_rounded,
                                      color: cs.danger500,
                                      size: 18,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _friendly(auth.loginError!),
                                        style: tx.bodySmall.copyWith(
                                          color: cs.danger600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                      ),
                      const SizedBox(height: 18),
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
                            : const Text('Giriş Yap'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Sunucu mesajlarını yumuşak, yol gösterici dile çevirir.
  static String _friendly(String message) {
    final m = message.toLowerCase();
    if (m.contains('şifre') ||
        m.contains('e-posta') ||
        m.contains('geçersiz')) {
      return 'E-posta veya şifre eşleşmedi. Yazımı kontrol edip tekrar deneyin.';
    }
    if (m.contains('çok fazla')) {
      return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.';
    }
    return message;
  }
}

/// Üst marka bandı: koyu yeşil zemin, ince nokta deseni, logo + slogan.
class _BrandHeader extends StatelessWidget {
  final double topInset;
  const _BrandHeader({required this.topInset});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      height: topInset + 210,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [cs.primary600, cs.primary800],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
      ),
      child: Stack(
        children: [
          Positioned.fill(child: CustomPaint(painter: _DotPatternPainter())),
          Positioned(
            right: -40,
            top: -30,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.12),
                  width: 1.2,
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(24, topInset + 22, 24, 0),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                  ),
                  child: const Icon(
                    Icons.pest_control_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Nilüfer İlaçlama',
                        style: tx.display.copyWith(
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Eviniz güvende, yaşamınız rahat',
                        style: tx.bodySmall.copyWith(color: Colors.white70),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DotPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.08);
    const step = 22.0;
    for (var x = 0.0; x < size.width; x += step) {
      for (var y = 0.0; y < size.height; y += step) {
        canvas.drawCircle(Offset(x, y), 1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
