// Bölüm I (3. tur): /search yanıt modelinin ayrıştırma ve gruplama testleri.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/models/search_result.dart';

void main() {
  group('SearchResponse', () {
    test('sonuçları ayrıştırır ve türe göre sabit sırayla gruplar', () {
      final res = SearchResponse.fromJson({
        'query': 'ah',
        'results': [
          {'type': 'job', 'id': 'j1', 'title': 'Hamam böceği — Ahmet', 'subtitle': 'Bekliyor', 'route': '/isler?search=Ahmet'},
          {'type': 'customer', 'id': 'c1', 'title': 'Ahmet Yılmaz', 'subtitle': '0555', 'route': '/musteriler?detailId=c1'},
          {'type': 'customer', 'id': 'c2', 'title': 'Ahmet Kaya', 'subtitle': '0544', 'route': '/musteriler?detailId=c2'},
          {'type': 'quote', 'id': 'q1', 'title': 'Ahsen', 'subtitle': 'Yeni', 'route': '/teklifler?highlight=q1'},
        ],
      });

      expect(res.query, 'ah');
      expect(res.results.length, 4);

      final grouped = res.grouped();
      // Sabit sıra: customer → job → staff → contract → quote; boşlar atlanır.
      expect(grouped.keys.toList(), [
        SearchResultType.customer,
        SearchResultType.job,
        SearchResultType.quote,
      ]);
      expect(grouped[SearchResultType.customer]!.map((r) => r.id), ['c1', 'c2']);
      expect(grouped[SearchResultType.job]!.single.title, 'Hamam böceği — Ahmet');
    });

    test('bilinmeyen tür ve eksik alanlar çökertmez', () {
      final res = SearchResponse.fromJson({
        'results': [
          {'type': 'wat', 'id': 'x'},
        ],
      });
      expect(res.query, '');
      expect(res.results.single.type, SearchResultType.unknown);
      expect(res.results.single.title, '');
      expect(res.grouped()[SearchResultType.unknown]!.length, 1);
    });

    test('boş results/eksik anahtar boş liste döner', () {
      expect(SearchResponse.fromJson({}).results, isEmpty);
      expect(SearchResponse.fromJson({}).grouped(), isEmpty);
    });
  });

  test('searchResultTypeLabelTr her tür için Türkçe etiket döner', () {
    expect(searchResultTypeLabelTr(SearchResultType.customer), 'Müşteri');
    expect(searchResultTypeLabelTr(SearchResultType.staff), 'Personel');
    expect(searchResultTypeLabelTr(SearchResultType.contract), 'Sözleşme');
  });
}
