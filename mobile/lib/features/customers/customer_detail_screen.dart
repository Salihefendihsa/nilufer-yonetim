import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../models/customer.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import '../jobs/job_detail_screen.dart';
import 'customer_tags.dart';
import 'customers_api.dart';
import 'customer_form_screen.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);
final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

/// web/CustomerDetailPanel.tsx ile aynı hesap: müşterinin `Job.rating`
/// alanı dolu olan işlerinden istemci tarafında ortalama alınır — backend
/// zaten `jobs` dizisini `rating` dahil tüm alanlarla döndürüyor, ayrı bir
/// uç gerekmiyor.
List<num> _ratings(List<dynamic> jobs) => jobs
    .map((j) => (j as Map<String, dynamic>)['rating'])
    .whereType<num>()
    .toList();

double? _averageRating(List<dynamic> jobs) {
  final ratings = _ratings(jobs);
  if (ratings.isEmpty) return null;
  return ratings.reduce((a, b) => a + b) / ratings.length;
}

int _ratedJobCount(List<dynamic> jobs) => _ratings(jobs).length;

/// backend/src/controllers/customersController.ts:getCustomer ile aynı veriyi
/// tek çağrıda çeker; STAFF için `payments`/`outstandingBalance` backend
/// tarafından zaten çıkarılmıştır — burada rolü tekrar kontrol ETMİYORUZ,
/// backend'in gönderdiği alanların varlığına göre gösteriyoruz (tek doğruluk
/// kaynağı backend kalsın diye).
class CustomerDetailScreen extends StatefulWidget {
  final String customerId;
  const CustomerDetailScreen({super.key, required this.customerId});

  @override
  State<CustomerDetailScreen> createState() => _CustomerDetailScreenState();
}

class _CustomerDetailScreenState extends State<CustomerDetailScreen>
    with SingleTickerProviderStateMixin {
  final _api = CustomersApi();
  late final TabController _tabController;
  CustomerDetail? _customer;
  bool _loading = true;
  String? _error;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final c = await _api.getById(widget.customerId);
      setState(() => _customer = c);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Müşteri yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  bool get _canManage {
    final role = context.read<AuthProvider>().user?.role;
    return role == AppRole.owner || role == AppRole.manager;
  }

  /// backend/src/routes/customers.ts: DELETE /:id —
  /// `requireRoleOrPermission([MANAGER], "delete_customers")`: MANAGER her
  /// zaman, OWNER yalnızca bu izin ayrıca atanmışsa silebilir. Web'de de aynı
  /// şekilde OWNER/MANAGER'a gösterilip backend'in 403'e bırakması tercih
  /// edildi — burada da aynı desen izlendi.
  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Müşteriyi sil'),
        content: Text(
          '${_customer?.fullName ?? 'Bu müşteri'} silinecek. Bu işlem geri alınamaz.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Sil', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.delete(widget.customerId);
      _changed = true;
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Müşteri silindi.')));
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Silinemedi'),
          ),
        );
      }
    }
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
        appBar: AppBar(
          title: Text(_customer?.fullName ?? 'Müşteri'),
          actions: [
            if (_canManage && _customer != null)
              IconButton(
                icon: const Icon(Icons.edit_rounded),
                onPressed: () async {
                  final updated = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(
                      builder: (_) => CustomerFormScreen(existing: _customer),
                    ),
                  );
                  if (updated == true) {
                    _changed = true;
                    _load();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Müşteri güncellendi.')),
                      );
                    }
                  }
                },
              ),
            if (_canManage && _customer != null)
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded),
                tooltip: 'Sil',
                onPressed: _delete,
              ),
          ],
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    final c = _customer!;

    final hasFinance = c.outstandingBalance != null;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Bölüm X (6. tur): etiketler (yönetim düzenler, STAFF görür).
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: CustomerTagEditor(
                  key: ValueKey('tags-${c.id}-${c.tags.length}'),
                  customerId: c.id,
                  initial: c.tags.map(CustomerTag.fromJson).toList(),
                  editable: _canManage,
                ),
              ),
              _InfoRow(icon: Icons.phone_rounded, text: c.phone),
              if (c.email != null)
                _InfoRow(icon: Icons.mail_outline_rounded, text: c.email!),
              if (c.address != null)
                _InfoRow(icon: Icons.location_on_outlined, text: c.address!),
              if (_averageRating(c.jobs) != null) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      size: 16,
                      color: AppColors.warning500,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${_averageRating(c.jobs)!.toStringAsFixed(1)} '
                      '(${_ratedJobCount(c.jobs)} değerlendirme)',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
              if (hasFinance) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: (c.outstandingBalance ?? 0) > 0
                        ? AppColors.danger50
                        : AppColors.success50,
                    borderRadius: BorderRadius.circular(AppRadius.chip),
                  ),
                  child: Text(
                    'Bakiye: ${_currency.format(c.outstandingBalance)}',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: (c.outstandingBalance ?? 0) > 0
                          ? AppColors.danger600
                          : AppColors.success600,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        TabBar(
          controller: _tabController,
          labelColor: AppColors.primary700,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary600,
          tabs: [
            Tab(text: 'İşler (${c.jobs.length})'),
            Tab(text: 'Sözleşmeler (${c.contracts.length})'),
            if (hasFinance)
              Tab(text: 'Ödemeler (${c.payments.length})')
            else
              const Tab(text: 'Ödemeler'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _JobsTab(jobs: c.jobs, onRefresh: _load),
              _ContractsTab(contracts: c.contracts, onRefresh: _load),
              hasFinance
                  ? _PaymentsTab(payments: c.payments, onRefresh: _load)
                  : const EmptyStateView(
                      title: 'Finansal veriler görünmüyor',
                      subtitle: 'Bu bilgiler yalnızca yönetim rolüne açıktır.',
                      icon: Icons.lock_outline_rounded,
                    ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 15, color: AppColors.textFaint),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          if (icon == Icons.phone_rounded)
            IconButton(
              icon: const Icon(
                Icons.call_rounded,
                size: 18,
                color: AppColors.primary600,
              ),
              onPressed: () => launchUrl(Uri.parse('tel:$text')),
              visualDensity: VisualDensity.compact,
            ),
        ],
      ),
    );
  }
}

