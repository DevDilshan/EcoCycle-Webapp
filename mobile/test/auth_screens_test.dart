import 'dart:async';
import 'dart:convert';

import 'package:ecocycle_mobile/app/auth_gate.dart';
import 'package:ecocycle_mobile/screens/forgot_password_screen.dart';
import 'package:ecocycle_mobile/screens/login_screen.dart';
import 'package:ecocycle_mobile/screens/register_screen.dart';
import 'package:ecocycle_mobile/screens/reset_password_screen.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:ecocycle_mobile/services/onboarding_store.dart';
import 'package:ecocycle_mobile/widgets/eco_components.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class CompletedOnboardingStore implements OnboardingStore {
  @override
  Future<bool> isComplete() async => true;
  @override
  Future<void> complete() async {}
}

void main() {
  final testUser = {
    'id': '00000000-0000-0000-0000-000000000001',
    'aud': 'authenticated',
    'email': 'resident@example.com',
    'app_metadata': <String, Object>{},
    'user_metadata': {'role': 'resident'},
    'created_at': '2026-01-01T00:00:00Z',
  };
  final expiresAt = DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600;
  final token =
      '${base64Url.encode(utf8.encode('{"alg":"HS256"}'))}.${base64Url.encode(utf8.encode(jsonEncode({'exp': expiresAt})))}.test';
  final session = {
    'access_token': token,
    'token_type': 'bearer',
    'refresh_token': 'test-refresh-token',
    'expires_in': 3600,
    'user': testUser,
  };
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await Supabase.initialize(
      url: 'https://ecocycle-test.supabase.co',
      publishableKey: 'public-test-key',
      httpClient: MockClient((request) async {
        final body = request.url.path.endsWith('/user') ? testUser : session;
        return http.Response(
          jsonEncode(body),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
      authOptions: const FlutterAuthClientOptions(
        autoRefreshToken: false,
        localStorage: EmptyLocalStorage(),
      ),
    );
  });
  tearDownAll(() async => Supabase.instance.dispose());

  Future<void> open(
    WidgetTester tester,
    Widget screen, {
    bool small = false,
    bool keyboard = false,
  }) async {
    final size = small ? const Size(320, 568) : const Size(390, 844);
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: MediaQuery(
          data: MediaQueryData(
            size: size,
            textScaler: TextScaler.linear(small ? 1.5 : 1),
            viewInsets: EdgeInsets.only(bottom: keyboard ? 260 : 0),
            disableAnimations: true,
          ),
          child: screen,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> tapPrimary(WidgetTester tester) async {
    final button = find.byType(EcoPrimaryButton).first;
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump();
  }

  testWidgets(
    'Login validates locally and password visibility preserves input',
    (tester) async {
      await open(tester, const LoginScreen());
      await tapPrimary(tester);
      await tester.pumpAndSettle();
      expect(find.text('Enter your email address.'), findsOneWidget);
      expect(find.text('Enter your password.'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).first, 'invalid');
      await tester.enterText(find.byType(TextFormField).last, 'test-password');
      await tester.tap(find.byTooltip('Show password'));
      await tester.pumpAndSettle();
      final password = tester.widget<TextFormField>(
        find.byType(TextFormField).last,
      );
      expect(
        tester.widget<TextField>(find.byType(TextField).last).obscureText,
        isFalse,
      );
      expect(password.controller!.text, 'test-password');
      expect(find.text('Enter a valid email address.'), findsOneWidget);
    },
  );

  testWidgets('Login opens recovery with entered email and returns', (
    tester,
  ) async {
    await open(tester, const LoginScreen());
    await tester.enterText(
      find.byType(TextFormField).first,
      'resident@example.com',
    );
    await tester.tap(find.text('Forgot password?'));
    await tester.pumpAndSettle();
    expect(find.byType(ForgotPasswordScreen), findsOneWidget);
    expect(
      tester.widget<TextFormField>(find.byType(TextFormField)).controller!.text,
      'resident@example.com',
    );
    await tester.tap(find.text('Back'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets(
    'Registration role selection and validation prevent invalid signup',
    (tester) async {
      await open(tester, const RegisterScreen());
      await tester.tap(find.text('Collector'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Google sign-up creates a resident account'),
        findsOneWidget,
      );
      await tester.enterText(find.byType(TextFormField).first, 'invalid');
      await tester.enterText(find.byType(TextFormField).last, 'abc');
      await tapPrimary(tester);
      await tester.pumpAndSettle();
      expect(find.text('Enter a valid email address.'), findsOneWidget);
      expect(find.text('Use at least 6 characters.'), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Recovery submits once, shows confirmation and allows another email',
    (tester) async {
      final pending = Completer<void>();
      final sent = <String>[];
      await open(
        tester,
        ForgotPasswordScreen(
          sendResetLink: (email) {
            sent.add(email);
            return pending.future;
          },
        ),
      );
      await tapPrimary(tester);
      expect(sent, isEmpty);
      await tester.enterText(
        find.byType(TextFormField),
        'resident@example.com',
      );
      await tapPrimary(tester);
      await tapPrimary(tester);
      expect(sent, ['resident@example.com']);
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField)).enabled,
        isFalse,
      );
      pending.complete();
      await tester.pumpAndSettle();
      expect(find.text('Check your inbox'), findsOneWidget);
      await tester.tap(find.text('Use a different email'));
      await tester.pumpAndSettle();
      expect(find.byType(TextFormField), findsOneWidget);
    },
  );

  testWidgets('Recovery reports server errors and permits retry', (
    tester,
  ) async {
    var attempts = 0;
    await open(
      tester,
      ForgotPasswordScreen(
        initialEmail: 'resident@example.com',
        sendResetLink: (_) async {
          if (attempts++ == 0) {
            throw const AuthException('Please try again later.');
          }
        },
      ),
    );
    await tapPrimary(tester);
    await tester.pumpAndSettle();
    expect(find.text('Please try again later.'), findsOneWidget);
    await tapPrimary(tester);
    await tester.pumpAndSettle();
    expect(find.text('Check your inbox'), findsOneWidget);
  });

  testWidgets('New password must match before update and continue', (
    tester,
  ) async {
    final updated = <String>[];
    var completed = false;
    await open(
      tester,
      ResetPasswordScreen(
        onComplete: () => completed = true,
        updatePassword: (value) async => updated.add(value),
      ),
    );
    await tester.enterText(
      find.byType(TextFormField).first,
      'new-test-password',
    );
    await tester.enterText(find.byType(TextFormField).last, 'different');
    await tapPrimary(tester);
    await tester.pumpAndSettle();
    expect(find.text('The passwords don’t match.'), findsOneWidget);
    expect(updated, isEmpty);
    await tester.enterText(
      find.byType(TextFormField).last,
      'new-test-password',
    );
    await tapPrimary(tester);
    await tester.pumpAndSettle();
    expect(updated, ['new-test-password']);
    expect(find.text('Password updated'), findsOneWidget);
    await tapPrimary(tester);
    expect(completed, isTrue);
  });

  testWidgets(
    'Auth screens stay scrollable with large text and keyboard on a small phone',
    (tester) async {
      final screens = <Widget>[
        const LoginScreen(),
        const RegisterScreen(),
        const ForgotPasswordScreen(),
        ResetPasswordScreen(onComplete: () {}),
      ];
      for (final screen in screens) {
        await open(tester, screen, small: true, keyboard: true);
        expect(tester.takeException(), isNull, reason: '$screen');
        final button = find.byType(EcoPrimaryButton).first;
        await tester.ensureVisible(button);
        await tester.pumpAndSettle();
        expect(tester.getCenter(button).dy, lessThan(308), reason: '$screen');
        expect(tester.takeException(), isNull, reason: '$screen');
      }
    },
  );

  testWidgets('Cold recovery link opens password reset and dismisses auth pages', (
    tester,
  ) async {
    final auth = Supabase.instance.client.auth;
    await tester.runAsync(
      () => auth.getSessionFromUrl(
        Uri.parse(
          'ecocycle://login-callback#access_token=$token&expires_in=3600&refresh_token=test-refresh-token&token_type=bearer&type=recovery',
        ),
      ),
    );
    await open(tester, AuthGate(onboardingStore: CompletedOnboardingStore()));
    expect(find.byType(ResetPasswordScreen), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
    final context = tester.element(find.byType(ResetPasswordScreen));
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const ForgotPasswordScreen()),
    );
    await tester.pumpAndSettle();
    expect(find.byType(ForgotPasswordScreen), findsOneWidget);
    await tester.runAsync(
      () => auth.getSessionFromUrl(
        Uri.parse(
          'ecocycle://login-callback#access_token=$token&expires_in=3600&refresh_token=test-refresh-token&token_type=bearer&type=recovery',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(ForgotPasswordScreen), findsNothing);
    expect(find.byType(ResetPasswordScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    await tester.runAsync(() => auth.signOut(scope: SignOutScope.local));
  });
}
