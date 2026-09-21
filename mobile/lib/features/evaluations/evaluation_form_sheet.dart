import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/evaluation.dart';
import '../../models/staff.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import 'evaluations_api.dart';

/// web/src/app/(dashboard)/performans/EvaluationsTab.tsx:EvaluationFormModal
/// ile aynı davranış — DRAFT'ta düzenlenebilir, SUBMITTED/LOCKED salt okunur.
class EvaluationFormSheet extends StatefulWidget {
  final Staff staff;
  final String periodId;
  final List<EvaluationCriterion> criteria;
  final Evaluation? existing;

  const EvaluationFormSheet({
    super.key,
    required this.staff,
    required this.periodId,
    required this.criteria,
    this.existing,
  });

  @override
  State<EvaluationFormSheet> createState() => _EvaluationFormSheetState();
}

class _EvaluationFormSheetState extends State<EvaluationFormSheet> {
  final _api = EvaluationsApi();
  late final Map<String, int> _scores;
  late final TextEditingController _commentController;
  late final TextEditingController _managerScoreController;
  bool _submitting = false;
  String? _error;

  bool get _readOnly =>
      widget.existing != null && widget.existing!.status != 'DRAFT';

  int? _existingScoreFor(String criterionId) {
    for (final s in widget.existing?.scores ?? const <EvaluationScoreItem>[]) {
      if (s.criterionId == criterionId) return s.score;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _scores = {
      for (final c in widget.criteria) c.id: _existingScoreFor(c.id) ?? 10,
    };
    _commentController = TextEditingController(
      text: widget.existing?.comment ?? '',
    );
    _managerScoreController = TextEditingController(
      text: widget.existing?.managerScore?.toString() ?? '',
    );
  }

  @override
  void dispose() {
    _commentController.dispose();
    _managerScoreController.dispose();
    super.dispose();
  }

  Future<void> _save({required bool submit}) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final comment = _commentController.text.trim().isEmpty
          ? null
          : _commentController.text.trim();
      final managerScore = _managerScoreController.text.trim().isEmpty
          ? null
          : int.tryParse(_managerScoreController.text.trim());

      String evaluationId;
      if (widget.existing != null) {
        await _api.updateEvaluation(
          widget.existing!.id,
          scoresByCriterionId: _scores,
          comment: comment,
          managerScore: managerScore,
        );
        evaluationId = widget.existing!.id;
      } else {
        final created = await _api.createEvaluation(
          targetStaffId: widget.staff.id,
          periodId: widget.periodId,
          scoresByCriterionId: _scores,
          comment: comment,
          managerScore: managerScore,
        );
        evaluationId = created.id;
      }
      if (submit) {
        await _api.submitEvaluation(evaluationId);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Kaydedilemedi');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      expand: false,
      builder: (ctx, scrollController) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 20,
          right: 20,
          top: 20,
        ),
        child: ListView(
          controller: scrollController,
          children: [
            Text(
              '${widget.staff.fullName} — Değerlendirme',
              style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            if (_error != null) ...[
              Text(_error!, style: tx.bodySmall.copyWith(color: cs.danger500)),
              const SizedBox(height: 8),
            ],
            if (_readOnly)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: cs.warning50,
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
                child: Text(
                  'Bu değerlendirme ${widget.existing!.status == 'LOCKED' ? 'kilitli' : 'gönderilmiş'} — salt okunur.',
                  style: tx.caption.copyWith(color: cs.warning600),
                ),
              ),
            if (widget.criteria.isEmpty)
              Text(
                'Henüz aktif kriter yok — Ayarlar → Değerlendirme Kriterleri\'nden ekleyin.',
                style: tx.bodySmall,
              )
            else
              for (final c in widget.criteria)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            c.name,
                            style: tx.bodySmall.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text('${_scores[c.id]}/20', style: tx.bodySmall),
                        ],
                      ),
                      Slider(
                        min: 1,
                        max: 20,
                        divisions: 19,
                        value: (_scores[c.id] ?? 10).toDouble(),
                        onChanged: _readOnly
                            ? null
                            : (v) => setState(() => _scores[c.id] = v.round()),
                      ),
                      if (c.description != null)
                        Text(c.description!, style: tx.label),
                    ],
                  ),
                ),
            const SizedBox(height: 8),
            TextField(
              controller: _commentController,
              enabled: !_readOnly,
              decoration: const InputDecoration(labelText: 'Yorum'),
              minLines: 2,
              maxLines: 4,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _managerScoreController,
              enabled: !_readOnly,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Genel Puan (opsiyonel, 1-20)',
                helperText: 'Kriter ortalamasından ayrı, ek bir genel puan',
              ),
            ),
            const SizedBox(height: 16),
            if (!_readOnly)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _submitting || widget.criteria.isEmpty
                          ? null
                          : () => _save(submit: false),
                      child: const Text('Taslak Kaydet'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _submitting || widget.criteria.isEmpty
                          ? null
                          : () => _save(submit: true),
                      child: Text(_submitting ? 'Gönderiliyor...' : 'Gönder'),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
