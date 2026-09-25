import 'package:flutter/widgets.dart';

import '../../models/user.dart';
import '../admin/data_deletion_screens.dart';
import '../appointment_requests/my_appointment_requests_screen.dart';
import '../approvals/approvals_screen.dart';
import '../complaints/complaints_screen.dart';
import '../contracts/contracts_list_screen.dart';
import '../customers/customers_list_screen.dart';
import '../jobs/jobs_list_screen.dart';
import '../leave_requests/leave_requests_screen.dart';
import '../messages/messages_list_screen.dart';
import '../payslip/payslip_screen.dart';
import '../performance/performance_screen.dart';
import '../quotes/quotes_list_screen.dart';
import '../staff/staff_detail_screen.dart';
import '../staff_requests/staff_requests_screen.dart';
import '../stock/stock_list_screen.dart';

/// Bildirime dokununca açılacak ekran (backend/src/lib/notify.ts:
/// NotificationLink ile birebir relatedType eşlemesi — web/src/lib/
/// notifications.ts:getNotificationHref ile aynı mantık, Flutter'da ekran
/// olarak). Hedef ekranın kendi API çağrısı kendi yetki/kapsam kontrolünü
/// zaten uyguluyor; burada ekstra bir kontrol EKLENMEDİ.
///
/// `type`, aynı relatedType'ın farklı alıcılarını ayırır (ör. izin: yönetime
/// "leave_request", talep sahibine "leave_request_decision"). `null` →
/// bildirim tıklanabilir gösterilmez.
Widget? screenForNotification({
  required String? relatedType,
  String? relatedId,
  String? type,
  AppRole? role,
}) {
  final isManagement = role == AppRole.owner || role == AppRole.manager;
  switch (relatedType) {
    case 'Job':
      return const JobsListScreen();
    case 'Product':
      return const StockListScreen();
    // web/src/lib/notifications.ts:getNotificationHref — avans talebi de
    // "/bekleyen-onaylar"a gider, teklif listesine DEĞİL.
    case 'AdvanceRequest':
      return const ApprovalsScreen();
    case 'QuoteRequest':
      return const QuotesListScreen();
    case 'Conversation':
      return const MessagesListScreen();
    // Müşteri randevu talebi — yönetim Bekleyen Onaylar'da planlar/reddeder,
    // müşteri kendi talep listesini görür.
    case 'AppointmentRequest':
      return role == AppRole.customer
          ? const MyAppointmentRequestsScreen()
          : const ApprovalsScreen();
    // Personel talebi: ekran modu (Patron gelen kutusu / Taleplerim) rolden seçilir.
    case 'StaffRequest':
      return const StaffRequestsScreen();
    // İzin: yönetime gelen yeni talep onay kuyruğuna, talep sahibine gelen
    // karar kendi izin listesine.
    case 'LeaveRequest':
      return type == 'leave_request_decision' || !isManagement
          ? const LeaveRequestsScreen()
          : const ApprovalsScreen();
    // Şikayet: aynı ekran — müşteride "Şikayetlerim", yönetimde "Şikayetler".
    case 'CustomerComplaint':
      return const ComplaintsScreen();
    // KVKK: talebi yalnızca Patron işler; müşteriye gelen ret bildirimi kendi
    // talep ekranına.
    case 'DataDeletionRequest':
      if (role == AppRole.owner) return const DataDeletionRequestsScreen();
      if (role == AppRole.customer) return const CustomerDataDeletionScreen();
      return null;
    // Araç bakım/muayene hatırlatması → ilgili personelin detayı (bakım kartı orada).
    case 'Staff':
      return isManagement && relatedId != null
          ? StaffDetailScreen(staffId: relatedId)
          : null;
    // Sözleşme yenileme uyarısı → Sözleşmeler.
    case 'Contract':
      return isManagement ? const ContractsListScreen() : null;
    // Onaylanan prim personelin bordrosuna yansır.
    case 'StaffBonus':
      return role == AppRole.staff || role == AppRole.teamLead
          ? const PayslipScreen()
          : const PerformanceScreen();
    // Teklif müşteriye dönüştü → Müşteriler; ekip duyurusu → Mesajlar.
    case 'Customer':
      return isManagement ? const CustomersListScreen() : null;
    case 'User':
      return const MessagesListScreen();
    default:
      return null;
  }
}
