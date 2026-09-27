import 'package:supabase_flutter/supabase_flutter.dart';

String userRole(User? user) {
  final meta = user?.userMetadata ?? {};
  final app = user?.appMetadata ?? {};
  final r = meta['role'] ?? app['role'];
  return r?.toString().toLowerCase() ?? 'resident';
}

String displayName(User? user) {
  final meta = user?.userMetadata;
  final full = meta?['full_name'] as String?;
  if (full != null && full.isNotEmpty) return full.split(' ').first;
  final email = user?.email ?? 'User';
  return email.split('@').first;
}

String initials(User? user) {
  final name = displayName(user);
  final parts = name.split(RegExp(r'\s+'));
  if (parts.length >= 2) {
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }
  return name.length >= 2
      ? name.substring(0, 2).toUpperCase()
      : name[0].toUpperCase();
}

String greeting() {
  final h = DateTime.now().hour;
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

String shortPickupId(String id) {
  if (id.length <= 8) return '#PR-$id';
  return '#PR-${id.substring(0, 4).toUpperCase()}';
}
