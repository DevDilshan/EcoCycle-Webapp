import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../app/eco_app_scope.dart';
import '../../services/api.dart';
import '../../services/pickup_photo_service.dart';
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

/// One stop as the screens show it.
///
/// The route assignment now carries the resident, the address, the category and
/// the photo itself, so nothing has to be merged in. It used to carry only ids,
/// and this screen fetched /pickuprequests?pageSize=100 to match them up --
/// which quietly lost every detail past the hundredth row and pulled requests
/// belonging to other collectors.
///
/// The stop's `id` stays the route id, which is what complete and missed act on.
Map<String, dynamic> collectorStop(Map<String, dynamic> route) => {
  ...route,
  'completion': stopCompletion(route['completionStatus']),
  // True when an earlier round never got to this stop. Today's round carries
  // anything still pending from before, deliberately, but it must not read as
  // booked for this morning.
  'carriedOver': _isCarriedOver(route['scheduledDate']),
};

bool _isCarriedOver(Object? scheduledDate) {
  final parsed = DateTime.tryParse(scheduledDate as String? ?? '');
  if (parsed == null) return false;
  final now = DateTime.now();
  return parsed.toLocal().isBefore(DateTime(now.year, now.month, now.day));
}

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
  List<Map<String, dynamic>> _upcoming = [];
  bool _loading = true;
  bool _failed = false;

  /// Which stops the list is showing. The order matches the web console's chips,
  /// so a collector moving between the two reads the same five choices.
  ///
  /// Pending is split in two because they are not the same job: one is today's
  /// work, the other is a stop an earlier round never got to and which is now the
  /// most overdue thing on the list.
  int _filter = 0;

  static const _filterLabels = [
    'All',
    'Not collected',
    'To do',
    'Collected',
    'Missed',
  ];

  /// How far ahead the preview looks, in days from tomorrow.
  ///
  /// Fourteen rather than seven: a fortnight covers the recurring pickups that
  /// repeat every other week, which a seven-day window showed on one refresh
  /// and hid on the next. The endpoint clamps to 30.
  static const _upcomingDays = 14;

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

      if (!mounted) return;
      setState(() {
        _stops = [for (final route in list) collectorStop(route)];
      });

      // Separate from the round itself: a failure here costs the collector the
      // preview, not the work in front of them, so it is not a route error.
      try {
        final ahead = await _api.get(
          '/routes/${widget.collectorId}/upcoming',
          query: {'days': '$_upcomingDays'},
        );
        final aheadList =
            (ahead is List ? ahead : (ahead?['items'] as List?) ?? const [])
                .cast<Map<String, dynamic>>();
        if (!mounted) return;
        setState(() {
          _upcoming = [for (final route in aheadList) collectorStop(route)]
            ..sort(
              (a, b) => (a['scheduledDate'] as String? ?? '').compareTo(
                b['scheduledDate'] as String? ?? '',
              ),
            );
        });
      } catch (_) {
        if (mounted) setState(() => _upcoming = []);
      }
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

  /// The preview grouped by day, in order, so a fortnight reads as a calendar
  /// rather than as one long list.
  List<_UpcomingDay> get _groupedUpcoming {
    final days = <String, _UpcomingDay>{};
    for (final stop in _upcoming) {
      final parsed = DateTime.tryParse(stop['scheduledDate'] as String? ?? '');
      if (parsed == null) continue;
      final local = parsed.toLocal();
      final key = DateFormat('yyyy-MM-dd').format(local);
      days.putIfAbsent(key, () => _UpcomingDay(local, [])).stops.add(stop);
    }
    return days.values.toList()..sort((a, b) => a.date.compareTo(b.date));
  }

  /// Whether a stop belongs under a given chip. Takes the filter rather than
  /// reading the field, so the counts on the chips can be worked out without
  /// touching state during a build.
  static bool _matches(Map<String, dynamic> stop, int filter) {
    final pending = stop['completion'] == 'Pending';
    final carried = stop['carriedOver'] == true;
    return switch (filter) {
      1 => pending && carried,
      2 => pending && !carried,
      3 => stop['completion'] == 'Completed',
      4 => stop['completion'] == 'Missed',
      _ => true,
    };
  }

  @override
  Widget build(BuildContext context) {
    final user = EcoAppScope.userOf(context);
    final done = _stops.where((s) => s['completion'] == 'Completed').length;
    final missed = _stops.where((s) => s['completion'] == 'Missed').length;
    final left = _stops.length - done - missed;
    final nextIndex = _stops.indexWhere((s) => s['completion'] == 'Pending');

    // Numbered against the whole round before filtering, so a card keeps its
    // place in the shift however the list is narrowed.
    final visible = <({Map<String, dynamic> stop, int number})>[];
    for (var i = 0; i < _stops.length; i++) {
      if (_matches(_stops[i], _filter)) {
        visible.add((stop: _stops[i], number: i + 1));
      }
    }

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
                  // The same five chips the web console shows, with counts, so a
                  // collector reads the same choices on either.
                  FilterPills(
                    labels: [
                      for (var f = 0; f < _filterLabels.length; f++)
                        '${_filterLabels[f]} '
                            '(${_stops.where((s) => _matches(s, f)).length})',
                    ],
                    selected: _filter,
                    onSelect: (i) => setState(() => _filter = i),
                  ),
                  const SizedBox(height: 14),
                  if (visible.isEmpty)
                    const EcoEmptyState(
                      icon: Icons.filter_list_rounded,
                      title: 'Nothing here',
                      message: 'No stops match that filter.',
                    )
                  else
                    // The number is the stop's place in the whole round, not in
                    // the filtered view, so it still matches the map and the
                    // detail screen after filtering.
                    for (final entry in visible)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _StopCard(
                          stop: entry.stop,
                          number: entry.number,
                          isNext: entry.number - 1 == nextIndex,
                          onTap: () => _openStop(entry.stop, entry.number),
                        ),
                      ),
                ],
                // Beyond today. Read-only: a stop can only be completed on its
                // own day, so these carry no actions -- they are here to plan
                // around, and to show a round building up before it arrives.
                if (_upcoming.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  EcoSectionHeading(
                    'Next $_upcomingDays days · ${_upcoming.length} stop'
                    '${_upcoming.length == 1 ? '' : 's'}',
                  ),
                  for (final day in _groupedUpcoming) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 6, bottom: 8),
                      child: Text(
                        DateFormat('EEEE, d MMMM').format(day.date),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: EcoColors.body,
                        ),
                      ),
                    ),
                    for (final stop in day.stops)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _UpcomingCard(stop: stop),
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

