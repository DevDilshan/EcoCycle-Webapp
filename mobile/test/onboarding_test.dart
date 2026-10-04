import 'package:ecocycle_mobile/app/auth_gate.dart';
import 'package:ecocycle_mobile/screens/onboarding_screen.dart';
import 'package:ecocycle_mobile/screens/login_screen.dart';
import 'package:ecocycle_mobile/screens/register_screen.dart';
import 'package:ecocycle_mobile/services/onboarding_store.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:ecocycle_mobile/widgets/eco_loading.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class MemoryOnboardingStore implements OnboardingStore {
  bool completed = false;
  bool failWrites = false;
  bool failReads = false;
  @override
  Future<bool> isComplete() async {
    if (failReads) throw StateError('Storage unavailable');
    return completed;
  }

  @override
  Future<void> complete() async {
    if (failWrites) throw StateError('Storage unavailable');
    completed = true;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await Supabase.initialize(
      url: 'https://ecocycle-test.supabase.co',
      publishableKey: 'public-test-key',
      authOptions: const FlutterAuthClientOptions(
        autoRefreshToken: false,
        localStorage: EmptyLocalStorage(),
      ),
    );
  });
  tearDownAll(() async => Supabase.instance.dispose());

  Future<void> openGate(
    WidgetTester tester,
    MemoryOnboardingStore store,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: AuthGate(onboardingStore: store),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('Skip is saved and a new launch opens login directly', (
    tester,
  ) async {
    final store = MemoryOnboardingStore();
    await openGate(tester, store);
    expect(find.byType(OnboardingScreen), findsOneWidget);
    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();
    expect(store.completed, isTrue);
    expect(find.byType(LoginScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    await openGate(tester, store);
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(OnboardingScreen), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Completed introductions open registration; back goes to login', (
    tester,
  ) async {
    final store = MemoryOnboardingStore();
    await openGate(tester, store);
    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(find.text('One photo.\nA simpler pickup.'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Small steps.\nLasting rewards.'), findsOneWidget);
    await tester.tap(find.text('Create account'));
    await tester.pumpAndSettle();
    expect(store.completed, isTrue);
    expect(find.byType(RegisterScreen), findsOneWidget);
    await tester.tap(find.text('Back'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(OnboardingScreen), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Failed preference save keeps onboarding and allows retry', (
    tester,
  ) async {
    final store = MemoryOnboardingStore()..failWrites = true;
    await openGate(tester, store);
    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();
    expect(store.completed, isFalse);
    expect(
      find.text('Could not save your progress. Please try again.'),
      findsOneWidget,
    );
    expect(find.byType(LoginScreen), findsNothing);
    store.failWrites = false;
    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('Startup preference read failure can be retried', (tester) async {
    final store = MemoryOnboardingStore()..failReads = true;
    await openGate(tester, store);
    expect(find.text('Try again'), findsOneWidget);
    store.failReads = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.byType(OnboardingScreen), findsOneWidget);
  });

  testWidgets('All three introductions keep their copy above fixed actions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: OnboardingScreen(onComplete: (_) async {}),
      ),
    );
    await tester.pumpAndSettle();
    const bodies = [
      'Recycle from home with simple pickups and rewards for doing your part.',
      'Snap your waste and choose a time. We’ll find the right collector.',
      'Track every pickup. Earn recycling points. Make a lasting difference.',
    ];
    for (var i = 0; i < bodies.length; i++) {
      final bodyBottom = tester.getBottomRight(find.text(bodies[i])).dy;
      final viewportBottom = tester.getBottomRight(find.byType(PageView)).dy;
      expect(
        bodyBottom,
        lessThanOrEqualTo(viewportBottom),
        reason:
            'Introduction ${i + 1} should show all copy without vertical scrolling',
      );
      expect(tester.takeException(), isNull);
      if (i < 2) {
        await tester.drag(find.byType(PageView), const Offset(-280, 0));
        await tester.pumpAndSettle();
      }
    }
  });

  testWidgets('Onboarding and loading fit a small phone with enlarged text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    Widget app(Widget child) => MaterialApp(
      theme: buildEcoTheme(),
      home: MediaQuery(
        data: const MediaQueryData(
          size: Size(320, 568),
          textScaler: TextScaler.linear(1.5),
          disableAnimations: true,
        ),
        child: child,
      ),
    );
    await tester.pumpWidget(app(OnboardingScreen(onComplete: (_) async {})));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(app(const EcoLoadingScreen()));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
