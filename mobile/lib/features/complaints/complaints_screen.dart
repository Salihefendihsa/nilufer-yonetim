import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/complaint.dart';
import '../../models/job.dart';
import '../../models/staff.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import '../jobs/jobs_api.dart';
import '../staff/staff_api.dart';
import 'complaints_api.dart';

final _dateTimeFormat = DateFormat('d MMM yyyy HH:mm', 'tr_TR');

Color _statusColor(String status) {
  switch (status) {
    case 'OPEN':
      return AppColors.danger600;
    case 'IN_PROGRESS':
      return AppColors.warning600;
    case 'RESOLVED':
      return AppColors.success600;
    default:
      return AppColors.textSecondary;
  }
}

Color _priorityColor(String priority) {
  switch (priority) {
    case 'HIGH':
      return AppColors.danger600;
    case 'MEDIUM':
      return AppColors.info600;
    default:
      return AppColors.textSecondary;
  }
}

/// Bölüm AO (9. tur): CUSTOMER → "Şikayetlerim" (form + geçmiş);
/// OWNER/MANAGER → "Şikayetler" (durum/öncelik filtresi, atama, çözüm notu).
/// Bekleyen Onaylar'dan AYRI bir akış — web `/sikayetler` ile aynı.
class ComplaintsScreen extends StatefulWidget {
  const ComplaintsScreen({super.key});

  @override
  State<ComplaintsScreen> createState() => _ComplaintsScreenState();
}

class _ComplaintsScreenState extends State<ComplaintsScreen> {
  final _api = ComplaintsApi();
  List<CustomerComplaint> _items = [];
  bool _loading = true;
  String? _error;
  String? _status;
  String? _priority;

