import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';

/// Bölüm X (6. tur): backend/prisma/schema.prisma → CustomerTag.
class CustomerTag {
  final String id;
  final String name;

  /// #RRGGBB
  final String color;
  final bool isActive;
  final int customerCount;

  const CustomerTag({
    required this.id,
    required this.name,
    required this.color,
    this.isActive = true,
    this.customerCount = 0,
  });

  factory CustomerTag.fromJson(Map<String, dynamic> json) => CustomerTag(
    id: json['id'] as String,
    name: json['name'] as String? ?? '',
    color: json['color'] as String? ?? '#3D8A4E',
    isActive: json['isActive'] as bool? ?? true,
    customerCount: (json['customerCount'] as num?)?.toInt() ?? 0,
  );

  Color get colorValue => colorFromHex(color);
}

/// "#RRGGBB" → Color; bozuk değerde marka yeşili.
Color colorFromHex(String hex) {
  final clean = hex.replaceFirst('#', '');
  if (clean.length != 6) return AppColors.primary600;
  final v = int.tryParse(clean, radix: 16);
  return v == null ? AppColors.primary600 : Color(0xFF000000 | v);
}

String colorToHex(Color c) {
  final r = (c.r * 255).round().toRadixString(16).padLeft(2, '0');
  final g = (c.g * 255).round().toRadixString(16).padLeft(2, '0');
  final b = (c.b * 255).round().toRadixString(16).padLeft(2, '0');
  return '#$r$g$b'.toUpperCase();
}

class CustomerTagsApi {
  final _api = ApiClient.instance;

  Future<List<CustomerTag>> list({bool includeInactive = false}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/customer-tags',
      query: {if (includeInactive) 'includeInactive': 'true'},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(CustomerTag.fromJson)
        .toList();
  }

  Future<CustomerTag> create(String name, String color) async =>
      CustomerTag.fromJson(
        await _api.post<Map<String, dynamic>>(
          '/customer-tags',
          body: {'name': name, 'color': color},
        ),
      );

  Future<CustomerTag> update(String id, Map<String, dynamic> body) async =>
      CustomerTag.fromJson(
        await _api.patch<Map<String, dynamic>>(
          '/customer-tags/$id',
          body: body,
        ),
      );

  Future<void> delete(String id) => _api.delete<void>('/customer-tags/$id');

  /// Müşterinin etiket kümesini tam olarak eşitler.
  Future<List<CustomerTag>> setForCustomer(
    String customerId,
    List<String> tagIds,
  ) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/customers/$customerId/tags',
      body: {'tagIds': tagIds},
    );
    return ((json['tags'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(CustomerTag.fromJson)
        .toList();
  }
}

/// Renkli küçük etiket rozeti.
class CustomerTagChip extends StatelessWidget {
  final CustomerTag tag;
  final bool dimmed;
  final VoidCallback? onTap;
  const CustomerTagChip({
    super.key,
    required this.tag,
    this.dimmed = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final tx = context.text;
    final c = tag.colorValue;
    final chip = Opacity(
      opacity: dimmed ? 0.4 : 1,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: c.withValues(alpha: 0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: c, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
            Text(tag.name, style: tx.label.copyWith(color: c)),
          ],
        ),
      ),
    );
    return onTap == null ? chip : GestureDetector(onTap: onTap, child: chip);
  }
}

/// Müşteri detayında etiket düzenleme — aktif etiketler çip olarak, dokununca
/// küme POST /customers/:id/tags ile eşitlenir. editable=false → yalnızca gösterir.
class CustomerTagEditor extends StatefulWidget {
  final String customerId;
  final List<CustomerTag> initial;
  final bool editable;
  const CustomerTagEditor({
    super.key,
    required this.customerId,
    required this.initial,
    required this.editable,
  });

  @override
  State<CustomerTagEditor> createState() => _CustomerTagEditorState();
}

class _CustomerTagEditorState extends State<CustomerTagEditor> {
  final _api = CustomerTagsApi();
  List<CustomerTag> _available = [];
  late List<CustomerTag> _current = widget.initial;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.editable) {
      _api
          .list()
          .then((v) {
            if (mounted) setState(() => _available = v);
          })
          .catchError((_) {});
    }
  }

  Future<void> _toggle(CustomerTag t) async {
    final has = _current.any((x) => x.id == t.id);
    final next = has
        ? _current.where((x) => x.id != t.id).toList()
        : [..._current, t];
    setState(() => _busy = true);
    try {
      final updated = await _api.setForCustomer(
        widget.customerId,
        next.map((x) => x.id).toList(),
      );
      if (mounted) setState(() => _current = updated);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    if (!widget.editable) {
      if (_current.isEmpty) return const SizedBox.shrink();
      return Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [for (final t in _current) CustomerTagChip(tag: t)],
      );
    }
    if (_available.isEmpty) {
      return Text(
        'Tanımlı etiket yok — Ayarlar → Müşteri Etiketleri.',
        style: tx.caption.copyWith(color: cs.textFaint),
      );
    }
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final t in _available)
          CustomerTagChip(
            tag: t,
            dimmed: !_current.any((x) => x.id == t.id),
            onTap: _busy ? null : () => _toggle(t),
          ),
      ],
    );
  }
}

