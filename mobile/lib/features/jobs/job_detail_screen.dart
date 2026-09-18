import 'dart:io';

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
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    final job = _job!;
    final isStaffOwner = _role == AppRole.staff;
    final isManagement = _role == AppRole.owner || _role == AppRole.manager;
    final isCustomer = _role == AppRole.customer;
    final isTeamLead = _role == AppRole.teamLead;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(AppRadius.sheet),
              border: Border.all(color: AppColors.borderDefault),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  job.customerName ?? 'Müşteri',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  job.serviceType,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _Pill(text: jobStatusLabelTr(job.status)),
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
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.danger600,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                if (job.scheduledAt != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Planlanan: ${_dateTimeFormat.format(job.scheduledAt!)}'
                    '${job.scheduledEndAt != null ? ' – ${_dateTimeFormat.format(job.scheduledEndAt!)}' : ''}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textFaint,
                    ),
                  ),
                ],
                if (job.startedAt != null)
                  Text(
                    'Başlama: ${_dateTimeFormat.format(job.startedAt!)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textFaint,
                    ),
                  ),
                if (job.completedAt != null)
                  Text(
                    'Tamamlanma: ${_dateTimeFormat.format(job.completedAt!)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textFaint,
                    ),
                  ),
                if (job.actualDuration != null)
                  Text(
                    'Süre: ${job.actualDuration!.inMinutes} dk',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textFaint,
                    ),
                  )
                else if (job.status == JobStatus.completed)
                  const Text(
                    'Süre: bilinmiyor (başlangıç kaydı yok)',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textFaint,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                if (job.notes != null && job.notes!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(job.notes!, style: const TextStyle(fontSize: 13)),
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
          ],

          const SizedBox(height: 18),
          const Text(
            'Fotoğraflar',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
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
            const Text(
              'İş Raporu',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
            ),
            const SizedBox(height: 8),
            _ReportCard(report: _report!),
          ] else if (isStaffOwner &&
              (job.status == JobStatus.inProgress ||
                  job.status == JobStatus.completed)) ...[
            const SizedBox(height: 18),
            // Bölüm N (4. tur): rapor öncesi kontrol listesi — eksikler
            // görünür kalır, "Raporu Tamamla" engellenmez.
            _ChecklistCard(
              jobId: job.id,
              api: _api,
              initial: job.checklist,
            ),
            const SizedBox(height: 18),
            const Text(
              'İş Raporu Oluştur',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
            ),
            const SizedBox(height: 8),
            _ReportForm(jobId: job.id, api: _api, onCreated: _load),
          ],
        ],
      ),
    );
  }

  Widget _buildStaffActions(Job job) {
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
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success600,
              ),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: AppColors.textSecondary),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
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
    final alreadyRated = widget.currentRating != null;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bu işi değerlendirin',
            style: TextStyle(fontWeight: FontWeight.w700),
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
                  color: AppColors.warning500,
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
      await widget.api.uploadPhoto(widget.jobId, File(xfile.path), type);
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.photos.isEmpty)
          const Text(
            'Henüz fotoğraf yok',
            style: TextStyle(fontSize: 12.5, color: AppColors.textFaint),
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
                final url = widget.api.resolveUploadUrl(p['url'] as String);
                return ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    url,
                    width: 84,
                    height: 84,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 84,
                      height: 84,
                      color: AppColors.surfaceMuted,
                      child: const Icon(Icons.broken_image_outlined),
                    ),
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
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Dozaj: ${report['dosage']}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          if (report['productsUsed'] != null)
            Text(
              'Kullanılan ürünler: ${report['productsUsed']}',
              style: const TextStyle(fontSize: 13),
            ),
          if (report['notes'] != null)
            Text(
              report['notes'] as String,
              style: const TextStyle(fontSize: 13),
            ),
          if (report['signatureUrl'] != null) ...[
            const SizedBox(height: 8),
            const Text(
              'Müşteri imzası alındı',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.success600,
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
    final done = _entries.where((e) => e.isChecked).length;
    final complete = _entries.isNotEmpty && done == _entries.length;
    return Container(
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
                Icons.checklist_rounded,
                size: 18,
                color: AppColors.primary600,
              ),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  'Günlük Kontrol Listesi',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: complete ? AppColors.primary50 : AppColors.warning50,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  '$done/${_entries.length}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: complete
                        ? AppColors.primary700
                        : AppColors.warning600,
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
              activeColor: AppColors.primary600,
              value: e.isChecked,
              onChanged: _busyItem == null ? (_) => _toggle(e) : null,
              title: Text(
                e.item,
                style: TextStyle(
                  fontSize: 13.5,
                  decoration: e.isChecked ? TextDecoration.lineThrough : null,
                  color: e.isChecked
                      ? AppColors.textSecondary
                      : AppColors.textPrimary,
                ),
              ),
            ),
          if (!complete && _entries.isNotEmpty)
            Text(
              '${_entries.length - done} öğe eksik — rapor yine gönderilebilir.',
              style: const TextStyle(fontSize: 11.5, color: AppColors.warning600),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                _error!,
                style: const TextStyle(fontSize: 11.5, color: AppColors.danger500),
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
    penColor: AppColors.textPrimary,
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
      setState(() => _error = 'Seçilen her ürün için miktar 0\'dan büyük olmalı');
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
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
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
              const Text(
                'Kullanılan Ürünler (Stoktan Düşüm)',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
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
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: Text(
                'Stokta ürün bulunamadı',
                style: TextStyle(fontSize: 12.5, color: AppColors.textFaint),
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
          const Text(
            'Müşteri İmzası',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            height: 150,
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.borderDefault),
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
            Text(
              _error!,
              style: const TextStyle(color: Colors.red, fontSize: 12.5),
            ),
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
        color: AppColors.surfaceMuted,
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
                      (p) => p.id == row.productId || !usedElsewhere.contains(p.id),
                    )
                    .map(
                      (p) => DropdownMenuItem(
                        value: p.id,
                        child: Text(
                          p.name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13),
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
              row.quantity.toStringAsFixed(row.quantity.truncateToDouble() == row.quantity ? 0 : 2),
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w700),
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
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.textFaint,
                ),
              ),
            ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(
              Icons.close_rounded,
              size: 18,
              color: AppColors.danger500,
            ),
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
    if (_loading) {
      return const SizedBox(
        height: 48,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ekipten Personel Ata',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
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
            Text(
              _error!,
              style: const TextStyle(color: Colors.red, fontSize: 12.5),
            ),
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
