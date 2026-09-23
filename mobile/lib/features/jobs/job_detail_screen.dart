
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:signature/signature.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/job.dart';
import '../../models/staff.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/auth_image.dart';
import '../../widgets/state_views.dart';
import '../staff/staff_api.dart';
import '../stock/stock_api.dart';
import '../../models/product.dart';
import 'jobs_api.dart';

final _dateTimeFormat = DateFormat('d MMMM yyyy, HH:mm', 'tr_TR');

class JobDetailScreen extends StatefulWidget {
  final String jobId;
  const JobDetailScreen({super.key, required this.jobId});

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  final _api = JobsApi();
  Job? _job;
  Map<String, dynamic>? _report;
  List<Map<String, dynamic>> _photos = [];
  bool _loading = true;
  String? _error;
  bool _busy = false;
  bool _changed = false;

  AppRole? get _role => context.read<AuthProvider>().user?.role;

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
      final job = await _api.getById(widget.jobId);
      Map<String, dynamic>? report;
      List<Map<String, dynamic>> photos = [];
      try {
        report = await _api.getReport(widget.jobId);
      } catch (_) {}
      try {
        photos = await _api.listPhotos(widget.jobId);
      } catch (_) {}
      setState(() {
        _job = job;
        _report = report;
        _photos = photos;
      });
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'İş yüklenemedi');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _changeStatus(JobStatus next) async {
    // Iptal gerekcesiz kaydedilmez (Stitch Mudur -> Isler: "Iptal Gerekcesi").
    String? reason;
    if (next == JobStatus.cancelled) {
      reason = await _askCancellationReason();
      if (reason == null || reason.trim().isEmpty) return;
    }

    setState(() => _busy = true);
    try {
      final updated = await _api.updateStatus(
        widget.jobId,
        next,
        cancellationReason: reason,
      );
      setState(() => _job = updated);
      _changed = true;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Durum güncellenemedi',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _askCancellationReason() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('İşi iptal et'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'İptal gerekçesi'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('İptal Et'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('İş Detayı')),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    final cs = context.colors;
    final tx = context.text;
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    final job = _job!;
    final isStaffOwner = _role == AppRole.staff;
    final isManagement = _role == AppRole.owner || _role == AppRole.manager;
    final isCustomer = _role == AppRole.customer;
    final isTeamLead = _role == AppRole.teamLead;

    return RefreshIndicator(
      onRefresh: _load,
      color: cs.accentSoft,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cs.surfaceCard,
              borderRadius: BorderRadius.circular(AppRadius.sheet),
              border: Border.all(color: cs.borderDefault),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(job.customerName ?? 'Müşteri', style: tx.title),
                const SizedBox(height: 4),
                Text(
                  job.serviceType,
                  style: tx.body.copyWith(color: cs.textSecondary),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _Pill(text: jobStatusLabelTr(job.status)),
                    // Bölüm Y (6. tur): geçerli garanti rozeti (süresi dolmuşsa gizli).
                    if (job.warrantyDaysLeft != null)
                      _Pill(
                        text: 'Garanti · ${job.warrantyDaysLeft} gün',
                        icon: Icons.verified_user_outlined,
                      ),
                    if (job.assignedStaffName != null)
                      _Pill(
                        text: job.assignedStaffName!,
                        icon: Icons.person_outline_rounded,
                      ),
                    if (job.price != null)
                      _Pill(
                        text: '${job.price!.toStringAsFixed(0)} ₺',
                        icon: Icons.payments_outlined,
                      ),
                  ],
                ),
                // Bölüm O (4. tur): Yol Tarifi — müşteri adresini Google Maps
                // arama linkiyle açar (platform varsayılan harita uygulaması).
                if (job.directionsUri != null) ...[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: () => launchUrl(
                        job.directionsUri!,
                        mode: LaunchMode.externalApplication,
                      ),
                      icon: const Icon(Icons.directions_outlined, size: 18),
                      label: Text(
                        [job.customerAddress, job.customerDistrict]
                            .whereType<String>()
                            .where((s) => s.trim().isNotEmpty)
                            .join(', '),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
                if (job.cancellationReason != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'İptal gerekçesi: ${job.cancellationReason}',
                    style: tx.bodySmall.copyWith(
                      color: cs.danger600,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                if (job.scheduledAt != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Planlanan: ${_dateTimeFormat.format(job.scheduledAt!)}'
                    '${job.scheduledEndAt != null ? ' – ${_dateTimeFormat.format(job.scheduledEndAt!)}' : ''}',
                    style: tx.caption.copyWith(color: cs.textFaint),
                  ),
                ],
                if (job.startedAt != null)
                  Text(
                    'Başlama: ${_dateTimeFormat.format(job.startedAt!)}',
                    style: tx.caption.copyWith(color: cs.textFaint),
                  ),
                if (job.completedAt != null)
                  Text(
                    'Tamamlanma: ${_dateTimeFormat.format(job.completedAt!)}',
                    style: tx.caption.copyWith(color: cs.textFaint),
                  ),
                if (job.actualDuration != null)
                  Text(
                    'Süre: ${job.actualDuration!.inMinutes} dk',
                    style: tx.caption.copyWith(color: cs.textFaint),
                  )
                else if (job.status == JobStatus.completed)
                  Text(
                    'Süre: bilinmiyor (başlangıç kaydı yok)',
                    style: tx.caption.copyWith(
                      color: cs.textFaint,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                if (job.notes != null && job.notes!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(job.notes!, style: tx.bodySmall),
                ],
              ],
            ),
          ),

          if (isStaffOwner) ...[
            const SizedBox(height: 14),
            _buildStaffActions(job),
          ],
          if (isManagement) ...[
            const SizedBox(height: 14),
            _buildManagementActions(job),
          ],
          if (isTeamLead) ...[
            const SizedBox(height: 14),
            _ReassignStaffCard(job: job, onReassigned: _load),
          ],
          if (isCustomer && job.status == JobStatus.completed) ...[
            const SizedBox(height: 14),
            _RatingCard(
              jobId: job.id,
              currentRating: job.rating,
              onRated: _load,
            ),
            const SizedBox(height: 10),
            // Bölüm S (5. tur): 3 kriter + öneri + yorum — bir kez.
            _FeedbackCard(
              jobId: job.id,
              api: _api,
              submitted: job.feedbackSubmittedAt != null,
              onSubmitted: _load,
            ),
          ],

          const SizedBox(height: 18),
          Text(
            'Fotoğraflar',
            style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          _PhotosSection(
            jobId: job.id,
            photos: _photos,
            api: _api,
            onChanged: _load,
            canUpload: isStaffOwner || isManagement,
          ),

          if (_report != null) ...[
            const SizedBox(height: 18),
            Text(
              'İş Raporu',
              style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            _ReportCard(report: _report!),
          ] else if (isStaffOwner &&
              (job.status == JobStatus.inProgress ||
                  job.status == JobStatus.completed)) ...[
            const SizedBox(height: 18),
            // Bölüm N (4. tur): rapor öncesi kontrol listesi — eksikler
            // görünür kalır, "Raporu Tamamla" engellenmez.
            _ChecklistCard(jobId: job.id, api: _api, initial: job.checklist),
            const SizedBox(height: 18),
            Text(
              'İş Raporu Oluştur',
              style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            _ReportForm(jobId: job.id, api: _api, onCreated: _load),
          ],
        ],
      ),
    );
  }

  Widget _buildStaffActions(Job job) {
    final cs = context.colors;
    final next = validJobStatusTransitions[job.status]!
        .where((s) => s != job.status)
        .toList();
    if (next.isEmpty) return const SizedBox.shrink();
    return Row(
      children: [
        if (next.contains(JobStatus.inProgress))
          Expanded(
            child: ElevatedButton.icon(
              onPressed: _busy
                  ? null
                  : () => _changeStatus(JobStatus.inProgress),
              icon: const Icon(Icons.play_arrow_rounded, size: 18),
              label: const Text('Rotayı Başlat'),
            ),
          ),
        if (next.contains(JobStatus.completed)) ...[
          if (next.contains(JobStatus.inProgress)) const SizedBox(width: 10),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: _busy
                  ? null
                  : () => _changeStatus(JobStatus.completed),
              icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
              label: const Text('Tamamla'),
              style: ElevatedButton.styleFrom(backgroundColor: cs.success600),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildManagementActions(Job job) {
    final next = validJobStatusTransitions[job.status]!
        .where((s) => s != job.status)
        .toList();
    if (next.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: next
          .map(
            (s) => OutlinedButton(
              onPressed: _busy ? null : () => _changeStatus(s),
              child: Text(jobStatusLabelTr(s)),
            ),
          )
          .toList(),
    );
  }
}

class _Pill extends StatelessWidget {
  final String text;
  final IconData? icon;
  const _Pill({required this.text, this.icon});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: cs.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: cs.textSecondary),
            const SizedBox(width: 4),
          ],
          Text(text, style: tx.caption.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

/// Bölüm S (5. tur): Detaylı değerlendirme kartı — gönderilmişse teşekkür
/// metni, değilse alt sayfada form (hizmet kalitesi / dakiklik / personel +
/// tavsiye + yorum). Genel yıldız puanından bağımsız.
class _FeedbackCard extends StatelessWidget {
  final String jobId;
  final JobsApi api;
  final bool submitted;
  final VoidCallback onSubmitted;
  const _FeedbackCard({
    required this.jobId,
    required this.api,
    required this.submitted,
    required this.onSubmitted,
  });

  static const _criteria = <({String key, String label, String hint})>[
    (
      key: 'quality',
      label: 'Hizmet Kalitesi',
      hint: 'Uygulamanın etkinliği ve özeni',
    ),
    (key: 'punctuality', label: 'Dakiklik', hint: 'Randevu saatine uyum'),
    (
      key: 'staff',
      label: 'Personel Profesyonelliği',
      hint: 'İletişim, nezaket, bilgilendirme',
    ),
  ];

  Future<void> _openForm(BuildContext context) async {
    final cs = context.colors;
    final tx = context.text;
    final scores = <String, int>{};
    bool? recommend;
    final commentController = TextEditingController();
    var submitting = false;

    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Detaylı Değerlendirme',
                  style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                for (final c in _criteria) ...[
                  Text(
                    c.label,
                    style: tx.bodySmall.copyWith(fontWeight: FontWeight.w600),
                  ),
                  Text(c.hint, style: tx.caption.copyWith(color: cs.textFaint)),
                  Row(
                    children: [
                      for (var n = 1; n <= 5; n++)
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: () =>
                              setSheetState(() => scores[c.key] = n),
                          icon: Icon(
                            n <= (scores[c.key] ?? 0)
                                ? Icons.star_rounded
                                : Icons.star_outline_rounded,
                            color: n <= (scores[c.key] ?? 0)
                                ? cs.warning500
                                : cs.textFaint,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                ],
                Text(
                  'Bizi tavsiye eder misiniz?',
                  style: tx.bodySmall.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                SegmentedButton<bool>(
                  emptySelectionAllowed: true,
                  segments: const [
                    ButtonSegment(
                      value: true,
                      label: Text('Evet'),
                      icon: Icon(Icons.thumb_up_outlined, size: 16),
                    ),
                    ButtonSegment(
                      value: false,
                      label: Text('Hayır'),
                      icon: Icon(Icons.thumb_down_outlined, size: 16),
                    ),
                  ],
                  selected: recommend == null ? const {} : {recommend!},
                  onSelectionChanged: (s) => setSheetState(
                    () => recommend = s.isEmpty ? null : s.first,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: commentController,
                  decoration: const InputDecoration(
                    labelText: 'Yorumunuz (opsiyonel)',
                  ),
                  minLines: 2,
                  maxLines: 4,
                  maxLength: 2000,
                ),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: submitting || scores.length < _criteria.length
                      ? null
                      : () async {
                          setSheetState(() => submitting = true);
                          try {
                            await api.submitFeedback(
                              jobId,
                              serviceQualityScore: scores['quality']!,
                              punctualityScore: scores['punctuality']!,
                              staffProfessionalismScore: scores['staff']!,
                              wouldRecommend: recommend,
                              comment: commentController.text.trim(),
                            );
                            if (ctx.mounted) Navigator.of(ctx).pop(true);
                          } catch (e) {
                            if (ctx.mounted) {
                              setSheetState(() => submitting = false);
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    e is ApiException
                                        ? e.message
                                        : 'Gönderilemedi',
                                  ),
                                ),
                              );
                            }
                          }
                        },
                  child: Text(submitting ? 'Gönderiliyor...' : 'Gönder'),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
    if (done == true) onSubmitted();
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Row(
        children: [
          Icon(Icons.rate_review_outlined, color: cs.accentSoft, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              submitted ? 'Detaylı değerlendirmeniz alındı — teşekkürler.' : 'Hizmeti birkaç açıdan değerlendirin (kalite, dakiklik, personel).',
              style: tx.bodySmall,
            ),
          ),
          if (!submitted)
            TextButton(
              onPressed: () => _openForm(context),
              child: const Text('Detaylı Değerlendir'),
            ),
        ],
      ),
    );
  }
}

class _RatingCard extends StatefulWidget {
  final String jobId;
  final int? currentRating;
  final VoidCallback onRated;
  const _RatingCard({
    required this.jobId,
    required this.currentRating,
    required this.onRated,
  });

  @override
  State<_RatingCard> createState() => _RatingCardState();
}

class _RatingCardState extends State<_RatingCard> {
  final _api = JobsApi();
  int _rating = 0;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _rating = widget.currentRating ?? 0;
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await _api.rate(widget.jobId, _rating);
      widget.onRated();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Değerlendirme kaydedilemedi',
            ),
          ),
        );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final alreadyRated = widget.currentRating != null;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Bu işi değerlendirin',
            style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Row(
            children: List.generate(5, (i) {
              final filled = i < _rating;
              return IconButton(
                onPressed: alreadyRated
                    ? null
                    : () => setState(() => _rating = i + 1),
                icon: Icon(
                  filled ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: cs.warning500,
                  size: 28,
                ),
              );
            }),
          ),
          if (!alreadyRated)
            ElevatedButton(
              onPressed: _rating == 0 || _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Gönder'),
            ),
        ],
      ),
    );
  }
}

