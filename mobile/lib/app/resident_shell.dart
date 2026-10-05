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
  final _homeKey = GlobalKey<HomeTabState>();
  final _rewardsKey = GlobalKey<RewardsTabState>();

  Future<void> _openNewPickup() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => NewPickupScreen(
          onSubmitted: () {
            _requestsKey.currentState?.reload();
            _homeKey.currentState?.reload();
            if (mounted) setState(() => _tab = 1);
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return EcoScreen(
      bottomNavigationBar: EcoBottomNav(
        index: _tab,
        onChanged: (i) {
          setState(() => _tab = i);
          if (i == 0) _homeKey.currentState?.reload();
          if (i == 1) _requestsKey.currentState?.reload();
          if (i == 2) _rewardsKey.currentState?.reload();
        },
        onRequestPickup: _openNewPickup,
      ),
      child: IndexedStack(
        index: _tab,
        children: [
          HomeTab(
            key: _homeKey,
            onRequestPickup: _openNewPickup,
            onOpenRequests: () => setState(() => _tab = 1),
            onOpenRewards: () => setState(() => _tab = 2),
            // The avatar is a shortcut to the Profile tab, not a new page, so
            // the bottom bar stays in step with what is on screen.
            onOpenProfile: () => setState(() => _tab = _profileTab),
          ),
          RequestsTab(key: _requestsKey, onRequestPickup: _openNewPickup),
          RewardsTab(key: _rewardsKey),
          const ProfileTab(),
        ],
      ),
    );
  }
}
