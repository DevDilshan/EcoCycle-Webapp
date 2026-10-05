import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/debug/mobile_preview.dart';
import 'package:ecocycle_mobile/screens/redeem_screen.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app() => MaterialApp(
  theme: buildEcoTheme(),
  builder: (context, child) => EcoAppScope(
    api: MobilePreviewApi(),
    user: MobilePreviewApi.user(),
    child: child!,
  ),
  home: const RewardCatalogScreen(balance: 1240),
);

void main() {
  testWidgets(
    'Browse, search and affordability filters do not mix in request history',
    (tester) async {
      tester.view.physicalSize = const Size(520, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_app());
      await tester.pumpAndSettle();
      expect(find.text('Explore rewards'), findsOneWidget);
      expect(find.textContaining('ECO-'), findsNothing);
      await tester.enterText(find.byType(TextField), 'SOLAR');
      await tester.pumpAndSettle();
      expect(find.text('Solar garden light kit'), findsOneWidget);
      expect(find.text('Reusable tote bag'), findsNothing);
      await tester.tap(find.text('Solar garden light kit'));
      await tester.pumpAndSettle();
      expect(
        find.text('Earn 510 more points to request this reward.'),
        findsOneWidget,
      );
      final locked = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Keep recycling to unlock'),
      );
      expect(locked.onPressed, isNull);
      await tester.tap(find.byTooltip('Close reward details'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '');
      await tester.tap(find.text('Within my points'));
      await tester.pumpAndSettle();
      expect(find.text('Solar garden light kit'), findsNothing);
      expect(find.text('Compost starter kit'), findsNothing);
      expect(find.text('Reusable tote bag'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('My requests is separate and opens full request details', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tester.tap(find.text('My requests'));
    await tester.pumpAndSettle();
    expect(find.text('My reward requests'), findsOneWidget);
    expect(find.text('Search rewards'), findsNothing);
    expect(find.text('ECO-7F3K-92QD'), findsNothing);
    await tester.tap(find.text('Grocery voucher'));
    await tester.pumpAndSettle();
    expect(find.text('ECO-7F3K-92QD'), findsOneWidget);
    expect(find.textContaining('Counter 3'), findsOneWidget);
    expect(find.byTooltip('Copy code'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
