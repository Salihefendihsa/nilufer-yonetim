// Bölüm AQ (9. tur): VehicleMaintenance ayrıştırma ve vade etiketi; bölümün
// yalnızca plakası dolu personelde görünme koşulu.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/staff.dart';
import 'package:nilufer_mobile/models/vehicle_maintenance.dart';

void main() {
  Map<String, dynamic> row({int daysLeft = 10, bool overdue = false}) => {
        'id': 'v1',
        'staffId': 's1',
        'maintenanceType': 'INSPECTION',
        'lastServiceDate': '2025-10-01T00:00:00.000Z',
        'nextDueDate': '2026-10-01T00:00:00.000Z',
        'note': 'TÜVTÜRK',
        'daysLeft': daysLeft,
        'isOverdue': overdue,
      };

  test('alanlar okunur; etiketler', () {
    final v = VehicleMaintenance.fromJson(row());
    expect(v.maintenanceType, 'INSPECTION');
    expect(vehicleMaintenanceTypeLabel(v.maintenanceType), 'Muayene');
    expect(v.dueLabel, '10 gün kaldı');
    expect(VehicleMaintenance.fromJson(row(daysLeft: 0)).dueLabel, 'Bugün');
    expect(VehicleMaintenance.fromJson(row(daysLeft: -3, overdue: true)).dueLabel, '3 gün gecikti');
    expect(vehicleMaintenanceTypeLabel('OIL_CHANGE'), 'Yağ Değişimi');
    expect(vehicleMaintenanceTypes.length, 4);
  });

  test('bölüm koşulu: vehiclePlate boş/null ise gösterilmez', () {
    bool shows(String? plate) => plate != null && plate.trim().isNotEmpty;
    final base = {
      'id': 's1', 'userId': 'u1', 'position': 'Tekniker', 'salaryBase': '10000', 'status': 'AVAILABLE', 'createdAt': '2026-01-01T00:00:00.000Z',
      'user': {'id': 'u1', 'fullName': 'Ali', 'email': 'a@x', 'role': 'STAFF'},
    };
    expect(shows(Staff.fromJson({...base, 'vehiclePlate': '16 AB 123'}).vehiclePlate), isTrue);
    expect(shows(Staff.fromJson({...base, 'vehiclePlate': '  '}).vehiclePlate), isFalse);
    expect(shows(Staff.fromJson(base).vehiclePlate), isFalse);
  });
}
