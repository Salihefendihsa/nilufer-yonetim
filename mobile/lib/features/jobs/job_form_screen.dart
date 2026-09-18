import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/customer.dart';
import '../../models/staff.dart';
import '../../models/staff_unavailability.dart';
import '../../theme/app_colors.dart';
import '../customers/customers_api.dart';
import '../staff/staff_api.dart';
import '../staff/staff_unavailability_api.dart';
import '../admin/job_templates_screen.dart';
import 'jobs_api.dart';

/// POST /jobs — backend OWNER/MANAGER'a kısıtlıyor (routes/jobs.ts:24).
class JobFormScreen extends StatefulWidget {
  /// Bölüm E (2. tur): Sözleşmeler → "Şimdi İş Oluştur" kısayolundan önceden doldurulmuş değerler.
  final String? prefillCustomerId;
  final String? prefillServiceType;

  const JobFormScreen({
    super.key,
    this.prefillCustomerId,
    this.prefillServiceType,
  });

  @override
  State<JobFormScreen> createState() => _JobFormScreenState();
}

class _JobFormScreenState extends State<JobFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _serviceTypeController = TextEditingController();
  final _priceController = TextEditingController();
  final _notesController = TextEditingController();

  final _customersApi = CustomersApi();
  final _staffApi = StaffApi();
  final _unavailabilityApi = StaffUnavailabilityApi();

  /// Bölüm K (3. tur): seçilen tarihte müsait olmayan personel (staffId →
  /// kayıtlar). Atamayı ENGELLEMEZ, yalnızca uyarı gösterir.
  Map<String, List<StaffUnavailability>> _unavailable = {};
  String? _unavailableForDate;

  Future<void> _refreshUnavailability() async {
    final date = _scheduledAt;
    if (date == null) {
      if (mounted) setState(() => _unavailable = {});
      return;
    }
    final key =
        '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    if (key == _unavailableForDate) return;
    try {
      final rows = await _unavailabilityApi.unavailableOn(key);
      final map = <String, List<StaffUnavailability>>{};
      for (final r in rows) {
        (map[r.staffId] ??= []).add(r);
      }
      if (mounted) {
        setState(() {
          _unavailable = map;
          _unavailableForDate = key;
        });
      }
    } catch (_) {
      // Uyarı bilgisi alınamazsa form yine çalışır.
    }
  }

  String _unavailableLabel(String staffId) {
    final rows = _unavailable[staffId];
    if (rows == null || rows.isEmpty) return '';
    return rows.map((r) => r.rangeLabel.toLowerCase()).join(', ');
  }
  final _jobsApi = JobsApi();

  List<Customer> _customers = [];
  List<Staff> _staff = [];
  String? _selectedCustomerId;
  String? _selectedStaffId;
  DateTime? _scheduledAt;
  DateTime? _scheduledEndAt;
  bool _loadingOptions = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedCustomerId = widget.prefillCustomerId;
    if (widget.prefillServiceType != null) {
      _serviceTypeController.text = widget.prefillServiceType!;
    }
    _loadOptions();
  }

  @override
  void dispose() {
    _serviceTypeController.dispose();
    _priceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  /// Bölüm T (5. tur): "Şablondan Doldur" — seçilince hizmet türü/fiyat/not
  /// dolar (süre tanımlıysa ve plan saati seçiliyse bitiş de hesaplanır);
  /// kullanıcı yine değiştirebilir.
  final _templatesApi = JobTemplatesApi();
  List<JobTemplate> _templates = [];
  String? _selectedTemplateId;

  void _applyTemplate(String? id) {
    setState(() => _selectedTemplateId = id);
    if (id == null) return;
    final t = _templates.where((x) => x.id == id).firstOrNull;
    if (t == null) return;
    setState(() {
      _serviceTypeController.text = t.serviceType;
      if (t.defaultPrice != null) {
        _priceController.text = t.defaultPrice!.toStringAsFixed(0);
      }
      if (t.defaultNotes != null && t.defaultNotes!.isNotEmpty) {
        _notesController.text = t.defaultNotes!;
      }
      if (t.defaultDurationMinutes != null && _scheduledAt != null) {
        _scheduledEndAt = _scheduledAt!.add(Duration(minutes: t.defaultDurationMinutes!));
      }
    });
  }

  /// Bölüm Y (6. tur): müşteri + hizmet türü seçilince geçerli garanti bilgisi
  /// (GET /customers/:id/active-warranties?serviceType=). Otomatik indirim yok.
  int? _warrantyDaysLeft;
  String? _warrantyServiceType;

  Future<void> _refreshWarranty() async {
    final customerId = _selectedCustomerId;
    final serviceType = _serviceTypeController.text.trim();
    if (customerId == null || serviceType.isEmpty) {
      if (mounted) setState(() => _warrantyDaysLeft = null);
      return;
    }
    try {
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/customers/$customerId/active-warranties',
        query: {'serviceType': serviceType},
      );
      final rows = (json['data'] as List?) ?? const [];
      if (mounted) {
        setState(() {
          if (rows.isEmpty) {
            _warrantyDaysLeft = null;
          } else {
            final first = rows.first as Map<String, dynamic>;
            _warrantyDaysLeft = (first['daysLeft'] as num?)?.toInt();
            _warrantyServiceType = first['serviceType'] as String?;
          }
        });
      }
    } on ApiException {
      if (mounted) setState(() => _warrantyDaysLeft = null);
    }
  }

  Future<void> _loadOptions() async {
    try {
      final results = await Future.wait([
        _customersApi.list(page: 1),
        _staffApi.list(page: 1),
      ]);
      List<JobTemplate> templates = [];
      try {
        templates = await _templatesApi.list();
      } on ApiException {
        templates = []; // şablonlar alınamazsa form yine çalışır
      }
      setState(() {
        _customers = (results[0] as dynamic).data as List<Customer>;
        _staff = (results[1] as dynamic).data as List<Staff>;
        _templates = templates;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Seçenekler yüklenemedi',
      );
    } finally {
      setState(() => _loadingOptions = false);
    }
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (time == null) return;
    setState(
      () => _scheduledAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
    _refreshUnavailability();
  }

  /// Randevu penceresinin bitisi - Stitch kartlarindaki "09:00 - 11:00".
  Future<void> _pickEndDateTime() async {
    final base = _scheduledAt ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _scheduledEndAt ?? base,
      firstDate: base.subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_scheduledEndAt ?? base),
    );
    if (time == null) return;
    setState(
      () => _scheduledEndAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _selectedCustomerId == null) {
      setState(
        () => _error = _selectedCustomerId == null ? 'Müşteri seçin' : null,
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _jobsApi.create(
        customerId: _selectedCustomerId!,
        assignedStaffId: _selectedStaffId,
        serviceType: _serviceTypeController.text.trim(),
        scheduledAt: _scheduledAt,
        scheduledEndAt: _scheduledEndAt,
        notes: _notesController.text.trim(),
        price: _priceController.text.trim().isEmpty
            ? null
            : double.tryParse(_priceController.text.trim()),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'İş oluşturulamadı',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yeni İş')),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_templates.isNotEmpty) ...[
                    DropdownButtonFormField<String>(
                      initialValue: _selectedTemplateId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Şablondan Doldur (opsiyonel)',
                        prefixIcon: Icon(Icons.dashboard_customize_outlined),
                      ),
                      items: _templates
                          .map(
                            (t) => DropdownMenuItem(
                              value: t.id,
                              child: Text(
                                '${t.name} — ${t.summary}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: _applyTemplate,
                    ),
                    const SizedBox(height: 12),
                  ],
                  DropdownButtonFormField<String>(
                    initialValue: _selectedCustomerId,
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
                    onChanged: (v) {
                      setState(() => _selectedCustomerId = v);
                      _refreshWarranty();
                    },
                  ),
                  if (_warrantyDaysLeft != null)
                    Container(
                      margin: const EdgeInsets.only(top: 10),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primary50,
                        borderRadius: BorderRadius.circular(AppRadius.card),
                        border: Border.all(color: AppColors.primary100),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.verified_user_outlined, size: 18, color: AppColors.primary700),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Bu müşterinin ${_warrantyServiceType ?? 'bu hizmet'} için devam eden garantisi var — '
                              '$_warrantyDaysLeft gün kaldı. Ücretlendirmeyi buna göre değerlendirin.',
                              style: const TextStyle(fontSize: 12, color: AppColors.primary700),
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedStaffId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Personel (opsiyonel)',
                    ),
                    items: _staff
                        .map(
                          (s) => DropdownMenuItem(
                            value: s.id,
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    s.fullName,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (_unavailable.containsKey(s.id))
                                  const Padding(
                                    padding: EdgeInsets.only(left: 6),
                                    child: Icon(
                                      Icons.warning_amber_rounded,
                                      size: 16,
                                      color: AppColors.warning600,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _selectedStaffId = v),
                  ),
                  if (_selectedStaffId != null &&
                      _unavailable.containsKey(_selectedStaffId)) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.warning50,
                        borderRadius: BorderRadius.circular(AppRadius.card),
                        border: Border.all(
                          color: AppColors.warning500.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.warning_amber_rounded,
                            size: 18,
                            color: AppColors.warning600,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Bu personel bu gün müsait değil '
                              '(${_unavailableLabel(_selectedStaffId!)}). '
                              'Yine de atayabilirsiniz.',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.warning600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _serviceTypeController,
                    onChanged: (_) => _refreshWarranty(),
                    decoration: const InputDecoration(
                      labelText: 'Hizmet Türü *',
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Zorunlu alan' : null,
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _pickDateTime,
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Planlanan Tarih/Saat (opsiyonel)',
                      ),
                      child: Text(
                        _scheduledAt == null
                            ? 'Seçilmedi'
                            : _scheduledAt.toString(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _pickEndDateTime,
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Tahmini Bitiş (opsiyonel)',
                      ),
                      child: Text(
                        _scheduledEndAt == null
                            ? 'Seçilmedi'
                            : _scheduledEndAt.toString(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _priceController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Fiyat (opsiyonel)',
                      hintText: 'Örn. 500',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _notesController,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Notlar (opsiyonel)',
                      hintText: 'Örn. Bahçe kapısından girilecek',
                    ),
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
