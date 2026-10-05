import 'package:flutter/material.dart';

import '../screens/collector/route_map_screen.dart';
import '../screens/collector/route_screen.dart';
import '../screens/tabs/profile_tab.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_feature.dart';
import 'eco_app_scope.dart';

class CollectorShell extends StatefulWidget {
  const CollectorShell({super.key});

  @override
  State<CollectorShell> createState() => _CollectorShellState();
}

class _CollectorShellState extends State<CollectorShell> {
  static const _profileTab = 2;

  int _tab = 0;
  bool _mapVisited = false;
  final _routeKey = GlobalKey<CollectorRouteScreenState>();
  final _mapKey = GlobalKey<RouteMapScreenState>();

  @override
  Widget build(BuildContext context) {
    final user = EcoAppScope.userOf(context)!;
    return EcoScreen(
      // The same bar the resident side uses, without the raised action: a
      // collector's next step is always a stop on the list, not a new request.
      bottomNavigationBar: EcoNavigationBar(
        index: _tab,
        onChanged: (i) {
          setState(() {
            _tab = i;
            if (i == 1) _mapVisited = true;
          });
          if (i == 0) _routeKey.currentState?.reload();
          if (i == 1) _mapKey.currentState?.reload();
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
          if (_mapVisited)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const EcoPageHeading(
                  title: 'Route map',
                  subtitle: 'Where today’s round takes you.',
                ),
                Expanded(
                  // A Builder, because the bar's height is only known below
                  // the Scaffold, not from this widget's own context.
                  child: Builder(
                    builder: (context) => Padding(
                      padding: EdgeInsets.only(
                        bottom: MediaQuery.paddingOf(context).bottom,
                      ),
                      child: RouteMapScreen(key: _mapKey, collectorId: user.id),
                    ),
                  ),
                ),
              ],
            )
          else
            const SizedBox.shrink(),
          const ProfileTab(),
        ],
      ),
    );
  }
}
