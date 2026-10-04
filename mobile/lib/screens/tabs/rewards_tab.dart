import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../app/eco_app_scope.dart';
import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/eco_feature.dart';
import '../../widgets/eco_loading.dart';
import '../leaderboard_screen.dart';
import '../redeem_screen.dart';

const _historyPreview = 5;

class RewardsTab extends StatefulWidget {
  const RewardsTab({super.key});
  @override
  State<RewardsTab> createState() => RewardsTabState();
}

class RewardsTabState extends State<RewardsTab> {
  late final Api _api;
  bool _loading = true;
  bool _failed = false;
  int _balance = 0;
  List<Map<String, dynamic>> _history = [];
  bool _showAllHistory = false;
  @override
  void initState() {
    super.initState();
    _api = EcoAppScope.apiOf(context);
    reload();
  }

  Future<void> reload() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final userId = EcoAppScope.userOf(context)!.id;
      final history = await _api.get(
        '/rewards/$userId/history',
        query: {'pageSize': '20'},
      );
      if (!mounted) return;
      setState(() {
        _balance = (history?['currentBalance'] as num?)?.toInt() ?? 0;
        _history =
            (history?['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: reload,
    color: EcoColors.green,
    child: ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      // The page scrolls underneath the floating bar; this is the room
      // that lets the last item come to rest above it.
      padding: EdgeInsets.only(bottom: ecoNavClearance(context)),
      children: [
        const EcoPageHeading(
          title: 'Small steps. Big rewards.',
          subtitle: 'Good choices deserve something good.',
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_loading)
                const EcoLoadingState(
                  title: 'Loading your rewards',
                  message: 'Adding up your greener steps.',
                  compact: true,
                )
              else if (_failed)
                EcoLoadError(onRetry: reload)
              else ...[
                EcoPointsCard(balance: _balance),
                const SizedBox(height: 18),
                EcoPrimaryButton(
                  label: 'Explore rewards',
                  icon: Icons.card_giftcard_outlined,
                  onPressed: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => RedeemScreen(balance: _balance),
                      ),
                    );
                    if (mounted) reload();
                  },
                ),
                const SizedBox(height: 12),
                EcoCard(
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const LeaderboardScreen(),
                    ),
                  ),
                  child: const Row(
                    children: [
                      EcoIconTile(icon: Icons.emoji_events_outlined, size: 44),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Community leaderboard',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'See the difference we make together',
                              style: TextStyle(
                                fontSize: 12,
                                height: 1.4,
                                color: EcoColors.body,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: EcoColors.green,
                        size: 22,
                      ),
                    ],
                  ),
                ),
                const EcoSectionHeading('Points activity'),
                if (_history.isEmpty)
                  const EcoEmptyState(
                    icon: Icons.eco_outlined,
                    title: 'Your first points are waiting',
                    message:
                        'Complete a pickup to start earning. Your points activity will appear here.',
                  )
                else ...[
                  ...(_showAllHistory
                          ? _history
                          : _history.take(_historyPreview))
                      .map((entry) => _HistoryRow(entry: entry)),
                  if (_history.length > _historyPreview)
                    TextButton(
                      onPressed: () =>
                          setState(() => _showAllHistory = !_showAllHistory),
                      child: Text(
                        _showAllHistory
                            ? 'Show less'
                            : 'Show all ${_history.length}',
                      ),
                    ),
                ],
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.entry});
  final Map<String, dynamic> entry;
  @override
  Widget build(BuildContext context) {
    final points = (entry['pointsEarned'] as num?)?.toInt() ?? 0;
    final positive = points >= 0;
    final date = DateTime.tryParse(entry['createdAt'] as String? ?? '');
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: EcoCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            EcoIconTile(
              icon: positive ? Icons.add_rounded : Icons.card_giftcard_outlined,
              size: 40,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry['reason'] as String? ?? 'Recycling points',
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (date != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      DateFormat('d MMM yyyy').format(date.toLocal()),
                      style: const TextStyle(
                        fontSize: 11,
                        color: EcoColors.body,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${positive ? '+' : ''}$points',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: positive ? EcoColors.green : EcoColors.danger,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
