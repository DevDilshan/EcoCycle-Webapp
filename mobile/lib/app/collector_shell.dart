import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../screens/collector/route_map_screen.dart';
import '../screens/collector/route_screen.dart';
import '../theme/eco_theme.dart';
import '../utils/user_helpers.dart';
import '../widgets/eco_components.dart';

class CollectorShell extends StatefulWidget {
  const CollectorShell({super.key});

  @override
  State<CollectorShell> createState() => _CollectorShellState();
}

class _CollectorShellState extends State<CollectorShell> {
  bool _mapView = false;

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser!;
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 8, 22, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEE, d MMM').format(DateTime.now()),
                      style: const TextStyle(fontSize: 12, color: EcoColors.body),
                    ),
                    const Text("Today's route", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  ],
                ),
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: EcoColors.avatarBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    initials(user),
                    style: const TextStyle(fontWeight: FontWeight.w800, color: EcoColors.primary),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _mapView
                ? RouteMapScreen(collectorId: user.id)
                : CollectorRouteScreen(collectorId: user.id),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 10, 22, 16),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _mapView = false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      decoration: BoxDecoration(
                        color: _mapView ? const Color(0xFFEEF3EE) : EcoColors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'List',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: _mapView ? EcoColors.primary : Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _mapView = true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      decoration: BoxDecoration(
                        color: _mapView ? EcoColors.primary : const Color(0xFFEEF3EE),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Map view',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: _mapView ? Colors.white : EcoColors.primary,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
