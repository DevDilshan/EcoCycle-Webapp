import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  static const hostedApiBaseUrl = 'https://ecocycle-webapp.onrender.com/api';

  static String get supabaseUrl => dotenv.env['SUPABASE_URL'] ?? '';
  static String get supabaseAnonKey => dotenv.env['SUPABASE_ANON_KEY'] ?? '';

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
  }
}
