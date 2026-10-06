import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/screens/leaderboard_screen.dart';
import 'package:ecocycle_mobile/screens/tabs/rewards_tab.dart';
import 'package:ecocycle_mobile/services/api.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _me = '00000000-0000-0000-0000-000000000001';

// Answers the rewards endpoints from fixed data and records what was asked.
class _FakeApi extends Api {
  _FakeApi({
    this.balance = 120,
    this.history = const [],
    this.pending = const [],
    this.leaderboard = const [],
    this.fail = false,
  });

  final int balance;
  final List<Map<String, dynamic>> history;
  final List<Map<String, dynamic>> pending;
  final List<Map<String, dynamic>> leaderboard;
  bool fail;
  final calls = <String>[];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    calls.add(query == null ? path : '$path?${Uri(queryParameters: query).query}');
    if (fail) throw Exception('offline');
    if (path.endsWith('/history')) {
      return {'currentBalance': balance, 'items': history};
    }
    if (path == '/redemptions') return {'items': pending};
    if (path == '/rewards/leaderboard') {
      final limit = int.parse(query?['limit'] ?? '10');
      return leaderboard.take(limit).toList();
    }
    return {'items': []};
  }
}

Widget _app(Api api, Widget child) => MaterialApp(
  theme: buildEcoTheme(),
  home: EcoAppScope(
    api: api,
    user: User(
      id: _me,
      appMetadata: const {},
      userMetadata: const {'role': 'resident'},
      aud: 'authenticated',
      email: 'resident@example.com',
      createdAt: '2026-01-01T00:00:00Z',
    ),
    child: Scaffold(body: child),
  ),
);

// The loading states animate forever, so settle with a few frames instead.
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Map<String, dynamic> _entry(int points, String reason) => {
  'pointsEarned': points,
  'reason': reason,
  'createdAt': '2026-10-05T10:00:00Z',
};

Map<String, dynamic> _rank(int rank, String id, String name, int points) => {
  'rank': rank,
  'residentId': id,
  'residentName': name,
  'pointsEarned': points,
};

void _tallScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 7200);
  addTearDown(tester.view.resetPhysicalSize);
}

void main() {
  group('Rewards tab', () {
    testWidgets('shows the balance and the points set aside for pending requests', (
      tester,
    ) async {
      _tallScreen(tester);
      final api = _FakeApi(
        balance: 120,
        pending: [
          {'status': 'Pending', 'points': 30},
          {'status': 'Pending', 'points': 20},
        ],
      );
      await tester.pumpWidget(_app(api, const RewardsTab()));
      await _settle(tester);

      expect(find.textContaining('120', findRichText: true), findsWidgets);
      expect(find.text('50 points set aside for pending requests.'), findsOneWidget);
      expect(find.text('2 waiting for approval'), findsOneWidget);
      expect(api.calls, contains('/rewards/$_me/history?pageSize=20'));
    });

    testWidgets('invites a first pickup when there is no points activity', (
      tester,
    ) async {
      _tallScreen(tester);
      await tester.pumpWidget(_app(_FakeApi(balance: 0), const RewardsTab()));
      await _settle(tester);

      expect(find.text('Your first points are waiting'), findsOneWidget);
      expect(find.textContaining('set aside'), findsNothing);
    });

    testWidgets('shows five entries first, with spent points as a minus', (
      tester,
    ) async {
      _tallScreen(tester);
      final history = [
        _entry(-120, 'Redemption: Grocery voucher'),
        for (var i = 1; i <= 6; i++) _entry(5, 'Recycling pickup $i'),
      ];
      await tester.pumpWidget(_app(_FakeApi(history: history), const RewardsTab()));
      await _settle(tester);

      expect(find.text('-120'), findsOneWidget);
      expect(find.text('Recycling pickup 5'), findsNothing);

      await tester.tap(find.text('Show all 7'));
      await _settle(tester);

      expect(find.text('Recycling pickup 6'), findsOneWidget);
      expect(find.text('Show less'), findsOneWidget);
    });

    testWidgets('offers a retry when the rewards cannot load', (tester) async {
      _tallScreen(tester);
      final api = _FakeApi(fail: true, history: [_entry(5, 'Recycling pickup')]);
      await tester.pumpWidget(_app(api, const RewardsTab()));
      await _settle(tester);

      expect(find.text('Try again'), findsOneWidget);

      api.fail = false;
      await tester.tap(find.text('Try again'));
      await _settle(tester);

      expect(find.text('Recycling pickup'), findsOneWidget);
    });
  });

  group('Leaderboard', () {
    testWidgets('marks the signed-in resident and shows their balance', (
      tester,
    ) async {
      _tallScreen(tester);
      final api = _FakeApi(
        balance: 75,
        leaderboard: [
          _rank(1, 'someone-else', 'Kamal', 40),
          _rank(2, _me, 'Nimali', 25),
        ],
      );
      await tester.pumpWidget(_app(api, const LeaderboardScreen()));
      await _settle(tester);

      expect(find.text('Kamal'), findsOneWidget);
      expect(find.text('You · Nimali'), findsOneWidget);
      expect(find.text('75 pts'), findsOneWidget);
      expect(find.text('Show more'), findsNothing);
    });

    testWidgets('loads ten more when a full page came back', (tester) async {
      _tallScreen(tester);
      final api = _FakeApi(
        leaderboard: [
          for (var i = 1; i <= 15; i++) _rank(i, 'r$i', 'Resident $i', 100 - i),
        ],
      );
      await tester.pumpWidget(_app(api, const LeaderboardScreen()));
      await _settle(tester);

      expect(find.text('Resident 10'), findsOneWidget);
      expect(find.text('Resident 11'), findsNothing);

      await tester.tap(find.text('Show more'));
      await _settle(tester);

      expect(api.calls, contains('/rewards/leaderboard?limit=20'));
      expect(find.text('Resident 15'), findsOneWidget);
      expect(find.text('Show more'), findsNothing);
    });
  });
}