/// One day of the preview, with the stops booked on it.
class _UpcomingDay {
  _UpcomingDay(this.date, this.stops);
  final DateTime date;
  final List<Map<String, dynamic>> stops;
}

/// An upcoming stop: the photo, who it is for, where, and a number to ring.
/// No tap target, because nothing can be done to it until its own day.
class _UpcomingCard extends StatelessWidget {
  const _UpcomingCard({required this.stop});
  final Map<String, dynamic> stop;

  @override
  Widget build(BuildContext context) {
    final resident = (stop['residentName'] as String?)?.trim();
    final address = (stop['address'] as String?)?.trim();
    final description = (stop['description'] as String?)?.trim();
    final phone = (stop['residentPhone'] as String?)?.trim();
    final photo = pickupPhotoUrl(stop);
    final category = (stop['category'] as String?)?.trim();

    final title = resident?.isNotEmpty == true
        ? resident!
        : (address?.isNotEmpty == true
              ? address!
              : (description?.isNotEmpty == true ? description! : 'Pickup stop'));
    final detail = [
      if (resident?.isNotEmpty == true) address,
      category,
      stop['zoneName'] as String?,
    ].whereType<String>().where((p) => p.isNotEmpty).join(' · ');

    return EcoCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Square and cropped, so a tall photo cannot change the row's height.
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 48,
              height: 48,
              child: photo != null
                  ? Image.network(
                      photo,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const ColoredBox(
                        color: EcoColors.honeydew,
                        child: Icon(
                          Icons.recycling_rounded,
                          size: 22,
                          color: EcoColors.green,
                        ),
                      ),
                    )
                  : const ColoredBox(
                      color: EcoColors.honeydew,
                      child: Icon(
                        Icons.recycling_rounded,
                        size: 22,
                        color: EcoColors.green,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.3,
                    fontWeight: FontWeight.w700,
                    color: EcoColors.ink,
                  ),
                ),
                if (detail.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    detail,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: EcoColors.body),
                  ),
                ],
                if (phone?.isNotEmpty == true) ...[
                  const SizedBox(height: 3),
                  Text(
                    phone!,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: EcoColors.green,
                    ),
                  ),
                ],
                if (stop['isBulkRequest'] == true) ...[
                  const SizedBox(height: 6),
                  const StatusBadge(label: 'Bulky', tone: BadgeTone.next),
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
    final carriedOver = stop['carriedOver'] == true && !completed && !missed;
    final address = (stop['address'] as String?)?.trim();
    final description = (stop['description'] as String?)?.trim();
    final resident = (stop['residentName'] as String?)?.trim();
    final phone = (stop['residentPhone'] as String?)?.trim();
    // Who, then where. The crew asks for a person at the door, and the office
    // rings about a resident by name rather than by reference.
    final title = resident?.isNotEmpty == true
        ? resident!
        : (address?.isNotEmpty == true
              ? address!
              : (description?.isNotEmpty == true ? description! : 'Stop $number'));
    final details = [
      if (resident?.isNotEmpty == true) address,
      stop['category'] as String?,
      description,
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
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: EcoColors.body),
                  ),
                ],
                if (phone?.isNotEmpty == true) ...[
                  const SizedBox(height: 4),
                  Text(
                    phone!,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: EcoColors.green,
                    ),
                  ),
                ],
                if (carriedOver) ...[
                  const SizedBox(height: 6),
                  const StatusBadge(
                    label: 'Not collected earlier',
                    tone: BadgeTone.inReview,
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
