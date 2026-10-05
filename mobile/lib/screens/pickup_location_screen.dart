import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/map_location.dart';
import '../services/zone_boundary.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_map.dart';

class PickupLocationScreen extends StatefulWidget {
  const PickupLocationScreen({
    super.key,
    this.point,
    this.center,
    this.zones = const [],
    this.zoneId,
    this.allowZoneChange = true,
  });
  final LatLng? point, center;
  final List<Map<String, dynamic>> zones;
  final String? zoneId;
  final bool allowZoneChange;
  @override
  State<PickupLocationScreen> createState() => _PickupLocationScreenState();
}

class _PickupLocationScreenState extends State<PickupLocationScreen> {
  final _map = MapController();
  late LatLng? _point = widget.point;
  late String? _zoneId = widget.zoneId;
  Map<String, dynamic>? get _zone =>
      widget.zones.where((z) => z['id'] == _zoneId).firstOrNull;
  ZoneBoundary? get _boundary => ZoneBoundary.fromZone(_zone);
  bool get _outside => _point != null && _boundary?.contains(_point!) == false;

  void _choose(LatLng point) {
    final matches = matchingZones(widget.zones, point);
    setState(() {
      _point = point;
      if (widget.allowZoneChange &&
          matches.length == 1 &&
          _boundary?.contains(point) != true) {
        _zoneId = matches.single['id'] as String;
      }
    });
  }

  void _fitZone() {
    final points = _boundary?.points ?? [];
    if (points.isNotEmpty) {
      _map.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: const EdgeInsets.all(24),
          maxZoom: 16,
        ),
      );
    }
  }

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
      _choose(point);
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
                            onMapReady: _fitZone,
                            onTap: (_, point) => _choose(point),
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
                            EcoZoneBoundaries(
                              zones: _zone == null ? widget.zones : [_zone!],
                              selectedId: _zoneId,
                              outside: _outside,
                            ),
                            MarkerLayer(
                              markers: [
                                if (_point != null)
                                  Marker(
                                    point: _point!,
                                    width: 46,
                                    height: 46,
                                    child: Icon(
                                      Icons.location_pin,
                                      color: _outside
                                          ? const Color(0xffb42318)
                                          : EcoColors.green,
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
                        if (widget.allowZoneChange && widget.zones.isNotEmpty)
                          DropdownButtonFormField<String>(
                            initialValue: _zoneId,
                            key: ValueKey(_zoneId),
                            isExpanded: true,
                            decoration: const InputDecoration(
                              labelText: 'Collection zone',
                            ),
                            items: widget.zones
                                .map(
                                  (z) => DropdownMenuItem<String>(
                                    value: z['id'] as String,
                                    child: Text(
                                      z['name'] as String,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (id) {
                              setState(() => _zoneId = id);
                              _fitZone();
                            },
                          ),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            _outside
                                ? 'This pin is outside ${_zone?['name']}. Move it inside the outline${widget.allowZoneChange ? ' or choose another zone' : ''}.'
                                : _point != null && _boundary != null
                                ? 'Inside ${_zone?['name']}.'
                                : _point != null &&
                                      matchingZones(
                                            widget.zones,
                                            _point!,
                                          ).length >
                                          1
                                ? 'More than one area matches. Choose your collection zone.'
                                : _boundary != null
                                ? 'Tap your entrance inside the collection outline.'
                                : _zone != null
                                ? 'This zone has no saved boundary yet. Its center pin does not define the area.'
                                : 'A unique matching collection area is selected automatically.',
                            style: TextStyle(
                              color: _outside
                                  ? const Color(0xffb42318)
                                  : EcoColors.green,
                              height: 1.5,
                            ),
                          ),
                        ),
                        if (_boundary != null)
                          TextButton.icon(
                            onPressed: _fitZone,
                            icon: const Icon(Icons.fit_screen),
                            label: const Text('Fit collection area'),
                          ),
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
                        Opacity(
                          opacity: _point == null || _outside ? .45 : 1,
                          child: EcoPrimaryButton(
                            label: 'Confirm pickup pin',
                            onPressed: _point == null || _outside
                                ? null
                                : () => Navigator.pop(
                                    context,
                                    PickupLocationChoice(_point!, _zoneId),
                                  ),
                          ),
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
