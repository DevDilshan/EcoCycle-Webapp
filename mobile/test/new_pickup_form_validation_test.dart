import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/screens/new_pickup_screen.dart';
import 'package:ecocycle_mobile/services/api.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// Create-mode form validation for the new-pickup screen. Submitting with bad or
// missing input must show the inline field errors and must NOT call the API.
// (Edit-mode save/navigation and the map pin are covered by
// pickup_location_form_test.dart and map_location_test.dart.)

class _RecordingApi extends Api {
  final List<String> posted = [];

  // The screen loads zones and the bulky allowance on create; return harmless
  // shapes so the form builds. An empty zone list is fine for these tests.
  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async =>
      path.contains('zones') ? <Map<String, dynamic>>[] : <String, dynamic>{};

  @override
  Future<dynamic> post(String path, {Object? body}) async {
    posted.add(path);
    return <String, dynamic>{'id': 'x'};
  }
}

User _resident() => User(
  id: '00000000-0000-0000-0000-000000000001',
  appMetadata: const {},
  userMetadata: const {'role': 'resident'},
  aud: 'authenticated',
  email: 'resident@example.com',
  createdAt: '2026-01-01T00:00:00Z',
);

Future<void> _pumpCreateForm(WidgetTester tester, _RecordingApi api) async {
  await tester.pumpWidget(
    EcoAppScope(
      api: api,
      user: _resident(),
      child: MaterialApp(
        theme: buildEcoTheme(),
        home: const NewPickupScreen(), // no `existing` => create mode
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _submit(WidgetTester tester) async {
  final button = find.text('Submit request');
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Submitting an empty form shows every required-field error', (
    tester,
  ) async {
    final api = _RecordingApi();
    await _pumpCreateForm(tester, api);

    await _submit(tester);

    expect(find.text('Please describe the waste to be collected.'), findsOneWidget);
    expect(find.text('Please give a number the crew can call.'), findsOneWidget);
    expect(find.text('Please choose the zone this pickup is in.'), findsOneWidget);
    expect(find.text('Please give your house number and street.'), findsOneWidget);
    expect(
      find.text('Please add a photo of the waste so it can be classified.'),
      findsOneWidget,
    );
    // Validation fails, so nothing is ever sent.
    expect(api.posted, isEmpty);
  });

  testWidgets('An unreachable contact number is rejected with the format hint', (
    tester,
  ) async {
    final api = _RecordingApi();
    await _pumpCreateForm(tester, api);

    final phoneField = find.byWidgetPredicate(
      (w) => w is TextField && w.keyboardType == TextInputType.phone,
    );
    expect(phoneField, findsOneWidget);
    await tester.enterText(phoneField, 'abc123'); // letters => not dialable
    await tester.pumpAndSettle();

    await _submit(tester);

    expect(
      find.text('Please give a valid contact number, e.g. 0771234567.'),
      findsOneWidget,
    );
    // The "missing number" message must NOT show -- a number was given.
    expect(find.text('Please give a number the crew can call.'), findsNothing);
    expect(api.posted, isEmpty);
  });

  testWidgets('A too-short description is rejected', (tester) async {
    final api = _RecordingApi();
    await _pumpCreateForm(tester, api);

    // The description is the multi-line field on the form.
    final descField = find.byWidgetPredicate(
      (w) => w is TextField && (w.maxLines == null || w.maxLines! > 1),
    );
    expect(descField, findsOneWidget);
    await tester.enterText(descField, 'abc'); // 3 chars < 5
    await tester.pumpAndSettle();

    await _submit(tester);

    expect(find.text('Description must be at least 5 characters.'), findsOneWidget);
    expect(api.posted, isEmpty);
  });
}
