import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../utils/network_errors.dart';
import '../../utils/user_helpers.dart';
import '../complaints_list_screen.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  Future<void> _signOut(BuildContext context) async {
    await Supabase.instance.client.auth.signOut();
  }

  Future<void> _deleteAccount(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This permanently deletes your account and all associated data. '
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: EcoColors.danger),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await Api().delete('/account');
      // Clearing the session makes AuthGate swap back to the login screen.
      await Supabase.instance.client.auth.signOut();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyNetworkMessage(e))),
        );
      }
    }
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
        const SizedBox(height: 4),
        _ProfileTile(
          icon: Icons.delete_outline,
          label: 'Delete account',
          color: EcoColors.danger,
          titleColor: EcoColors.danger,
          onTap: () => _deleteAccount(context),
        ),
      ],
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = EcoColors.primary,
    this.titleColor,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  final Color? titleColor;

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
        leading: Icon(icon, color: color),
        title: Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: titleColor)),
        trailing: const Icon(Icons.chevron_right, color: EcoColors.muted),
        onTap: onTap,
      ),
    );
  }
}