class _JobsTab extends StatelessWidget {
  final List<dynamic> jobs;
  final Future<void> Function() onRefresh;
  const _JobsTab({required this.jobs, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (jobs.isEmpty)
      return const EmptyStateView(
        title: 'Henüz iş yok',
        icon: Icons.assignment_outlined,
      );
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary600,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: jobs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final j = jobs[i] as Map<String, dynamic>;
          return _JobRow(job: j);
        },
      ),
    );
  }
}

/// backend/src/routes/jobs.ts: GET /:id/report/pdf — yalnızca tamamlanmış
/// (rapor girilmiş) işlerde anlamlı; web'de müşteri detayındaki iş
/// listesinde "PDF İndir" olarak gösteriliyor.
class _JobRow extends StatefulWidget {
  final Map<String, dynamic> job;
  const _JobRow({required this.job});

  @override
  State<_JobRow> createState() => _JobRowState();
}

class _JobRowState extends State<_JobRow> {
  bool _downloading = false;

  Future<void> _downloadReport() async {
    setState(() => _downloading = true);
    try {
      final id = widget.job['id'] as String;
      await downloadAndShare('/jobs/$id/report/pdf', 'is-raporu-$id.pdf');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Rapor indirilemedi'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final j = widget.job;
    final isCompleted = j['status'] == 'COMPLETED';
    return ListTile(
      tileColor: AppColors.surfaceCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.card),
        side: const BorderSide(color: AppColors.borderDefault),
      ),
      title: Text(
        j['serviceType'] as String? ?? '',
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
      ),
      subtitle: Text(
        j['status'] as String? ?? '',
        style: const TextStyle(fontSize: 12),
      ),
      trailing: isCompleted
          ? (_downloading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : IconButton(
                    tooltip: 'PDF İndir',
                    icon: const Icon(
                      Icons.picture_as_pdf_outlined,
                      color: AppColors.textFaint,
                    ),
                    onPressed: _downloadReport,
                  ))
          : null,
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => JobDetailScreen(jobId: j['id'] as String),
        ),
      ),
    );
  }
}

class _ContractsTab extends StatelessWidget {
  final List<dynamic> contracts;
  final Future<void> Function() onRefresh;
  const _ContractsTab({required this.contracts, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (contracts.isEmpty)
      return const EmptyStateView(
        title: 'Sözleşme yok',
        icon: Icons.description_outlined,
      );
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary600,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: contracts.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final c = contracts[i] as Map<String, dynamic>;
          final amount = (c['amount'] as num?)?.toDouble();
          return ListTile(
            tileColor: AppColors.surfaceCard,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: const BorderSide(color: AppColors.borderDefault),
            ),
            title: Text(
              c['serviceType'] as String? ?? c['status'] as String? ?? '',
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
            ),
            subtitle: Text(
              amount != null
                  ? '${_currency.format(amount)} · ${c['status']}'
                  : c['status'] as String? ?? '',
              style: const TextStyle(fontSize: 12),
            ),
          );
        },
      ),
    );
  }
}

class _PaymentsTab extends StatelessWidget {
  final List<dynamic> payments;
  final Future<void> Function() onRefresh;
  const _PaymentsTab({required this.payments, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (payments.isEmpty)
      return const EmptyStateView(
        title: 'Ödeme yok',
        icon: Icons.payments_outlined,
      );
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary600,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: payments.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final p = payments[i] as Map<String, dynamic>;
          return ListTile(
            tileColor: AppColors.surfaceCard,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.card),
              side: const BorderSide(color: AppColors.borderDefault),
            ),
            title: Text(
              _currency.format((p['amount'] as num).toDouble()),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              '${p['paymentType']} · ${_dateFormat.format(DateTime.parse(p['createdAt'] as String))}',
              style: const TextStyle(fontSize: 12),
            ),
          );
        },
      ),
    );
  }
}
