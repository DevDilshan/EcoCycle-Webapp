import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../app/eco_app_scope.dart';
import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../utils/user_helpers.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/eco_feature.dart';
import '../../widgets/eco_loading.dart';
import '../pickup_detail_screen.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({
    super.key,
    required this.onRequestPickup,
    required this.onOpenProfile,
    required this.onOpenRequests,
    required this.onOpenRewards,
  });
  final VoidCallback onRequestPickup;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenRequests;
  final VoidCallback onOpenRewards;
  @override
  State<HomeTab> createState() => HomeTabState();
}

class HomeTabState extends State<HomeTab> {
  late final Api _api;
  bool _loading = true;
  bool _failed = false;
  int _balance = 0;
  int? _rank;
  List<Map<String, dynamic>> _pickups = [];
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
      final user = EcoAppScope.userOf(context)!;
      final results = await Future.wait([
        _api.get('/pickuprequests', query: {'pageSize': '50'}),
        _api.get('/rewards/${user.id}/history', query: {'pageSize': '1'}),
        _api.get('/rewards/leaderboard', query: {'limit': '50'}),
      ]);
      if (!mounted) return;
      final leaders = results[2] as List<dynamic>? ?? [];
      int? rank;
      for (var i = 0; i < leaders.length; i++) {
        if (leaders[i]['residentId'] == user.id) {
          rank = (leaders[i]['rank'] as num?)?.toInt() ?? i + 1;
          break;
        }
      }
      setState(() {
        _pickups =
            (results[0]['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _balance = (results[1]?['currentBalance'] as num?)?.toInt() ?? 0;
        _rank = rank;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openPickup(Map<String, dynamic> pickup) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PickupDetailScreen(pickupId: pickup['id'] as String),
      ),
    );
    if (mounted) reload();
  }

  @override
  Widget build(BuildContext context) {
    final user = EcoAppScope.userOf(context);
    final active = _pickups.where(activePickup).toList()
      ..sort(
        (a, b) => (a['preferredDate'] as String? ?? '').compareTo(
          b['preferredDate'] as String? ?? '',
        ),
      );
    final completed = _pickups
        .where(
          (p) => (p['status'] as String? ?? '').toLowerCase() == 'completed',
        )
        .length;
    return RefreshIndicator(
      onRefresh: reload,
      color: EcoColors.green,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        // The page scrolls underneath the floating bar; this is the room
        // that lets the last item come to rest above it.
        padding: EdgeInsets.only(bottom: ecoNavClearance(context)),
        children: [
          EcoPageHeading(
            title: 'Hello, ${displayName(user)}',
            subtitle:
                '${greeting().replaceAll(',', '')}. Let’s make today greener.',
            trailing: Semantics(
              button: true,
              label: 'Open profile',
              child: Material(
                color: EcoColors.celadon,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  onTap: widget.onOpenProfile,
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    width: 48,
                    height: 48,
                    child: Center(
                      child: ExcludeSemantics(
                        child: Text(
                          initials(user),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: EcoColors.green,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                EcoCard(
                  color: EcoColors.honeydew,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Row(
                        children: [
                          EcoIconTile(icon: Icons.recycling_rounded, size: 48),
                          SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Less waste.\nMore possibility.',
                              style: TextStyle(
                                fontSize: 21,
                                height: 1.2,
                                letterSpacing: -.4,
                                fontWeight: FontWeight.w800,
                                color: EcoColors.green,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Give your recyclables a fresh start. Choose a day and we’ll take care of the pickup.',
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.6,
                          color: EcoColors.body,
                        ),
                      ),
                      const SizedBox(height: 18),
                      EcoPrimaryButton(
                        label: 'Request a pickup',
                        icon: Icons.add_rounded,
                        onPressed: widget.onRequestPickup,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                if (_loading)
                  const EcoLoadingState(
                    title: 'Your latest activity',
                    message: 'Fetching your pickups and rewards.',
                    compact: true,
                  )
                else if (_failed)
                  EcoLoadError(onRetry: reload)
                else ...[
                  EcoCard(
                    onTap: widget.onOpenRewards,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'YOUR IMPACT',
                          style: TextStyle(
                            fontSize: 12,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w800,
                            color: EcoColors.body,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: _Metric(
                                value: NumberFormat('#,###').format(_balance),
                                label: 'Reward points',
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: _Metric(
                                value: '$completed',
                                label: 'Completed pickups',
                              ),
                            ),
                          ],
                        ),
                        if (_rank != null) ...[
                          const SizedBox(height: 14),
                          Text(
                            'Community rank #$_rank',
                            style: const TextStyle(
                              fontSize: 13,
                              color: EcoColors.green,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        const SizedBox(height: 14),
                        const Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Explore your rewards',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: EcoColors.green,
                                ),
                              ),
                            ),
                            Icon(
                              Icons.arrow_forward_rounded,
                              size: 18,
                              color: EcoColors.green,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  EcoSectionHeading(
                    'Next pickup',
                    action: 'View all',
                    onAction: widget.onOpenRequests,
                  ),
                  if (active.isEmpty)
                    const EcoEmptyState(
                      icon: Icons.event_available_outlined,
                      title: 'A fresh start awaits',
                      message:
                          'Your next pickup will appear here once you send a request.',
                    )
                  else
                    EcoPickupCard(
                      pickup: active.first,
                      onTap: () => _openPickup(active.first),
                    ),
                  if (_pickups.isNotEmpty) ...[
                    const EcoSectionHeading('Recent activity'),
                    ..._pickups
                        .take(3)
                        .map(
                          (pickup) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: EcoPickupCard(
                              pickup: pickup,
                              onTap: () => _openPickup(pickup),
                            ),
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
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label});
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        value,
        style: const TextStyle(
          fontSize: 27,
          fontWeight: FontWeight.w800,
          color: EcoColors.green,
          height: 1.2,
          letterSpacing: -.5,
        ),
      ),
      const SizedBox(height: 6),
      Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          height: 1.4,
          color: EcoColors.body,
        ),
      ),
    ],
  );
}
