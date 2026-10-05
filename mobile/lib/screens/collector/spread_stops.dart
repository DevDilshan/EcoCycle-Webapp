import 'dart:math';

import 'package:latlong2/latlong.dart';

/// Spreading stops that share a coordinate.
///
/// Nothing in this system geocodes a street address, so a stop's only point is
/// the centre of its zone. Every stop in one zone therefore has the *same*
/// coordinate, and markers drawn at the same coordinate sit exactly on top of
/// one another -- a round of eight stops in Dehiwala showed a single pin, and
/// the "to do", "collected" and "not collected" colours were invisible
/// underneath it.
///
/// Each group is laid out on a small ring around its shared centre, so every
/// stop gets its own tappable marker. The positions are not presented as real
/// locations: the zone marker stays exactly on the centre, and the screen says
/// in words that stops are shown around their zone.
///
/// Mirrors spreadStops.js on the web so a round has the same shape on both.

/// Degrees of latitude ~ 110km, so this ring is roughly 300m across.
const _ringRadiusDeg = 0.0027;

/// Beyond this many in one ring the markers touch, so a second ring starts.
const _perRing = 8;

/// Lay a group of points out around the coordinate they share.
///
/// Deterministic in the index, so a marker does not move when the round reloads
/// -- a pin that wanders is worse than one that is merely approximate.
List<LatLng> fanOut(LatLng centre, int count) {
  if (count <= 0) return const [];
  // A lone stop sits exactly on its zone's centre: there is nothing to separate
  // it from, and offsetting it would only misplace it.
  if (count == 1) return [centre];

  // Longitude degrees shrink towards the poles, so the ring would be a squashed
  // ellipse without this.
  final lngScale = 1 / max(cos(centre.latitude * pi / 180), 0.1);

  return List<LatLng>.generate(count, (index) {
    final ring = index ~/ _perRing + 1;
    final inRing = index % _perRing;
    final inThisRing = min(_perRing, count - (ring - 1) * _perRing);
    // Each ring is turned half a step so an outer marker never hides directly
    // behind an inner one.
    final angle =
        (inRing / inThisRing) * 2 * pi + (ring - 1) * (pi / _perRing);
    final radius = _ringRadiusDeg * ring;
    return LatLng(
      centre.latitude + radius * sin(angle),
      centre.longitude + radius * cos(angle) * lngScale,
    );
  });
}

/// Positions for a whole round, grouping by shared coordinate first.
///
/// Returns one point per input, in the same order.
List<LatLng> spreadStops(List<LatLng> raw) {
  final groups = <String, List<int>>{};
  for (var i = 0; i < raw.length; i++) {
    // Rounded, because two zones at the same place can differ in the last
    // decimal and would then not be grouped at all.
    final key = '${raw[i].latitude.toStringAsFixed(5)},'
        '${raw[i].longitude.toStringAsFixed(5)}';
    groups.putIfAbsent(key, () => []).add(i);
  }

  final out = List<LatLng>.filled(raw.length, const LatLng(0, 0));
  groups.forEach((_, indexes) {
    final placed = fanOut(raw[indexes.first], indexes.length);
    for (var n = 0; n < indexes.length; n++) {
      out[indexes[n]] = placed[n];
    }
  });
  return out;
}
