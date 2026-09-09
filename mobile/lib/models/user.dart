/// backend Role enum (backend/prisma/schema.prisma) ile birebir.
enum AppRole { owner, manager, teamLead, staff, customer }

AppRole roleFromString(String value) {
  switch (value) {
    case 'OWNER':
      return AppRole.owner;
    case 'MANAGER':
      return AppRole.manager;
    case 'TEAM_LEAD':
      return AppRole.teamLead;
    case 'STAFF':
      return AppRole.staff;
    case 'CUSTOMER':
    default:
      return AppRole.customer;
  }
}

String roleToApiString(AppRole role) {
  switch (role) {
    case AppRole.owner:
      return 'OWNER';
    case AppRole.manager:
      return 'MANAGER';
    case AppRole.teamLead:
      return 'TEAM_LEAD';
    case AppRole.staff:
      return 'STAFF';
    case AppRole.customer:
      return 'CUSTOMER';
  }
}

String roleLabelTr(AppRole role) {
  switch (role) {
    case AppRole.owner:
      return 'Patron';
    case AppRole.manager:
      return 'Yönetici';
    case AppRole.teamLead:
      return 'Takım Lideri';
    case AppRole.staff:
      return 'Saha Personeli';
    case AppRole.customer:
      return 'Müşteri';
  }
}

class AppUser {
  final String id;
  final String email;
  final String fullName;
  final AppRole role;

  AppUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] as String,
    email: json['email'] as String,
    fullName: json['fullName'] as String,
    role: roleFromString(json['role'] as String),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'fullName': fullName,
    'role': roleToApiString(role),
  };
}
