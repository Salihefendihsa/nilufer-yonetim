import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../models/org_chart.dart';
import '../../models/user.dart';
import '../../navigation/sub_page_scaffold.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/state_views.dart';
import 'staff_detail_screen.dart';

Map<String, Color> _roleTones(AppPalette cs) => {
  'OWNER': cs.warning600,
  'MANAGER': cs.primary700,
  'TEAM_LEAD': cs.info600,
  'STAFF': cs.textSecondary,
};

/// Düğüm kutusu genişliği ve dallar arası boşluklar (ağaç görünümü).
const double _nodeWidth = 132;
const double _siblingGap = 8;
const double _levelGap = 18;
const double _stackIndent = 16;

/// web/src/app/(dashboard)/personel/OrgChartView.tsx'in mobil karşılığı.
/// Varsayılan görünüm üstten alta dallanan bir ağaç şemasıdır (kutular arası
/// bağlantı çizgileri CustomPaint ile, dış paket yok); telefondan geniş ağaç
/// InteractiveViewer ile kaydırılır/yakınlaştırılır ve açılışta ekrana
/// sığacak şekilde ölçeklenir. Girintili liste görünümü de seçilebilir.
/// Aynı `/staff/org-chart` uçtan beslenir.
class OrgChartScreen extends StatefulWidget {
  const OrgChartScreen({super.key});

  @override
  State<OrgChartScreen> createState() => _OrgChartScreenState();
}

