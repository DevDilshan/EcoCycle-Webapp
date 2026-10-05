import 'package:ecocycle_mobile/debug/mobile_preview.dart';
import 'package:ecocycle_mobile/screens/pickup_location_screen.dart';
import 'package:ecocycle_mobile/services/zone_boundary.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:ecocycle_mobile/widgets/eco_components.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'A map tap selects its unique zone and returns it with the confirmed pin',
    (tester) async {
      PickupLocationChoice? choice;
      await tester.pumpWidget(
        MaterialApp(
          theme: buildEcoTheme(),
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () async {
                  choice = await Navigator.of(context)
                      .push<PickupLocationChoice>(
                        MaterialPageRoute(
                          builder: (_) => const PickupLocationScreen(
                            zones: MobilePreviewApi.demoZones,
                          ),
                        ),
                      );
                },
                child: const Text('Open map'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open map'));
      await tester.pumpAndSettle();
      await tester.tapAt(tester.getCenter(find.byType(FlutterMap)));
      // Flutter Map waits for the double-tap gesture window before onTap.
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(find.text('Inside Demo collection area.'), findsOneWidget);
      await tester.ensureVisible(find.text('Confirm pickup pin'));
      await tester.tap(find.text('Confirm pickup pin'));
      await tester.pumpAndSettle();
      expect(choice?.zoneId, 'preview-zone');
      expect(
        ZoneBoundary.fromZone(
          MobilePreviewApi.demoZones.first,
        )!.contains(choice!.point),
        isTrue,
      );
    },
  );

  testWidgets(
    'An outside tap keeps confirmation disabled until the pin is moved inside',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildEcoTheme(),
          home: const PickupLocationScreen(
            zones: MobilePreviewApi.demoZones,
            zoneId: 'preview-zone',
            allowZoneChange: false,
          ),
        ),
      );
      await tester.pumpAndSettle();
      final map = tester.getRect(find.byType(FlutterMap));
      await tester.tapAt(Offset(map.left + 5, map.center.dy));
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(find.textContaining('This pin is outside'), findsOneWidget);
      expect(
        tester
            .widget<EcoPrimaryButton>(find.byType(EcoPrimaryButton))
            .onPressed,
        isNull,
      );
      await tester.tapAt(map.center);
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(find.text('Inside Demo collection area.'), findsOneWidget);
      expect(
        tester
            .widget<EcoPrimaryButton>(find.byType(EcoPrimaryButton))
            .onPressed,
        isNotNull,
      );
    },
  );
}