const _presetColors = [
  '#3D8A4E',
  '#1F6FA8',
  '#B57F13',
  '#C0392B',
  '#6B4FBB',
  '#0F766E',
  '#7C8A7F',
  '#D97706',
];

/// Ayarlar → Müşteri Etiketleri (OWNER/MANAGER): ekle / düzenle / pasif / sil.
class CustomerTagsScreen extends StatefulWidget {
  const CustomerTagsScreen({super.key});

  @override
  State<CustomerTagsScreen> createState() => _CustomerTagsScreenState();
}

class _CustomerTagsScreenState extends State<CustomerTagsScreen> {
  final _api = CustomerTagsApi();
  List<CustomerTag> _items = [];
  bool _loading = true;
  String? _error;
  bool _busy = false;

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
      final items = await _api.list(includeInactive: true);
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) {
        setState(
          () =>
              _error = e is ApiException ? e.message : 'Etiketler yüklenemedi',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm({CustomerTag? existing}) async {
    final cs = context.colors;
    final tx = context.text;
    final name = TextEditingController(text: existing?.name ?? '');
    var color = existing?.color ?? _presetColors.first;
    final saved = await showModalBottomSheet<bool>(
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                existing == null ? 'Yeni Etiket' : 'Etiketi Düzenle',
                style: tx.subtitle.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Etiket adı *'),
                maxLength: 40,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final c in _presetColors)
                    GestureDetector(
                      onTap: () => setSheetState(() => color = c),
                      child: Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: colorFromHex(c),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: color == c
                                ? cs.textPrimary
                                : Colors.transparent,
                            width: 2.5,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: CustomerTagChip(
                  tag: CustomerTag(
                    id: 'preview',
                    name: name.text.isEmpty ? 'Önizleme' : name.text,
                    color: color,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  if (name.text.trim().isEmpty) return;
                  try {
                    if (existing == null) {
                      await _api.create(name.text.trim(), color);
                    } else {
                      await _api.update(existing.id, {
                        'name': name.text.trim(),
                        'color': color,
                      });
                    }
                    if (ctx.mounted) Navigator.of(ctx).pop(true);
                  } on ApiException catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx)
                          .showSnackBar(SnackBar(content: Text(e.message)));
                    }
                  }
                },
                child: const Text('Kaydet'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _delete(CustomerTag t) async {
    final cs = context.colors;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Etiketi sil'),
        content: Text(
          '"${t.name}" silinecek ve ${t.customerCount} müşteriden kaldırılacak. Geri alınamaz.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: cs.danger500),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await _api.delete(t.id);
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Müşteri Etiketleri'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            tooltip: 'Yeni etiket',
            onPressed: () => _openForm(),
          ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _items.isEmpty
          ? const EmptyStateView(
              title: 'Henüz etiket yok',
              subtitle: 'VIP, Kurumsal, Konut gibi segmentler ekleyin.',
              icon: Icons.label_outline_rounded,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: cs.accentSoft,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final t = _items[i];
                  return Container(
                    padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
                    decoration: BoxDecoration(
                      color: cs.surfaceCard,
                      borderRadius: BorderRadius.circular(AppRadius.card),
                      border: Border.all(color: cs.borderDefault),
                    ),
                    child: Row(
                      children: [
                        CustomerTagChip(tag: t, dimmed: !t.isActive),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${t.customerCount} müşteri${t.isActive ? '' : ' · pasif'}',
                            style: tx.caption.copyWith(color: cs.textFaint),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.edit_outlined, size: 20),
                          onPressed: _busy
                              ? null
                              : () => _openForm(existing: t),
                        ),
                        IconButton(
                          icon: Icon(
                            t.isActive
                                ? Icons.visibility_off_outlined
                                : Icons.restore_rounded,
                            size: 20,
                          ),
                          tooltip: t.isActive ? 'Pasife al' : 'Geri al',
                          onPressed: _busy
                              ? null
                              : () async {
                                  await _api.update(t.id, {
                                    'isActive': !t.isActive,
                                  });
                                  _load();
                                },
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.delete_outline_rounded,
                            size: 20,
                            color: cs.danger500,
                          ),
                          onPressed: _busy ? null : () => _delete(t),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }
}
