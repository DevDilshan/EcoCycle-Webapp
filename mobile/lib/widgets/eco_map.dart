import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/eco_theme.dart';
import '../services/zone_boundary.dart';

class EcoZoneBoundaries extends StatelessWidget {
  const EcoZoneBoundaries({
    super.key,
    required this.zones,
    this.selectedId,
    this.outside = false,
  });
  final List<Map<String, dynamic>> zones;
  final String? selectedId;
  final bool outside;
  @override
  Widget build(BuildContext context) => PolygonLayer(
    polygons: zones.expand((zone) {
      final boundary = ZoneBoundary.fromZone(zone);
      final selected = zone['id'] == selectedId;
      final color = outside && selected
          ? const Color(0xffb42318)
          : EcoColors.green;
      return (boundary?.polygons ?? []).map(
        (rings) => Polygon(
          points: rings.first,
          holePointsList: rings.skip(1).toList(),
          color: color.withValues(alpha: selected ? .16 : .07),
          borderColor: color,
          borderStrokeWidth: selected ? 3 : 2,
        ),
      );
    }).toList(),
  );
}

class EcoMapTiles extends StatefulWidget {
  const EcoMapTiles({super.key, this.onError});
  final VoidCallback? onError;

  @override
  State<EcoMapTiles> createState() => _EcoMapTilesState();
}

class _EcoMapTilesState extends State<EcoMapTiles> {
  // Keep the HTTP client alive across map rebuilds. TileLayer disposes it
  // when the layer is removed.
  final _provider = NetworkTileProvider();

  @override
  Widget build(BuildContext context) => TileLayer(
    urlTemplate: const String.fromEnvironment(
      'MAP_TILE_URL',
      defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ),
    userAgentPackageName: 'com.ecocycle.ecocycle_mobile',
    tileProvider: _provider,
    maxNativeZoom: 19,
    tileDisplay: const TileDisplay.instantaneous(),
    errorTileCallback: (_, _, _) => widget.onError?.call(),
  );
}

class EcoMapAttribution extends StatelessWidget {
  const EcoMapAttribution({super.key});
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.bottomRight,
    child: Material(
      color: Colors.white.withValues(alpha: .94),
      child: InkWell(
        onTap: () => launchUrl(
          Uri.parse('https://www.openstreetmap.org/copyright'),
          mode: LaunchMode.externalApplication,
        ),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: Text(
            '© OpenStreetMap contributors',
            style: TextStyle(fontSize: 10, color: EcoColors.green),
          ),
        ),
      ),
    ),
  );
}

class EcoMapPin extends StatelessWidget {
  const EcoMapPin({
    super.key,
    required this.label,
    this.color = EcoColors.green,
    this.selected = false,
    this.onTap,
  });
  final String label;
  final Color color;
  final bool selected;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: onTap != null,
    label: 'Stop $label',
    selected: selected,
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(
              color: selected ? EcoColors.celadon : Colors.white,
              width: selected ? 5 : 3,
            ),
            boxShadow: const [
              BoxShadow(color: Color(0x3300563B), blurRadius: 8),
            ],
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 15,
            ),
          ),
        ),
      ),
    ),
  );
}
