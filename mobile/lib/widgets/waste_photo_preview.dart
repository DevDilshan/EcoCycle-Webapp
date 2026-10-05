import 'dart:io';
import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';

import '../theme/eco_theme.dart';
import 'eco_components.dart';

/// Shows a remote/local waste photo or the striped placeholder.
class WastePhotoPreview extends StatelessWidget {
  const WastePhotoPreview({
    super.key,
    this.photoUrl,
    this.localPath,
    this.height = 130,
    this.subtitle = 'waste photo',
    this.onTap,
    this.title,
  });

  final String? photoUrl;
  final String? localPath;
  final double height;
  final String? subtitle;
  final String? title;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final radius = title != null ? 20.0 : 16.0;
    final image = _buildImage();
    if (image == null) {
      return StripedPhotoZone(
        height: height,
        title: title,
        subtitle: subtitle,
        onTap: onTap,
      );
    }

    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              image,
              if (subtitle != null)
                Positioned(
                  left: 10,
                  bottom: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      subtitle!,
                      style: ecoMono(size: 10, color: EcoColors.ivory),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget? _buildImage() {
    if (localPath != null && localPath!.isNotEmpty) {
      if (kIsWeb) {
        return Image.network(
          localPath!,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        );
      }
      return Image.file(
        File(localPath!),
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
      );
    }
    final url = photoUrl?.trim();
    if (url == null || url.isEmpty) return null;
    return Image.network(
      url,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return Container(
          color: EcoColors.honeydew,
          alignment: Alignment.center,
          child: const CircularProgressIndicator(
            color: EcoColors.green,
            strokeWidth: 2,
          ),
        );
      },
      errorBuilder: (_, __, ___) => Container(
        color: EcoColors.honeydew,
        alignment: Alignment.center,
        child: const Text(
          'Photo unavailable',
          style: TextStyle(fontSize: 13, color: EcoColors.body),
        ),
      ),
    );
  }
}
