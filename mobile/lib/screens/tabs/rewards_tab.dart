import 'package:flutter/material.dart';
import '../../widgets/eco_loading.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../leaderboard_screen.dart';
import '../redeem_screen.dart';

const _historyPreview = 5;

class RewardsTab extends StatefulWidget {
  const RewardsTab({super.key});

  @override
  State<RewardsTab> createState() => _RewardsTabState();
}

class _RewardsTabState extends State<RewardsTab> {
  final _api = Api();
  bool _loading = true;
  int _balance = 0;
  List<Map<String, dynamic>> _history = [];
  bool _showAllHistory = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final userId = Supabase.instance.client.auth.currentUser!.id;
      final history = await _api.get('/rewards/$userId/history', query: {'pageSize': '20'});
      setState(() {
        _balance = (history?['currentBalance'] as num?)?.toInt() ?? 0;
        _history = (history?['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const EcoLoadingState(title: 'Loading your EcoCycle', message: 'Bringing your latest details together.', compact: true);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 8, 22, 24),
        children: [
          const Text('Rewards', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: const LinearGradient(
                colors: [EcoColors.primary, EcoColors.primaryDark],
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
              children: [
                const Text('Current balance', style: TextStyle(fontSize: 12, color: Colors.white70)),
                Text(
                  NumberFormat('#,###').format(_balance),
                  style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w800, color: Colors.white),
                ),
                const Text('points', style: TextStyle(fontSize: 13, color: Colors.white70)),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    '🔥 Keep recycling to climb the board',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          // Both actions sit right under the balance, so they never scroll away
          // however long the points history gets.
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => Navigator.of(context)
                      .push(MaterialPageRoute<void>(builder: (_) => RedeemScreen(balance: _balance)))
                      .then((_) => _load()),
                  icon: const Icon(Icons.card_giftcard, size: 18),
                  label: const Text('Redeem'),
                  style: FilledButton.styleFrom(
                    backgroundColor: EcoColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const LeaderboardScreen()),
                  ),
                  icon: const Icon(Icons.emoji_events_outlined, size: 18),
                  label: const Text('Leaderboard'),
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'Points history',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: EcoColors.label),
          ),
          const SizedBox(height: 10),
          if (_history.isEmpty)
            const Text('No history yet.', style: TextStyle(color: EcoColors.body))
          else ...[
            // Only the latest few, so the page stays short; the rest is one tap away.
            ...(_showAllHistory ? _history : _history.take(_historyPreview)).map((h) => _HistoryRow(entry: h)),
            if (_history.length > _historyPreview)
              Center(
                child: TextButton(
                  onPressed: () => setState(() => _showAllHistory = !_showAllHistory),
                  child: Text(_showAllHistory ? 'Show less' : 'Show all ${_history.length}'),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.entry});
  final Map<String, dynamic> entry;

  @override
  Widget build(BuildContext context) {
    final pts = (entry['pointsEarned'] as num?)?.toInt() ?? 0;
    final positive = pts >= 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
              color: positive ? const Color(0xFFE2ECF7) : const Color(0xFFF7E3E0),
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: Text(positive ? '♻️' : '⚠️', style: const TextStyle(fontSize: 16)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry['reason'] as String? ?? 'Points',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
                Text(
                  entry['createdAt'] != null
                      ? DateFormat('d MMM').format(DateTime.parse(entry['createdAt'] as String))
                      : '',
                  style: const TextStyle(fontSize: 11, color: EcoColors.body),
                ),
              ],
            ),
          ),
          Text(
            '${positive ? '+' : ''}$pts',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: positive ? EcoColors.primary : EcoColors.danger,
            ),
          ),
        ],
      ),
    );
  }
}
