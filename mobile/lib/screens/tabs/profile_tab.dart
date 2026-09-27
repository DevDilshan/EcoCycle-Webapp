import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../theme/eco_theme.dart';
import '../../utils/user_helpers.dart';
import '../complaints_list_screen.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  Future<void> _signOut(BuildContext context) async {
    await Supabase.instance.client.auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    return ListView(
      padding: const EdgeInsets.fromLTRB(22, 8, 22, 24),
      children: [
        const Text('Profile', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: EcoColors.cardBorder),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: EcoColors.avatarBg,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Text(
                  initials(user),
                  style: const TextStyle(fontWeight: FontWeight.w800, color: EcoColors.primary, fontSize: 18),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(displayName(user), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    Text(user?.email ?? '', style: const TextStyle(fontSize: 12, color: EcoColors.body)),
                    Text(
                      'Role: ${userRole(user)}',
                      style: ecoMono(color: EcoColors.body),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _ProfileTile(
          icon: Icons.report_outlined,
          label: 'My complaints',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const ComplaintsListScreen()),
          ),
        ),
        _ProfileTile(
          icon: Icons.logout,
          label: 'Sign out',
          onTap: () => _signOut(context),
        ),
      ],
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: EcoColors.cardBorder),
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListTile(
        leading: Icon(icon, color: EcoColors.primary),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right, color: EcoColors.muted),
        onTap: onTap,
      ),
    );
  }
}
