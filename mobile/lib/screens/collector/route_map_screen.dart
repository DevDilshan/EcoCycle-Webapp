import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../app/eco_app_scope.dart';
import '../../services/map_location.dart';
import '../../theme/eco_theme.dart';
import '../../widgets/eco_map.dart';
import 'route_screen.dart';
import 'stop_detail_screen.dart';

class RouteMapScreen extends StatefulWidget {
  const RouteMapScreen({super.key, required this.collectorId});
  final String collectorId;
  @override
  State<RouteMapScreen> createState() => RouteMapScreenState();
}

class RouteMapScreenState extends State<RouteMapScreen> {
  final _map = MapController();
  List<Map<String, dynamic>> _stops = [];
  String? _selectedId, _error;
  bool _loading = true, _ready = false, _locating = false, _tileFailed = false;
  LatLng? _location;

  @override
  void initState() {
    super.initState();
    reload();
  }

  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  Future<void> reload() async {
    if (!mounted) return;
    setState(() {
      _loading = _stops.isEmpty;
      _error = null;
    });
    try {
      final data = await EcoAppScope.apiOf(
        context,
      ).get('/routes/${widget.collectorId}/today');
      final rows = (data is List ? data : data['items'] as List? ?? [])
          .cast<Map<String, dynamic>>()
          .map(
            (r) => collectorStop(
              r,
              (r['pickup'] as Map?)?.cast<String, dynamic>(),
            ),
          )
          .toList();
      if (!mounted) return;
      setState(() {
        _stops = rows;
        if (rows.isEmpty) _ready = false;
        if (!rows.any((r) => r['id'] == _selectedId)) {
          _selectedId =
              rows.where((r) => r['completion'] == 'Pending').firstOrNull?['id']
                  as String? ??
              rows.firstOrNull?['id'] as String?;
        }
        _loading = false;
      });
      if (_ready) _fit();
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not load your route. Try again.';
        });
      }
    }
  }

  void _fit() {
    final points = _stops.map(pickupPoint).whereType<LatLng>().toList();
    if (points.isEmpty) return;
    if (points.length == 1) {
      _map.move(points.single, 16);
      return;
    }
    _map.fitCamera(
      CameraFit.bounds(
        bounds: LatLngBounds.fromPoints(points),
        padding: const EdgeInsets.fromLTRB(48, 78, 48, 40),
        maxZoom: 16,
      ),
    );
  }

  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      final location = await deviceLocation();
      if (!mounted) return;
      setState(() => _location = location);
      _map.move(location, 16);
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

  Future<void> _open(Map<String, dynamic> stop) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            StopDetailScreen(stop: stop, stopNumber: _stops.indexOf(stop) + 1),
      ),
    );
    if (changed == true && mounted) await reload();
  }

  Future<void> _navigate(Map<String, dynamic> stop) async {
    final uri = pickupDirections(stop);
    if (uri == null) return;
    try {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open directions. Please try again.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null && _stops.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!),
            TextButton(onPressed: reload, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_stops.isEmpty) {
      return const Center(child: Text('No stops scheduled today.'));
    }
    final selected =
        _stops.where((s) => s['id'] == _selectedId).firstOrNull ?? _stops.first;
    final pinned = _stops.where((s) => pickupPoint(s) != null).length;
    final initialPoints = _stops.map(pickupPoint).whereType<LatLng>().toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '$pinned of ${_stops.length} stops pinned',
                  style: const TextStyle(color: EcoColors.body, fontSize: 12),
                ),
              ),
              IconButton(
                tooltip: 'Refresh route',
                onPressed: reload,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        if (_error != null)
          Text(_error!, style: const TextStyle(color: EcoColors.danger)),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _map,
                    options: MapOptions(
                      initialCenter: pickupPoint(selected) ?? mapFallback,
                      initialZoom: initialPoints.length == 1 ? 16 : 14,
                      initialCameraFit: initialPoints.length > 1
                          ? CameraFit.bounds(
                              bounds: LatLngBounds.fromPoints(initialPoints),
                              padding: const EdgeInsets.fromLTRB(
                                48,
                                78,
                                48,
                                40,
                              ),
                              maxZoom: 16,
                            )
                          : null,
                      onMapReady: () {
                        _ready = true;
                      },
                    ),
                    children: [
                      EcoMapTiles(
                        onError: () {
                          if (!_tileFailed && mounted) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (mounted) setState(() => _tileFailed = true);
                            });
                          }
                        },
                      ),
                      MarkerLayer(
                        markers: [
                          for (var i = 0; i < _stops.length; i++)
                            if (pickupPoint(_stops[i]) case final LatLng point)
                              Marker(
                                point: point,
                                width: 46,
                                height: 46,
                                child: EcoMapPin(
                                  label: '${i + 1}',
                                  selected: _stops[i]['id'] == _selectedId,
                                  color: _stops[i]['completion'] == 'Missed'
                                      ? EcoColors.danger
                                      : _stops[i]['completion'] == 'Completed'
                                      ? EcoColors.body
                                      : EcoColors.green,
                                  onTap: () => setState(
                                    () =>
                                        _selectedId = _stops[i]['id'] as String,
                                  ),
                                ),
                              ),
                          if (_location != null)
                            Marker(
                              point: _location!,
                              width: 24,
                              height: 24,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: EcoColors.blue,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 3,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const EcoMapAttribution(),
                    ],
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: 'Fit all stops',
                            onPressed: _fit,
                            icon: const Icon(Icons.zoom_out_map),
                          ),
                          IconButton(
                            tooltip: 'My location',
                            onPressed: _locating ? null : _locate,
                            icon: Icon(
                              _locating
                                  ? Icons.hourglass_top
                                  : Icons.my_location,
                            ),
                          ),
                          IconButton(
                            tooltip: 'Zoom in',
                            onPressed: () => _map.move(
                              _map.camera.center,
                              (_map.camera.zoom + 1).clamp(2, 19),
                            ),
                            icon: const Icon(Icons.add),
                          ),
                          IconButton(
                            tooltip: 'Zoom out',
                            onPressed: () => _map.move(
                              _map.camera.center,
                              (_map.camera.zoom - 1).clamp(2, 19),
                            ),
                            icon: const Icon(Icons.remove),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_tileFailed || pinned == 0)
                    Positioned(
                      top: 70,
                      left: 10,
                      right: 10,
                      child: Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Text(
                            _tileFailed
                                ? 'Map tiles unavailable. Stop details and directions still work.'
                                : 'These bookings have no pins yet. Use their addresses for directions.',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    for (var i = 0; i < _stops.length; i++)
                      ChoiceChip(
                        label: Text('Stop ${i + 1}'),
                        selected: _selectedId == _stops[i]['id'],
                        onSelected: (_) {
                          setState(
                            () => _selectedId = _stops[i]['id'] as String,
                          );
                          final point = pickupPoint(_stops[i]);
                          if (point != null) _map.move(point, 16);
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  selected['description'] as String? ?? 'Pickup stop',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: EcoColors.green,
                    fontSize: 16,
                  ),
                ),
                Text(selected['address'] as String? ?? 'Address not provided'),
                Text(
                  '${selected['completion']} · ${pickupPoint(selected) == null ? 'Address only · no pin' : 'Pickup pin confirmed'}',
                  style: const TextStyle(color: EcoColors.body, fontSize: 12),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: pickupDirections(selected) == null
                          ? null
                          : () => _navigate(selected),
                      icon: const Icon(Icons.navigation_outlined, size: 18),
                      label: const Text('Directions'),
                    ),
                    OutlinedButton(
                      onPressed: () => _open(selected),
                      child: const Text('Open stop'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
