import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../app/eco_app_scope.dart';
import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/eco_feature.dart';
import '../../widgets/eco_loading.dart';
import 'route_screen.dart';
import 'spread_stops.dart';

/// Central Colombo, for when nothing on the round has a location to centre on.
const _fallbackCentre = LatLng(6.9271, 79.8612);

const _osmTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/// Today's round on OpenStreetMap, with the collector's own zones marked.
///
/// This screen used to be a drawing: a hand-painted grid with three pins at
/// fixed pixel positions, showing the same three stops whatever the round
/// actually was. It now reads the real round.
///
/// OSM tiles through flutter_map, to match the web app's Leaflet maps -- the
/// same tiles mean a zone pin sits on the same street on both.
class RouteMapScreen extends StatefulWidget {
  const RouteMapScreen({super.key, required this.collectorId});

  final String collectorId;

  @override
  State<RouteMapScreen> createState() => _RouteMapScreenState();
}

class _RouteMapScreenState extends State<RouteMapScreen> {
  late final Api _api = EcoAppScope.apiOf(context);
  final _controller = MapController();

  List<Map<String, dynamic>> _stops = [];
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _stops.isEmpty;
      _failed = false;
    });
    try {
      final routes = await _api.get('/routes/${widget.collectorId}/today');
      final list =
          (routes is List ? routes : (routes?['items'] as List?) ?? const [])
              .cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() => _stops = [for (final r in list) collectorStop(r)]);
      _frame();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Stops that can be drawn, numbered by their place in the whole round.
  ///
  /// The number is the position in the round, not in this list, so the map and
  /// the Route tab agree even when a stop is left off for want of a location.
  List<({Map<String, dynamic> stop, int number, LatLng point})> get _placed {
    final stops = <({Map<String, dynamic> stop, int number})>[];
    final centres = <LatLng>[];
    for (var i = 0; i < _stops.length; i++) {
      final lat = (_stops[i]['zoneLatitude'] as num?)?.toDouble();
      final lng = (_stops[i]['zoneLongitude'] as num?)?.toDouble();
      if (lat == null || lng == null) continue;
      stops.add((stop: _stops[i], number: i + 1));
      centres.add(LatLng(lat, lng));
    }

    // Every stop in a zone shares that zone's centre, so markers on the raw
    // coordinate stack exactly on top of each other and only the last is
    // visible. Fanned onto a small ring instead, so each stop has its own pin.
    final points = spreadStops(centres);
    return [
      for (var i = 0; i < stops.length; i++)
        (stop: stops[i].stop, number: stops[i].number, point: points[i]),
    ];
  }

  /// The collector's own zones, taken from the round rather than fetched: a
  /// collector's zones are the ones their stops are in, and the stops already
  /// carry the id, the name and the centre.
  List<({String name, LatLng point})> get _zones {
    final seen = <String>{};
    final out = <({String name, LatLng point})>[];
    for (final stop in _stops) {
      final id = stop['zoneId'] as String?;
      final lat = (stop['zoneLatitude'] as num?)?.toDouble();
      final lng = (stop['zoneLongitude'] as num?)?.toDouble();
      if (id == null || lat == null || lng == null) continue;
      if (!seen.add(id)) continue;
      out.add((
        name: (stop['zoneName'] as String?) ?? 'Your zone',
        point: LatLng(lat, lng),
      ));
    }
    return out;
  }

  int get _unmapped => _stops.length - _placed.length;

  /// Frame the map around everything on it, once the round has loaded.
  void _frame() {
    final points = [
      ..._placed.map((p) => p.point),
      ..._zones.map((z) => z.point),
    ];
    if (points.isEmpty) return;
    // A single point has no bounds to fit; fitting them would zoom to maximum.
    if (points.length == 1) {
      _controller.move(points.first, 14);
      return;
    }
    _controller.fitCamera(
      CameraFit.bounds(
        bounds: LatLngBounds.fromPoints(points),
        padding: const EdgeInsets.all(48),
        maxZoom: 14,
      ),
    );
  }

  void _openStop(Map<String, dynamic> stop, int number) {
    final resident = (stop['residentName'] as String?)?.trim();
    final address = (stop['address'] as String?)?.trim();
    final phone = (stop['residentPhone'] as String?)?.trim();
    final title = resident?.isNotEmpty == true
        ? resident!
        : ((stop['description'] as String?) ?? 'Pickup stop');

    // A centred dialog, not a bottom sheet: this is a marker's popup, and on web
    // Leaflet draws it over the map near the pin. A sheet rising from the bottom
    // reads as a separate screen and covers the very part of the map the tapped
    // pin sits in.
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: EcoColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
        titlePadding: const EdgeInsets.fromLTRB(22, 20, 22, 0),
        contentPadding: const EdgeInsets.fromLTRB(22, 10, 22, 4),
        title: Text(
          '$number. $title',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: EcoColors.ink,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (address?.isNotEmpty == true)
              Text(
                address!,
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.45,
                  color: EcoColors.body,
                ),
              ),
            if (phone?.isNotEmpty == true) ...[
              const SizedBox(height: 6),
              Text(
                phone!,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: EcoColors.green,
                ),
              ),
            ],
            const SizedBox(height: 12),
            // The pin is not the house. Said here rather than left to be
            // discovered by driving to it.
            const Text(
              'Shown around the zone centre, not at the address.',
              style: TextStyle(
                fontSize: 11.5,
                fontStyle: FontStyle.italic,
                color: EcoColors.muted,
              ),
            ),
            const SizedBox(height: 10),
            StatusBadge(
              label: stop['completion'] as String,
              tone: switch (stop['completion']) {
                'Completed' => BadgeTone.completed,
                'Missed' => BadgeTone.inReview,
                _ => BadgeTone.next,
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text(
              'Close',
              style: TextStyle(fontWeight: FontWeight.w700, color: EcoColors.green),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const EcoLoadingState(
        title: 'Loading the map',
        message: 'Fetching today’s stops.',
        compact: true,
      );
    }
    if (_failed) {
      return EcoLoadError(
        onRetry: _load,
        message: 'We couldn’t load your route. Please try again.',
      );
    }

    final placed = _placed;
    final zones = _zones;
    if (placed.isEmpty && zones.isEmpty) {
      return const EcoEmptyState(
        icon: Icons.map_outlined,
        title: 'Nothing to map yet',
        message:
            'A stop appears here once its zone has a location set by the office.',
      );
    }

    int? nextNumber;
    for (final p in placed) {
      if (p.stop['completion'] == 'Pending') {
        nextNumber = p.number;
        break;
      }
    }

    final offMap = [
      for (var i = 0; i < _stops.length; i++)
        if ((_stops[i]['zoneLatitude'] as num?) == null ||
            (_stops[i]['zoneLongitude'] as num?) == null)
          (stop: _stops[i], number: i + 1),
    ];

    return RefreshIndicator(
      onRefresh: _load,
      color: EcoColors.green,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.only(bottom: ecoNavClearance(context)),
        children: [
          // The heading lives here rather than in the shell, so the subtitle can
          // carry the count and the caveat -- as the web page's does.
          EcoPageHeading(
            title: 'Route map',
            subtitle:
                '${placed.length} stop${placed.length == 1 ? '' : 's'} shown around '
                'your zone centre — pins are not street addresses.',
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                // Tall enough to read street names off, short enough that the
                // list below it is still discoverable by scrolling.
                height: 420,
                child: _buildMap(placed, zones, nextNumber),
              ),
            ),
          ),
          if (offMap.isNotEmpty) ...[
            const SizedBox(height: 22),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Named, not just counted: a collector comparing pins against
                  // the round needs to know which stops are missing from it, so
                  // they can still be driven from the list.
                  const EcoSectionHeading('Not on the map'),
                  Text(
                    '${offMap.length} stop${offMap.length == 1 ? '' : 's'} whose zone '
                    'has no location set.',
                    style: const TextStyle(fontSize: 12.5, color: EcoColors.body),
                  ),
                  const SizedBox(height: 12),
                  for (final entry in offMap)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _UnplacedCard(stop: entry.stop, number: entry.number),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildMap(
    List<({Map<String, dynamic> stop, int number, LatLng point})> placed,
    List<({String name, LatLng point})> zones,
    int? nextNumber,
  ) {
    return Stack(
      children: [
        FlutterMap(
          mapController: _controller,
          options: MapOptions(
            initialCenter: placed.isNotEmpty
                ? placed.first.point
                : (zones.isNotEmpty ? zones.first.point : _fallbackCentre),
            initialZoom: 13,
          ),
          children: [
            TileLayer(
              urlTemplate: _osmTileUrl,
              // OSM's tile policy asks that an app identify itself.
              userAgentPackageName: 'com.ecocycle.app',
            ),
            // Zones before stops, so a stop marker is never hidden under one.
            MarkerLayer(
              markers: [
                for (final zone in zones)
                  Marker(
                    point: zone.point,
                    width: 28,
                    height: 28,
                    child: Tooltip(
                      message: '${zone.name} — your collection zone',
                      child: const _ZoneMarker(),
                    ),
                  ),
                for (final p in placed)
                  Marker(
                    point: p.point,
                    width: 34,
                    height: 34,
                    child: GestureDetector(
                      onTap: () => _openStop(p.stop, p.number),
                      child: _StopMarker(
                        number: p.number,
                        completion: p.stop['completion'] as String,
                        isNext: p.number == nextNumber,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),

        // Said plainly rather than left as a silent gap between the list and the
        // map: a collector counting pins against the round needs to know why the
        // totals differ.
        if (_unmapped > 0)
          Positioned(
            top: 12,
            left: 14,
            right: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Text(
                '$_unmapped stop${_unmapped == 1 ? '' : 's'} not shown — '
                'no location on their zone',
                style: const TextStyle(fontSize: 12, color: EcoColors.body),
              ),
            ),
          ),

        Positioned(
          right: 6,
          bottom: 4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            color: Colors.white.withValues(alpha: 0.75),
            child: const Text(
              '© OpenStreetMap contributors',
              style: TextStyle(fontSize: 9.5, color: EcoColors.body),
            ),
          ),
        ),

        Positioned(
          left: 14,
          bottom: 14,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 10,
                ),
              ],
            ),
            child: const Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _LegendRow(color: EcoColors.blue, label: 'Next stop'),
                SizedBox(height: 5),
                _LegendRow(color: EcoColors.green, label: 'To do'),
                SizedBox(height: 5),
                _LegendRow(color: EcoColors.celadonStrong, label: 'Collected'),
                SizedBox(height: 5),
                _LegendRow(color: EcoColors.danger, label: 'Not collected'),
                SizedBox(height: 5),
                _LegendRow(color: null, label: 'Your zone'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// A stop that could not be drawn, because its zone has no location.
///
/// Still listed, and still numbered by its place in the round, so it can be
/// driven from the address even though there is no pin for it.
class _UnplacedCard extends StatelessWidget {
  const _UnplacedCard({required this.stop, required this.number});

  final Map<String, dynamic> stop;
  final int number;

  @override
  Widget build(BuildContext context) {
    final resident = (stop['residentName'] as String?)?.trim();
    final address = (stop['address'] as String?)?.trim();
    final zone = (stop['zoneName'] as String?)?.trim();

    return EcoCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: EcoColors.honeydew,
              shape: BoxShape.circle,
              border: Border.all(color: EcoColors.border),
            ),
            child: Text(
              '$number',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: EcoColors.body,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  resident?.isNotEmpty == true ? resident! : 'Pickup stop',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: EcoColors.ink,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    if (address?.isNotEmpty == true) address,
                    zone,
                  ].whereType<String>().join(' · ').isEmpty
                      ? 'No address recorded'
                      : [
                          if (address?.isNotEmpty == true) address,
                          zone,
                        ].whereType<String>().join(' · '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: EcoColors.body),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A numbered stop, matching the numbered cards on the Route tab.
class _StopMarker extends StatelessWidget {
  const _StopMarker({
    required this.number,
    required this.completion,
    required this.isNext,
  });

  final int number;
  final String completion;
  final bool isNext;

  @override
  Widget build(BuildContext context) {
    // A round half done should look half done, so what is left reads at a glance
    // rather than by tapping each pin.
    //
    // Each state differs by glyph as well as by colour. Colour alone was not
    // enough twice over: EcoColors.primary is an alias for green, so "to do" and
    // "collected" were drawn in the identical shade -- and a collector who
    // cannot distinguish them is the one person who needs to. A tick and a bang
    // also read for anyone who cannot tell the hues apart, and they match the
    // icons the stop cards already use.
    final (fill, ink) = switch (completion) {
      'Completed' => (EcoColors.celadonStrong, EcoColors.green),
      'Missed' => (EcoColors.danger, Colors.white),
      _ when isNext => (EcoColors.blue, Colors.white),
      _ => (EcoColors.green, Colors.white),
    };

    return Center(
      child: Container(
        width: isNext ? 32 : 28,
        height: isNext ? 32 : 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: fill,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 6,
            ),
          ],
        ),
        child: switch (completion) {
          'Completed' => Icon(Icons.check_rounded, size: 17, color: ink),
          'Missed' => Icon(Icons.priority_high_rounded, size: 17, color: ink),
          _ => Text(
            '$number',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: ink,
            ),
          ),
        },
      ),
    );
  }
}

/// The zone centre: a ringed dot, deliberately nothing like a numbered stop. It
/// is an area, not somewhere to drive to, and a collector must never set off
/// towards it thinking it is a pickup.
class _ZoneMarker extends StatelessWidget {
  const _ZoneMarker();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: EcoColors.green.withValues(alpha: 0.16),
        shape: BoxShape.circle,
        border: Border.all(color: EcoColors.green, width: 3),
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({required this.color, required this.label});

  /// Null draws the zone's ring instead of a filled dot.
  final Color? color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 11,
          height: 11,
          decoration: BoxDecoration(
            color: color ?? EcoColors.green.withValues(alpha: 0.16),
            shape: BoxShape.circle,
            border: color == null
                ? Border.all(color: EcoColors.green, width: 2.5)
                : null,
          ),
        ),
        const SizedBox(width: 7),
        Text(
          label,
          style: const TextStyle(fontSize: 11.5, color: EcoColors.body),
        ),
      ],
    );
  }
}
