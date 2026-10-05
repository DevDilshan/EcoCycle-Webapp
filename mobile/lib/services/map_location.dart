import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

const mapFallback = LatLng(6.9271, 79.8612);

LatLng? pickupPoint(Map<String, dynamic> data) {
  final lat = data['latitude'];
  final lng = data['longitude'];
  if (lat is! num ||
      lng is! num ||
      !lat.isFinite ||
      !lng.isFinite ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180) {
    return null;
  }
  return LatLng(lat.toDouble(), lng.toDouble());
}

Uri? pickupDirections(Map<String, dynamic> data) {
  final point = pickupPoint(data);
  final address = (data['address'] as String? ?? '').trim();
  if (point == null && address.isEmpty) return null;
  return Uri.https('www.google.com', '/maps/dir/', {
    'api': '1',
    'destination': point == null
        ? address
        : '${point.latitude},${point.longitude}',
    'travelmode': 'driving',
  });
}

Future<LatLng> deviceLocation() async {
  if (!await Geolocator.isLocationServiceEnabled()) {
    throw Exception('Turn on location services or choose a point on the map.');
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    throw Exception(
      'Location access was denied. You can still choose a point on the map.',
    );
  }
  final location = await Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      timeLimit: Duration(seconds: 15),
    ),
  );
  return LatLng(location.latitude, location.longitude);
}
