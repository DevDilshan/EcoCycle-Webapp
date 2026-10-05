import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/screens/new_pickup_screen.dart';
import 'package:ecocycle_mobile/services/api.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class RecordingPickupApi extends Api {
  Map<String, dynamic>? saved;
  @override
  Future<dynamic> put(String path, {Object? body}) async {
    saved = (body as Map).cast<String, dynamic>();
    return {};
  }
}

void main() {
  for (final changeAddress in [false, true]) {
    testWidgets(
      changeAddress
          ? 'Changing an address clears its old pickup pin'
          : 'Editing a pickup preserves address, contact and pin',
      (tester) async {
        final api = RecordingPickupApi();
        final user = User(
          id: 'resident',
          appMetadata: {},
          userMetadata: {},
          aud: 'authenticated',
          createdAt: '2026-01-01T00:00:00Z',
        );
        await tester.pumpWidget(
          EcoAppScope(
            api: api,
            user: user,
            child: MaterialApp(
              theme: buildEcoTheme(),
              home: NewPickupScreen(
                existing: {
                  'id': 'pickup',
                  'address': '14 Park Road',
                  'contactPhone': '0771234567',
                  'description': 'Cardboard boxes',
                  'latitude': 6.91,
                  'longitude': 79.87,
                  'preferredDate': DateTime.now()
                      .add(const Duration(days: 2))
                      .toIso8601String(),
                },
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final addressField = find.byWidgetPredicate(
          (w) => w is TextField && w.controller?.text == '14 Park Road',
        );
        await tester.ensureVisible(addressField);
        if (changeAddress) {
          await tester.enterText(addressField, '21 New Street');
          await tester.pump();
          expect(find.text('Add pickup pin (optional)'), findsOneWidget);
        } else {
          expect(find.text('Change pickup pin'), findsOneWidget);
        }
        await tester.tap(find.text('Save changes'));
        await tester.pumpAndSettle();
        expect(
          api.saved?['address'],
          changeAddress ? '21 New Street' : '14 Park Road',
        );
        expect(api.saved?['contactPhone'], '0771234567');
        expect(api.saved?['latitude'], changeAddress ? null : 6.91);
        expect(api.saved?['longitude'], changeAddress ? null : 79.87);
        expect(api.saved?['clearLocation'], changeAddress);
      },
    );
  }
}