class _PhotosSection extends StatefulWidget {
  final String jobId;
  final List<Map<String, dynamic>> photos;
  final JobsApi api;
  final VoidCallback onChanged;
  final bool canUpload;

  const _PhotosSection({
    required this.jobId,
    required this.photos,
    required this.api,
    required this.onChanged,
    required this.canUpload,
  });

  @override
  State<_PhotosSection> createState() => _PhotosSectionState();
}

class _PhotosSectionState extends State<_PhotosSection> {
  bool _uploading = false;

  Future<void> _pickAndUpload(String type) async {
    final picker = ImagePicker();
    final xfile = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 80,
    );
    if (xfile == null) return;
    setState(() => _uploading = true);
    try {
      // XFile.readAsBytes web'de de çalışır (dart:io File çalışmaz).
      await widget.api.uploadPhoto(
        widget.jobId,
        await xfile.readAsBytes(),
        xfile.name,
        type,
      );
      widget.onChanged();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Fotoğraf yüklenemedi',
            ),
          ),
        );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.photos.isEmpty)
          Text(
            'Henüz fotoğraf yok',
            style: tx.bodySmall.copyWith(color: cs.textFaint),
          )
        else
          SizedBox(
            height: 84,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: widget.photos.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final p = widget.photos[i];
                // Bölüm AC: kimlik doğrulamalı görsel (/files/job-photo/:id).
                final path = widget.api.fileUrl('job-photo', p['id'] as String);
                return InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => showDialog<void>(
                    context: context,
                    builder: (_) => Dialog(
                      backgroundColor: Colors.black,
                      insetPadding: const EdgeInsets.all(12),
                      child: Stack(
                        alignment: Alignment.topRight,
                        children: [
                          InteractiveViewer(
                            child: AuthImage(path: path, fit: BoxFit.contain),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Colors.white),
                            onPressed: () => Navigator.of(context).pop(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: AuthImage(path: path, width: 84, height: 84),
                  ),
                );
              },
            ),
          ),
        if (widget.canUpload) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _uploading ? null : () => _pickAndUpload('BEFORE'),
                  icon: const Icon(Icons.camera_alt_outlined, size: 16),
                  label: const Text('Öncesi'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _uploading ? null : () => _pickAndUpload('AFTER'),
                  icon: const Icon(Icons.camera_alt_rounded, size: 16),
                  label: const Text('Sonrası'),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _ReportCard extends StatelessWidget {
  final Map<String, dynamic> report;
  const _ReportCard({required this.report});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Dozaj: ${report['dosage']}', style: tx.subtitle),
          if (report['productsUsed'] != null)
            Text(
              'Kullanılan ürünler: ${report['productsUsed']}',
              style: tx.bodySmall,
            ),
          if (report['notes'] != null)
            Text(report['notes'] as String, style: tx.bodySmall),
          if (report['signatureUrl'] != null) ...[
            const SizedBox(height: 8),
            Text(
              'Müşteri imzası alındı',
              style: tx.caption.copyWith(
                color: cs.success600,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Bölüm N (4. tur): Günlük kontrol listesi kartı — dokununca anında
/// kaydeder (PATCH /jobs/:id/checklist), sunucudan dönen tam listeyi gösterir.
class _ChecklistCard extends StatefulWidget {
  final String jobId;
  final JobsApi api;
  final List<JobChecklistEntry> initial;
  const _ChecklistCard({
    required this.jobId,
    required this.api,
    required this.initial,
  });

  @override
  State<_ChecklistCard> createState() => _ChecklistCardState();
}

class _ChecklistCardState extends State<_ChecklistCard> {
  late List<JobChecklistEntry> _entries = widget.initial;
  String? _busyItem;
  String? _error;

  Future<void> _toggle(JobChecklistEntry e) async {
    setState(() {
      _busyItem = e.item;
      _error = null;
    });
    try {
      final updated = await widget.api.updateChecklist(
        widget.jobId,
        item: e.item,
        isChecked: !e.isChecked,
      );
      if (mounted) setState(() => _entries = updated);
    } catch (err) {
      if (mounted) {
        setState(
          () => _error = err is ApiException ? err.message : 'Kaydedilemedi',
        );
      }
    } finally {
      if (mounted) setState(() => _busyItem = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final done = _entries.where((e) => e.isChecked).length;
    final complete = _entries.isNotEmpty && done == _entries.length;
    return Container(
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
              Icon(Icons.checklist_rounded, size: 18, color: cs.accentSoft),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Günlük Kontrol Listesi',
                  style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: complete ? cs.primary50 : cs.warning50,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  '$done/${_entries.length}',
                  style: tx.label.copyWith(
                    color: complete ? cs.primary700 : cs.warning600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          for (final e in _entries)
            CheckboxListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              activeColor: cs.primary600,
              value: e.isChecked,
              onChanged: _busyItem == null ? (_) => _toggle(e) : null,
              title: Text(
                e.item,
                style: tx.body.copyWith(
                  decoration: e.isChecked ? TextDecoration.lineThrough : null,
                  color: e.isChecked ? cs.textSecondary : cs.textPrimary,
                ),
              ),
            ),
          if (!complete && _entries.isNotEmpty)
            Text(
              '${_entries.length - done} öğe eksik — rapor yine gönderilebilir.',
              style: tx.caption.copyWith(color: cs.warning600),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                _error!,
                style: tx.caption.copyWith(color: cs.danger500),
              ),
            ),
        ],
      ),
    );
  }
}

class _ReportForm extends StatefulWidget {
  final String jobId;
  final JobsApi api;
  final VoidCallback onCreated;
  const _ReportForm({
    required this.jobId,
    required this.api,
    required this.onCreated,
  });

  @override
  State<_ReportForm> createState() => _ReportFormState();
}

class _UsedProductRow {
  String? productId;
  double quantity = 1;
}

class _ReportFormState extends State<_ReportForm> {
  final _dosageController = TextEditingController();
  final _notesController = TextEditingController();
  final _signatureController = SignatureController(
    penStrokeWidth: 2.5,
    // İmza tuvali her temada beyaz → mürekkep sabit koyu.
    penColor: AppColors.ink,
  );
  final _stockApi = StockApi();
  bool _saving = false;
  String? _error;
  bool _loadingProducts = true;
  List<Product> _availableProducts = [];
  final List<_UsedProductRow> _usedProducts = [];

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    try {
      final res = await _stockApi.list();
      if (!mounted) return;
      setState(() {
        _availableProducts = res.data;
        _loadingProducts = false;
      });
    } on ApiException {
      // STAFF'ın ürün listesine erişimi yoksa (beklenmez, backend GET
      // /products'ı STAFF'a açık tutar) sessizce boş liste ile devam et —
      // dozaj/imza/fotoğraf raporu ürünsüz de gönderilebilir.
      if (!mounted) return;
      setState(() => _loadingProducts = false);
    }
  }

  @override
  void dispose() {
    _dosageController.dispose();
    _notesController.dispose();
    _signatureController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_dosageController.text.trim().isEmpty) {
      setState(() => _error = 'Dozaj alanı zorunludur');
      return;
    }
    final rows = _usedProducts.where((r) => r.productId != null).toList();
    final ids = rows.map((r) => r.productId).toSet();
    if (ids.length != rows.length) {
      setState(() => _error = 'Aynı ürün birden fazla kez seçilemez');
      return;
    }
    if (rows.any((r) => r.quantity <= 0)) {
      setState(
        () => _error = 'Seçilen her ürün için miktar 0\'dan büyük olmalı',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      String? signatureDataUrl;
      if (_signatureController.isNotEmpty) {
        final bytes = await _signatureController.toPngBytes();
        if (bytes != null) signatureDataUrl = toSignatureDataUrl(bytes);
      }
      await widget.api.createReport(
        widget.jobId,
        products: rows
            .map((r) => (productId: r.productId!, quantity: r.quantity))
            .toList(),
        dosage: _dosageController.text.trim(),
        notes: _notesController.text.trim(),
        signatureBase64: signatureDataUrl,
      );
      widget.onCreated();
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Rapor oluşturulamadı',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _dosageController,
            decoration: const InputDecoration(labelText: 'Dozaj *'),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Kullanılan Ürünler (Stoktan Düşüm)',
                style: tx.bodySmall.copyWith(fontWeight: FontWeight.w600),
              ),
              if (!_loadingProducts && _availableProducts.isNotEmpty)
                TextButton(
                  onPressed: () =>
                      setState(() => _usedProducts.add(_UsedProductRow())),
                  child: const Text('+ Ürün Ekle'),
                ),
            ],
          ),
          if (_loadingProducts)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else if (_availableProducts.isEmpty)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: Text(
                'Stokta ürün bulunamadı',
                style: tx.bodySmall.copyWith(color: cs.textFaint),
              ),
            )
          else
            for (int i = 0; i < _usedProducts.length; i++)
              _UsedProductRowWidget(
                key: ValueKey(i),
                row: _usedProducts[i],
                products: _availableProducts,
                usedElsewhere: _usedProducts
                    .where((r) => r != _usedProducts[i])
                    .map((r) => r.productId)
                    .whereType<String>()
                    .toSet(),
                onChanged: () => setState(() {}),
                onRemove: () => setState(() => _usedProducts.removeAt(i)),
              ),
          const SizedBox(height: 4),
          TextField(
            controller: _notesController,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Notlar (opsiyonel)'),
          ),
          const SizedBox(height: 10),
          Text(
            'Müşteri İmzası',
            style: tx.bodySmall.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Container(
            height: 150,
            decoration: BoxDecoration(
              border: Border.all(color: cs.borderDefault),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Signature(
              controller: _signatureController,
              backgroundColor: Colors.white,
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => _signatureController.clear(),
              child: const Text('Temizle'),
            ),
          ),
          if (_error != null)
            Text(_error!, style: tx.bodySmall.copyWith(color: Colors.red)),
          const SizedBox(height: 6),
          ElevatedButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Raporu Gönder'),
          ),
        ],
      ),
    );
  }
}

