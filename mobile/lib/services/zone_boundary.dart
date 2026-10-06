import 'dart:convert';
import 'package:latlong2/latlong.dart';

/// GeoJSON uses [longitude, latitude]; Flutter uses LatLng(latitude, longitude).
class ZoneBoundary {
  ZoneBoundary(this.polygons);
  final List<List<List<LatLng>>> polygons;
  List<LatLng> get points => polygons.expand((p) => p.first).toList();

  static ZoneBoundary? fromZone(Map<String, dynamic>? zone) {
    final raw = zone?['boundaryGeoJson'];
    if (raw is! String || raw.isEmpty) return null;
    try {
      final g = jsonDecode(raw) as Map<String, dynamic>;
      final List shapes = switch (g['type']) {
        'Polygon' => [g['coordinates']],
        'MultiPolygon' => g['coordinates'] as List,
        _ => [],
      };
      if (shapes.isEmpty) return null;
      final polygons = shapes
          .map(
            (shape) => (shape as List)
                .map(
                  (ring) => (ring as List).map((p) {
                    final lat = (p[1] as num).toDouble(),
                        lng = (p[0] as num).toDouble();
                    if (!lat.isFinite ||
                        !lng.isFinite ||
                        lat.abs() > 90 ||
                        lng.abs() > 180) {
                      throw const FormatException('Invalid coordinate');
                    }
                    return LatLng(lat, lng);
                  }).toList(),
                )
                .toList(),
          )
          .toList();
      if (polygons.any(
        (p) => p.isEmpty || p.any((r) => r.length < 4 || r.first != r.last),
      )) {
        return null;
      }
      return ZoneBoundary(polygons);
    } catch (_) {
      return null;
    }
  }

  // Same edge policy as the API: outer edge included, hole edge excluded.
  bool contains(LatLng p) => polygons.any(
    (rings) =>
        _inRing(p, rings.first) != 0 &&
        rings.skip(1).every((ring) => _inRing(p, ring) == 0),
  );
  static int _inRing(LatLng p, List<LatLng> ring) {
    var inside = false;
    const eps = 1e-10;
    for (var i = 0; i < ring.length - 1; i++) {
      final a = ring[i], b = ring[i + 1];
      final turn =
          (b.longitude - a.longitude) * (p.latitude - a.latitude) -
          (b.latitude - a.latitude) * (p.longitude - a.longitude);
      final minX = a.longitude < b.longitude ? a.longitude : b.longitude;
      final maxX = a.longitude > b.longitude ? a.longitude : b.longitude;
      final minY = a.latitude < b.latitude ? a.latitude : b.latitude;
      final maxY = a.latitude > b.latitude ? a.latitude : b.latitude;
      if (turn.abs() <= eps &&
          p.longitude >= minX - eps &&
          p.longitude <= maxX + eps &&
          p.latitude >= minY - eps &&
          p.latitude <= maxY + eps) {
        return 2;
      }
      if ((a.latitude > p.latitude) != (b.latitude > p.latitude) &&
          p.longitude <
              (b.longitude - a.longitude) *
                      (p.latitude - a.latitude) /
                      (b.latitude - a.latitude) +
                  a.longitude) {
        inside = !inside;
      }
    }
    return inside ? 1 : 0;
  }
}

List<Map<String, dynamic>> matchingZones(
  List<Map<String, dynamic>> zones,
  LatLng point,
) => zones
    .where(
      (z) =>
          z['isActive'] != false &&
          ZoneBoundary.fromZone(z)?.contains(point) == true,
    )
    .toList();

class PickupLocationChoice {
  const PickupLocationChoice(this.point, this.zoneId);
  final LatLng point;
  final String? zoneId;
}
