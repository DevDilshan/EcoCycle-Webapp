import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/map_location.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_map.dart';

class PickupLocationScreen extends StatefulWidget {
  const PickupLocationScreen({super.key, this.point, this.center});
  final LatLng? point, center;
  @override
  State<PickupLocationScreen> createState() => _PickupLocationScreenState();
}

class _PickupLocationScreenState extends State<PickupLocationScreen> {
  final _map = MapController();
  late LatLng? _point = widget.point;
  bool _locating = false, _tileFailed = false;
  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      final point = await deviceLocation();
      if (!mounted) return;
      setState(() => _point = point);
      _map.move(point, 18);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  @override
  Widget build(BuildContext context) => EcoScreen(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const EcoBackHeader(title: 'Pickup location'),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(22, 0, 22, 14),
                    child: Text(
                      'Tap your pickup spot on the map. Zoom in to place the pin at your entrance.',
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: EcoColors.body,
                      ),
                    ),
                  ),
                  if (_tileFailed)
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text(
                        'Map tiles unavailable. Try again when you have a connection.',
                      ),
                    ),
                  SizedBox(
                    height: (constraints.maxHeight * .5).clamp(240.0, 420.0),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(22),
                        child: FlutterMap(
                          mapController: _map,
                          options: MapOptions(
                            initialCenter:
                                _point ?? widget.center ?? mapFallback,
                            initialZoom: _point == null ? 14 : 18,
                            onTap: (_, point) => setState(() => _point = point),
                          ),
                          children: [
                            EcoMapTiles(
                              onError: () {
                                if (!_tileFailed && mounted) {
                                  WidgetsBinding.instance.addPostFrameCallback((
                                    _,
                                  ) {
                                    if (mounted) {
                                      setState(() => _tileFailed = true);
                                    }
                                  });
                                }
                              },
                            ),
                            MarkerLayer(
                              markers: [
                                if (_point != null)
                                  Marker(
                                    point: _point!,
                                    width: 46,
                                    height: 46,
                                    child: const Icon(
                                      Icons.location_pin,
                                      color: EcoColors.green,
                                      size: 46,
                                    ),
                                  ),
                              ],
                            ),
                            const EcoMapAttribution(),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Text(
                          _point == null
                              ? 'No pickup pin chosen yet'
                              : '${_point!.latitude.toStringAsFixed(5)}, ${_point!.longitude.toStringAsFixed(5)}',
                        ),
                        TextButton.icon(
                          onPressed: _locating ? null : _locate,
                          icon: const Icon(Icons.my_location),
                          label: Text(
                            _locating ? 'Finding location…' : 'Use my location',
                          ),
                        ),
                        EcoPrimaryButton(
                          label: 'Confirm pickup pin',
                          onPressed: _point == null
                              ? null
                              : () => Navigator.pop(context, _point),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
