import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/staff.dart';
import '../../theme/app_colors.dart';
import 'staff_api.dart';

const Map<String, String> _staffRoleLabels = {
  'STAFF': 'Personel',
  'TEAM_LEAD': 'Ekip Lideri',
};

/// web/src/app/(dashboard)/personel/StaffFormModal.tsx'in Flutter karşılığı.
/// `staff` verilirse düzenleme, verilmezse yeni personel oluşturma modudur.
class StaffFormScreen extends StatefulWidget {
  final Staff? staff;
  const StaffFormScreen({super.key, this.staff});

  @override
  State<StaffFormScreen> createState() => _StaffFormScreenState();
}

class _StaffFormScreenState extends State<StaffFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _api = StaffApi();
  final _positionController = TextEditingController();
  final _salaryController = TextEditingController();
  final _vehicleController = TextEditingController();
  final _capacityController = TextEditingController();

  String _staffRole = 'STAFF';
  String? _userId;
  String? _supervisorId;
  List<UnlinkedUser> _unlinkedUsers = [];
  List<Staff> _teamLeads = [];
  // Organizasyon zinciri STAFF → TEAM_LEAD → MANAGER → OWNER: MANAGER'ın
  // kendi Staff kaydı yok, bu yüzden ayrı uçtan (/users?role=MANAGER)
  // çekilip Şef seçicisine ikinci bir grup olarak eklenir.
  List<UnlinkedUser> _managers = [];
  bool _loadingOptions = true;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.staff != null;

  @override
  void initState() {
    super.initState();
    final s = widget.staff;
    if (s != null) {
      _positionController.text = s.position;
      _salaryController.text = s.salaryBase.toString();
      _vehicleController.text = s.vehiclePlate ?? '';
      _capacityController.text = s.dailyJobCapacity?.toString() ?? '';
      _supervisorId = s.supervisorId;
    }
    _load();
  }

  @override
  void dispose() {
    _positionController.dispose();
    _salaryController.dispose();
    _vehicleController.dispose();
    _capacityController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loadingOptions = true);
    try {
      final teamLeads = await _api
          .list(role: 'TEAM_LEAD')
          .then((r) => r.data);
      final managers = await _api.listUnlinkedUsers('MANAGER');
      List<UnlinkedUser> unlinked = [];
      if (!_isEdit) {
        unlinked = await _api.listUnlinkedUsers(_staffRole);
      }
      setState(() {
        _teamLeads = teamLeads;
        _managers = managers;
        _unlinkedUsers = unlinked;
      });
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Seçenekler yüklenemedi',
      );
    } finally {
      if (mounted) setState(() => _loadingOptions = false);
    }
  }

  Future<void> _onRoleChanged(String? role) async {
    if (role == null || _isEdit) return;
    setState(() {
      _staffRole = role;
      _userId = null;
      _loadingOptions = true;
    });
    try {
      final unlinked = await _api.listUnlinkedUsers(role);
      setState(() => _unlinkedUsers = unlinked);
    } catch (_) {
      setState(() => _unlinkedUsers = []);
    } finally {
      if (mounted) setState(() => _loadingOptions = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_isEdit && _userId == null) {
      setState(() => _error = 'Kullanıcı seçin');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final salary = double.parse(_salaryController.text.trim());
      final capacity = _capacityController.text.trim().isEmpty
          ? null
          : int.tryParse(_capacityController.text.trim());
      final vehicle = _vehicleController.text.trim().isEmpty
          ? null
          : _vehicleController.text.trim();

      if (_isEdit) {
        await _api.update(
          widget.staff!.id,
          position: _positionController.text.trim(),
          salaryBase: salary,
          supervisorId: _supervisorId,
          vehiclePlate: vehicle,
          dailyJobCapacity: capacity,
        );
      } else {
        await _api.create(
          userId: _userId!,
          position: _positionController.text.trim(),
          salaryBase: salary,
          supervisorId: _supervisorId,
          vehiclePlate: vehicle,
          dailyJobCapacity: capacity,
        );
      }
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
      appBar: AppBar(
        title: Text(_isEdit ? 'Personeli Düzenle' : 'Yeni Personel'),
      ),
      body: _loadingOptions
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (!_isEdit) ...[
                    DropdownButtonFormField<String>(
                      initialValue: _staffRole,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Rol'),
                      items: _staffRoleLabels.entries
                          .map(
                            (e) => DropdownMenuItem(
                              value: e.key,
                              child: Text(e.value),
                            ),
                          )
                          .toList(),
                      onChanged: _onRoleChanged,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _userId,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Kullanıcı *'),
                      items: _unlinkedUsers
                          .map(
                            (u) => DropdownMenuItem(
                              value: u.id,
                              child: Text(
                                '${u.fullName} (${u.email})',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setState(() => _userId = v),
                    ),
                    if (_unlinkedUsers.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          'Bağlanabilecek ${_staffRoleLabels[_staffRole]} rolünde '
                          'kullanıcı yok. Önce bu rolle bir kullanıcı hesabı '
                          'oluşturulmalı.',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                  ] else ...[
                    Text(
                      'Kullanıcı',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(AppRadius.card),
                      ),
                      child: Text(
                        '${widget.staff!.fullName} (${widget.staff!.email})',
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _positionController,
                    decoration: const InputDecoration(
                      labelText: 'Pozisyon *',
                      hintText: 'Örn. İlaçlama Teknisyeni',
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Zorunlu alan' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _salaryController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(labelText: 'Taban Maaş (₺) *'),
                    validator: (v) =>
                        (v == null || double.tryParse(v.trim()) == null)
                        ? 'Geçerli bir tutar girin'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _vehicleController,
                          decoration: const InputDecoration(
                            labelText: 'Araç Plakası',
                            hintText: '16 ABC 123',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _capacityController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Günlük Kapasite',
                            hintText: 'Örn. 6',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _supervisorId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Şef (opsiyonel)'),
                    items: [
                      const DropdownMenuItem<String>(
                        value: null,
                        child: Text('Yok'),
                      ),
                      ..._teamLeads
                          .where((lead) => lead.id != widget.staff?.id)
                          .map(
                            (lead) => DropdownMenuItem(
                              value: lead.id,
                              child: Text(
                                '${lead.fullName} (Şef)',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                      ..._managers.map(
                        (m) => DropdownMenuItem(
                          value: m.id,
                          child: Text(
                            '${m.fullName} (Müdür)',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _supervisorId = v),
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
                        : const Text('Kaydet'),
                  ),
                ],
              ),
            ),
    );
  }
}
