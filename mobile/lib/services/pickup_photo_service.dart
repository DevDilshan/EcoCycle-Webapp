import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

/// Uploads pickup waste photos to Supabase Storage and returns a public URL
/// stored on the pickup request as `photoUrl`.
class PickupPhotoService {
  static Future<String> upload(XFile file) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      throw Exception('Not signed in');
    }

    final bucket = AppConfig.pickupPhotoBucket;
    final bytes = await file.readAsBytes();
    final ext = _extension(file.path);
    final path = '${user.id}/${DateTime.now().millisecondsSinceEpoch}.$ext';

    await Supabase.instance.client.storage.from(bucket).uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(
            contentType: _contentType(ext),
            upsert: false,
          ),
        );

    return Supabase.instance.client.storage.from(bucket).getPublicUrl(path);
  }

  static String _extension(String path) {
    final dot = path.lastIndexOf('.');
    if (dot <= 0 || dot >= path.length - 1) return 'jpg';
    final ext = path.substring(dot + 1).toLowerCase();
    if (ext == 'jpeg') return 'jpg';
    return ext.length <= 5 ? ext : 'jpg';
  }

  static String _contentType(String ext) {
    return switch (ext) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      'heic' => 'image/heic',
      _ => 'image/jpeg',
    };
  }
}

String? pickupPhotoUrl(Map<String, dynamic> pickup) {
  final raw = pickup['photoUrl'] as String?;
  if (raw == null || raw.trim().isEmpty) return null;
  return raw.trim();
}
