import 'package:ecocycle_mobile/app/eco_app_scope.dart';
import 'package:ecocycle_mobile/screens/redeem_screen.dart';
import 'package:ecocycle_mobile/services/api.dart';
import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _FakeApi extends Api {
  _FakeApi(this.requests);

  final List<Map<String, dynamic>> requests;
  final posted = <Object?>[];

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path.endsWith('/history')) return {'currentBalance': 500};
    if (path == '/reward-items') {
      return {
        'items': [
          {
            'id': 'kit',
            'name': 'Seed starter kit',
            'pointsCost': 90,
            'delivery': 'Post',
            'imageUrl': '/images/rewards/herb-seeds.webp',
          },
        ],
      };
    }
    return {'items': requests};
  }

  @override
  Future<dynamic> post(String path, {Object? body}) async {
    posted.add(body);
    return null;
  }
}

Widget _app(Api api, {bool requestsOnly = false}) => MaterialApp(
  theme: buildEcoTheme(),
  home: EcoAppScope(
    api: api,
    user: User(
      id: '00000000-0000-0000-0000-000000000001',
      appMetadata: const {},
      userMetadata: const {'role': 'resident'},
      aud: 'authenticated',
      email: 'resident@example.com',
      createdAt: '2026-01-01T00:00:00Z',
    ),
    child: RedeemScreen(balance: 500, requestsOnly: requestsOnly),
  ),
);

void main() {
  testWidgets('An approved request shows its code and where it is going', (
    tester,
  ) async {
    // Tall enough for all three cards: the list only builds what is on screen.
    tester.view.physicalSize = const Size(1080, 4000);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      _app(
        _FakeApi([
          {
            'id': 'r1',
            'reason': 'Grocery voucher',
            'points': 120,
            'status': 'Approved',
            'delivery': 'Collect',
            'collectionCode': 'ECO-7F3K-92QD',
            'deliveryInstructions': 'Counter 3, Town Hall.',
          },
          {
            'id': 'r2',
            'reason': 'Seed starter kit',
            'points': 90,
            'status': 'Approved',
            'delivery': 'Post',
            'collectionCode': 'ECO-B6NZ-P4GC',
            'deliveryAddress': '12 Galle Road, Colombo 03',
            'deliveryInstructions': 'We will post this reward.',
            'fulfilledAt': '2026-10-01T09:30:00Z',
          },
          {
            'id': 'r3',
            'reason': 'Old approval',
            'points': 10,
            'status': 'Approved',
          },
        ]),
        requestsOnly: true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Grocery voucher'));
    await tester.pumpAndSettle();
    expect(find.text('ECO-7F3K-92QD'), findsOneWidget);
    expect(find.text('Counter 3, Town Hall.'), findsOneWidget);
    expect(find.text('Ready to collect'), findsNWidgets(2));
    await tester.tap(find.byTooltip('Close request details'));
    await tester.pumpAndSettle();
    expect(find.text('Posted'), findsOneWidget);
    await tester.tap(find.text('Seed starter kit'));
    await tester.pumpAndSettle();
    expect(find.textContaining('code ECO-B6NZ-P4GC'), findsOneWidget);
    // Approved before codes existed: still just "Approved", with no slip.
    await tester.tap(find.byTooltip('Close request details'));
    await tester.pumpAndSettle();
    expect(
      find.text('Approved'),
      findsNWidgets(2),
    ); // Filter chip and the legacy request.
  });

  testWidgets('A posted reward asks for an address before it is requested', (
    tester,
  ) async {
    final api = _FakeApi([]);
    await tester.pumpWidget(_app(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Seed starter kit'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Request reward'));
    await tester.tap(find.text('Request reward'));
    await tester.pumpAndSettle();
    expect(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.textContaining('sent by post'),
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Send request'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Postal address'),
      'No 5',
    );
    await tester.tap(find.text('Use this address'));
    await tester.pumpAndSettle();
    expect(find.text('Enter the full address.'), findsOneWidget);
    expect(api.posted, isEmpty);

    await tester.enterText(
      find.widgetWithText(TextField, 'Postal address'),
      '12 Galle Road, Colombo 03',
    );
    await tester.tap(find.text('Use this address'));
    await tester.pumpAndSettle();

    expect(api.posted.single, {
      'rewardItemId': 'kit',
      'deliveryAddress': '12 Galle Road, Colombo 03',
    });
  });

  testWidgets(
    'Reward image and request controls fit a narrow screen with larger text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 900);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await tester.pumpWidget(_app(_FakeApi([])));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('View reward'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      expect(find.byType(Image), findsOneWidget);
      final image = tester.widget<Image>(find.byType(Image));
      expect(
        (image.image as AssetImage).assetName,
        'assets/images/rewards/herb-seeds.webp',
      );
      expect(tester.takeException(), isNull);
      expect(find.text('View reward'), findsOneWidget);
      await tester.tap(find.text('Seed starter kit'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Request reward'));
      await tester.tap(find.text('Request reward'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
