import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/decimal.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

/// Bölüm T (5. tur): backend/prisma/schema.prisma → JobTemplate.
class JobTemplate {
  final String id;
  final String name;
  final String serviceType;
  final double? defaultPrice;
  final int? defaultDurationMinutes;
  final String? defaultNotes;
  final bool isActive;

  const JobTemplate({
    required this.id,
    required this.name,
    required this.serviceType,
    required this.isActive,
    this.defaultPrice,
    this.defaultDurationMinutes,
    this.defaultNotes,
  });

  factory JobTemplate.fromJson(Map<String, dynamic> json) => JobTemplate(
        id: json['id'] as String,
        name: json['name'] as String? ?? '—',
        serviceType: json['serviceType'] as String? ?? '',
        defaultPrice: decimalOrNull(json['defaultPrice']),
        defaultDurationMinutes: (json['defaultDurationMinutes'] as num?)?.toInt(),
        defaultNotes: json['defaultNotes'] as String?,
        isActive: json['isActive'] as bool? ?? true,
      );

  /// Liste/dropdown alt satırı: "Hamam Böceği · 1.250 ₺ · 90 dk".
  String get summary => [
        serviceType,
        if (defaultPrice != null) '${defaultPrice!.toStringAsFixed(0)} ₺',
        if (defaultDurationMinutes != null) '$defaultDurationMinutes dk',
      ].join(' · ');
}

class JobTemplatesApi {
  final _api = ApiClient.instance;

  Future<List<JobTemplate>> list({bool includeInactive = false}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/job-templates',
      query: {if (includeInactive) 'includeInactive': 'true'},
    );
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(JobTemplate.fromJson)
        .toList();
  }

  Future<JobTemplate> create(Map<String, dynamic> body) async =>
      JobTemplate.fromJson(await _api.post<Map<String, dynamic>>('/job-templates', body: body));

  Future<JobTemplate> update(String id, Map<String, dynamic> body) async =>
      JobTemplate.fromJson(await _api.patch<Map<String, dynamic>>('/job-templates/$id', body: body));

  Future<void> deactivate(String id) => _api.delete<void>('/job-templates/$id');
}

/// Ayarlar → İş Şablonları (OWNER/MANAGER): ekle / düzenle / pasife al / geri al.
class JobTemplatesScreen extends StatefulWidget {
  const JobTemplatesScreen({super.key});

  @override
  State<JobTemplatesScreen> createState() => _JobTemplatesScreenState();
}

class _JobTemplatesScreenState extends State<JobTemplatesScreen> {
  final _api = JobTemplatesApi();
  List<JobTemplate> _items = [];
  bool _loading = true;
  String? _error;
  String? _busyId;

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
        setState(() => _error = e is ApiException ? e.message : 'Şablonlar yüklenemedi');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm({JobTemplate? existing}) async {
    final name = TextEditingController(text: existing?.name ?? '');
    final serviceType = TextEditingController(text: existing?.serviceType ?? '');
    final price = TextEditingController(
      text: existing?.defaultPrice != null ? existing!.defaultPrice!.toStringAsFixed(0) : '',
    );
    final duration = TextEditingController(
      text: existing?.defaultDurationMinutes?.toString() ?? '',
    );
    final notes = TextEditingController(text: existing?.defaultNotes ?? '');
    var submitting = false;

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
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  existing == null ? 'Yeni Şablon' : 'Şablonu Düzenle',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
                const SizedBox(height: 12),
                TextField(controller: name, decoration: const InputDecoration(labelText: 'Şablon adı *')),
                const SizedBox(height: 10),
                TextField(controller: serviceType, decoration: const InputDecoration(labelText: 'Hizmet türü *')),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: price,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(labelText: 'Fiyat (₺)'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: duration,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Süre (dk)'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: notes,
                  decoration: const InputDecoration(labelText: 'Varsayılan not'),
                  minLines: 1,
                  maxLines: 3,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: submitting
                      ? null
                      : () async {
                          if (name.text.trim().isEmpty || serviceType.text.trim().isEmpty) {
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              const SnackBar(content: Text('Ad ve hizmet türü zorunlu')),
                            );
                            return;
                          }
                          setSheetState(() => submitting = true);
                          final body = <String, dynamic>{
                            'name': name.text.trim(),
                            'serviceType': serviceType.text.trim(),
                            'defaultPrice': price.text.trim().isEmpty ? null : double.tryParse(price.text.trim().replaceAll(',', '.')),
                            'defaultDurationMinutes': duration.text.trim().isEmpty ? null : int.tryParse(duration.text.trim()),
                            'defaultNotes': notes.text.trim().isEmpty ? null : notes.text.trim(),
                          };
                          try {
                            if (existing == null) {
                              await _api.create(body);
                            } else {
                              await _api.update(existing.id, body);
                            }
                            if (ctx.mounted) Navigator.of(ctx).pop(true);
                          } catch (e) {
                            if (ctx.mounted) {
                              setSheetState(() => submitting = false);
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(content: Text(e is ApiException ? e.message : 'Kaydedilemedi')),
                              );
                            }
                          }
                        },
                  child: Text(submitting ? 'Kaydediliyor...' : 'Kaydet'),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _toggle(JobTemplate t) async {
    setState(() => _busyId = t.id);
    try {
      if (t.isActive) {
        await _api.deactivate(t.id);
      } else {
        await _api.update(t.id, {'isActive': true});
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Güncellenemedi')),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('İş Şablonları'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            tooltip: 'Yeni şablon',
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
              title: 'Henüz şablon yok',
              subtitle: 'Sağ üstten ilk şablonu ekleyin; iş formunda "Şablondan Doldur" ile kullanın.',
              icon: Icons.dashboard_customize_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final t = _items[i];
                  return Container(
                    padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceCard,
                      borderRadius: BorderRadius.circular(AppRadius.card),
                      border: Border.all(color: AppColors.borderDefault),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                t.name,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  color: t.isActive ? AppColors.textPrimary : AppColors.textFaint,
                                  decoration: t.isActive ? null : TextDecoration.lineThrough,
                                ),
                              ),
                              Text(
                                t.summary,
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              if (t.defaultNotes != null && t.defaultNotes!.isNotEmpty)
                                Text(
                                  t.defaultNotes!,
                                  style: const TextStyle(fontSize: 11.5, color: AppColors.textFaint),
                                ),
                            ],
                          ),
                        ),
                        if (t.isActive)
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 20),
                            tooltip: 'Düzenle',
                            onPressed: _busyId == null ? () => _openForm(existing: t) : null,
                          ),
                        IconButton(
                          icon: Icon(
                            t.isActive ? Icons.delete_outline_rounded : Icons.restore_rounded,
                            size: 20,
                            color: t.isActive ? AppColors.danger500 : AppColors.primary600,
                          ),
                          tooltip: t.isActive ? 'Pasife al' : 'Geri al',
                          onPressed: _busyId == null ? () => _toggle(t) : null,
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
