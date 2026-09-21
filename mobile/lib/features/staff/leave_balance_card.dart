import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';

/// Bölüm AH (8. tur): GET /staff/:id/leave-balance yanıtı (takvim yılı).
class LeaveBalance {
  final int year;
  final int quotaDays;
  final int usedDays;
  final int remainingDays;
  final int approvedRequestCount;

  const LeaveBalance({
    required this.year,
    required this.quotaDays,
    required this.usedDays,
    required this.remainingDays,
    required this.approvedRequestCount,
  });

  factory LeaveBalance.fromJson(Map<String, dynamic> json) => LeaveBalance(
    year: (json['year'] as num).toInt(),
    quotaDays: (json['quotaDays'] as num?)?.toInt() ?? 0,
    usedDays: (json['usedDays'] as num?)?.toInt() ?? 0,
    remainingDays: (json['remainingDays'] as num?)?.toInt() ?? 0,
    approvedRequestCount: (json['approvedRequestCount'] as num?)?.toInt() ?? 0,
  );

  bool get isOver => remainingDays < 0;

  /// 0–100 arası kullanılan yüzdesi (kota 0 ise 0).
  int get usedPercent {
    if (quotaDays <= 0) return 0;
    final used = usedDays.clamp(0, quotaDays);
    return (used * 100 / quotaDays).round();
  }
}

/// "İzin Bakiyesi" kartı — kalan/toplam gün + progress bar.
/// Yetki yoksa (403) veya hata → kart gizli.
class LeaveBalanceCard extends StatefulWidget {
  final String staffId;
  const LeaveBalanceCard({super.key, required this.staffId});

  @override
  State<LeaveBalanceCard> createState() => _LeaveBalanceCardState();
}

class _LeaveBalanceCardState extends State<LeaveBalanceCard> {
  LeaveBalance? _balance;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/staff/${widget.staffId}/leave-balance',
      );
      if (mounted) setState(() => _balance = LeaveBalance.fromJson(json));
    } on ApiException {
      if (mounted) setState(() => _balance = null);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (_loading || _balance == null) return const SizedBox.shrink();
    final b = _balance!;
    final barColor = b.isOver
        ? cs.danger500
        : b.usedPercent >= 80
        ? cs.warning500
        : cs.primary600;

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.event_busy_rounded, size: 18, color: cs.accentSoft),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'İzin Bakiyesi ${b.year}',
                  style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                '${b.remainingDays} / ${b.quotaDays} gün',
                style: tx.bodySmall.copyWith(
                  fontWeight: FontWeight.w700,
                  color: b.isOver ? cs.danger500 : cs.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: b.usedPercent / 100,
              minHeight: 6,
              backgroundColor: cs.surfaceMuted,
              color: barColor,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${b.usedDays} gün kullanıldı (${b.approvedRequestCount} onaylı talep)'
            '${b.isOver ? ' · bakiye aşıldı' : ''}',
            style: tx.caption,
          ),
        ],
      ),
    );
  }
}

/// Bekleyen izin talebi bakiyeyi aşıyorsa gösterilen uyarı rozeti (onayı engellemez).
class LeaveBalanceExceedBadge extends StatelessWidget {
  final int? remainingDays;
  const LeaveBalanceExceedBadge({super.key, this.remainingDays});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: cs.warning50,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: cs.warning500.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.warning_amber_rounded, size: 13, color: cs.warning600),
          const SizedBox(width: 4),
          Text(
            'Bakiyeyi aşıyor (kalan ${remainingDays ?? 0} gün)',
            style: tx.label.copyWith(color: cs.warning600),
          ),
        ],
      ),
    );
  }
}
