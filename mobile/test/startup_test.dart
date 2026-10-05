import 'dart:async';

import 'package:ecocycle_mobile/app/eco_startup.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:ecocycle_mobile/widgets/eco_loading.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Brand screen remains until initialization finishes', (
    tester,
  ) async {
    final initialization = Completer<void>();
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: EcoStartup(
          initialize: () => initialization.future,
          child: const Scaffold(body: Text('Ready')),
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 3));
    expect(find.byType(EcoLoadingScreen), findsOneWidget);
    expect(find.text('EcoCycle'), findsOneWidget);
    expect(find.text('Ready'), findsNothing);
    initialization.complete();
    await tester.pumpAndSettle();
    expect(find.text('Ready'), findsOneWidget);
    expect(find.byType(EcoLoadingScreen), findsNothing);
  });

  testWidgets('Failed initialization can retry and enter the app', (
    tester,
  ) async {
    var attempts = 0;
    final retriedInitialization = Completer<void>();
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: EcoStartup(
          initialize: () {
            attempts++;
            if (attempts == 1) throw StateError('Services unavailable');
            return retriedInitialization.future;
          },
          child: const Scaffold(body: Text('Ready')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Try again'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    await tester.pump();
    expect(attempts, 2);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    retriedInitialization.complete();
    await tester.pumpAndSettle();
    expect(find.text('Ready'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