  bool get _isCustomer =>
      context.read<AuthProvider>().user?.role == AppRole.customer;

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
      final items = await _api.list(status: _status, priority: _priority);
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is ApiException
              ? e.message
              : 'Şikayetler yüklenemedi',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCreate() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const _NewComplaintScreen()),
    );
    if (created == true) {
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Şikayetiniz iletildi.')),
        );
      }
    }
  }

  Future<void> _openManage(CustomerComplaint c) async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => _ManageComplaintScreen(complaint: c)),
    );
    if (updated == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final isCustomer = _isCustomer;
    return Scaffold(
      appBar: AppBar(title: Text(isCustomer ? 'Şikayetlerim' : 'Şikayetler')),
      floatingActionButton: isCustomer
          ? FloatingActionButton.extended(
              onPressed: _openCreate,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Yeni Şikayet'),
            )
          : null,
      body: Column(
        children: [
          SizedBox(
            height: 46,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              children: [
                for (final s in [null, 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) ...[
                  ChoiceChip(
                    label: Text(s == null ? 'Tümü' : complaintStatusLabels[s]!),
                    selected: _status == s,
                    onSelected: (_) {
                      setState(() => _status = s);
                      _load();
                    },
                  ),
                  const SizedBox(width: 6),
                ],
                if (!isCustomer) ...[
                  const SizedBox(width: 8),
                  for (final p in ['HIGH', 'MEDIUM', 'LOW']) ...[
                    FilterChip(
                      label: Text(complaintPriorityLabels[p]!),
                      selected: _priority == p,
                      onSelected: (sel) {
                        setState(() => _priority = sel ? p : null);
                        _load();
                      },
                    ),
                    const SizedBox(width: 6),
                  ],
                ],
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorRetryView(message: _error!, onRetry: _load)
                : _items.isEmpty
                ? EmptyStateView(
                    title: isCustomer ? 'Henüz şikayetiniz yok' : 'Şikayet yok',
                    subtitle: isCustomer
                        ? 'Bir sorun yaşarsanız buradan bildirebilirsiniz.'
                        : 'Bu filtreyle eşleşen şikayet bulunmuyor.',
                    icon: Icons.report_problem_outlined,
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    color: AppColors.primary600,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                      itemCount: _items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) => ComplaintTile(
                        complaint: _items[i],
                        showCustomer: !isCustomer,
                        onTap: isCustomer ? null : () => _openManage(_items[i]),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class ComplaintTile extends StatelessWidget {
  final CustomerComplaint complaint;
  final bool showCustomer;
  final VoidCallback? onTap;
  const ComplaintTile({
    super.key,
    required this.complaint,
    this.showCustomer = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = complaint;
    return Material(
      color: AppColors.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.card),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: AppColors.borderDefault),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      c.subject,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  _Pill(
                    complaintStatusLabels[c.status] ?? c.status,
                    _statusColor(c.status),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                [
                  if (showCustomer && c.customerName != null) c.customerName!,
                  _dateTimeFormat.format(DateTime.parse(c.createdAt)),
                  if (c.jobSequenceNo != null)
                    'İş #NLF-${c.jobSequenceNo} (${c.jobServiceType ?? ''})',
                  if (c.assignedToName != null)
                    'Sorumlu: ${c.assignedToName}'
                  else if (showCustomer)
                    'Atanmamış',
                ].join(' · '),
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              Text(c.description, style: const TextStyle(fontSize: 13)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _Pill(
                    '${complaintPriorityLabels[c.priority] ?? c.priority} öncelik',
                    _priorityColor(c.priority),
                  ),
                ],
              ),
              if (c.resolutionNote != null && c.resolutionNote!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.success50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'Çözüm: ${c.resolutionNote}'
                    '${c.resolvedAt != null ? ' · ${_dateTimeFormat.format(DateTime.parse(c.resolvedAt!))}' : ''}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.success600,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String text;
  final Color color;
  const _Pill(this.text, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

/// CUSTOMER: yeni şikayet formu — konu, açıklama, opsiyonel iş, aciliyet.
class _NewComplaintScreen extends StatefulWidget {
  const _NewComplaintScreen();

  @override
  State<_NewComplaintScreen> createState() => _NewComplaintScreenState();
}

class _NewComplaintScreenState extends State<_NewComplaintScreen> {
  final _api = ComplaintsApi();
  final _subject = TextEditingController();
  final _description = TextEditingController();
  String _priority = 'MEDIUM';
  String? _jobId;
  List<Job> _jobs = const [];
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Müşteri kendi işlerini görür — GET /jobs kayıt bazlı filtreler.
    JobsApi().list(limit: 50).then((r) {
      if (mounted) setState(() => _jobs = r.data);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      await _api.create(
        subject: _subject.text.trim(),
        description: _description.text.trim(),
        priority: _priority,
        jobId: _jobId,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Gönderilemedi',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yeni Şikayet')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _subject,
            maxLength: 200,
            decoration: const InputDecoration(
              labelText: 'Konu',
              hintText: 'Örn. İlaçlama sonrası haşere devam ediyor',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLength: 4000,
            maxLines: 5,
            decoration: const InputDecoration(
              labelText: 'Açıklama',
              hintText: 'Sorunu ayrıntılı anlatın (en az 10 karakter).',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: _jobId,
            decoration: const InputDecoration(labelText: 'İlgili iş (opsiyonel)'),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('— Seçilmedi —')),
              for (final j in _jobs)
                DropdownMenuItem<String?>(
                  value: j.id,
                  child: Text('#NLF-${j.sequenceNo ?? ''} · ${j.serviceType}'),
                ),
            ],
            onChanged: (v) => setState(() => _jobId = v),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _priority,
            decoration: const InputDecoration(labelText: 'Aciliyet'),
            items: [
              for (final e in complaintPriorityLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _priority = v ?? 'MEDIUM'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.danger600)),
          ],
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _saving ? null : _submit,
            child: Text(_saving ? 'Gönderiliyor...' : 'Gönder'),
          ),
        ],
      ),
    );
  }
}

/// OWNER/MANAGER: durum / öncelik / atama / çözüm notu.
class _ManageComplaintScreen extends StatefulWidget {
  final CustomerComplaint complaint;
  const _ManageComplaintScreen({required this.complaint});

  @override
  State<_ManageComplaintScreen> createState() => _ManageComplaintScreenState();
}

class _ManageComplaintScreenState extends State<_ManageComplaintScreen> {
  final _api = ComplaintsApi();
  late String _status = widget.complaint.status;
  late String _priority = widget.complaint.priority;
  late String? _assignee = widget.complaint.assignedToUserId;
  late final _note = TextEditingController(
    text: widget.complaint.resolutionNote ?? '',
  );
  List<Staff> _staff = const [];
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    StaffApi().list().then((r) {
      if (mounted) setState(() => _staff = r.data);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      await _api.update(
        widget.complaint.id,
        status: _status,
        priority: _priority,
        assignedToUserId: _assignee,
        clearAssignee: _assignee == null,
        resolutionNote: _note.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Kaydedilemedi',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.read<AuthProvider>().user;
    final c = widget.complaint;
    final knownIds = {
      if (me != null) me.id,
      ..._staff.map((s) => s.userId),
    };
    return Scaffold(
      appBar: AppBar(title: const Text('Şikayeti Yönet')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ComplaintTile(complaint: c, showCustomer: true),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _status,
            decoration: const InputDecoration(labelText: 'Durum'),
            items: [
              for (final e in complaintStatusLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _status = v ?? _status),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _priority,
            decoration: const InputDecoration(labelText: 'Öncelik'),
            items: [
              for (final e in complaintPriorityLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _priority = v ?? _priority),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: _assignee,
            decoration: const InputDecoration(labelText: 'Sorumlu'),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('— Atanmamış —')),
              if (me != null)
                DropdownMenuItem<String?>(value: me.id, child: Text('Bana ata (${me.fullName})')),
              for (final s in _staff)
                DropdownMenuItem<String?>(
                  value: s.userId,
                  child: Text('${s.fullName} · ${s.position}'),
                ),
              // Atanan kişi listede yoksa (başka yönetici) seçili kalsın.
              if (_assignee != null && !knownIds.contains(_assignee))
                DropdownMenuItem<String?>(
                  value: _assignee,
                  child: Text(c.assignedToName ?? 'Atanan'),
                ),
            ],
            onChanged: (v) => setState(() => _assignee = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            maxLines: 4,
            maxLength: 4000,
            decoration: InputDecoration(
              labelText: _status == 'RESOLVED' || _status == 'CLOSED'
                  ? 'Çözüm notu (müşteriye bildirilir)'
                  : 'Çözüm notu (opsiyonel)',
              alignLabelWithHint: true,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.danger600)),
          ],
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Kaydediliyor...' : 'Kaydet'),
          ),
        ],
      ),
    );
  }
}
