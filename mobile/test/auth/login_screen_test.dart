// Giriş ekranı tek ortak form: rol seçimi YOK — kullanıcı yalnızca e-posta +
// şifre girer, kabuk sunucunun döndürdüğü gerçek role göre açılır.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:nilufer_mobile/auth/auth_provider.dart';
import 'package:nilufer_mobile/auth/login_screen.dart';
import 'package:nilufer_mobile/theme/app_theme.dart';
import 'package:nilufer_mobile/theme/theme_controller.dart';

void main() {
  Future<void> pumpLogin(WidgetTester tester, {bool dark = false}) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => ThemeController()),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: dark ? ThemeMode.dark : ThemeMode.light,
          home: const LoginScreen(),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('tek form: e-posta, şifre, Şifremi Unuttum; rol seçici yok', (
    tester,
  ) async {
    await pumpLogin(tester);

    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('E-posta'), findsOneWidget);
    expect(find.text('Şifre'), findsOneWidget);
    expect(find.text('Şifremi Unuttum'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Giriş Yap'), findsOneWidget);
    for (final roleLabel in ['Patron', 'Müdür', 'Şef', 'Personel', 'Müşteri']) {
      expect(find.text(roleLabel), findsNothing, reason: roleLabel);
    }
    // Marka alanı korunur.
    expect(find.text('Nilüfer İlaçlama'), findsOneWidget);
  });

  testWidgets('koyu temada da çökmeden açılır', (tester) async {
    await pumpLogin(tester, dark: true);
    expect(find.text('Nilüfer İlaçlama'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
