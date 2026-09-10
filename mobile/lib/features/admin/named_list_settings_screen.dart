import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

/// web/src/app/(dashboard)/ayarlar/page.tsx: ServiceTypesSection ve
/// DistrictsSection ile birebir aynı davranış — ikisi de aynı şekle sahip
/// (`{id, name, isActive}`) ve aynı CRUD deseniyle çalışıyor (POST/PATCH,
/// "silme" aslında `isActive:false` yapan yumuşak bir pasifleştirme;
/// `DELETE` bu yüzden geri getirilemez bir kayıp değil). Tek bir genel
/// ekranla hem `/service-types` hem `/districts` için kullanılır.
class NamedListSettingsScreen extends StatefulWidget {
  final String title;
  final String description;
  final String endpoint;
  final String addHint;

  const NamedListSettingsScreen({
    super.key,
    required this.title,
    required this.description,
    required this.endpoint,
    required this.addHint,
  });

  @override
  State<NamedListSettingsScreen> createState() =>
      _NamedListSettingsScreenState();
}

class _NamedItem {
  final String id;
  final String name;
  final bool isActive;
  const _NamedItem({
    required this.id,
    required this.name,
    required this.isActive,
  });

  factory _NamedItem.fromJson(Map<String, dynamic> json) => _NamedItem(
    id: json['id'] as String,
    name: json['name'] as String,
    isActive: json['isActive'] as bool? ?? true,
  );
}

class _NamedListSettingsScreenState extends State<NamedListSettingsScreen> {
  final _api = ApiClient.instance;
  final _addController = TextEditingController();
  List<_NamedItem> _items = [];
  bool _loading = true;
  String? _error;
  bool _busy = false;
  String? _editingId;
  final _editController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _addController.dispose();
    _editController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await _api.get<Map<String, dynamic>>(widget.endpoint);
      setState(
        () => _items = (json['data'] as List)
            .cast<Map<String, dynamic>>()
            .map(_NamedItem.fromJson)
            .toList(),
      );
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Yüklenemedi',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _add() async {
    final name = _addController.text.trim();
    if (name.isEmpty) return;
    setState(() => _busy = true);
    try {
      await _api.post(widget.endpoint, body: {'name': name});
      _addController.clear();
      await _load();
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rename(String id) async {
    final name = _editController.text.trim();
    if (name.isEmpty) return;
    setState(() => _busy = true);
    try {
      await _api.patch('${widget.endpoint}/$id', body: {'name': name});
      setState(() => _editingId = null);
      await _load();
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleActive(_NamedItem item) async {
    setState(() => _busy = true);
    try {
      if (item.isActive) {
        await _api.delete('${widget.endpoint}/${item.id}');
      } else {
        await _api.patch(
          '${widget.endpoint}/${item.id}',
          body: {'isActive': true},
        );
      }
      await _load();
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showError(Object e) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(e is ApiException ? e.message : 'Güncellenemedi'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePage,
      appBar: AppBar(title: Text(widget.title)),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  widget.description,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 12),
                if (_items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text('Henüz eklenmemiş.'),
                  )
                else
                  ..._items.map((item) {
                    final editing = _editingId == item.id;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceCard,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.borderDefault),
                      ),
                      child: editing
                          ? Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _editController,
                                    autofocus: true,
                                    decoration: const InputDecoration(
                                      isDense: true,
                                    ),
                                  ),
                                ),
                                TextButton(
                                  onPressed: _busy
                                      ? null
                                      : () => _rename(item.id),
                                  child: const Text('Kaydet'),
                                ),
                                TextButton(
                                  onPressed: () =>
                                      setState(() => _editingId = null),
                                  child: const Text('Vazgeç'),
                                ),
                              ],
                            )
                          : Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    item.name,
                                    style: TextStyle(
                                      fontSize: 13.5,
                                      color: item.isActive
                                          ? AppColors.textPrimary
                                          : AppColors.textFaint,
                                      decoration: item.isActive
                                          ? null
                                          : TextDecoration.lineThrough,
                                    ),
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(
                                    Icons.edit_outlined,
                                    size: 18,
                                  ),
                                  onPressed: () => setState(() {
                                    _editingId = item.id;
                                    _editController.text = item.name;
                                  }),
                                ),
                                TextButton(
                                  onPressed: _busy
                                      ? null
                                      : () => _toggleActive(item),
                                  child: Text(
                                    item.isActive
                                        ? 'Pasifleştir'
                                        : 'Aktifleştir',
                                    style: TextStyle(
                                      color: item.isActive
                                          ? AppColors.danger500
                                          : AppColors.primary600,
                                      fontSize: 12.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                    );
                  }),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _addController,
                        decoration: InputDecoration(hintText: widget.addHint),
                        onSubmitted: (_) => _add(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: _busy ? null : _add,
                      child: const Text('Ekle'),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}
