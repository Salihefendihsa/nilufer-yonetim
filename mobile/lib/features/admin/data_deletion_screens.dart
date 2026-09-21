import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';

/// Bölüm AD (7. tur): KVKK veri silme talebi (backend DataDeletionRequest).
class DataDeletionRequest {
  final String id;
  final String status; // PENDING | COMPLETED | REJECTED
  final String requestedAt;
  final String? processedAt;
  final String? rejectionReason;
  final String? customerName;
  final String? customerPhone;
  final String? processedByName;

  const DataDeletionRequest({
    required this.id,
    required this.status,
    required this.requestedAt,
    this.processedAt,
    this.rejectionReason,
    this.customerName,
    this.customerPhone,
    this.processedByName,
  });

  factory DataDeletionRequest.fromJson(Map<String, dynamic> json) =>
      DataDeletionRequest(
        id: json['id'] as String,
        status: json['status'] as String? ?? 'PENDING',
        requestedAt: json['requestedAt'] as String? ?? '',
        processedAt: json['processedAt'] as String?,
        rejectionReason: json['rejectionReason'] as String?,
        customerName:
            (json['customer'] as Map<String, dynamic>?)?['fullName'] as String?,
        customerPhone:
            (json['customer'] as Map<String, dynamic>?)?['phone'] as String?,
        processedByName:
            (json['processedBy'] as Map<String, dynamic>?)?['fullName']
                as String?,
      );

  bool get isPending => status == 'PENDING';
}

String deletionStatusLabelTr(String s) => switch (s) {
  'COMPLETED' => 'Tamamlandı',
  'REJECTED' => 'Reddedildi',
  _ => 'Bekliyor',
};

final _fmt = DateFormat('d MMM yyyy HH:mm', 'tr_TR');

/// Müşteri → "Hesabımı ve Verilerimi Sil".
class CustomerDataDeletionScreen extends StatefulWidget {
  const CustomerDataDeletionScreen({super.key});

  @override
  State<CustomerDataDeletionScreen> createState() =>
      _CustomerDataDeletionScreenState();
}

class _CustomerDataDeletionScreenState
    extends State<CustomerDataDeletionScreen> {
  final _api = ApiClient.instance;
  DataDeletionRequest? _latest;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await _api.get<Map<String, dynamic>>(
        '/customers/me/deletion-request',
      );
      final data = json['data'] as Map<String, dynamic>?;
      if (mounted)
        setState(
          () => _latest = data == null
              ? null
              : DataDeletionRequest.fromJson(data),
        );
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final cs = context.colors;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Veri silme talebi gönder'),
        content: const Text(
          'Talebiniz işletme yetkilisine iletilecek. Onaylanırsa adınız, telefonunuz, e-postanız ve adresiniz kalıcı olarak kaldırılır ve bu hesapla bir daha giriş yapamazsınız. Geçmiş işleriniz yalnızca kimliksiz istatistik olarak kalır.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: cs.danger500),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Talebi gönder'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await _api.post<Map<String, dynamic>>(
        '/customers/me/deletion-request',
        body: {},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Talebiniz alındı. Sonuç size bildirilecek.'),
          ),
        );
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final pending = _latest?.isPending ?? false;
    return Scaffold(
      appBar: AppBar(title: const Text('Hesabımı ve Verilerimi Sil')),
      body: _loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: cs.surfaceCard,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(
                      color: cs.danger500.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.person_off_outlined, color: cs.danger500),
                          SizedBox(width: 8),
                          Text(
                            'KVKK Veri Silme',
                            style: tx.subtitle.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Kişisel verilerinizin silinmesini talep edebilirsiniz. Onaylandığında adınız, telefonunuz, e-postanız ve adresiniz kaldırılır ve hesabınız kapanır; geçmiş işleriniz yalnızca istatistiksel (kimliksiz) kayıt olarak kalır.',
                        style: tx.bodySmall,
                      ),
                      const SizedBox(height: 14),
                      if (pending)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: cs.warning50,
                            borderRadius: BorderRadius.circular(AppRadius.card),
                          ),
                          child: Text(
                            'Talebiniz inceleniyor (${_latest!.requestedAt.isNotEmpty ? _fmt.format(DateTime.parse(_latest!.requestedAt).toLocal()) : ''}). Sonuç size bildirilecek.',
                            style: tx.bodySmall.copyWith(color: cs.warning600),
                          ),
                        )
                      else ...[
                        if (_latest?.status == 'REJECTED')
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Text(
                              'Son talebiniz reddedildi${_latest!.rejectionReason != null ? ': ${_latest!.rejectionReason}' : '.'} Dilerseniz yeniden talep açabilirsiniz.',
                              style: tx.bodySmall,
                            ),
                          ),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _submit,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: cs.danger500,
                          ),
                          icon: const Icon(
                            Icons.delete_forever_outlined,
                            size: 18,
                          ),
                          label: const Text('Silme talebi oluştur'),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

