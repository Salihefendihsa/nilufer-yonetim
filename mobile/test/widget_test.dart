// Temel smoke test: uygulama çöküp çökmediğini ve MaterialApp'in kurulduğunu
// doğrular. Gerçek oturum/giriş akışı testleri, backend'e bağımlı olmayan bir
// AuthProvider soyutlaması eklenene kadar (widget testinde flutter_secure_storage
// platform kanalı mock'lanmadan güvenilir çalışmaz) entegrasyon testi
// seviyesinde bırakılmıştır.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/main.dart';

void main() {
  testWidgets('Uygulama çökmeden açılır', (WidgetTester tester) async {
    await tester.pumpWidget(const NiluferApp());
    await tester.pump();

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
