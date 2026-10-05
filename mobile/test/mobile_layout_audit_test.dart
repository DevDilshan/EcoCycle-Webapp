import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/app/resident_shell.dart';
import 'package:ecocycle_mobile/app/collector_shell.dart';
import 'package:ecocycle_mobile/debug/mobile_preview.dart';
import 'package:ecocycle_mobile/screens/onboarding_screen.dart';
import 'package:ecocycle_mobile/screens/login_screen.dart';
import 'package:ecocycle_mobile/screens/register_screen.dart';
import 'package:ecocycle_mobile/screens/forgot_password_screen.dart';
import 'package:ecocycle_mobile/screens/reset_password_screen.dart';
import 'package:ecocycle_mobile/screens/new_pickup_screen.dart';
import 'package:ecocycle_mobile/screens/pickup_detail_screen.dart';
import 'package:ecocycle_mobile/screens/pickup_submitted_screen.dart';
import 'package:ecocycle_mobile/screens/pickup_location_screen.dart';
import 'package:ecocycle_mobile/screens/complaints_list_screen.dart';
import 'package:ecocycle_mobile/screens/new_complaint_screen.dart';
import 'package:ecocycle_mobile/screens/leaderboard_screen.dart';
import 'package:ecocycle_mobile/screens/redeem_screen.dart';
import 'package:ecocycle_mobile/screens/tabs/rewards_tab.dart';
import 'package:ecocycle_mobile/screens/tabs/requests_tab.dart';
import 'package:ecocycle_mobile/screens/tabs/profile_tab.dart';
import 'package:ecocycle_mobile/screens/collector/route_map_screen.dart';
import 'package:ecocycle_mobile/screens/collector/route_screen.dart';
import 'package:ecocycle_mobile/screens/collector/stop_detail_screen.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:ecocycle_mobile/widgets/eco_components.dart';
import 'package:ecocycle_mobile/widgets/eco_loading.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  late MobilePreviewApi api;
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    api = MobilePreviewApi();
    final fonts = FontLoader('Manrope');
    for (final weight in [
      'Regular',
      'Medium',
      'SemiBold',
      'Bold',
      'ExtraBold',
    ]) {
      fonts.addFont(rootBundle.load('assets/fonts/Manrope-$weight.ttf'));
    }
    await fonts.load();
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
  Map<String, dynamic> stop() => collectorStop({
    ...api.pickups.first,
    'id': 'preview-route',
    'pickupRequestId': 'preview-pickup-1',
    'completionStatus': 0,
    'residentName': 'A resident with a longer display name',
    'residentPhone': '+94 77 123 4567',
    'address': '12 Park Road, near the community centre, Colombo 07',
  });
  final screens = <String, Widget Function()>{
    'Startup': () => const EcoLoadingScreen(),
    'Onboarding': () => OnboardingScreen(onComplete: (_) async {}),
    'Login': () => const LoginScreen(),
    'Register': () => const RegisterScreen(),
    'Forgot password': () => const ForgotPasswordScreen(),
    'Reset password': () => ResetPasswordScreen(onComplete: () {}),
    'Resident home and navigation': () => const ResidentShell(),
    'Pickups': () => EcoScreen(child: RequestsTab(onRequestPickup: () {})),
    'New pickup': () => const NewPickupScreen(),
    'Edit pickup': () => NewPickupScreen(existing: api.pickups.first),
    'Pickup details': () =>
        const PickupDetailScreen(pickupId: 'preview-pickup-1'),
    'Pickup confirmation': () =>
        PickupSubmittedScreen(pickup: api.pickups.first),
    'Pickup pin': () => const PickupLocationScreen(),
    'Rewards': () => const EcoScreen(child: RewardsTab()),
    'Reward catalog': () => const RedeemScreen(balance: 1240),
    'Leaderboard': () => const LeaderboardScreen(),
    'Profile': () => const EcoScreen(child: ProfileTab()),
    'Complaints': () => const ComplaintsListScreen(),
    'New complaint': () => const NewComplaintScreen(),
    'Collector route and navigation': () => const CollectorShell(),
    'Collector map': () => const EcoScreen(
      child: RouteMapScreen(collectorId: 'preview-collector'),
    ),
    'Collector stop': () => StopDetailScreen(stop: stop(), stopNumber: 1),
  };

  for (final size in [const Size(390, 844), const Size(320, 568)]) {
    for (final entry in screens.entries) {
      testWidgets('${entry.key} fits $size with larger text', (tester) async {
        final originalHandler = FlutterError.onError;
        FlutterError.onError = (details) {
          debugPrint(details.toString());
          originalHandler?.call(details);
        };
        addTearDown(() => FlutterError.onError = originalHandler);
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          MaterialApp(
            theme: buildEcoTheme(),
            scrollBehavior: const EcoScrollBehavior(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(size.width == 320 ? 1.5 : 1),
                disableAnimations: true,
              ),
              child: EcoAppScope(
                api: api,
                user: MobilePreviewApi.user(
                  collector: entry.key.startsWith('Collector'),
                ),
                preview: true,
                child: child!,
              ),
            ),
            home: entry.value(),
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(seconds: 1));
        expect(tester.takeException(), isNull);
        for (final element
            in find
                .descendant(
                  of: find.byType(EcoNavigationBar),
                  matching: find.byType(RichText),
                )
                .evaluate()) {
          final paragraph = element.findRenderObject() as RenderParagraph;
          expect(
            paragraph.didExceedMaxLines,
            isFalse,
            reason:
                'Navigation label ${paragraph.text.toPlainText()} must be readable in full',
          );
        }
        // Visit the bottom of every vertical list to build lazy rows, too.
        for (final element in find.byType(Scrollable).evaluate().toList()) {
          final state = (element as StatefulElement).state as ScrollableState;
          if (state.position.hasContentDimensions &&
              axisDirectionToAxis(state.position.axisDirection) ==
                  Axis.vertical) {
            state.position.jumpTo(state.position.maxScrollExtent);
          }
        }
        await tester.pump();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pump();
      });
    }
  }
}
