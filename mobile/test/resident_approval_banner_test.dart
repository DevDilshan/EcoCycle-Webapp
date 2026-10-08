import 'package:ecocycle_mobile/theme/eco_theme.dart';
import 'package:ecocycle_mobile/widgets/resident_approval_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Rejected banner shows resident-facing message', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildEcoTheme(),
        home: Scaffold(
          body: ResidentApprovalBanner(
            pickup: {
              'hasApprovalRequest': true,
              'approvalStatus': 'Rejected',
              'residentMessage': 'We cannot collect hazardous waste from the curb.',
              'flagReason': 'Hazardous category',
            },
          ),
        ),
      ),
    );

    expect(find.text('Pickup not approved'), findsOneWidget);
    expect(find.text('We cannot collect hazardous waste from the curb.'), findsOneWidget);
    expect(find.textContaining('Originally flagged'), findsOneWidget);
  });
}
