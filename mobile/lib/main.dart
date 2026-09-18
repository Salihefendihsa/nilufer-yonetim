import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'auth/auth_provider.dart';
import 'auth/force_change_password_screen.dart';
import 'auth/login_screen.dart';
import 'auth/two_factor_verify_screen.dart';
import 'navigation/impersonation_banner.dart';
import 'navigation/role_shell.dart';
import 'theme/app_theme.dart';
import 'theme/theme_controller.dart';
import 'widgets/state_views.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('tr_TR', null);
  runApp(const NiluferApp());
}

class NiluferApp extends StatelessWidget {
  const NiluferApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..restoreSession()),
        ChangeNotifierProvider(create: (_) => ThemeController()..load()),
      ],
      child: Consumer<ThemeController>(
        builder: (context, themeController, _) => MaterialApp(
          title: 'Nilüfer İlaçlama',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: themeController.mode,
          locale: const Locale('tr', 'TR'),
          supportedLocales: const [Locale('tr', 'TR')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: const _AuthGate(),
        ),
      ),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    // Bölüm R (4. tur): giriş ↔ 2FA ↔ uygulama geçişleri yumuşak (fade+slide).
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 260),
      switchInCurve: Curves.easeOut,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.04, 0),
            end: Offset.zero,
          ).animate(animation),
          child: child,
        ),
      ),
      child: KeyedSubtree(
        key: ValueKey(_gateKey(auth)),
        child: _buildForStatus(auth),
      ),
    );
  }

  static String _gateKey(AuthProvider auth) => switch (auth.status) {
        AuthStatus.unknown => 'unknown',
        AuthStatus.unauthenticated => 'login',
        AuthStatus.twoFactorRequired => '2fa',
        AuthStatus.authenticated =>
          auth.mustChangePassword ? 'force-password' : 'app',
      };

  Widget _buildForStatus(AuthProvider auth) {
    switch (auth.status) {
      case AuthStatus.unknown:
        return const Scaffold(body: LoadingView());
      case AuthStatus.unauthenticated:
        return const LoginScreen();
      case AuthStatus.twoFactorRequired:
        return const TwoFactorVerifyScreen();
      case AuthStatus.authenticated:
        if (auth.mustChangePassword) {
          return const ForceChangePasswordScreen();
        }
        return const Column(
          children: [ImpersonationBanner(), Expanded(child: RoleShell())],
        );
    }
  }
}
