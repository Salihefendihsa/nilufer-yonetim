import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/file_download.dart';
import '../../models/contract.dart';
import '../../models/customer.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';
import '../../widgets/stat_card.dart';
import '../customers/customers_api.dart';
import '../jobs/job_form_screen.dart';
import 'contracts_api.dart';

final _currency = NumberFormat.currency(
  locale: 'tr_TR',
  symbol: '₺',
  decimalDigits: 0,
);
final _dateFormat = DateFormat('d MMM yyyy', 'tr_TR');

/// backend/src/routes/contracts.ts: GET OWNER/MANAGER/CUSTOMER, yazma yalnızca
/// OWNER/MANAGER — bu ekran "Daha Fazla" menüsünde yalnızca yönetime açık.
class ContractsListScreen extends StatefulWidget {
  const ContractsListScreen({super.key});

  @override
  State<ContractsListScreen> createState() => _ContractsListScreenState();
}

class _ContractsListScreenState extends State<ContractsListScreen> {
  final _api = ContractsApi();
  List<Contract> _contracts = [];
  List<Contract> _expiring = [];
  ContractsSummary? _summary;
  List<ContractHealthCheckItem> _healthCheck = [];
  bool _healthCheckOpen = false;
  bool _loading = true;
  String? _error;
  String? _busyId;
  String? _pdfDownloadingId;
  Future<void> _downloadContractPdf(Contract c) async {
    setState(() => _pdfDownloadingId = c.id);
    try {
      await downloadAndShare('/contracts/${c.id}/pdf', 'sozlesme-${c.id}.pdf');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'PDF indirilemedi')),
        );
      }
    } finally {
      if (mounted) setState(() => _pdfDownloadingId = null);
    }
  }

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
      final results = await Future.wait([
        _api.list(),
        _api.expiring(),
        _api.summary(),
        _api.healthCheck(),
      ]);
      if (!mounted) return;
      setState(() {
        _contracts = (results[0] as dynamic).data as List<Contract>;
        _expiring = results[1] as List<Contract>;
        _summary = results[2] as ContractsSummary;
        _healthCheck = results[3] as List<ContractHealthCheckItem>;
      });
    } catch (e) {
      setState(
        () =>
            _error = e is ApiException ? e.message : 'Sözleşmeler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sözleşmeler'),
        actions: [
          if (_healthCheck.isNotEmpty)
            IconButton(
              icon: Badge(
                label: Text('${_healthCheck.length}'),
                backgroundColor: AppColors.warning600,
                child: const Icon(Icons.favorite_border_rounded),
              ),
              tooltip: 'Otomasyon gecikmeleri',
              onPressed: () => setState(() => _healthCheckOpen = !_healthCheckOpen),
            ),
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () async {
              final created = await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => const _ContractFormScreen()),
              );
              if (created == true) _load();
            },
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  /// Sozlesmeyi yeniler: eski donem kapanir, yeni donem eski bitis tarihinden
  /// baslar. Onay istenir cunku islem geri alinamaz.
  Future<void> _renew(Contract c) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sözleşmeyi yenile'),
        content: Text(
          'Mevcut dönem kapatılıp ${c.durationMonths} aylık yeni bir dönem '
          '${_dateFormat.format(DateTime.parse(c.endDate))} tarihinden itibaren '
          'başlatılacak. Devam edilsin mi?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Yenile'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyId = c.id);
    try {
      await _api.renew(c.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sözleşme yenilendi')),
        );
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Yenilenemedi'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorRetryView(message: _error!, onRetry: _load);
    if (_contracts.isEmpty)
      return const EmptyStateView(
        title: 'Sözleşme yok',
        icon: Icons.description_outlined,
      );

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary600,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_summary != null) ...[
            StatCardGrid(
              children: [
                AppStatCard(
                  label: 'Aktif Sözleşme',
                  value: '${_summary!.activeCount}',
                  icon: Icons.description_rounded,
                ),
                AppStatCard(
                  label: 'Aylık Tekrarlayan Gelir',
                  value: _currency.format(_summary!.monthlyRecurringRevenue),
                  icon: Icons.repeat_rounded,
                  iconColor: AppColors.success600,
                  iconBackground: AppColors.success50,
                  caption: 'Periyot aylığa normalize edilmiştir',
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          if (_expiring.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger50,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: AppColors.danger500),
              ),
              child: Text(
                '${_expiring.length} sözleşme önümüzdeki 30 gün içinde sona eriyor',
                style: const TextStyle(
                  color: AppColors.danger600,
                  fontWeight: FontWeight.w700,
                  fontSize: 12.5,
                ),
              ),
            ),
          if (_healthCheckOpen && _healthCheck.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning50,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: AppColors.warning500),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_healthCheck.length} sözleşmenin otomasyonu gecikmiş',
                    style: const TextStyle(
                      color: AppColors.warning600,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Beklenen otomatik iş tarihi geçmiş ama iş henüz oluşturulmamış.',
                    style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 10),
                  for (final item in _healthCheck)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceCard,
                        borderRadius: BorderRadius.circular(AppRadius.chip),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.customerName,
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                                ),
                                Text(
                                  '${item.serviceType ?? "Hizmet belirtilmemiş"} · ${item.daysOverdue} gün gecikmiş',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () async {
                              final created = await Navigator.of(context).push<bool>(
                                MaterialPageRoute(
                                  builder: (_) => JobFormScreen(
                                    prefillCustomerId: item.customerId,
                                    prefillServiceType: item.serviceType,
                                  ),
                                ),
                              );
                              if (created == true) _load();
                            },
                            icon: const Icon(Icons.build_outlined, size: 16),
                            label: const Text('Şimdi Oluştur', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ..._contracts.map(
            (c) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
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
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            c.serviceType ?? 'Sözleşme',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceSubtle,
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            contractStatusLabelTr(c.status),
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_dateFormat.format(DateTime.parse(c.startDate))} → ${_dateFormat.format(DateTime.parse(c.endDate))} (${c.durationMonths} ay)',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    if (c.amount != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '${_currency.format(c.amount)}'
                        '${c.recurrenceType != null ? ' · ${recurrenceTypeLabelTr(c.recurrenceType)}' : ''}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary700,
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _pdfDownloadingId == c.id ? null : () => _downloadContractPdf(c),
                            icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
                            label: Text(
                              _pdfDownloadingId == c.id ? 'İndiriliyor...' : 'PDF İndir',
                            ),
                          ),
                        ),
                        if (c.status == 'ACTIVE') ...[
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _busyId == c.id ? null : () => _renew(c),
                              icon: const Icon(Icons.refresh_rounded, size: 16),
                              label: Text(
                                _busyId == c.id ? 'İşleniyor...' : 'Yenile',
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContractFormScreen extends StatefulWidget {
  const _ContractFormScreen();

  @override
  State<_ContractFormScreen> createState() => _ContractFormScreenState();
}

class _ContractFormScreenState extends State<_ContractFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _durationController = TextEditingController(text: '12');
  String? _recurrenceType;
  final _amountController = TextEditingController();
  final _serviceTypeController = TextEditingController();
  final _customersApi = CustomersApi();
  final _contractsApi = ContractsApi();

  List<Customer> _customers = [];
  String? _customerId;
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now().add(const Duration(days: 365));
  String _status = 'ACTIVE';
  bool _loadingOptions = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCustomers();
  }

  Future<void> _loadCustomers() async {
    try {
      final res = await _customersApi.list(page: 1);
      setState(() => _customers = res.data);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Müşteriler yüklenemedi',
      );
    } finally {
      setState(() => _loadingOptions = false);
    }
  }

  Future<void> _pickDate({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _startDate : _endDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() => isStart ? _startDate = picked : _endDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _customerId == null) {
      setState(() => _error = _customerId == null ? 'Müşteri seçin' : null);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _contractsApi.create(
        customerId: _customerId!,
        startDate: _startDate,
        endDate: _endDate,
        durationMonths: int.tryParse(_durationController.text.trim()) ?? 12,
        status: _status,
        serviceType: _serviceTypeController.text.trim(),
        recurrenceType: _recurrenceType,
        amount: double.tryParse(_amountController.text.trim()),
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
    return Scaffold(
      appBar: AppBar(title: const Text('Yeni Sözleşme')),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _customerId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Müşteri *'),
                    items: _customers
                        .map(
                          (c) => DropdownMenuItem(
                            value: c.id,
                            child: Text(
                              c.fullName,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _customerId = v),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => _pickDate(isStart: true),
                          child: InputDecorator(
                            decoration: const InputDecoration(
                              labelText: 'Başlangıç',
                            ),
                            child: Text(_dateFormat.format(_startDate)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: InkWell(
                          onTap: () => _pickDate(isStart: false),
                          child: InputDecorator(
                            decoration: const InputDecoration(
                              labelText: 'Bitiş',
                            ),
                            child: Text(_dateFormat.format(_endDate)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _durationController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Süre (ay)',
                      hintText: 'Örn. 12',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _status,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Durum'),
                    items: contractStatusOptions
                        .map(
                          (s) => DropdownMenuItem(
                            value: s,
                            child: Text(contractStatusLabelTr(s)),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _status = v ?? _status),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Dönem Ücreti (₺, opsiyonel)',
                      hintText: 'Örn. 1200',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _serviceTypeController,
                    decoration: const InputDecoration(
                      labelText: 'Hizmet Türü (opsiyonel)',
                      hintText: 'Örn. İlaçlama',
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Periyot secilirse backend otomatik is uretimi icin
                  // nextGenerationDate hesaplar (contractsController.ts).
                  DropdownButtonFormField<String?>(
                    initialValue: _recurrenceType,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Tekrar Periyodu (opsiyonel)',
                    ),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('Yok'),
                      ),
                      ...recurrenceTypeOptions.map(
                        (r) => DropdownMenuItem<String?>(
                          value: r,
                          child: Text(recurrenceTypeLabelTr(r)),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _recurrenceType = v),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                  ],
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _saving ? null : _submit,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Oluştur'),
                  ),
                ],
              ),
            ),
    );
  }
}

/// CUSTOMER için sadeleştirilmiş salt-okunur görünüm — backend GET
/// /contracts CUSTOMER'ı zaten kendi sözleşmeleriyle sınırlıyor
/// (contractsController.ts:listContracts). /contracts/expiring ve oluşturma
/// yalnızca OWNER/MANAGER olduğu için burada hiç çağrılmaz.
class MyContractsScreen extends StatefulWidget {
  const MyContractsScreen({super.key});

  @override
  State<MyContractsScreen> createState() => _MyContractsScreenState();
}

class _MyContractsScreenState extends State<MyContractsScreen> {
  final _api = ContractsApi();
  List<Contract> _contracts = [];
  bool _loading = true;
  String? _error;
  String? _pdfDownloadingId;
  String? _toggleBusyId;

  /// Bölüm Q (4. tur): duraklat/devam ettir — duraklatmadan önce onay ister.
  Future<void> _togglePause(Contract c) async {
    if (!c.isPaused) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Sözleşmeyi duraklat'),
          content: const Text(
            'Duraklatılan sözleşme için periyodik işler planlanmaz. İstediğiniz zaman devam ettirebilirsiniz.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Vazgeç')),
            ElevatedButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Duraklat')),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _toggleBusyId = c.id);
    try {
      if (c.isPaused) {
        await _api.resume(c.id);
      } else {
        await _api.pause(c.id);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(c.isPaused ? 'Sözleşme devam ettirildi' : 'Sözleşme duraklatıldı')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'İşlem yapılamadı')),
        );
      }
    } finally {
      if (mounted) setState(() => _toggleBusyId = null);
    }
  }


  Future<void> _downloadContractPdf(Contract c) async {
    setState(() => _pdfDownloadingId = c.id);
    try {
      await downloadAndShare('/contracts/${c.id}/pdf', 'sozlesme-${c.id}.pdf');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'PDF indirilemedi')),
        );
      }
    } finally {
      if (mounted) setState(() => _pdfDownloadingId = null);
    }
  }

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
      final res = await _api.list();
      setState(() => _contracts = res.data);
    } catch (e) {
      setState(
        () =>
            _error = e is ApiException ? e.message : 'Sözleşmeler yüklenemedi',
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sözleşmelerim')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _contracts.isEmpty
          ? const EmptyStateView(
              title: 'Sözleşmeniz yok',
              icon: Icons.description_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _contracts.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final c = _contracts[i];
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceCard,
                      borderRadius: BorderRadius.circular(AppRadius.card),
                      border: Border.all(color: AppColors.borderDefault),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                c.serviceType ?? 'Sözleşme',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${_dateFormat.format(DateTime.parse(c.startDate))} → ${_dateFormat.format(DateTime.parse(c.endDate))}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              Text(
                                contractStatusLabelTr(c.status),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (c.isPaused)
                                Container(
                                  margin: const EdgeInsets.only(top: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.warning50,
                                    borderRadius: BorderRadius.circular(AppRadius.pill),
                                  ),
                                  child: const Text(
                                    'Duraklatıldı',
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.warning600,
                                    ),
                                  ),
                                ),
                              if (c.amount != null)
                                Text(
                                  _currency.format(c.amount),
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary700,
                                  ),
                                ),
                              // Bölüm Q: yalnızca aktif sözleşmede duraklat/devam.
                              if (c.status == 'ACTIVE')
                                Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: OutlinedButton.icon(
                                    onPressed: _toggleBusyId == c.id ? null : () => _togglePause(c),
                                    icon: Icon(
                                      c.isPaused ? Icons.play_circle_outline_rounded : Icons.pause_circle_outline_rounded,
                                      size: 16,
                                    ),
                                    label: Text(c.isPaused ? 'Devam Ettir' : 'Duraklat'),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: _pdfDownloadingId == c.id
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.picture_as_pdf_outlined, size: 20),
                          tooltip: 'PDF İndir',
                          onPressed: _pdfDownloadingId == c.id ? null : () => _downloadContractPdf(c),
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
