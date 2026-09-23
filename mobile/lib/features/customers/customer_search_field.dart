import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/customer.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import 'customers_api.dart';

/// Form içi müşteri seçici (Yeni Tahsilat, Yeni İş).
///
/// Önceden bu formlar `DropdownButtonFormField` + `GET /customers?page=1`
/// (limit 20) kullanıyordu: 21. ve sonraki müşteriler hiç seçilemiyordu;
/// `initialCustomerId` ilk 20'de değilse Dropdown "exactly one item with
/// value" assertion'ı ile çöküyordu. Bu alan dokununca aramalı bir alt sayfa
/// açar ve sunucu tarafında (`search=`) arar — tüm müşterilere erişilir.
class CustomerSearchField extends StatefulWidget {
  final String? initialCustomerId;
  final ValueChanged<Customer?> onChanged;
  final String label;

  const CustomerSearchField({
    super.key,
    this.initialCustomerId,
    required this.onChanged,
    this.label = 'Müşteri *',
  });

  @override
  State<CustomerSearchField> createState() => _CustomerSearchFieldState();
}

class _CustomerSearchFieldState extends State<CustomerSearchField> {
  final _api = CustomersApi();
  String? _selectedName;
  bool _resolving = false;

  @override
  void initState() {
    super.initState();
    final id = widget.initialCustomerId;
    if (id != null) _resolveName(id);
  }

  /// Önceden seçili müşterinin (ör. randevu talebinden gelen) adını getirir.
  Future<void> _resolveName(String id) async {
    setState(() => _resolving = true);
    try {
      final c = await _api.getById(id);
      if (mounted) setState(() => _selectedName = c.fullName);
    } on ApiException {
      // Ad alınamazsa alan boş görünür; seçili id yine korunur.
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  Future<void> _open() async {
    final picked = await showModalBottomSheet<Customer>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _CustomerSearchSheet(),
    );
    if (picked == null || !mounted) return;
    setState(() => _selectedName = picked.fullName);
    widget.onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    return InkWell(
      onTap: _open,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: widget.label,
          suffixIcon: const Icon(Icons.search_rounded),
        ),
        isEmpty: _selectedName == null && !_resolving,
        child: _resolving
            ? const SizedBox(
                height: 18,
                width: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(
                _selectedName ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: tx.body.copyWith(color: cs.textPrimary),
              ),
      ),
    );
  }
}

class _CustomerSearchSheet extends StatefulWidget {
  const _CustomerSearchSheet();

  @override
  State<_CustomerSearchSheet> createState() => _CustomerSearchSheetState();
}

class _CustomerSearchSheetState extends State<_CustomerSearchSheet> {
  final _api = CustomersApi();
  Timer? _debounce;
  List<Customer> _results = [];
  bool _loading = true;
  String? _error;
  int _requestSeq = 0;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _search(String q) async {
    final seq = ++_requestSeq;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.list(search: q.trim(), sort: 'name');
      // Yavaş dönen eski bir arama yeni sonucu ezmesin.
      if (!mounted || seq != _requestSeq) return;
      setState(() => _results = res.data);
    } catch (e) {
      if (!mounted || seq != _requestSeq) return;
      setState(
        () => _error = e is ApiException ? e.message : 'Müşteriler yüklenemedi',
      );
    } finally {
      if (mounted && seq == _requestSeq) setState(() => _loading = false);
    }
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(v));
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final insets = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: insets),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                autofocus: true,
                onChanged: _onChanged,
                decoration: const InputDecoration(
                  hintText: 'Ad, telefon veya bölge ara...',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                  ? Center(child: Text(_error!, style: tx.bodySmall))
                  : _results.isEmpty
                  ? Center(
                      child: Text(
                        'Eşleşen müşteri yok',
                        style: tx.bodySmall.copyWith(color: cs.textFaint),
                      ),
                    )
                  : ListView.builder(
                      itemCount: _results.length,
                      itemBuilder: (_, i) {
                        final c = _results[i];
                        return ListTile(
                          title: Text(
                            c.fullName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            [c.phone, c.district]
                                .whereType<String>()
                                .where((s) => s.isNotEmpty)
                                .join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          onTap: () => Navigator.of(context).pop(c),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
