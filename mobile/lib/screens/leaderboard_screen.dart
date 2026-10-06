import '../app/eco_app_scope.dart';
import 'package:flutter/material.dart';

import '../services/api.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_loading.dart';
import 'redeem_screen.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  late final Api _api = EcoAppScope.apiOf(context);
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;
  bool _loadingMore = false;
  int _limit = _pageSize;
  int _balance = 0;

  static const _pageSize = 10;
  static const _maxEntries = 50;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final userId = EcoAppScope.userOf(context)?.id;
      final results = await Future.wait([
        _api.get('/rewards/leaderboard', query: {'limit': '$_limit'}),
        if (userId != null)
          _api.get('/rewards/$userId/history', query: {'pageSize': '1'}),
      ]);
      _entries = (results[0] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (results.length > 1) {
        _balance =
            ((results[1] as Map?)?['currentBalance'] as num?)?.toInt() ?? 0;
      }
    } catch (_) {}
    if (mounted) {
      setState(() {
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  void _showMore() {
    setState(() {
      _limit = (_limit + _pageSize).clamp(0, _maxEntries);
      _loadingMore = true;
    });
    _load();
  }

  // A full page came back, so there may be more; stop at the cap.
  bool get _canShowMore => _entries.length >= _limit && _limit < _maxEntries;

  @override
  Widget build(BuildContext context) {
    final userId = EcoAppScope.userOf(context)?.id;
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const EcoBackHeader(title: 'Leaderboard', subtitle: 'Top recyclers'),
          if (_loading)
            const Expanded(
              child: EcoLoadingState(
                title: 'Loading your EcoCycle',
                message: 'Bringing your latest details together.',
                compact: true,
              ),
            )
          else
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
                itemCount: _entries.length + (_canShowMore ? 1 : 0),
                itemBuilder: (context, i) {
                  if (i == _entries.length) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: TextButton(
                        onPressed: _loadingMore ? null : _showMore,
                        child: Text(_loadingMore ? 'Loading…' : 'Show more'),
                      ),
                    );
                  }
                  final e = _entries[i];
                  final rank = (e['rank'] as num?)?.toInt() ?? i + 1;
                  final isMe = e['residentId'] == userId;
                  final name = e['residentName'] as String? ?? 'Resident';
                  final pts = (e['pointsEarned'] as num?)?.toInt() ?? 0;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: isMe ? EcoColors.mintBg : Colors.white,
                      border: Border.all(
                        color: isMe ? EcoColors.primary : EcoColors.cardBorder,
                        width: isMe ? 1.5 : 1,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 24,
                          child: Text(
                            '$rank',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: isMe ? EcoColors.primary : EcoColors.body,
                            ),
                          ),
                        ),
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: isMe
                                ? EcoColors.primary
                                : EcoColors.avatarBg,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: isMe
                                  ? Colors.white
                                  : const Color(0xFF4A6A55),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            isMe ? 'You · $name' : name,
                            style: TextStyle(
                              fontWeight: isMe
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              fontSize: 13,
                              color: isMe ? EcoColors.primary : EcoColors.ink,
                            ),
                          ),
                        ),
                        Text(
                          '$pts',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: EcoColors.primary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          // Always visible under the scrolling list, so Redeem is never pushed off screen.
          Container(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: EcoColors.cardBorder)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Your balance',
                        style: TextStyle(fontSize: 13, color: EcoColors.body),
                      ),
                      Text(
                        '$_balance pts',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                          color: EcoColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                FilledButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => RewardCatalogScreen(balance: _balance),
                    ),
                  ),
                  icon: const Icon(Icons.card_giftcard, size: 18),
                  label: const Text('Rewards'),
                  style: FilledButton.styleFrom(
                    backgroundColor: EcoColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
