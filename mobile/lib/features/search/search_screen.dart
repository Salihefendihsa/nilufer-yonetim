import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/search_result.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';
import '../contracts/contracts_list_screen.dart';
import '../customers/customer_detail_screen.dart';
import '../jobs/job_detail_screen.dart';
import '../quotes/quotes_list_screen.dart';
import '../staff/staff_detail_screen.dart';
import 'search_api.dart';

/// Bölüm I (3. tur): Tam ekran global arama. Ana Sayfa AppBar'ındaki büyüteç
/// ikonu buraya açılır; yazarken 300 ms debounce ile /search çağrılır,
/// sonuçlar türe göre gruplanır, dokununca ilgili detay ekranına gidilir.
/// Sunucu rol kapsamını zaten uygular — burada ek filtre yoktur.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  static const _minLength = 2;
  static const _debounce = Duration(milliseconds: 300);

  final _api = SearchApi();
  final _controller = TextEditingController();
  Timer? _timer;
  int _requestSeq = 0;

  String _query = '';
  bool _loading = false;
  String? _error;
  Map<SearchResultType, List<SearchResult>> _groups = const {};

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _timer?.cancel();
    final q = value.trim();
    setState(() {
      _query = q;
      _error = null;
      if (q.length < _minLength) {
        _groups = const {};
        _loading = false;
      } else {
        _loading = true;
      }
    });
    if (q.length < _minLength) return;
    _timer = Timer(_debounce, () => _run(q));
  }

  Future<void> _run(String q) async {
    final seq = ++_requestSeq;
    try {
      final res = await _api.search(q);
      if (!mounted || seq != _requestSeq) return; // daha yeni bir istek var
      setState(() {
        _groups = res.grouped();
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted || seq != _requestSeq) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || seq != _requestSeq) return;
      setState(() {
        _error = 'Arama yapılamadı';
        _loading = false;
      });
    }
  }

  void _open(SearchResult r) {
    final Widget? target = switch (r.type) {
      SearchResultType.customer => CustomerDetailScreen(customerId: r.id),
      SearchResultType.job => JobDetailScreen(jobId: r.id),
      SearchResultType.staff => StaffDetailScreen(staffId: r.id),
      // Sözleşme/teklif için ayrı detay ekranı yok — ilgili liste açılır.
      SearchResultType.contract => const ContractsListScreen(),
      SearchResultType.quote => const QuotesListScreen(),
      SearchResultType.unknown => null,
    };
    if (target == null) return;
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => target));
  }

  static IconData _iconFor(SearchResultType type) {
    switch (type) {
      case SearchResultType.customer:
        return Icons.person_outline_rounded;
      case SearchResultType.job:
        return Icons.build_outlined;
      case SearchResultType.staff:
        return Icons.engineering_outlined;
      case SearchResultType.contract:
        return Icons.description_outlined;
      case SearchResultType.quote:
        return Icons.request_quote_outlined;
      case SearchResultType.unknown:
        return Icons.search_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onChanged: _onChanged,
          decoration: InputDecoration(
            hintText: 'Müşteri, iş, personel, sözleşme, teklif ara...',
            border: InputBorder.none,
            isDense: true,
            suffixIcon: _query.isEmpty
                ? null
                : IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    tooltip: 'Temizle',
                    onPressed: () {
                      _controller.clear();
                      _onChanged('');
                    },
                  ),
          ),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    final cs = context.colors;
    final tx = context.text;
    // Bölüm R (4. tur): durum görünümleri ortak widget'larla (LoadingView /
    // ErrorRetryView / EmptyStateView) — diğer ekranlarla aynı dil.
    if (_query.length < _minLength) {
      return const EmptyStateView(
        title: 'Aramak için en az 2 karakter yazın',
        subtitle: 'Müşteri, iş, personel, sözleşme ve teklif aranır.',
        icon: Icons.search_rounded,
      );
    }
    if (_loading && _groups.isEmpty) {
      return const LoadingView();
    }
    if (_error != null) {
      return ErrorRetryView(message: _error!, onRetry: () => _run(_query));
    }
    if (_groups.isEmpty) {
      return const EmptyStateView(
        title: 'Sonuç bulunamadı',
        subtitle: 'Farklı bir terim deneyin.',
        icon: Icons.search_off_rounded,
      );
    }

    final sections = _groups.entries.toList();
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: sections.length,
      itemBuilder: (context, i) {
        final type = sections[i].key;
        final items = sections[i].value;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                children: [
                  Icon(_iconFor(type), size: 14, color: cs.textFaint),
                  const SizedBox(width: 6),
                  Text(
                    searchResultTypeLabelTr(type),
                    style: tx.caption.copyWith(
                      fontWeight: FontWeight.w700,
                      color: cs.textFaint,
                    ),
                  ),
                ],
              ),
            ),
            for (final r in items)
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: cs.surfaceSubtle,
                  foregroundColor: cs.textSecondary,
                  child: Icon(_iconFor(type), size: 20),
                ),
                title: Text(
                  r.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  r.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: cs.surfaceSubtle,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(searchResultTypeLabelTr(type), style: tx.label),
                ),
                onTap: () => _open(r),
              ),
          ],
        );
      },
    );
  }
}
