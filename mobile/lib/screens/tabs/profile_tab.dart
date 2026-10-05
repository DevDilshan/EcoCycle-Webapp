import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app/eco_app_scope.dart';
import '../../theme/eco_theme.dart';
import '../../utils/network_errors.dart';
import '../../utils/user_helpers.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/eco_feature.dart';
import '../complaints_list_screen.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});
  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  bool _busy = false;
  String? _deleteError;
  Future<void> _signOut() async {
    setState(() => _busy = true);
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(friendlyNetworkMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This permanently deletes your account and all associated data. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep account'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: EcoColors.danger),
            child: const Text('Delete account'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _busy = true;
      _deleteError = null;
    });
    try {
      await EcoAppScope.apiOf(context).delete('/account');
    } catch (e) {
      // Shown next to the button, not in a passing message at the bottom of
      // the screen, so a failed deletion cannot be missed.
      if (mounted) setState(() => _deleteError = friendlyNetworkMessage(e));
      return;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    try {
      // The account no longer exists, so there is nothing for the server to
      // sign out; asking it would fail and leave this phone logged in to a
      // deleted account. Clearing the session on this device is enough.
      await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
    } catch (_) {
      // Nothing useful to tell the user: the account is already gone.
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = EcoAppScope.userOf(context);
    final preview = EcoAppScope.isPreview(context);
    final role = userRole(user) == 'collector' ? 'Collector' : 'Resident';
    return ListView(
      // The page scrolls underneath the floating bar; this is the room
      // that lets the last item come to rest above it.
      padding: EdgeInsets.only(bottom: ecoNavClearance(context)),
      children: [
        const EcoPageHeading(
          title: 'Your corner',
          subtitle: 'A little about you. A lot of good ahead.',
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              EcoCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: EcoColors.celadon,
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Text(
                            initials(user),
                            style: const TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              color: EcoColors.green,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                displayName(user),
                                style: const TextStyle(
                                  fontSize: 20,
                                  height: 1.3,
                                  fontWeight: FontWeight.w800,
                                  color: EcoColors.green,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: StatusBadge(
                                  label: role,
                                  tone: BadgeTone.next,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    const Divider(height: 1, color: EcoColors.border),
                    const SizedBox(height: 16),
                    const Text(
                      'Email address',
                      style: TextStyle(
                        fontSize: 12,
                        color: EcoColors.body,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      user?.email ?? 'Email unavailable',
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const EcoSectionHeading('Account & support'),
              // Complaints are raised by residents about their own pickups.
              if (role == 'Resident')
                _ProfileTile(
                  icon: Icons.chat_bubble_outline_rounded,
                  label: 'My complaints',
                  subtitle: 'Follow up on a pickup issue',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const ComplaintsListScreen(),
                    ),
                  ),
                ),
              _ProfileTile(
                icon: Icons.logout_rounded,
                label: _busy ? 'Please wait…' : 'Log out',
                subtitle: preview
                    ? 'Available when signed in'
                    : 'You can log back in at any time',
                onTap: _busy || preview ? null : _signOut,
              ),
              const SizedBox(height: 28),
              EcoCard(
                color: EcoColors.honeydew,
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.eco_outlined, color: EcoColors.green, size: 24),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Thank you for being part of a cleaner community. Every pickup counts.',
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.6,
                          color: EcoColors.green,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const EcoSectionHeading('Danger zone'),
              const Text(
                'Deleting your account removes your pickups, points and '
                'rewards for good.',
                style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: EcoColors.body,
                ),
              ),
              const SizedBox(height: 12),
              if (_deleteError != null) ...[
                Text(
                  'Your account was not deleted. $_deleteError',
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    fontWeight: FontWeight.w600,
                    color: EcoColors.danger,
                  ),
                ),
                const SizedBox(height: 12),
              ],
              EcoDangerButton(
                label: 'Delete account',
                icon: Icons.delete_outline_rounded,
                loading: _busy,
                onPressed: _busy || preview ? null : _deleteAccount,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: EcoCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EcoIconTile(icon: icon, size: 42),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    color: EcoColors.body,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.chevron_right_rounded,
            color: EcoColors.body,
            size: 21,
          ),
        ],
      ),
    ),
  );
}
