import 'package:ecocycle_mobile/widgets/reward_artwork.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Legacy API records get bundled artwork on an installed device', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: RewardArtwork(itemName: 'Reusable tote bag')),
    );
    await tester.pumpAndSettle();
    final image = tester.widget<Image>(find.byType(Image));
    expect(
      (image.image as AssetImage).assetName,
      'assets/images/rewards/tote.webp',
    );
  });
  testWidgets('Explicit removal does not restore suggested artwork', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: RewardArtwork(itemName: 'Reusable tote bag', imageUrl: ''),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(Image), findsNothing);
    expect(find.byIcon(Icons.card_giftcard), findsOneWidget);
  });
}
