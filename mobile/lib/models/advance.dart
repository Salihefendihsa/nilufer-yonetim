import 'decimal.dart';

class AdvanceRequest {
  final String id;
  final String staffId;
  final double amount;
  final String reason;
  final String status;
  final String createdAt;
  final String? staffName;

  AdvanceRequest({
    required this.id,
    required this.staffId,
    required this.amount,
    required this.reason,
    required this.status,
    required this.createdAt,
    required this.staffName,
  });

  factory AdvanceRequest.fromJson(Map<String, dynamic> json) => AdvanceRequest(
    id: json['id'] as String,
    staffId: json['staffId'] as String,
    amount: decimalOr(json['amount']),
    reason: json['reason'] as String,
    status: json['status'] as String,
    createdAt: json['createdAt'] as String,
    staffName:
        ((json['staff'] as Map<String, dynamic>?)?['user']
                as Map<String, dynamic>?)?['fullName']
            as String?,
  );
}
