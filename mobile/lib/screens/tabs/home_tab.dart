import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../utils/user_helpers.dart';
import '../../widgets/eco_components.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key, required this.onRequestPickup});

  final VoidCallback onRequestPickup;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  final _api = Api();
  bool _loading = true;
  int _balance = 0;
  int? _rank;
  List<Map<String, dynamic>> _pickups = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = Supabase.instance.client.auth.currentUser!;
      final pickups = await _api.get(
        '/pickuprequests',
        query: {'pageSize': '50'},
      );
      final history = await _api.get(
        '/rewards/${user.id}/history',
        query: {'pageSize': '1'},
      );
      final leaders = await _api.get(
        '/rewards/leaderboard',
        query: {'limit': '50'},
      );
      final items =
          (pickups['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      int? rank;
      final list = leaders as List<dynamic>? ?? [];
      for (var i = 0; i < list.length; i++) {
        if (list[i]['residentId'] == user.id) {
          rank = (list[i]['rank'] as num?)?.toInt() ?? i + 1;
          break;
        }
      }
      setState(() {
        _pickups = items;
        _balance = (history?['currentBalance'] as num?)?.toInt() ?? 0;
        _rank = rank;
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Map<String, dynamic>? get _nextPickup {
    final open =
        _pickups.where((p) {
          final s = (p['status'] as String? ?? '').toLowerCase();
          return s != 'completed' && s != 'rejected' && s != 'cancelled';
        }).toList()..sort(
          (a, b) => DateTime.parse(
            a['preferredDate'] as String,
          ).compareTo(DateTime.parse(b['preferredDate'] as String)),
        );
    return open.isEmpty ? null : open.first;
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final name = displayName(user);
    final next = _nextPickup;

    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: EcoColors.primary),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: EcoColors.primary,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 16, 22, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        greeting(),
                        style: const TextStyle(
                          fontSize: 13,
                          color: EcoColors.body,
                        ),
                      ),
                      Text(
                        '$name 👋',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: EcoColors.avatarBg,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    initials(user),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: EcoColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: const LinearGradient(
                  colors: [EcoColors.primary, EcoColors.primaryDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: EcoColors.primary.withValues(alpha: 0.55),
                    blurRadius: 30,
                    offset: const Offset(0, 16),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Reward balance',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.white70,
                    ),
                  ),
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(color: Colors.white, height: 1.1),
                      children: [
                        TextSpan(
                          text: NumberFormat('#,###').format(_balance),
                          style: const TextStyle(
                            fontSize: 38,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const TextSpan(
                          text: ' pts',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _StatChip(emoji: '🔥 Streak', value: '—'),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatChip(
                          emoji: 'Rank',
                          value: _rank != null ? '#$_rank zone' : '—',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 16, 22, 0),
            child: GestureDetector(
              onTap: widget.onRequestPickup,
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: EcoColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: EcoColors.green.withValues(alpha: 0.12),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: EcoColors.mintLight,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      alignment: Alignment.center,
                      child: const Text('📷', style: TextStyle(fontSize: 22)),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Request a pickup',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                          Text(
                            'Snap a photo — AI does the rest',
                            style: TextStyle(
                              fontSize: 12,
                              color: EcoColors.body,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right,
                      color: EcoColors.primary,
                      size: 24,
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (next != null) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(22, 20, 22, 6),
              child: Text(
                'Next pickup',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: EcoColors.label,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: _NextPickupCard(pickup: next),
            ),
          ],
          const Padding(
            padding: EdgeInsets.fromLTRB(22, 20, 22, 6),
            child: Text(
              'Recent activity',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: EcoColors.label,
              ),
            ),
          ),
          ..._pickups
              .take(3)
              .map(
                (p) => Padding(
                  padding: const EdgeInsets.fromLTRB(22, 0, 22, 8),
                  child: _ActivityRow(pickup: p),
                ),
              ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.emoji, required this.value});
  final String emoji;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            emoji,
            style: const TextStyle(fontSize: 11, color: Colors.white70),
          ),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _NextPickupCard extends StatelessWidget {
  const _NextPickupCard({required this.pickup});
  final Map<String, dynamic> pickup;

  @override
  Widget build(BuildContext context) {
    final date = DateTime.parse(pickup['preferredDate'] as String);
    final cat = pickup['category'] as String? ?? 'Pickup';
    final status = pickup['status'] as String? ?? 'Pending';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: EcoColors.cardBorder),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: EcoColors.mintBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  DateFormat('MMM').format(date).toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: EcoColors.primary,
                  ),
                ),
                Text(
                  DateFormat('d').format(date),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$cat · ${pickup['description'] ?? 'Kerbside'}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  DateFormat('EEE').format(date),
                  style: const TextStyle(fontSize: 12, color: EcoColors.body),
                ),
              ],
            ),
          ),
          StatusBadge(label: status, tone: toneForPickupStatus(status)),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.pickup});
  final Map<String, dynamic> pickup;

  @override
  Widget build(BuildContext context) {
    final status = pickup['status'] as String? ?? '';
    final hasApproval = pickup['hasApprovalRequest'] == true;
    final approval = pickup['approvalStatus'] as String?;
    final isRejected = approval?.toLowerCase() == 'rejected';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: EcoColors.cardBorder),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: isRejected
                  ? EcoColors.dangerBg
                  : hasApproval
                      ? const Color(0xFFF7E3E0)
                      : const Color(0xFFE2ECF7),
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: Text(
              isRejected ? '✕' : (hasApproval ? '⚠️' : '♻️'),
              style: const TextStyle(fontSize: 16),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pickup['description'] as String? ?? 'Pickup',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${pickup['category'] ?? status} · ${isRejected ? 'not approved' : (approval?.toLowerCase() == 'pending' ? 'in review' : status.toLowerCase())}',
                  style: const TextStyle(fontSize: 11, color: EcoColors.body),
                ),
              ],
            ),
          ),
          if (isRejected)
            const StatusBadge(label: 'Not approved', tone: BadgeTone.pendingApproval)
          else if (hasApproval && approval?.toLowerCase() == 'pending')
            const StatusBadge(label: 'In review', tone: BadgeTone.pendingApproval)
          else
            const Text(
              '✓',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: EcoColors.primary,
                fontSize: 11,
              ),
            ),
        ],
      ),
    );
  }
}
