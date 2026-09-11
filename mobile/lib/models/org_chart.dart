/// backend/src/controllers/staffController.ts:getOrgChart yanıtı.
class OrgChartNode {
  final String id;
  final String userId;
  final String fullName;
  final String role;
  final String? position;
  final String? status;
  final List<Map<String, String>> assignedCustomers;
  final List<OrgChartNode> children;

  OrgChartNode({
    required this.id,
    required this.userId,
    required this.fullName,
    required this.role,
    this.position,
    this.status,
    required this.assignedCustomers,
    required this.children,
  });

  factory OrgChartNode.fromJson(Map<String, dynamic> json) => OrgChartNode(
    id: json['id'] as String,
    userId: json['userId'] as String,
    fullName: json['fullName'] as String,
    role: json['role'] as String,
    position: json['position'] as String?,
    status: json['status'] as String?,
    assignedCustomers: (json['assignedCustomers'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .map((c) => {'id': c['id'] as String, 'fullName': c['fullName'] as String})
        .toList(),
    children: (json['children'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .map(OrgChartNode.fromJson)
        .toList(),
  );
}

class OrgChartResponse {
  final List<OrgChartNode> tree;
  final List<OrgChartNode> unassigned;

  OrgChartResponse({required this.tree, required this.unassigned});

  factory OrgChartResponse.fromJson(Map<String, dynamic> json) => OrgChartResponse(
    tree: (json['tree'] as List).cast<Map<String, dynamic>>().map(OrgChartNode.fromJson).toList(),
    unassigned: (json['unassigned'] as List)
        .cast<Map<String, dynamic>>()
        .map(OrgChartNode.fromJson)
        .toList(),
  );
}
