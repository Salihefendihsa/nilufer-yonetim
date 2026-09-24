// Tema butonlarının `minimumSize: Size.fromHeight(48)` (sonsuz genişlik)
// varsayılanı, Row içinde esnek olmayan çocuk olarak kullanılınca layout'u
// kırar (Personel/Şef ana sayfası bu yüzden boş geliyordu). Bu test hem
// tuzağı belgeler hem de kullanılan iki çözümün (sonlu minimumSize,
// Expanded) gerçek temayla çalıştığını doğrular.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/theme/app_theme.dart';

Widget _host(Widget child, {bool dark = false}) => MaterialApp(
  theme: AppTheme.light(),
  darkTheme: AppTheme.dark(),
  themeMode: dark ? ThemeMode.dark : ThemeMode.light,
  home: Scaffold(body: SizedBox(width: 360, child: child)),
);

void main() {
  testWidgets('tema butonu çıplak Row içinde sonsuz genişlik hatası verir', (
    tester,
  ) async {
    // Layout hatası zincirleme birkaç exception üretir; hepsini topla.
    final errors = <FlutterErrorDetails>[];
    final previous = FlutterError.onError;
    FlutterError.onError = errors.add;
    try {
      await tester.pumpWidget(
        _host(
          Row(
            children: [
              const Expanded(child: Text('Puantaj')),
              ElevatedButton(onPressed: () {}, child: const Text('Giriş Yap')),
            ],
          ),
        ),
      );
    } finally {
      FlutterError.onError = previous;
    }
    expect(errors, isNotEmpty);
    expect(errors.first.exceptionAsString(), contains('infinite width'));
  });

  for (final dark in [false, true]) {
    testWidgets('sonlu minimumSize ve Expanded ile hatasız çizilir '
        '(${dark ? 'koyu' : 'açık'} tema)', (tester) async {
      await tester.pumpWidget(
        _host(
          Column(
            children: [
              Row(
                children: [
                  const Expanded(child: Text('Merhaba')),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(64, 48),
                    ),
                    onPressed: () {},
                    icon: const Icon(Icons.payments_rounded, size: 16),
                    label: const Text('Avans Talep Et'),
                  ),
                ],
              ),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {},
                      child: const Text('Anonimleştir'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {},
                      child: const Text('Reddet'),
                    ),
                  ),
                ],
              ),
            ],
          ),
          dark: dark,
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.text('Avans Talep Et'), findsOneWidget);
      expect(find.text('Anonimleştir'), findsOneWidget);
      expect(find.text('Reddet'), findsOneWidget);
      final avans = tester.getSize(find.byType(OutlinedButton).first);
      expect(avans.width, lessThan(360));
      expect(avans.height, 48);
    });
  }
}
