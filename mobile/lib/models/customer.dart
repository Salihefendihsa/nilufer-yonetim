/// backend/src/controllers/customersController.ts ile birebir.
class Customer {
  final String id;
  final String? userId;
  final String fullName;
  final String phone;
  final String? email;
  final String? address;
  final String? district;
  final String createdAt;

  // --- Mudur fazi: liste yanitinda sunucu tarafinda hesaplanir ---
  /// Faturalanan is tutari - tahsilat. STAFF icin backend bu alani gondermez.
  final double? outstandingBalance;
  final int jobCount;
  final int activeContractCount;
  final DateTime? lastJobDate;

  Customer({
    required this.id,
    required this.userId,
    required this.fullName,
    required this.phone,
    required this.email,
    required this.address,
    required this.district,
    required this.createdAt,
    this.outstandingBalance,
    this.jobCount = 0,
    this.activeContractCount = 0,
    this.lastJobDate,
  });

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
    id: json['id'] as String,
    userId: json['userId'] as String?,
    fullName: json['fullName'] as String,
    phone: json['phone'] as String,
    email: json['email'] as String?,
    address: json['address'] as String?,
    district: json['district'] as String?,
    createdAt: json['createdAt'] as String,
    outstandingBalance: (json['outstandingBalance'] as num?)?.toDouble(),
    jobCount: (json['jobCount'] as num?)?.toInt() ?? 0,
    activeContractCount: (json['activeContractCount'] as num?)?.toInt() ?? 0,
    lastJobDate: json['lastJobDate'] != null
        ? DateTime.parse(json['lastJobDate'] as String)
        : null,
  );

  Map<String, dynamic> toCreateJson() => {
    'fullName': fullName,
    'phone': phone,
    if (email != null && email!.isNotEmpty) 'email': email,
    if (address != null && address!.isNotEmpty) 'address': address,
    if (district != null && district!.isNotEmpty) 'district': district,
  };
}

/// GET /customers/:id — jobs/contracts/payments dahil (STAFF için payments
/// backend tarafından çıkarılıyor, bkz. customersController.ts:76).
class CustomerDetail extends Customer {
  final List<dynamic> jobs;
  final List<dynamic> contracts;
  final List<dynamic> payments;
  final double? outstandingBalance;

  CustomerDetail({
    required super.id,
    required super.userId,
    required super.fullName,
    required super.phone,
    required super.email,
    required super.address,
    required super.district,
    required super.createdAt,
    required this.jobs,
    required this.contracts,
    required this.payments,
    required this.outstandingBalance,
  });

  factory CustomerDetail.fromJson(Map<String, dynamic> json) => CustomerDetail(
    id: json['id'] as String,
    userId: json['userId'] as String?,
    fullName: json['fullName'] as String,
    phone: json['phone'] as String,
    email: json['email'] as String?,
    address: json['address'] as String?,
    district: json['district'] as String?,
    createdAt: json['createdAt'] as String,
    jobs: (json['jobs'] as List?) ?? [],
    contracts: (json['contracts'] as List?) ?? [],
    payments: (json['payments'] as List?) ?? [],
    outstandingBalance: (json['outstandingBalance'] as num?)?.toDouble(),
  );
}
