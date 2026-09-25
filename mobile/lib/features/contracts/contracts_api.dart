import '../../core/api_dates.dart';
import '../../core/api_client.dart';
import '../../models/contract.dart';
import '../../models/paginated.dart';

class ContractsApi {
  final _api = ApiClient.instance;

  /// Bölüm Q (4. tur): müşteri kendi aktif sözleşmesini duraklatır/devam ettirir.
  Future<Contract> pause(String id) async =>
      Contract.fromJson(await _api.post<Map<String, dynamic>>('/contracts/$id/pause'));
  Future<Contract> resume(String id) async =>
      Contract.fromJson(await _api.post<Map<String, dynamic>>('/contracts/$id/resume'));

  Future<Paginated<Contract>> list({int page = 1, String? status}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/contracts',
      query: {'page': page, 'limit': 30, if (status != null) 'status': status},
    );
    return Paginated.fromJson(json, Contract.fromJson);
  }

  Future<List<Contract>> expiring() async {
    final json = await _api.get<Map<String, dynamic>>('/contracts/expiring');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(Contract.fromJson)
        .toList();
  }

  Future<Contract> create({
    required String customerId,
    required DateTime startDate,
    required DateTime endDate,
    required int durationMonths,
    required String status,
    String? serviceType,
    double? amount,
    String? recurrenceType,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/contracts',
      body: {
        'customerId': customerId,
        'startDate': apiDate(startDate),
        'endDate': apiDate(endDate),
        'durationMonths': durationMonths,
        'status': status,
        if (serviceType != null && serviceType.isNotEmpty)
          'serviceType': serviceType,
        if (amount != null) 'amount': amount,
        if (recurrenceType != null) 'recurrenceType': recurrenceType,
      },
    );
    return Contract.fromJson(json);
  }

  Future<ContractsSummary> summary() async {
    final json = await _api.get<Map<String, dynamic>>('/contracts/summary');
    return ContractsSummary.fromJson(json);
  }

  Future<List<ContractHealthCheckItem>> healthCheck() async {
    final json = await _api.get<Map<String, dynamic>>('/contracts/health-check');
    return (json['data'] as List)
        .cast<Map<String, dynamic>>()
        .map(ContractHealthCheckItem.fromJson)
        .toList();
  }

  /// Yeni donemi eski sozlesmenin bitis tarihinden baslatir; eski kayit
  /// EXPIRED'a cekilir. Backend iyimser kilitle mukerrer yenilemeyi engeller.
  Future<Contract> renew(String id) async {
    final json = await _api.post<Map<String, dynamic>>('/contracts/$id/renew');
    return Contract.fromJson(json);
  }

  Future<Contract> updateStatus(String id, String status) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/contracts/$id',
      body: {'status': status},
    );
    return Contract.fromJson(json);
  }
}
