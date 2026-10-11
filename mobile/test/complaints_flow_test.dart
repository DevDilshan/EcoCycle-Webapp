import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/screens/complaints_list_screen.dart';
import 'package:ecocycle_mobile/screens/new_complaint_screen.dart';
import 'package:ecocycle_mobile/services/api.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _ComplaintsApi extends Api {
  final posts = <Map<String, dynamic>>[];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path == '/complaints') {
      return {
        'items': [
          {
            'id': 'abcd-0001',
            'status': 'Open',
            'description': 'Missed yesterday morning — no collection.',
            'issueType': 'Missed pickup',
          },
        ],
      };
    }
    if (path == '/pickuprequests') {
      return {
        'items': [
          {
            'id': 'pickup-001',
            'status': 'Completed',
            'preferredDate': '2026-10-08T00:00:00Z',
            'description': 'Mixed recyclables',
          },
        ],
      };
    }
    return null;
  }

  @override
  Future<dynamic> post(String path, {Object? body}) async {
    posts.add({'path': path, 'body': body});
    return {'id': 'c-new'};
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

void main() {
  testWidgets('Complaints list loads open complaints', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: EcoAppScope(
          api: _ComplaintsApi(),
          user: _resident(),
          child: const ComplaintsListScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('My complaints'), findsOneWidget);
    expect(find.textContaining('Missed yesterday'), findsOneWidget);
    expect(find.text('Open'), findsOneWidget);
  });

  testWidgets('New complaint requires pickup and sends description', (
    tester,
  ) async {
    final api = _ComplaintsApi();
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: EcoAppScope(
          api: api,
          user: _resident(),
          child: const NewComplaintScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Submit complaint'));
    await tester.pumpAndSettle();
    expect(api.posts, isEmpty);

    await tester.tap(find.text('Select a pickup request…'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Mixed recyclables').last);
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextField),
      'The crew never came on Tuesday morning.',
    );
    await tester.tap(find.text('Submit complaint'));
    await tester.pumpAndSettle();

    expect(api.posts, hasLength(1));
    expect(api.posts.first['path'], '/complaints');
    expect(api.posts.first['body'], {
      'pickupRequestId': 'pickup-001',
      'description': '[Missed pickup] The crew never came on Tuesday morning.',
    });
  });

  testWidgets('The photo box offers the camera and the library', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: EcoAppScope(
          api: _ComplaintsApi(),
          user: _resident(),
          child: const NewComplaintScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('tap to attach'));
    await tester.tap(find.text('tap to attach'));
    await tester.pumpAndSettle();

    expect(find.text('Take photo'), findsOneWidget);
    expect(find.text('Choose from library'), findsOneWidget);
  });
}
