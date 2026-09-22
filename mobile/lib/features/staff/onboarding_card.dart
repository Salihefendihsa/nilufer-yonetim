import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';

/// Bölüm U (5. tur): GET /staff/:id/onboarding satırı.
class OnboardingItem {
  final String id;
  final String item;
  final bool isCompleted;
  final String? completedAt;
  final String? completedByName;

  const OnboardingItem({
    required this.id,
    required this.item,
    required this.isCompleted,
    this.completedAt,
    this.completedByName,
  });

  factory OnboardingItem.fromJson(Map<String, dynamic> json) => OnboardingItem(
    id: json['id'] as String,
    item: json['item'] as String? ?? '',
    isCompleted: json['isCompleted'] as bool? ?? false,
    completedAt: json['completedAt'] as String?,
    completedByName:
        (json['completedBy'] as Map<String, dynamic>?)?['fullName'] as String?,
  );
}

class OnboardingChecklist {
  final List<OnboardingItem> items;
  final int total;
  final int completed;
  final int percent;
  final bool isComplete;

  const OnboardingChecklist({
    required this.items,
    required this.total,
    required this.completed,
    required this.percent,
    required this.isComplete,
  });

  factory OnboardingChecklist.fromJson(Map<String, dynamic> json) {
    final p = (json['progress'] as Map<String, dynamic>?) ?? const {};
    return OnboardingChecklist(
      items: ((json['items'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(OnboardingItem.fromJson)
          .toList(),
      total: (p['total'] as num?)?.toInt() ?? 0,
      completed: (p['completed'] as num?)?.toInt() ?? 0,
      percent: (p['percent'] as num?)?.toInt() ?? 0,
      isComplete: p['isComplete'] as bool? ?? false,
    );
  }
}

/// Personel detayı → "İşe Alım Süreci": ilerleme çubuğu + maddeler. Yönetim
/// (editable) işaretler; personel kendi listesini salt-okunur görür.
/// Liste boşsa (özellikten önce açılmış kayıt) kart hiç çizilmez.
class OnboardingCard extends StatefulWidget {
  final String staffId;
  final bool editable;
  const OnboardingCard({
    super.key,
    required this.staffId,
    required this.editable,
  });

  @override
  State<OnboardingCard> createState() => _OnboardingCardState();
}

class _OnboardingCardState extends State<OnboardingCard> {
  final _api = ApiClient.instance;
  OnboardingChecklist? _data;
  bool _loading = true;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await _api.get<Map<String, dynamic>>(
        '/staff/${widget.staffId}/onboarding',
      );
      if (mounted) setState(() => _data = OnboardingChecklist.fromJson(json));
    } on ApiException {
      // 403/404 → kart gizli kalır (örn. ekip dışı personel).
      if (mounted) setState(() => _data = null);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(OnboardingItem item) async {
    setState(() => _busyId = item.id);
    try {
      await _api.patch<Map<String, dynamic>>(
        '/staff/${widget.staffId}/onboarding/${item.id}',
        body: {'isCompleted': !item.isCompleted},
      );
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (_loading || _data == null || _data!.items.isEmpty) {
      return const SizedBox.shrink();
    }
    final d = _data!;
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
              Icon(Icons.fact_check_outlined, size: 18, color: cs.accentSoft),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'İşe Alım Süreci',
                  style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                '${d.completed}/${d.total} · %${d.percent}',
                style: tx.caption.copyWith(
                  fontWeight: FontWeight.w700,
                  color: d.isComplete ? cs.primary700 : cs.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: d.percent / 100,
              minHeight: 7,
              backgroundColor: cs.surfaceMuted,
              color: d.isComplete ? cs.primary600 : cs.primary400,
            ),
          ),
          const SizedBox(height: 6),
          for (final item in d.items)
            CheckboxListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              activeColor: cs.primary600,
              value: item.isCompleted,
              onChanged: widget.editable && _busyId == null
                  ? (_) => _toggle(item)
                  : null,
              title: Text(
                item.item,
                style: tx.body.copyWith(
                  decoration: item.isCompleted
                      ? TextDecoration.lineThrough
                      : null,
                  color: item.isCompleted ? cs.textSecondary : cs.textPrimary,
                ),
              ),
              subtitle: item.isCompleted && item.completedAt != null
                  ? Text(
                      '${DateFormat('d MMM yyyy', 'tr_TR').format(DateTime.parse(item.completedAt!).toLocal())}'
                      '${item.completedByName != null ? ' · ${item.completedByName}' : ''}',
                      style: tx.label,
                    )
                  : null,
            ),
          if (!widget.editable)
            Text(
              'Bu listeyi yalnızca yönetim işaretleyebilir.',
              style: tx.label,
            ),
        ],
      ),
    );
  }
}
