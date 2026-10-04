import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../app/eco_app_scope.dart';
import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../utils/user_helpers.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/eco_feature.dart';
import '../../widgets/eco_loading.dart';
import 'stop_detail_screen.dart';

/// A route stop's own state. The API sends the enum as a number
/// (0 pending, 1 completed, 2 missed); a name is accepted too.
String stopCompletion(Object? value) => switch (value) {
  1 || 'Completed' => 'Completed',
  2 || 'Missed' => 'Missed',
  _ => 'Pending',
};

/// One stop as the screens show it. A route assignment carries only ids, so
/// the address, items and photo are taken from the pickup it points at. The
/// stop's `id` stays the route id, which is what complete and missed act on.
Map<String, dynamic> collectorStop(
  Map<String, dynamic> route,
  Map<String, dynamic>? pickup,
) => {
  ...?pickup,
  ...route,
  'completion': stopCompletion(route['completionStatus']),
};

class CollectorRouteScreen extends StatefulWidget {
  const CollectorRouteScreen({
    super.key,
    required this.collectorId,
    required this.onOpenProfile,
  });

  final String collectorId;
  final VoidCallback onOpenProfile;

  @override
  State<CollectorRouteScreen> createState() => CollectorRouteScreenState();
}

class CollectorRouteScreenState extends State<CollectorRouteScreen> {
  late final Api _api = EcoAppScope.apiOf(context);
  List<Map<String, dynamic>> _stops = [];
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    setState(() {
      // Keep the list on screen while refreshing; only a first load, or a
      // retry after a failure, shows the loading state.
      _loading = _stops.isEmpty;
      _failed = false;
    });
    try {
      final routes = await _api.get('/routes/${widget.collectorId}/today');
      final list =
          (routes is List ? routes : (routes?['items'] as List?) ?? const [])
              .cast<Map<String, dynamic>>();

      // Losing the pickup details costs the cards their address, not the
      // round, so a failure here is not a route error.
      final pickups = <String, Map<String, dynamic>>{};
      try {
        final page = await _api.get(
          '/pickuprequests',
          query: {'pageSize': '100'},
        );
        for (final p
            in (page?['items'] as List? ?? const [])
                .cast<Map<String, dynamic>>()) {
          pickups[p['id'] as String] = p;
        }
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _stops = [
          for (final route in list)
            collectorStop(route, pickups[route['pickupRequestId']]),
        ];
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openStop(Map<String, dynamic> stop, int number) async {
    final changed = await Navigator.of(context).push(
      MaterialPageRoute<bool>(
        builder: (_) => StopDetailScreen(stop: stop, stopNumber: number),
      ),
    );
    if (changed == true && mounted) reload();
  }

  @override
  Widget build(BuildContext context) {
    final user = EcoAppScope.userOf(context);
    final done = _stops.where((s) => s['completion'] == 'Completed').length;
    final missed = _stops.where((s) => s['completion'] == 'Missed').length;
    final left = _stops.length - done - missed;
    final nextIndex = _stops.indexWhere((s) => s['completion'] == 'Pending');

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
            title: 'Today’s route',
            subtitle: DateFormat('EEEE, d MMMM').format(DateTime.now()),
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
                if (_loading)
                  const EcoLoadingState(
                    title: 'Getting your round ready',
                    message: 'Fetching today’s stops.',
                    compact: true,
                  )
                else if (_failed)
                  EcoLoadError(
                    onRetry: reload,
                    message: 'We couldn’t load your route. Please try again.',
                  )
                else if (_stops.isEmpty)
                  const EcoEmptyState(
                    icon: Icons.route_outlined,
                    title: 'No stops today',
                    message:
                        'When pickups are assigned to you for today, they’ll '
                        'appear here.',
                  )
                else ...[
                  _RouteProgress(
                    total: _stops.length,
                    done: done,
                    left: left,
                    missed: missed,
                  ),
                  const EcoSectionHeading('Stops'),
                  for (var i = 0; i < _stops.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _StopCard(
                        stop: _stops[i],
                        number: i + 1,
                        isNext: i == nextIndex,
                        onTap: () => _openStop(_stops[i], i + 1),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteProgress extends StatelessWidget {
  const _RouteProgress({
    required this.total,
    required this.done,
    required this.left,
    required this.missed,
  });
  final int total;
  final int done;
  final int left;
  final int missed;

  @override
  Widget build(BuildContext context) {
    return EcoCard(
      color: EcoColors.honeydew,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            left == 0 ? 'Round complete' : '$done of $total collected',
            style: const TextStyle(
              fontSize: 21,
              height: 1.2,
              letterSpacing: -.4,
              fontWeight: FontWeight.w800,
              color: EcoColors.green,
            ),
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : done / total,
              minHeight: 8,
              backgroundColor: EcoColors.celadon.withValues(alpha: .45),
              color: EcoColors.green,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _Stat(value: '$total', label: 'Stops'),
              ),
              Expanded(
                child: _Stat(value: '$left', label: 'Left'),
              ),
              Expanded(
                child: _Stat(
                  value: '$missed',
                  label: 'Not collected',
                  color: missed > 0 ? EcoColors.danger : EcoColors.green,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.value,
    required this.label,
    this.color = EcoColors.green,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        value,
        style: TextStyle(
          fontSize: 22,
          height: 1.2,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
      const SizedBox(height: 4),
      Text(label, style: const TextStyle(fontSize: 12, color: EcoColors.body)),
    ],
  );
}

class _StopCard extends StatelessWidget {
  const _StopCard({
    required this.stop,
    required this.number,
    required this.isNext,
    required this.onTap,
  });
  final Map<String, dynamic> stop;
  final int number;
  final bool isNext;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final completion = stop['completion'] as String;
    final completed = completion == 'Completed';
    final missed = completion == 'Missed';
    final address = (stop['address'] as String?)?.trim();
    final description = (stop['description'] as String?)?.trim();
    final title = address?.isNotEmpty == true
        ? address!
        : (description?.isNotEmpty == true ? description! : 'Stop $number');
    final details = [
      stop['category'] as String?,
      if (address?.isNotEmpty == true) description,
    ].whereType<String>().where((part) => part.isNotEmpty).join(' · ');

    return EcoCard(
      onTap: onTap,
      color: completed ? EcoColors.honeydew : EcoColors.surface,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: completed
                  ? EcoColors.green
                  : missed
                  ? EcoColors.dangerBg
                  : EcoColors.celadon.withValues(alpha: .55),
              borderRadius: BorderRadius.circular(14),
            ),
            child: completed
                ? const Icon(Icons.check_rounded, size: 22, color: Colors.white)
                : missed
                ? const Icon(
                    Icons.priority_high_rounded,
                    size: 22,
                    color: EcoColors.danger,
                  )
                : Text(
                    '$number',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: EcoColors.green,
                    ),
                  ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    height: 1.3,
                    fontWeight: FontWeight.w700,
                    color: EcoColors.ink,
                  ),
                ),
                if (details.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    details,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: EcoColors.body),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (completed)
            const StatusBadge(label: 'Collected', tone: BadgeTone.completed)
          else if (missed)
            const StatusBadge(label: 'Not collected', tone: BadgeTone.inReview)
          else if (isNext)
            const StatusBadge(label: 'Next', tone: BadgeTone.next)
          else
            const Icon(Icons.chevron_right_rounded, color: EcoColors.green),
        ],
      ),
    );
  }
}
