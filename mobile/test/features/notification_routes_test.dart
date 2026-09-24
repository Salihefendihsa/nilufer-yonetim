// Bildirim → ekran eşlemesi (HEALTH_AUDIT Bölüm 1 #3): eskiden 6 tür hiçbir
// yere gitmiyordu. Her tür, alıcının rolüne/`type`'a göre doğru ekrana gider.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/admin/data_deletion_screens.dart';
import 'package:nilufer_mobile/features/appointment_requests/my_appointment_requests_screen.dart';
import 'package:nilufer_mobile/features/approvals/approvals_screen.dart';
import 'package:nilufer_mobile/features/complaints/complaints_screen.dart';
import 'package:nilufer_mobile/features/contracts/contracts_list_screen.dart';
import 'package:nilufer_mobile/features/leave_requests/leave_requests_screen.dart';
import 'package:nilufer_mobile/features/notifications/notification_routes.dart';
import 'package:nilufer_mobile/features/payslip/payslip_screen.dart';
import 'package:nilufer_mobile/features/staff/staff_detail_screen.dart';
import 'package:nilufer_mobile/models/user.dart';

Type? target(
  String relatedType,
  AppRole role, {
  String? type,
  String? id = 'x',
}) => screenForNotification(
  relatedType: relatedType,
  relatedId: id,
  type: type,
  role: role,
)?.runtimeType;

void main() {
  test('izin: yönetime onay kuyruğu, talep sahibine kendi izinleri', () {
    expect(
      target('LeaveRequest', AppRole.owner, type: 'leave_request'),
      ApprovalsScreen,
    );
    expect(
      target('LeaveRequest', AppRole.manager, type: 'leave_request'),
      ApprovalsScreen,
    );
    expect(
      target('LeaveRequest', AppRole.staff, type: 'leave_request_decision'),
      LeaveRequestsScreen,
    );
    expect(
      target('LeaveRequest', AppRole.teamLead, type: 'leave_request_decision'),
      LeaveRequestsScreen,
    );
  });

  test('şikayet, KVKK, randevu: rol bazlı', () {
    expect(target('CustomerComplaint', AppRole.customer), ComplaintsScreen);
    expect(target('CustomerComplaint', AppRole.owner), ComplaintsScreen);
    expect(
      target('DataDeletionRequest', AppRole.owner),
      DataDeletionRequestsScreen,
    );
    expect(
      target('DataDeletionRequest', AppRole.customer),
      CustomerDataDeletionScreen,
    );
    expect(target('DataDeletionRequest', AppRole.manager), isNull);
    expect(
      target('AppointmentRequest', AppRole.customer),
      MyAppointmentRequestsScreen,
    );
    expect(target('AppointmentRequest', AppRole.manager), ApprovalsScreen);
  });

  test('personel (araç bakımı), sözleşme, prim', () {
    expect(target('Staff', AppRole.owner), StaffDetailScreen);
    expect(target('Staff', AppRole.owner, id: null), isNull);
    expect(target('Staff', AppRole.staff), isNull);
    expect(target('Contract', AppRole.manager), ContractsListScreen);
    expect(target('StaffBonus', AppRole.staff), PayslipScreen);
    expect(target('StaffBonus', AppRole.teamLead), PayslipScreen);
  });

  test('bilinmeyen tür tıklanamaz', () {
    expect(target('Bilinmeyen', AppRole.owner), isNull);
    expect(
      screenForNotification(relatedType: null, role: AppRole.owner),
      isNull,
    );
  });
}
