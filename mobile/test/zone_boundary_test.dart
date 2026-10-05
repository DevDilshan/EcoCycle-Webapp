import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:ecocycle_mobile/services/zone_boundary.dart';

void main() {
  test('Published Malabe outline matches web and API pickup coverage', () {
    final source =
        jsonDecode(
              File(
                '../test-data/sri-lanka-boundary-sample.json',
              ).readAsStringSync(),
            )
            as Map<String, dynamic>;
    final area = ZoneBoundary.fromZone({
      'boundaryGeoJson': jsonEncode(source['geometry']),
    })!;
    for (final point in source['cases'] as List) {
      expect(
        area.contains(
          LatLng(
            (point['latitude'] as num).toDouble(),
            (point['longitude'] as num).toDouble(),
          ),
        ),
        point['inside'],
        reason: point['name'] as String,
      );
    }
  });
  final fixture =
      jsonDecode(File('../test-data/zone-boundaries.json').readAsStringSync())
          as Map<String, dynamic>;
  final zone = <String, dynamic>{
    'id': 'a',
    'boundaryGeoJson': jsonEncode(fixture['geometry']),
  };
  final boundary = ZoneBoundary.fromZone(zone)!;
  for (final sample in fixture['cases'] as List) {
    test(
      sample['name'] as String,
      () => expect(
        boundary.contains(
          LatLng(
            (sample['latitude'] as num).toDouble(),
            (sample['longitude'] as num).toDouble(),
          ),
        ),
        sample['inside'],
      ),
    );
  }
  test('No boundary does not imply outside, and overlaps remain ambiguous', () {
    expect(ZoneBoundary.fromZone({}), isNull);
    expect(
      matchingZones([
        zone,
        {...zone, 'id': 'b'},
      ], const LatLng(6.91, 79.85)),
      hasLength(2),
    );
    expect(
      matchingZones([
        {...zone, 'isActive': false},
      ], const LatLng(6.91, 79.85)),
      isEmpty,
    );
    expect(boundary.points.first, const LatLng(6.9, 79.84));
  });
}
