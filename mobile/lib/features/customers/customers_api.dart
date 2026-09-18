import '../../core/api_client.dart';
import '../../models/customer.dart';
import '../../models/paginated.dart';

class CustomersApi {
  final _api = ApiClient.instance;

  /// [sort]: 'newest' | 'name' | 'balance' (bkz. customersController.ts).
  Future<Paginated<Customer>> list({
    int page = 1,
    String? search,
    String sort = 'newest',
    String? tagId,
  }) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/customers',
      query: {
        'page': page,
        'limit': 20,
        'sort': sort,
        if (search != null && search.isNotEmpty) 'search': search,
        // Bölüm X (6. tur): etiket filtresi.
        'tagId': ?tagId,
      },
    );
    return Paginated.fromJson(json, Customer.fromJson);
  }

  Future<CustomerDetail> getById(String id) async {
    final json = await _api.get<Map<String, dynamic>>('/customers/$id');
    return CustomerDetail.fromJson(json);
  }

  Future<Customer> create(Customer draft) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/customers',
      body: draft.toCreateJson(),
    );
    return Customer.fromJson(json);
  }

  Future<Customer> update(String id, Customer draft) async {
    final json = await _api.patch<Map<String, dynamic>>(
      '/customers/$id',
      body: draft.toCreateJson(),
    );
    return Customer.fromJson(json);
  }

  Future<void> delete(String id) => _api.delete('/customers/$id');
}
