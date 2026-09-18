import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';

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
    if (_loading || _balance == null) return const SizedBox.shrink();
    final b = _balance!;
    final barColor = b.isOver
        ? AppColors.danger500
        : b.usedPercent >= 80
        ? AppColors.warning500
        : AppColors.primary600;

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.event_busy_rounded,
                size: 18,
                color: AppColors.primary600,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'İzin Bakiyesi ${b.year}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14.5,
                  ),
                ),
              ),
              Text(
                '${b.remainingDays} / ${b.quotaDays} gün',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: b.isOver ? AppColors.danger500 : AppColors.textPrimary,
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
              backgroundColor: AppColors.surfaceMuted,
              color: barColor,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${b.usedDays} gün kullanıldı (${b.approvedRequestCount} onaylı talep)'
            '${b.isOver ? ' · bakiye aşıldı' : ''}',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.warning50,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.warning500.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            size: 13,
            color: AppColors.warning600,
          ),
          const SizedBox(width: 4),
          Text(
            'Bakiyeyi aşıyor (kalan ${remainingDays ?? 0} gün)',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.warning600,
            ),
          ),
        ],
      ),
    );
  }
}
