import 'package:ecocycle_mobile/services/map_location.dart';
import 'package:ecocycle_mobile/screens/collector/route_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('only a valid coordinate pair produces a pickup pin', () {
    for (final data in <Map<String, dynamic>>[
      {},
      {'latitude': null, 'longitude': null},
      {'latitude': 6.9},
      {'latitude': 91, 'longitude': 79},
      {'latitude': double.nan, 'longitude': 79},
    ]) {
      expect(pickupPoint(data), isNull);
    }
    expect(pickupPoint({'latitude': 0, 'longitude': 0})!.latitude, 0);
  });
  test('directions use the saved pin or the full address', () {
    expect(
      pickupDirections({
        'latitude': 6.9,
        'longitude': 79.8,
      })!.queryParameters['destination'],
      '6.9,79.8',
    );
    const address = '14/2 Park Road & Lane, Colombo';
    expect(
      pickupDirections({'address': address})!.queryParameters['destination'],
      address,
    );
    expect(pickupDirections({'address': ' '}), isNull);
  });
  test('route payload supplies location without losing the route id', () {
    final stop = collectorStop({
      'id': 'route-120',
      'pickupRequestId': 'pickup-120',
      'completionStatus': 1,
      'pickup': {
        'id': 'pickup-120',
        'address': '14 Park Road',
        'latitude': 6.9,
        'longitude': 79.8,
      },
    }, null);
    expect(stop['id'], 'route-120');
    expect(stop['completion'], 'Completed');
    expect(pickupPoint(stop), isNotNull);
  });
}
