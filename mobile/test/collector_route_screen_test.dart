import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/screens/collector/route_screen.dart';
import 'package:ecocycle_mobile/services/api.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _RouteApi extends Api {
  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.endsWith('/today')) {
      return [
        {
          'id': 'route-1',
          'completionStatus': 0,
          'scheduledDate': DateTime.now().toUtc().toIso8601String(),
          'address': '14 Park Road',
          'description': 'Mixed recycling bags',
          'residentName': 'Kavisha Perera',
          'pickup': {
            'address': '14 Park Road',
            'description': 'Mixed recycling bags',
          },
        },
      ];
    }
    if (path.contains('/upcoming')) return [];
    return [];
  }
}

User _collector() => User(
  id: '00000000-0000-0000-0000-000000000002',
  appMetadata: const {},
  userMetadata: const {'full_name': 'Sam', 'role': 'collector'},
  aud: 'authenticated',
  email: 'collector@example.com',
  createdAt: '2026-01-01T00:00:00Z',
);

void main() {
  testWidgets('Collector route screen lists today\'s assigned stop', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: EcoAppScope(
          api: _RouteApi(),
          user: _collector(),
          child: Scaffold(
            body: CollectorRouteScreen(
              collectorId: _collector().id,
              onOpenProfile: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Today’s route'), findsOneWidget);
    expect(find.text('Kavisha Perera'), findsOneWidget);
    expect(find.textContaining('14 Park Road'), findsOneWidget);
    expect(find.textContaining('Mixed recycling bags'), findsOneWidget);
  });
}