/// OWNER → Ayarlar → "Veri Silme Talepleri".
class DataDeletionRequestsScreen extends StatefulWidget {
  const DataDeletionRequestsScreen({super.key});

  @override
  State<DataDeletionRequestsScreen> createState() =>
      _DataDeletionRequestsScreenState();
}

class _DataDeletionRequestsScreenState
    extends State<DataDeletionRequestsScreen> {
  final _api = ApiClient.instance;
  List<DataDeletionRequest> _items = [];
  bool _loading = true;
  String? _error;
  String? _busyId;
  bool _all = false;

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
      final json = await _api.get<Map<String, dynamic>>(
        '/data-deletion-requests',
        query: {'status': _all ? 'ALL' : 'PENDING'},
      );
      if (mounted) {
        setState(
          () => _items = ((json['data'] as List?) ?? const [])
              .cast<Map<String, dynamic>>()
              .map(DataDeletionRequest.fromJson)
              .toList(),
        );
      }
    } catch (e) {
      if (mounted)
        setState(
          () => _error = e is ApiException ? e.message : 'Talepler yüklenemedi',
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _approve(DataDeletionRequest r) async {
    final cs = context.colors;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Verileri kalıcı olarak anonimleştir'),
        content: Text(
          '"${r.customerName ?? 'Müşteri'}" adlı müşterinin adı, telefonu, e-postası ve adresi silinecek; hesabı kapanacak. İş/ödeme/sözleşme kayıtları istatistik için kalır. Bu işlem GERİ ALINAMAZ.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: cs.danger500),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Evet, anonimleştir'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _act(
      r.id,
      () => _api.post<Map<String, dynamic>>(
        '/data-deletion-requests/${r.id}/approve',
        body: {},
      ),
      'Müşteri verileri anonimleştirildi',
    );
  }

  Future<void> _reject(DataDeletionRequest r) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Talebi reddet'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Gerekçe (müşteriye iletilir)',
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(null),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Reddet'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    await _act(
      r.id,
      () => _api.post<Map<String, dynamic>>(
        '/data-deletion-requests/${r.id}/reject',
        body: {'reason': reason},
      ),
      'Talep reddedildi',
    );
  }

  Future<void> _act(
    String id,
    Future<void> Function() fn,
    String okMessage,
  ) async {
    setState(() => _busyId = id);
    try {
      await fn();
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(okMessage)));
      await _load();
    } on ApiException catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final isOwner = context.read<AuthProvider>().user?.role == AppRole.owner;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Veri Silme Talepleri'),
        actions: [
          TextButton(
            onPressed: () {
              setState(() => _all = !_all);
              _load();
            },
            child: Text(_all ? 'Bekleyenler' : 'Tümü'),
          ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _items.isEmpty
          ? EmptyStateView(
              title: _all ? 'Henüz talep yok' : 'Bekleyen talep yok',
              subtitle: 'KVKK veri silme talepleri burada listelenir.',
              icon: Icons.shield_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: cs.accentSoft,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final r = _items[i];
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
                            Expanded(
                              child: Text(
                                r.customerName ?? 'Müşteri',
                                style: tx.subtitle.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Text(
                              deletionStatusLabelTr(r.status),
                              style: tx.caption.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        Text(
                          'Talep: ${r.requestedAt.isNotEmpty ? _fmt.format(DateTime.parse(r.requestedAt).toLocal()) : '—'}'
                          '${r.customerPhone != null ? ' · ${r.customerPhone}' : ''}'
                          '${r.rejectionReason != null ? '\nGerekçe: ${r.rejectionReason}' : ''}',
                          style: tx.caption,
                        ),
                        if (r.isPending && isOwner) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: cs.danger500,
                                ),
                                onPressed: _busyId == null
                                    ? () => _approve(r)
                                    : null,
                                icon: const Icon(
                                  Icons.delete_forever_outlined,
                                  size: 16,
                                ),
                                label: const Text('Anonimleştir'),
                              ),
                              const SizedBox(width: 8),
                              OutlinedButton(
                                onPressed: _busyId == null
                                    ? () => _reject(r)
                                    : null,
                                child: const Text('Reddet'),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }
}
