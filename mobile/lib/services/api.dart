import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

class Api {
  Api({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    return _send('GET', path, query: query);
  }

  Future<dynamic> post(String path, {Object? body}) async {
    return _send('POST', path, body: body);
  }

  Future<dynamic> put(String path, {Object? body}) async {
    return _send('PUT', path, body: body);
  }

  Future<dynamic> delete(String path) async {
    return _send('DELETE', path);
  }

  Future<dynamic> _send(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
  }) async {
    final token = Supabase.instance.client.auth.currentSession?.accessToken;
    if (token == null || token.isEmpty) {
      throw Exception('Not signed in');
    }

    final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final normalized = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$base$normalized').replace(queryParameters: query);

    final headers = {
      'Authorization': 'Bearer $token',
      if (body != null) 'Content-Type': 'application/json',
    };

    late http.Response response;
    switch (method) {
      case 'POST':
        response = await _client.post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      case 'PUT':
        response = await _client.put(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      case 'DELETE':
        response = await _client.delete(uri, headers: headers);
      default:
        response = await _client.get(uri, headers: headers);
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.statusCode == 204 || response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }

    String? serverMessage;
    try {
      final err = jsonDecode(response.body) as Map<String, dynamic>;
      serverMessage = (err['message'] ?? err['title']) as String?;
      final errors = err['errors'];
      if (errors is Map && errors.isNotEmpty) {
        final first = errors.values.first;
        if (first is List && first.isNotEmpty) serverMessage = first.first.toString();
      }
    } catch (_) {
      // Body was not JSON; fall through to the generic message.
    }
    throw Exception(serverMessage ?? 'Request failed (${response.statusCode})');
  }
}
