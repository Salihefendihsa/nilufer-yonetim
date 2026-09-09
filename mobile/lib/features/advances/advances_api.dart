import '../../core/api_client.dart';

/// backend/src/routes/advances.ts: POST /advances yalnızca STAFF'a açık —
/// personel kendi adına avans talebi oluşturur (bkz. advancesController.ts:
/// createAdvanceRequest, staffId req.user'dan türetilir, body'de gönderilmez).
class AdvancesApi {
  final _api = ApiClient.instance;

  Future<Map<String, dynamic>> create({
    required double amount,
    required String reason,
  }) {
    return _api.post<Map<String, dynamic>>(
      '/advances',
      body: {'amount': amount, 'reason': reason},
    );
  }
}
