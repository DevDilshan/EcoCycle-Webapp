import 'package:flutter/material.dart';

import '../screens/collector/route_map_screen.dart';
import '../screens/collector/route_screen.dart';
import '../screens/tabs/profile_tab.dart';
import '../widgets/eco_components.dart';
import 'eco_app_scope.dart';

class CollectorShell extends StatefulWidget {
  const CollectorShell({super.key});

  @override
  State<CollectorShell> createState() => _CollectorShellState();
}

class _CollectorShellState extends State<CollectorShell> {
  static const _profileTab = 2;

  int _tab = 0;
  final _routeKey = GlobalKey<CollectorRouteScreenState>();

  @override
  Widget build(BuildContext context) {
    final user = EcoAppScope.userOf(context)!;
    return EcoScreen(
      // The same bar the resident side uses, without the raised action: a
      // collector's next step is always a stop on the list, not a new request.
      bottomNavigationBar: EcoNavigationBar(
        index: _tab,
        onChanged: (i) {
          setState(() => _tab = i);
          if (i == 0) _routeKey.currentState?.reload();
        },
        destinations: const [
          (Icons.route_outlined, Icons.route_rounded, 'Route'),
          (Icons.map_outlined, Icons.map_rounded, 'Map'),
          (Icons.person_outline_rounded, Icons.person_rounded, 'Profile'),
        ],
      ),
      child: IndexedStack(
        index: _tab,
        children: [
          CollectorRouteScreen(
            key: _routeKey,
            collectorId: user.id,
            onOpenProfile: () => setState(() => _tab = _profileTab),
          ),
          // The map screen owns its heading now, so its subtitle can carry the
          // stop count and the caveat that pins sit on the zone centre rather
          // than on the address -- as the web console's map page does.
          RouteMapScreen(collectorId: user.id),
          const ProfileTab(),
        ],
      ),
    );
  }
}
