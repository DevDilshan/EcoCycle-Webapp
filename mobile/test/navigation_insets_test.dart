import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:ecocycle_mobile/widgets/eco_components.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  for (final width in [320.0, 393.0]) {
    for (final scale in [1.0, 1.5, 2.0]) {
      testWidgets(
        'Notched navigation stays above Android gestures at $width / $scale',
        (tester) async {
          tester.view.physicalSize = Size(width, 852);
          tester.view.devicePixelRatio = 1;
          tester.view.padding = const FakeViewPadding(top: 24, bottom: 24);
          tester.view.viewPadding = const FakeViewPadding(top: 24, bottom: 24);
          tester.platformDispatcher.textScaleFactorTestValue = scale;
          addTearDown(tester.view.reset);
          addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
          var pickups = 0;
          var destination = -1;
          final controller = ScrollController();
          addTearDown(controller.dispose);
          await tester.pumpWidget(
            MaterialApp(
              theme: buildEcoTheme(),
              home: EcoScreen(
                bottomNavigationBar: EcoBottomNav(
                  index: 2,
                  onChanged: (i) => destination = i,
                  onRequestPickup: () => pickups++,
                ),
                child: ListView(
                  controller: controller,
                  children: [
                    for (var i = 0; i < 20; i++)
                      SizedBox(height: 80, child: Text('Activity $i')),
                    const SizedBox(height: 40, child: Text('Last activity')),
                  ],
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          final surface = tester.getRect(
            find.byKey(const ValueKey('eco-nav-surface')),
          );
          final plus = tester.getRect(find.byIcon(Icons.add_rounded));
          expect(plus.center.dx, closeTo(width / 2, 1));
          // The action intersects the bar's top, rather than detaching above it.
          expect(plus.top, lessThan(surface.top));
          expect(plus.bottom, greaterThan(surface.top));
          expect(surface.bottom, lessThanOrEqualTo(852 - 24));
          final labels = find.descendant(
            of: find.byType(EcoNavigationBar),
            matching: find.byType(Text),
          );
          expect(
            labels,
            width >= 360 && scale <= 1.2 ? findsNWidgets(4) : findsNothing,
          );
          await tester.tap(find.byIcon(Icons.add_rounded));
          expect(pickups, 1);
          await tester.tap(find.byTooltip('Profile'));
          expect(destination, 3);
          controller.jumpTo(controller.position.maxScrollExtent);
          await tester.pumpAndSettle();
          final last = tester.getRect(find.text('Last activity'));
          expect(last.bottom, lessThanOrEqualTo(plus.top));
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
