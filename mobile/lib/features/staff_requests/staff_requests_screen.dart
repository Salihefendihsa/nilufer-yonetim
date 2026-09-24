import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/staff_request.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/chip_bar.dart';
import '../../widgets/staggered_fade_in.dart';
import '../../widgets/state_views.dart';
import 'staff_requests_api.dart';

final _dateTimeFormat = DateFormat('d MMM yyyy HH:mm', 'tr_TR');

Color _statusColor(AppPalette cs, String status) {
  switch (status) {
    case 'OPEN':
      return cs.danger600;
    case 'IN_PROGRESS':
      return cs.warning600;
    case 'RESOLVED':
      return cs.success600;
    default:
      return cs.textSecondary;
  }
}

Color _priorityColor(AppPalette cs, String priority) {
  switch (priority) {
    case 'HIGH':
      return cs.danger600;
    case 'MEDIUM':
      return cs.info600;
    default:
      return cs.textSecondary;
  }
}

/// Personel → Patron genel talep kanalı. MANAGER/TEAM_LEAD/STAFF →
/// "Taleplerim" (yeni talep + geçmiş); OWNER → "Personel Talepleri" (yanıt,
/// durum). Web `/taleplerim` ve `/personel-talepleri` ile aynı; mod yalnızca
/// giriş yapan kullanıcının gerçek rolünden seçilir, kapsamı backend daraltır.
class StaffRequestsScreen extends StatefulWidget {
  const StaffRequestsScreen({super.key});

  @override
  State<StaffRequestsScreen> createState() => _StaffRequestsScreenState();
}

class _StaffRequestsScreenState extends State<StaffRequestsScreen> {
  final _api = StaffRequestsApi();
  List<StaffRequest> _items = [];
  bool _loading = true;
  String? _error;
  String? _status;
  String? _category;

