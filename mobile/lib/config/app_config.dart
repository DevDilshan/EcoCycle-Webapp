import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  static const hostedApiBaseUrl = 'https://ecocycle-webapp.onrender.com/api';

  static String get supabaseUrl => dotenv.env['SUPABASE_URL'] ?? '';
  static String get supabaseAnonKey => dotenv.env['SUPABASE_ANON_KEY'] ?? '';

  /// Public Supabase Storage bucket for resident pickup photos.
  static String get pickupPhotoBucket =>
      dotenv.env['SUPABASE_PICKUP_BUCKET'] ?? 'pickup-photos';

  /// Set `API_BASE_URL` in `.env` to override (e.g. local dotnet on :5051).
  static String get apiBaseUrl {
    final fromEnv = dotenv.env['API_BASE_URL'];
    if (fromEnv != null && fromEnv.isNotEmpty) {
      return fromEnv.replaceAll(RegExp(r'/+$'), '');
    }
    return hostedApiBaseUrl;
  }

  static void assertConfigured() {
    if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
      throw StateError('Set SUPABASE_URL and SUPABASE_ANON_KEY in mobile/.env');
    }
    assertSupabaseUrlMatchesAnonKey();
  }

  /// Anon JWT `ref` must match the hostname in [supabaseUrl] (catches typos / old projects).
  static void assertSupabaseUrlMatchesAnonKey() {
    final ref = _projectRefFromAnonKey(supabaseAnonKey);
    if (ref == null) return;
    final host = Uri.tryParse(supabaseUrl)?.host ?? '';
    if (!host.contains(ref)) {
      throw StateError(
        'SUPABASE_URL must include project ref "$ref" from SUPABASE_ANON_KEY. '
        'Got: $supabaseUrl',
      );
    }
  }

  static String? _projectRefFromAnonKey(String anonKey) {
    try {
      final parts = anonKey.split('.');
      if (parts.length < 2) return null;
      final normalized = base64Url.normalize(parts[1]);
      final payload = jsonDecode(utf8.decode(base64Url.decode(normalized))) as Map<String, dynamic>;
      return payload['ref'] as String?;
    } catch (_) {
      return null;
    }
  }
}
