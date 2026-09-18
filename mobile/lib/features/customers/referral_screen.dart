import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

/// Bölüm P (4. tur): GET /customers/me/referral yanıtı.
class CustomerReferral {
  final String referralCode;
  final String inviteLink;
  final int referredCount;
  final List<({String id, String fullName, String createdAt})> referred;

  const CustomerReferral({
    required this.referralCode,
    required this.inviteLink,
    required this.referredCount,
    required this.referred,
  });

  factory CustomerReferral.fromJson(Map<String, dynamic> json) =>
      CustomerReferral(
        referralCode: json['referralCode'] as String? ?? '',
        inviteLink: json['inviteLink'] as String? ?? '',
        referredCount: (json['referredCount'] as num?)?.toInt() ?? 0,
        referred: ((json['referred'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(
              (e) => (
                id: e['id'] as String,
                fullName: e['fullName'] as String? ?? '—',
                createdAt: e['createdAt'] as String? ?? '',
              ),
            )
            .toList(),
      );
}

/// Müşteri → "Arkadaşını Davet Et": kod, paylaşılabilir link, davet sayısı.
/// İndirim/ödül mekanizması YOK — yalnızca takip (bkz. docs).
class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  final _api = ApiClient.instance;
  CustomerReferral? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await _api.get<Map<String, dynamic>>(
        '/customers/me/referral',
      );
      if (mounted) setState(() => _data = CustomerReferral.fromJson(json));
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is ApiException
              ? e.message
              : 'Davet bilgisi yüklenemedi',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _copy() async {
    final d = _data;
    if (d == null) return;
    await Clipboard.setData(ClipboardData(text: d.inviteLink));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Davet linki kopyalandı')),
      );
    }
  }

  Future<void> _share() async {
    final d = _data;
    if (d == null) return;
    await Share.share(
      'Nilüfer İlaçlama teklif davet linkim: ${d.inviteLink}',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Arkadaşını Davet Et')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [_buildCard(_data!)],
              ),
            ),
    );
  }

  Widget _buildCard(CustomerReferral d) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.card_giftcard_rounded,
                color: AppColors.primary600,
                size: 20,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Linki paylaşın; arkadaşınız teklif isteyip müşterimiz olduğunda burada görünür.',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'DAVET KODUNUZ',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.textFaint,
              letterSpacing: 1,
            ),
          ),
          Text(
            d.referralCode,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: 4,
              color: AppColors.primary700,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surfaceSubtle,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.borderDefault),
            ),
            child: SelectableText(
              d.inviteLink,
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.textSecondary,
                fontFamily: 'monospace',
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _copy,
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  label: const Text('Kopyala'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _share,
                  icon: const Icon(Icons.share_rounded, size: 16),
                  label: const Text('Paylaş'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(
                Icons.people_outline_rounded,
                size: 16,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 6),
              Text(
                '${d.referredCount} kişi davetinizle geldi',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (d.referred.isNotEmpty) ...[
            const SizedBox(height: 8),
            for (final r in d.referred)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        r.fullName,
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                    if (r.createdAt.isNotEmpty)
                      Text(
                        DateFormat(
                          'd MMM yyyy',
                          'tr_TR',
                        ).format(DateTime.parse(r.createdAt).toLocal()),
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.textFaint,
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}
