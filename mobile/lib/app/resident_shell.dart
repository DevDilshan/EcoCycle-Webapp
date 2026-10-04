import 'package:flutter/material.dart';

import '../screens/tabs/home_tab.dart';
import '../screens/tabs/profile_tab.dart';
import '../screens/tabs/requests_tab.dart';
import '../screens/tabs/rewards_tab.dart';
import '../screens/new_pickup_screen.dart';
import '../widgets/eco_components.dart';

class ResidentShell extends StatefulWidget {
  const ResidentShell({super.key});

  @override
  State<ResidentShell> createState() => _ResidentShellState();
}

class _ResidentShellState extends State<ResidentShell> {
  static const _profileTab = 3;

  int _tab = 0;
  final _requestsKey = GlobalKey<RequestsTabState>();

  void _openNewPickup() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => NewPickupScreen(
          onSubmitted: () => _requestsKey.currentState?.reload(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return EcoScreen(
      bottomNavigationBar: EcoBottomNav(
        index: _tab,
        onChanged: (i) => setState(() => _tab = i),
        onFab: _openNewPickup,
      ),
      child: IndexedStack(
        index: _tab,
        children: [
          HomeTab(
            onRequestPickup: _openNewPickup,
            // The avatar is a shortcut to the Profile tab, not a new page, so
            // the bottom bar stays in step with what is on screen.
            onOpenProfile: () => setState(() => _tab = _profileTab),
          ),
          RequestsTab(key: _requestsKey),
          const RewardsTab(),
          const ProfileTab(),
        ],
      ),
    );
  }
}
