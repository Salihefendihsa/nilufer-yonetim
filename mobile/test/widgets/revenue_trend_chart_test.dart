// Bölüm AA (6. tur): RevenueTrendChart ikinci seriyle (geçen yıl) çökmeden çizilir.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/widgets/charts.dart';

void main() {
  testWidgets('tek ve çift seri render', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              RevenueTrendChart(points: [ChartPoint('Oca', 100), ChartPoint('Şub', 200)]),
              RevenueTrendChart(
                points: [ChartPoint('Oca', 100), ChartPoint('Şub', 200)],
                secondaryPoints: [ChartPoint('Oca', 300), ChartPoint('Şub', 50)],
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.byType(RevenueTrendChart), findsNWidgets(2));
  });
}
