import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/screens/tabs/profile_tab.dart';
import 'package:ecocycle_mobile/services/api.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:ecocycle_mobile/widgets/eco_components.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _RecordingApi extends Api {
  final deleted = <String>[];

  @override
  Future<dynamic> delete(String path) async {
    deleted.add(path);
    return null;
  }
}

User _user(String role) => User(
  id: '00000000-0000-0000-0000-000000000001',
  appMetadata: const {},
  userMetadata: {'full_name': 'Kavisha', 'role': role},
  aud: 'authenticated',
  email: 'resident@example.com',
  createdAt: '2026-01-01T00:00:00Z',
);

Widget _app(Api api, {String role = 'resident'}) => MaterialApp(
  theme: buildEcoTheme(),
  scrollBehavior: const EcoScrollBehavior(),
  home: EcoAppScope(
    api: api,
    user: _user(role),
    child: const Scaffold(body: ProfileTab()),
  ),
);

void main() {
  testWidgets('Delete account asks first, then deletes on confirmation', (
    tester,
  ) async {
    final api = _RecordingApi();
    await tester.pumpWidget(_app(api));

    final button = find.widgetWithText(EcoDangerButton, 'Delete account');
    await tester.scrollUntilVisible(button, 200);
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pumpAndSettle();

    expect(find.text('Delete account?'), findsOneWidget);
    expect(
      api.deleted,
      isEmpty,
      reason: 'nothing is deleted before confirming',
    );

    await tester.tap(find.widgetWithText(TextButton, 'Delete account'));
    await tester.pumpAndSettle();

    expect(api.deleted, ['/account']);
  });

  testWidgets('Keeping the account deletes nothing', (tester) async {
    final api = _RecordingApi();
    await tester.pumpWidget(_app(api));

    final button = find.widgetWithText(EcoDangerButton, 'Delete account');
    await tester.scrollUntilVisible(button, 200);
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Keep account'));
    await tester.pumpAndSettle();

    expect(api.deleted, isEmpty);
    expect(find.text('Delete account?'), findsNothing);
  });

  testWidgets('A collector is not offered complaints', (tester) async {
    await tester.pumpWidget(_app(_RecordingApi(), role: 'collector'));

    expect(find.text('Collector'), findsOneWidget);
    expect(find.text('My complaints'), findsNothing);
  });
}