/// Stitch Personel → İşler: ürün seçimi + tüp/şişe stepper'ı — bkz.
/// [_UsedProductRow] / JobsApi.createReport `products` parametresi.
class _UsedProductRowWidget extends StatelessWidget {
  final _UsedProductRow row;
  final List<Product> products;
  final Set<String> usedElsewhere;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  const _UsedProductRowWidget({
    super.key,
    required this.row,
    required this.products,
    required this.usedElsewhere,
    required this.onChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    Product? selected;
    for (final p in products) {
      if (p.id == row.productId) {
        selected = p;
        break;
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: cs.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                hint: const Text('Ürün seç'),
                value: row.productId,
                items: products
                    .where(
                      (p) =>
                          p.id == row.productId ||
                          !usedElsewhere.contains(p.id),
                    )
                    .map(
                      (p) => DropdownMenuItem(
                        value: p.id,
                        child: Text(
                          p.name,
                          overflow: TextOverflow.ellipsis,
                          style: tx.bodySmall,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (v) {
                  row.productId = v;
                  onChanged();
                },
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.remove_circle_outline, size: 20),
            onPressed: row.quantity > 1
                ? () {
                    row.quantity -= 1;
                    onChanged();
                  }
                : null,
          ),
          SizedBox(
            width: 32,
            child: Text(
              row.quantity.toStringAsFixed(
                row.quantity.truncateToDouble() == row.quantity ? 0 : 2,
              ),
              textAlign: TextAlign.center,
              style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.add_circle_outline, size: 20),
            onPressed: () {
              row.quantity += 1;
              onChanged();
            },
          ),
          if (selected != null)
            Padding(
              padding: const EdgeInsets.only(left: 4),
              child: Text(
                selected.unit,
                style: tx.caption.copyWith(color: cs.textFaint),
              ),
            ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: Icon(Icons.close_rounded, size: 18, color: cs.danger500),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}

/// Yalnızca TEAM_LEAD — backend/src/controllers/jobsController.ts:
/// teamLeadUpdateSchema. `StaffApi.list()` zaten backend'de ekiple
/// sınırlanmış geliyor (getTeamStaffIds), burada tekrar filtrelenmez.
class _ReassignStaffCard extends StatefulWidget {
  final Job job;
  final VoidCallback onReassigned;
  const _ReassignStaffCard({required this.job, required this.onReassigned});

  @override
  State<_ReassignStaffCard> createState() => _ReassignStaffCardState();
}

class _ReassignStaffCardState extends State<_ReassignStaffCard> {
  final _staffApi = StaffApi();
  final _jobsApi = JobsApi();
  List<Staff> _team = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _selectedStaffId;

  @override
  void initState() {
    super.initState();
    _selectedStaffId = widget.job.assignedStaffId;
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _staffApi.list();
      setState(() => _team = res.data);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Ekip yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (_selectedStaffId == null ||
        _selectedStaffId == widget.job.assignedStaffId)
      return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _jobsApi.reassignStaff(widget.job.id, _selectedStaffId!);
      widget.onReassigned();
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Atama güncellenemedi',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (_loading) {
      return const SizedBox(
        height: 48,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: cs.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ekipten Personel Ata',
            style: tx.body.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _selectedStaffId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Personel'),
            items: _team
                .map(
                  (s) => DropdownMenuItem(value: s.id, child: Text(s.fullName)),
                )
                .toList(),
            onChanged: (v) => setState(() => _selectedStaffId = v),
          ),
          if (_error != null) ...[
            const SizedBox(height: 6),
            Text(_error!, style: tx.bodySmall.copyWith(color: Colors.red)),
          ],
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed:
                (_saving || _selectedStaffId == widget.job.assignedStaffId)
                ? null
                : _submit,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Atamayı Güncelle'),
          ),
        ],
      ),
    );
  }
}