  bool get _isOwner => context.read<AuthProvider>().user?.role == AppRole.owner;

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
      final items = await _api.list(status: _status, category: _category);
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is ApiException ? e.message : 'Talepler yüklenemedi',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCreate() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const _NewStaffRequestScreen()),
    );
    if (created == true) {
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Talebiniz Patron'a iletildi.")),
        );
      }
    }
  }

  Future<void> _openRespond(StaffRequest r) async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => _RespondStaffRequestScreen(request: r)),
    );
    if (updated == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final isOwner = _isOwner;
    return Scaffold(
      appBar: AppBar(
        title: Text(isOwner ? 'Personel Talepleri' : 'Taleplerim'),
      ),
      floatingActionButton: isOwner
          ? null
          : FloatingActionButton.extended(
              onPressed: _openCreate,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Yeni Talep'),
            ),
      body: Column(
        children: [
          ChipBar(
            spacing: 0,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            children: [
              for (final s in [
                null,
                'OPEN',
                'IN_PROGRESS',
                'RESOLVED',
                'REJECTED',
              ]) ...[
                ChoiceChip(
                  label: Text(
                    s == null ? 'Tümü' : staffRequestStatusLabels[s]!,
                  ),
                  selected: _status == s,
                  onSelected: (_) {
                    setState(() => _status = s);
                    _load();
                  },
                ),
                const SizedBox(width: 6),
              ],
              const SizedBox(width: 8),
              for (final c in staffRequestCategoryLabels.keys) ...[
                FilterChip(
                  label: Text(staffRequestCategoryLabels[c]!),
                  selected: _category == c,
                  onSelected: (sel) {
                    setState(() => _category = sel ? c : null);
                    _load();
                  },
                ),
                const SizedBox(width: 6),
              ],
            ],
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorRetryView(message: _error!, onRetry: _load)
                : _items.isEmpty
                ? EmptyStateView(
                    title: isOwner ? 'Talep yok' : 'Henüz talebiniz yok',
                    subtitle: isOwner
                        ? 'Bu filtreyle eşleşen personel talebi bulunmuyor.'
                        : 'Bir ihtiyacınız ya da öneriniz olursa buradan iletebilirsiniz.',
                    icon: Icons.move_to_inbox_outlined,
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    color: cs.accentSoft,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                      itemCount: _items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, i) => StaggeredFadeIn(
                        index: i,
                        child: StaffRequestTile(
                          request: _items[i],
                          showRequester: isOwner,
                          onTap: isOwner ? () => _openRespond(_items[i]) : null,
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

class StaffRequestTile extends StatelessWidget {
  final StaffRequest request;
  final bool showRequester;
  final VoidCallback? onTap;
  const StaffRequestTile({
    super.key,
    required this.request,
    this.showRequester = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final r = request;
    return Material(
      color: cs.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.card),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: cs.borderDefault),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      r.subject,
                      style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _Pill(
                    staffRequestStatusLabels[r.status] ?? r.status,
                    _statusColor(cs, r.status),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                [
                  if (showRequester && r.staffName != null)
                    r.staffRole != null
                        ? '${r.staffName} (${roleLabelTr(r.staffRole!)})'
                        : r.staffName!,
                  _dateTimeFormat.format(DateTime.parse(r.createdAt)),
                ].join(' · '),
                style: tx.caption,
              ),
              const SizedBox(height: 8),
              Text(r.description, style: tx.bodySmall),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _Pill(
                    staffRequestCategoryLabels[r.category] ?? r.category,
                    cs.accentSoft,
                  ),
                  _Pill(
                    '${staffRequestPriorityLabels[r.priority] ?? r.priority} öncelik',
                    _priorityColor(cs, r.priority),
                  ),
                ],
              ),
              if (r.responseNote != null && r.responseNote!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: cs.success50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'Patron yanıtı: ${r.responseNote}'
                    '${r.resolvedAt != null ? ' · ${_dateTimeFormat.format(DateTime.parse(r.resolvedAt!))}' : ''}',
                    style: tx.caption.copyWith(color: cs.success600),
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
    final tx = context.text;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(text, style: tx.label.copyWith(color: color)),
    );
  }
}

/// Personel: yeni talep formu — kategori, öncelik, konu, açıklama.
class _NewStaffRequestScreen extends StatefulWidget {
  const _NewStaffRequestScreen();

  @override
  State<_NewStaffRequestScreen> createState() => _NewStaffRequestScreenState();
}

class _NewStaffRequestScreenState extends State<_NewStaffRequestScreen> {
  final _api = StaffRequestsApi();
  final _subject = TextEditingController();
  final _description = TextEditingController();
  String _category = 'EQUIPMENT';
  String _priority = 'MEDIUM';
  bool _saving = false;
  String? _error;

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
        category: _category,
        priority: _priority,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Gönderilemedi');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(title: const Text('Yeni Talep')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            initialValue: _category,
            decoration: const InputDecoration(labelText: 'Kategori'),
            items: [
              for (final e in staffRequestCategoryLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _category = v ?? _category),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _priority,
            decoration: const InputDecoration(labelText: 'Öncelik'),
            items: [
              for (final e in staffRequestPriorityLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _priority = v ?? _priority),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _subject,
            maxLength: 200,
            decoration: const InputDecoration(
              labelText: 'Konu',
              hintText: 'Örn. Yeni pülverizatör ihtiyacı',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLength: 4000,
            maxLines: 5,
            decoration: const InputDecoration(
              labelText: 'Açıklama',
              hintText: 'Talebinizi ayrıntılı anlatın (en az 10 karakter).',
              alignLabelWithHint: true,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: tx.bodySmall.copyWith(color: cs.danger600)),
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

/// OWNER: durum / öncelik / yanıt notu.
class _RespondStaffRequestScreen extends StatefulWidget {
  final StaffRequest request;
  const _RespondStaffRequestScreen({required this.request});

  @override
  State<_RespondStaffRequestScreen> createState() =>
      _RespondStaffRequestScreenState();
}

class _RespondStaffRequestScreenState
    extends State<_RespondStaffRequestScreen> {
  final _api = StaffRequestsApi();
  late String _status = widget.request.status;
  late String _priority = widget.request.priority;
  late final _note = TextEditingController(
    text: widget.request.responseNote ?? '',
  );
  bool _saving = false;
  String? _error;

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
      await _api.respond(
        widget.request.id,
        status: _status,
        priority: _priority,
        responseNote: _note.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Kaydedilemedi');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(title: const Text('Talebi Yanıtla')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          StaffRequestTile(request: widget.request, showRequester: true),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _status,
            decoration: const InputDecoration(labelText: 'Durum'),
            items: [
              for (final e in staffRequestStatusLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _status = v ?? _status),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _priority,
            decoration: const InputDecoration(labelText: 'Öncelik'),
            items: [
              for (final e in staffRequestPriorityLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _priority = v ?? _priority),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            maxLines: 4,
            maxLength: 4000,
            decoration: const InputDecoration(
              labelText: 'Yanıt notu (talep sahibine bildirilir)',
              alignLabelWithHint: true,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: tx.bodySmall.copyWith(color: cs.danger600)),
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
