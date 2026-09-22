import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_text_styles.dart';

/// Tek bir veri noktası — hem çizgi hem çubuk grafiklerde kullanılır.
class ChartPoint {
  final String label;
  final double value;
  const ChartPoint(this.label, this.value);
}

/// Ciro trendi / zaman serisi çizgi grafiği — Raporlar ve Para & Finans
/// ekranlarındaki "Ciro Trendi" bölümünde aynı veri sözleşmesiyle kullanılır
/// (backend/src/controllers/analyticsController.ts:getRevenueTrend).
/// fl_chart yüklenemezse (kapsam dışı bırakılan bağımlılık) diye önceki
/// sürüm basit yatay çubuklardı — artık gerçek, animasyonlu bir çizgi grafik.
class RevenueTrendChart extends StatelessWidget {
  final List<ChartPoint> points;

  /// Bölüm V (5. tur): Y ekseni sabit üst sınırı (örn. 20 puanlık ölçek) ve
  /// tooltip biçimi — verilmezse ciro davranışı (₺, otomatik üst sınır) korunur.
  final double? fixedMaxY;
  final String Function(double value)? valueFormatter;

  /// Bölüm AA (6. tur): aynı eksende ikinci seri (örn. geçen yıl) — gri, kesikli.
  final List<ChartPoint>? secondaryPoints;
  const RevenueTrendChart({
    super.key,
    required this.points,
    this.fixedMaxY,
    this.valueFormatter,
    this.secondaryPoints,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (points.isEmpty) return const SizedBox.shrink();
    final maxY = [
      ...points,
      ...?secondaryPoints,
    ].map((p) => p.value).fold<double>(0, (a, b) => a > b ? a : b);
    final safeMaxY = fixedMaxY ?? (maxY <= 0 ? 1.0 : maxY * 1.25);
    final fmt = valueFormatter ?? (double v) => '₺${v.toStringAsFixed(0)}';

    return SizedBox(
      height: 180,
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: safeMaxY,
          gridData: FlGridData(
            drawVerticalLine: false,
            horizontalInterval: safeMaxY / 4,
            getDrawingHorizontalLine: (_) =>
                FlLine(color: cs.borderDefault, strokeWidth: 1),
          ),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            rightTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            topTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 26,
                getTitlesWidget: (value, meta) {
                  final i = value.toInt();
                  if (i < 0 || i >= points.length || value != i) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(points[i].label, style: tx.label),
                  );
                },
              ),
            ),
          ),
          borderData: FlBorderData(show: false),
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipColor: (_) => cs.textPrimary,
              getTooltipItems: (spots) => spots
                  .map(
                    (s) => LineTooltipItem(
                      fmt(s.y),
                      tx.label.copyWith(color: Colors.white),
                    ),
                  )
                  .toList(),
            ),
          ),
          lineBarsData: [
            if (secondaryPoints != null && secondaryPoints!.isNotEmpty)
              LineChartBarData(
                spots: [
                  for (var i = 0; i < secondaryPoints!.length; i++)
                    FlSpot(i.toDouble(), secondaryPoints![i].value),
                ],
                isCurved: true,
                curveSmoothness: 0.25,
                color: cs.neutral400,
                barWidth: 2,
                dashArray: [6, 4],
                dotData: const FlDotData(show: false),
              ),
            LineChartBarData(
              spots: [
                for (var i = 0; i < points.length; i++)
                  FlSpot(i.toDouble(), points[i].value),
              ],
              isCurved: true,
              curveSmoothness: 0.25,
              color: cs.primary600,
              barWidth: 3,
              dotData: const FlDotData(show: true),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    cs.primary500.withValues(alpha: 0.25),
                    cs.primary500.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ],
        ),
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeOutCubic,
      ),
    );
  }
}

List<Color> _pieColors(AppPalette cs) => [
  cs.primary600,
  cs.info500,
  cs.warning500,
  cs.success500,
  cs.danger500,
  cs.primary100,
];

/// Kategori dağılımı pasta grafiği — "Hizmet Türü Dağılımı" gibi yüzdesel
/// kırılımlar için (backend zaten yüzdeyi hesaplıyor, burada yalnızca çizilir).
class CategoryPieChart extends StatelessWidget {
  final List<ChartPoint> points;
  const CategoryPieChart({super.key, required this.points});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (points.isEmpty) return const SizedBox.shrink();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: 120,
          height: 120,
          child: PieChart(
            PieChartData(
              sectionsSpace: 2,
              centerSpaceRadius: 28,
              sections: [
                for (var i = 0; i < points.length; i++)
                  PieChartSectionData(
                    value: points[i].value <= 0 ? 0.001 : points[i].value,
                    color: _pieColors(cs)[i % 6],
                    radius: 22,
                    showTitle: false,
                  ),
              ],
            ),
            duration: const Duration(milliseconds: 500),
            curve: Curves.easeOutCubic,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < points.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: _pieColors(cs)[i % 6],
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          points[i].label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: tx.caption.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        '%${points[i].value.toStringAsFixed(0)}',
                        style: tx.label.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
