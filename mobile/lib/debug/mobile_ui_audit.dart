import 'package:flutter/material.dart';

import '../app/resident_shell.dart';
import '../app/collector_shell.dart';
import '../screens/collector/route_map_screen.dart';
import '../screens/collector/route_screen.dart';
import '../screens/collector/stop_detail_screen.dart';
import '../screens/complaints_list_screen.dart';
import '../screens/leaderboard_screen.dart';
import '../screens/new_complaint_screen.dart';
import '../screens/new_pickup_screen.dart';
import '../screens/pickup_detail_screen.dart';
import '../screens/pickup_location_screen.dart';
import '../screens/pickup_submitted_screen.dart';
import '../screens/redeem_screen.dart';
import '../screens/tabs/profile_tab.dart';
import '../screens/tabs/requests_tab.dart';
import '../screens/tabs/rewards_tab.dart';
import '../widgets/eco_components.dart';
import 'mobile_preview.dart';

/// Only reachable from the debug web preview, using the read-only sample API.
/// Direct entry points let layout checks cover detail and completion screens
/// without submitting a real booking or changing an account.
class MobileUiAudit extends StatelessWidget {
  const MobileUiAudit({super.key, required this.page});
  final String page;

  @override
  Widget build(BuildContext context) {
    final pickup = MobilePreviewApi().pickups.first;
    return switch (page) {
      'pickups' => EcoScreen(child: RequestsTab(onRequestPickup: () {})),
      'booking' => const NewPickupScreen(),
      'edit-booking' => NewPickupScreen(existing: pickup),
      'pickup-detail' => const PickupDetailScreen(pickupId: 'preview-pickup-1'),
      'submitted' => PickupSubmittedScreen(pickup: pickup),
      'location' => const PickupLocationScreen(),
      'rewards' => const EcoScreen(child: RewardsTab()),
      'redeem' => const RedeemScreen(balance: 1240),
      'leaderboard' => const LeaderboardScreen(),
      'profile' => const EcoScreen(child: ProfileTab()),
      'complaints' => const ComplaintsListScreen(),
      'new-complaint' => const NewComplaintScreen(),
      'collector' => const CollectorShell(),
      'collector-map' => const EcoScreen(
        child: RouteMapScreen(collectorId: 'preview-collector'),
      ),
      'collector-stop' => StopDetailScreen(
        stop: collectorStop({
          ...pickup,
          'id': 'preview-route-1',
          'pickupRequestId': pickup['id'],
          'residentName': 'Kavisha',
          'residentPhone': '+94 77 123 4567',
          'completionStatus': 0,
        }),
        stopNumber: 1,
      ),
      _ => const ResidentShell(),
    };
  }
}
