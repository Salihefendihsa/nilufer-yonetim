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
    return ChangeNotifierProvider(
      create: (_) => AuthProvider()..restoreSession(),
      child: MaterialApp(
        title: 'Nilüfer İlaçlama',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        locale: const Locale('tr', 'TR'),
        supportedLocales: const [Locale('tr', 'TR')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const _AuthGate(),
      ),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
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
