import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/org_chart.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../widgets/state_views.dart';

const _roleTones = {
  'OWNER': AppColors.warning600,
  'MANAGER': AppColors.primary700,
  'TEAM_LEAD': AppColors.info600,
  'STAFF': AppColors.textSecondary,
};

/// web/src/app/(dashboard)/personel/OrgChartView.tsx'in mobildeki
/// basitleştirilmiş karşılığı — bir ağaç diyagramı yerine dikey kaydırmalı,
/// girintili (indented) bir liste. Aynı `/staff/org-chart` uçtan beslenir.
class OrgChartScreen extends StatefulWidget {
  const OrgChartScreen({super.key});

  @override
  State<OrgChartScreen> createState() => _OrgChartScreenState();
}

class _OrgChartScreenState extends State<OrgChartScreen> {
  OrgChartResponse? _data;
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
      final json = await ApiClient.instance.get<Map<String, dynamic>>('/staff/org-chart');
      setState(() => _data = OrgChartResponse.fromJson(json));
    } catch (e) {
      setState(
        () => _error = e is ApiException ? e.message : 'Organizasyon şeması yüklenemedi',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Organizasyon Şeması')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : _data == null || _data!.tree.isEmpty
          ? const EmptyStateView(
              title: 'Organizasyon şeması boş',
              subtitle: 'Henüz bir işletme sahibi hesabı tanımlı değil.',
              icon: Icons.account_tree_outlined,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary600,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final root in _data!.tree) ..._flatten(root, 0),
                  if (_data!.unassigned.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Row(
                      children: const [
                        Icon(Icons.warning_amber_rounded, size: 16, color: AppColors.warning600),
                        SizedBox(width: 6),
                        Text(
                          'Şefi Tanımlı Olmayan / Bağlantısız',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    for (final n in _data!.unassigned) _buildRow(n, 0),
                  ],
                ],
              ),
            ),
    );
  }

  List<Widget> _flatten(OrgChartNode node, int depth) {
    return [
      _buildRow(node, depth),
      for (final child in node.children) ..._flatten(child, depth + 1),
    ];
  }

  Widget _buildRow(OrgChartNode node, int depth) {
    final tone = _roleTones[node.role] ?? AppColors.textSecondary;
    return Padding(
      padding: EdgeInsets.only(left: depth * 20.0, bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: AppColors.borderDefault),
        ),
        child: Row(
          children: [
            Container(width: 3, height: 32, color: tone, margin: const EdgeInsets.only(right: 10)),
            CircleAvatar(
              radius: 16,
              backgroundColor: tone.withValues(alpha: 0.15),
              child: node.role == 'OWNER'
                  ? Icon(Icons.workspace_premium_rounded, size: 16, color: tone)
                  : Text(
                      node.fullName.isNotEmpty ? node.fullName[0].toUpperCase() : '?',
                      style: TextStyle(fontWeight: FontWeight.w700, color: tone, fontSize: 12),
                    ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    node.fullName,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    [
                      roleLabelTr(roleFromString(node.role)),
                      if (node.position != null) node.position!,
                    ].join(' · '),
                    style: const TextStyle(fontSize: 11, color: AppColors.textFaint),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (node.assignedCustomers.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  '${node.assignedCustomers.length} müşteri',
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