class _OrgChartScreenState extends State<OrgChartScreen> {
  OrgChartResponse? _data;
  bool _loading = true;
  String? _error;
  bool _treeView = true;

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
      final json = await ApiClient.instance.get<Map<String, dynamic>>(
        '/staff/org-chart',
      );
      setState(() => _data = OrgChartResponse.fromJson(json));
    } catch (e) {
      setState(
        () => _error = e is ApiException
            ? e.message
            : 'Organizasyon şeması yüklenemedi',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Personel/şef düğümü → mevcut personel detay ekranı (patron/müdür
  /// düğümlerinin Staff kaydı yok, tıklanamaz).
  VoidCallback? _onTapFor(OrgChartNode node) {
    if (node.role != 'STAFF' && node.role != 'TEAM_LEAD') return null;
    return () => Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => StaffDetailScreen(staffId: node.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return SubPageScaffold(
      title: 'Organizasyon Şeması',
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorRetryView(message: _error!, onRetry: _load)
          : data == null || data.tree.isEmpty
          ? const EmptyStateView(
              title: 'Organizasyon şeması boş',
              subtitle: 'Henüz bir işletme sahibi hesabı tanımlı değil.',
              icon: Icons.account_tree_outlined,
            )
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(
                        value: true,
                        icon: Icon(Icons.account_tree_outlined),
                        label: Text('Şema'),
                      ),
                      ButtonSegment(
                        value: false,
                        icon: Icon(Icons.format_list_bulleted_rounded),
                        label: Text('Liste'),
                      ),
                    ],
                    selected: {_treeView},
                    showSelectedIcon: false,
                    onSelectionChanged: (s) =>
                        setState(() => _treeView = s.first),
                  ),
                ),
                Expanded(
                  child: _treeView ? _buildTreeView(data) : _buildList(data),
                ),
              ],
            ),
    );
  }

  // ── Ağaç görünümü ─────────────────────────────────────────────────────

  Widget _buildTreeView(OrgChartResponse data) {
    return Column(
      children: [
        Expanded(
          child: _FitInteractiveTree(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final root in data.tree) ...[
                  _subtree(root),
                  const SizedBox(height: 24),
                ],
              ],
            ),
          ),
        ),
        if (data.unassigned.isNotEmpty) _buildUnassignedStrip(data),
      ],
    );
  }

  /// Çocuklarının hepsi yaprak (alt ekibi yok) ve birden fazlaysa (ör. şef →
  /// personel) çocuklar yan yana değil, dikey bir gövdeye bağlı olarak alt
  /// alta dizilir — ağacın genişliği ve dolayısıyla sığdırma ölçeği makul kalır.
  bool _isLeafStack(OrgChartNode node) =>
      node.children.length > 1 &&
      node.children.every((c) => c.children.isEmpty);

  Widget _subtree(OrgChartNode node) {
    final line = context.colors.borderStrong;
    if (_isLeafStack(node)) {
      // Kutu solda; gövde kutu merkezinden (x = _nodeWidth/2) aşağı iner.
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _NodeBox(node: node, onTap: _onTapFor(node)),
          Padding(
            padding: const EdgeInsets.only(
              left: _nodeWidth / 2 - _stackIndent / 2,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < node.children.length; i++)
                  CustomPaint(
                    painter: _StackConnectorPainter(
                      color: line,
                      isLast: i == node.children.length - 1,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.only(
                        left: _stackIndent + 6,
                        top: 8,
                      ),
                      child: _NodeBox(
                        node: node.children[i],
                        onTap: _onTapFor(node.children[i]),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _NodeBox(node: node, onTap: _onTapFor(node)),
        if (node.children.isNotEmpty) ...[
          Container(width: 2, height: _levelGap, color: line),
          Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < node.children.length; i++)
                CustomPaint(
                  painter: _ConnectorPainter(
                    color: line,
                    isFirst: i == 0,
                    isLast: i == node.children.length - 1,
                    // Dikey yığın düzenindeki çocuğun kutusu solda durur.
                    anchorX: _isLeafStack(node.children[i])
                        ? _siblingGap / 2 + _nodeWidth / 2
                        : null,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.only(
                      top: _levelGap,
                      left: _siblingGap / 2,
                      right: _siblingGap / 2,
                    ),
                    child: _subtree(node.children[i]),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildUnassignedStrip(OrgChartResponse data) {
    final cs = context.colors;
    final tx = context.text;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(
        color: cs.warning50,
        border: Border(top: BorderSide(color: cs.borderDefault)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, size: 16, color: cs.warning600),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Şefi Tanımlı Olmayan (${data.unassigned.length})',
                  style: tx.bodySmall.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final n in data.unassigned)
                ActionChip(
                  avatar: const Icon(Icons.person_outline_rounded, size: 16),
                  label: Text(n.fullName),
                  onPressed: _onTapFor(n),
                ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Liste görünümü (önceki girintili liste) ───────────────────────────

  Widget _buildList(OrgChartResponse data) {
    final cs = context.colors;
    final tx = context.text;
    return RefreshIndicator(
      onRefresh: _load,
      color: cs.accentSoft,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final root in data.tree) ..._flatten(root, 0),
          if (data.unassigned.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(
              children: [
                Icon(
                  Icons.warning_amber_rounded,
                  size: 16,
                  color: cs.warning600,
                ),
                const SizedBox(width: 6),
                Text(
                  'Şefi Tanımlı Olmayan / Bağlantısız',
                  style: tx.bodySmall.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 8),
            for (final n in data.unassigned) ..._flatten(n, 0),
          ],
        ],
      ),
    );
  }

  List<Widget> _flatten(OrgChartNode node, int depth) {
    return [
      Padding(
        padding: EdgeInsets.only(left: depth * 20.0, bottom: 8),
        child: _ListRow(node: node, onTap: _onTapFor(node)),
      ),
      for (final child in node.children) ..._flatten(child, depth + 1),
    ];
  }
}

/// Ağacı InteractiveViewer içinde gösterir; ilk çizimden sonra ağacın
/// gerçek boyutunu ölçüp tamamı ekrana sığacak şekilde küçültür (en fazla
/// 1×) ve yatayda ortalar. Kullanıcı sonra parmakla yakınlaştırabilir.
class _FitInteractiveTree extends StatefulWidget {
  final Widget child;
  const _FitInteractiveTree({required this.child});

  @override
  State<_FitInteractiveTree> createState() => _FitInteractiveTreeState();
}

class _FitInteractiveTreeState extends State<_FitInteractiveTree> {
  final _controller = TransformationController();
  final _childKey = GlobalKey();
  bool _fitted = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _fit(BoxConstraints viewport) {
    if (_fitted) return;
    final box = _childKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    _fitted = true;
    const margin = 16.0;
    final size = box.size;
    final scale = ((viewport.maxWidth - margin * 2) / size.width).clamp(
      0.25,
      1.0,
    );
    final dx = (viewport.maxWidth - size.width * scale) / 2;
    _controller.value = Matrix4.identity()
      ..translateByDouble(dx, margin, 0, 1)
      ..scaleByDouble(scale, scale, 1, 1);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _fit(constraints);
        });
        return InteractiveViewer(
          transformationController: _controller,
          constrained: false,
          minScale: 0.25,
          maxScale: 2.5,
          boundaryMargin: const EdgeInsets.all(400),
          child: KeyedSubtree(key: _childKey, child: widget.child),
        );
      },
    );
  }
}

/// Bir çocuğun üst bağlantısı: kardeşleri birleştiren yatay çizginin bu
/// çocuğa düşen parçası (ilk çocukta sağ yarı, sonda sol yarı, ortadakilerde
/// tam genişlik, tek çocukta yok) + çocuğun kutusuna inen dikey çizgi.
class _ConnectorPainter extends CustomPainter {
  final Color color;
  final bool isFirst;
  final bool isLast;

  /// Çocuk kutusunun yatay merkezi; null → alanın ortası.
  final double? anchorX;
  const _ConnectorPainter({
    required this.color,
    required this.isFirst,
    required this.isLast,
    this.anchorX,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2;
    final cx = anchorX ?? size.width / 2;
    if (!(isFirst && isLast)) {
      final startX = isFirst ? cx : 0.0;
      final endX = isLast ? cx : size.width;
      canvas.drawLine(Offset(startX, 1), Offset(endX, 1), paint);
    } else if (anchorX != null) {
      // Tek çocuk sola hizalı yığınsa: ortadaki gövdeden inişe kısa köprü.
      canvas.drawLine(Offset(size.width / 2, 1), Offset(cx, 1), paint);
    }
    canvas.drawLine(Offset(cx, 0), Offset(cx, _levelGap), paint);
  }

  @override
  bool shouldRepaint(_ConnectorPainter old) =>
      old.color != color ||
      old.isFirst != isFirst ||
      old.isLast != isLast ||
      old.anchorX != anchorX;
}

/// Dikey yığındaki bir çocuğun bağlantısı: soldaki gövde (son çocukta kutunun
/// ortasında biter) + kutuya giden yatay kısa çizgi.
class _StackConnectorPainter extends CustomPainter {
  final Color color;
  final bool isLast;
  const _StackConnectorPainter({required this.color, required this.isLast});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2;
    const x = _stackIndent / 2;
    // Kutunun dikey ortası (üst boşluk 8 dahil).
    final midY = 8 + (size.height - 8) / 2;
    canvas.drawLine(
      const Offset(x, 0),
      Offset(x, isLast ? midY : size.height),
      paint,
    );
    canvas.drawLine(Offset(x, midY), Offset(_stackIndent + 6, midY), paint);
  }

  @override
  bool shouldRepaint(_StackConnectorPainter old) =>
      old.color != color || old.isLast != isLast;
}

class _NodeBox extends StatelessWidget {
  final OrgChartNode node;
  final VoidCallback? onTap;
  const _NodeBox({required this.node, this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final tone = _roleTones(cs)[node.role] ?? cs.textSecondary;
    final radius = BorderRadius.circular(AppRadius.card);
    return SizedBox(
      width: _nodeWidth,
      child: Material(
        color: cs.surfaceCard,
        borderRadius: radius,
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(color: cs.borderDefault),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Rol rengi üst şerit olarak (tek renkli kenarlık + radius
                // kısıtı nedeniyle ayrı çizilir — bkz. widgets/accent_card.dart).
                Container(height: 4, color: tone),
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
                  child: Column(
                    children: [
                      _Avatar(node: node, tone: tone),
                      const SizedBox(height: 6),
                      Text(
                        node.fullName,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: tx.bodySmall.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        roleLabelTr(roleFromString(node.role)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: tx.label.copyWith(color: tone),
                      ),
                      if (node.assignedCustomers.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          '${node.assignedCustomers.length} aktif müşteri',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: tx.label.copyWith(color: cs.textFaint),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final OrgChartNode node;
  final Color tone;
  const _Avatar({required this.node, required this.tone});

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 16,
      backgroundColor: tone.withValues(alpha: 0.15),
      child: node.role == 'OWNER'
          ? Icon(Icons.workspace_premium_rounded, size: 16, color: tone)
          : Text(
              node.fullName.isNotEmpty ? node.fullName[0].toUpperCase() : '?',
              style: context.text.caption.copyWith(
                fontWeight: FontWeight.w700,
                color: tone,
              ),
            ),
    );
  }
}

class _ListRow extends StatelessWidget {
  final OrgChartNode node;
  final VoidCallback? onTap;
  const _ListRow({required this.node, this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = context.colors;
    final tx = context.text;
    final tone = _roleTones(cs)[node.role] ?? cs.textSecondary;
    final radius = BorderRadius.circular(AppRadius.card);
    return Material(
      color: cs.surfaceCard,
      borderRadius: radius,
      child: InkWell(
        borderRadius: radius,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(color: cs.borderDefault),
          ),
          child: Row(
            children: [
              Container(
                width: 3,
                height: 32,
                color: tone,
                margin: const EdgeInsets.only(right: 10),
              ),
              _Avatar(node: node, tone: tone),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      node.fullName,
                      style: tx.bodySmall.copyWith(fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      [
                        roleLabelTr(roleFromString(node.role)),
                        if (node.position != null) node.position!,
                      ].join(' · '),
                      style: tx.label,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (node.assignedCustomers.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: cs.surfaceMuted,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    '${node.assignedCustomers.length} müşteri',
                    style: tx.label.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
