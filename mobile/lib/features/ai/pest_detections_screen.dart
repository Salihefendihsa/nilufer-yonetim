import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../navigation/sub_page_scaffold.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/auth_image.dart';
import '../../widgets/chip_bar.dart';
import '../../widgets/state_views.dart';
import '../jobs/job_detail_screen.dart';

final _dateFormat = DateFormat('d MMM yyyy, HH:mm', 'tr_TR');

/// GET /pest-detections satırı (backend pestDetectionsController).
class PestDetection {
  final String id;
  final String pestType;
  final double confidence;
  final String description;
  final DateTime analyzedAt;
  final String photoUrl;
  final String photoType;
  final String jobId;
  final int? jobSequenceNo;
  final String serviceType;
  final String customerName;
  final String? staffName;

  PestDetection.fromJson(Map<String, dynamic> json)
    : id = json['id'] as String,
      pestType = json['detectedPestType'] as String,
      confidence = (json['confidence'] as num).toDouble(),
      description = json['description'] as String,
      analyzedAt = DateTime.parse(json['analyzedAt'] as String).toLocal(),
      photoUrl = (json['photo'] as Map)['fileUrl'] as String,
      photoType = (json['photo'] as Map)['type'] as String,
      jobId = (json['job'] as Map)['id'] as String,
      jobSequenceNo = (json['job'] as Map)['sequenceNo'] as int?,
      serviceType = (json['job'] as Map)['serviceType'] as String,
      customerName = (json['job'] as Map)['customerName'] as String,
      staffName = (json['job'] as Map)['staffName'] as String?;
}

/// Bölüm J: "AI Analiz" — iş fotoğraflarının yapay zekâ haşere tespitleri.
/// Tüm çalışan rollerine açık; kapsamı backend daraltır (personel kendi
/// işleri, şef ekibi, müdür/patron tümü). Fotoğraflar kimlik doğrulamalı
/// /files/job-photo/:id ucundan AuthImage ile yüklenir.
class PestDetectionsScreen extends StatefulWidget {
  const PestDetectionsScreen({super.key});

  @override
  State<PestDetectionsScreen> createState() => _PestDetectionsScreenState();
}

class _PestDetectionsScreenState extends State<PestDetectionsScreen> {
  List<PestDetection> _items = [];
  List<({String pestType, int count})> _summary = [];
  String? _filter;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/pest-detections',
        query: {'limit': 50, if (_filter != null) 'pestType': _filter},
      );
      if (!mounted) return;
      setState(() {
        _items = (json['data'] as List)
            .cast<Map<String, dynamic>>()
            .map(PestDetection.fromJson)
            .toList();
        _summary = ((json['summary'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(
              (s) =>
                  (pestType: s['pestType'] as String, count: s['count'] as int),
            )
            .toList();
      });
    } catch (e) {
      if (mounted) {
        setState(
          () =>
              _error = e is ApiException ? e.message : 'Analizler yüklenemedi',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    return SubPageScaffold(
      title: 'AI Analiz',
      body: Column(
        children: [
          if (_summary.isNotEmpty)
            ChipBar(
              children: [
                ChoiceChip(
                  label: const Text('Tümü'),
                  selected: _filter == null,
                  onSelected: (_) {
                    setState(() => _filter = null);
                    _load();
                  },
                ),
                for (final s in _summary)
                  ChoiceChip(
                    label: Text('${s.pestType} (${s.count})'),
                    selected: _filter == s.pestType,
                    onSelected: (_) {
                      setState(() => _filter = s.pestType);
                      _load();
                    },
                  ),
              ],
            ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorRetryView(message: _error!, onRetry: _load)
                : _items.isEmpty
                ? const EmptyStateView(
                    title: 'Henüz analiz yok',
                    subtitle: 'İş fotoğrafları yüklendiğinde yapay zekâ haşere türünü otomatik tespit eder.',
                    icon: Icons.auto_awesome_outlined,
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    color: cs.accentSoft,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, i) => _DetectionCard(
                        item: _items[i],
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                JobDetailScreen(jobId: _items[i].jobId),
                          ),
                        ),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _DetectionCard extends StatelessWidget {
  final PestDetection item;
  final VoidCallback onTap;
  const _DetectionCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final pct = (item.confidence * 100).round();
    final tone = pct >= 80
        ? cs.success600
        : pct >= 50
        ? cs.warning600
        : cs.danger600;
    final radius = BorderRadius.circular(AppRadius.card);
    return Material(
      color: cs.surfaceCard,
      borderRadius: radius,
      child: InkWell(
        borderRadius: radius,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(color: cs.borderDefault),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.chip),
                child: AuthImage(path: item.photoUrl, width: 76, height: 76),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.pestType,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: tx.body.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: tone.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            '%$pct güven',
                            style: tx.label.copyWith(
                              color: tone,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.description,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: tx.bodySmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        if (item.jobSequenceNo != null)
                          '#${item.jobSequenceNo}',
                        item.customerName,
                        item.serviceType,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx.caption.copyWith(color: cs.textSecondary),
                    ),
                    Text(
                      [
                        item.photoType == 'BEFORE' ? 'Önce' : 'Sonra',
                        if (item.staffName != null) item.staffName!,
                        _dateFormat.format(item.analyzedAt),
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx.caption.copyWith(color: cs.textFaint),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
