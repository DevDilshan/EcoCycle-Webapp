import 'package:flutter/material.dart';
import '../theme/eco_theme.dart';

/// Bundled catalog paths work offline in Flutter; custom HTTPS images use the network.
class RewardArtwork extends StatelessWidget {
  const RewardArtwork({
    super.key,
    this.imageUrl,
    this.itemName,
    this.size = 72,
  });
  final String? imageUrl;
  final String? itemName;
  final double size;

  static const bundledKeys = {
    'tote',
    'herb-seeds',
    'mobile-reload',
    'toothbrush',
    'water-bottle',
    'grocery-voucher',
    'compost-kit',
    'recycling-bins',
    'utility-voucher',
    'compost-bin',
    'tree',
    'solar-lights',
    'produce-bags',
    'cutlery',
    'notebook',
  };

  @override
  Widget build(BuildContext context) {
    // Older hosted APIs may omit imageUrl. Explicitly removed (empty) images
    // stay removed; only an absent field gets bundled name-matched artwork.
    final url = imageUrl?.trim() ?? _legacyImage(itemName);
    final key = url.startsWith('/images/rewards/') && url.endsWith('.webp')
        ? url.substring('/images/rewards/'.length, url.length - 5)
        : null;
    final uri = Uri.tryParse(url);
    Widget fallback() => const Center(
      child: Icon(Icons.card_giftcard, color: EcoColors.primary, size: 26),
    );
    final Widget image;
    if (key != null && bundledKeys.contains(key)) {
      image = Image.asset(
        'assets/images/rewards/$key.webp',
        fit: BoxFit.contain,
        errorBuilder: (_, error, stack) => fallback(),
      );
    } else if (uri?.scheme == 'https' &&
        uri!.host.isNotEmpty &&
        uri.userInfo.isEmpty) {
      image = Image.network(
        url,
        fit: BoxFit.contain,
        cacheWidth: 512,
        errorBuilder: (_, error, stack) => fallback(),
        loadingBuilder: (_, child, progress) =>
            progress == null ? child : fallback(),
      );
    } else {
      image = fallback();
    }
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: size,
          height: size,
          color: const Color(0xFFF7F6EB),
          child: image,
        ),
      ),
    );
  }

  static String _legacyImage(String? name) {
    final n = (name ?? '').toLowerCase();
    final key = switch (n) {
      _ when n.contains('produce bag') => 'produce-bags',
      _ when n.contains('tote') => 'tote',
      _ when n.contains('seed') => 'herb-seeds',
      _ when n.contains('reload') => 'mobile-reload',
      _ when n.contains('toothbrush') => 'toothbrush',
      _ when n.contains('water bottle') || n.contains('steel bottle') =>
        'water-bottle',
      _ when n.contains('supermarket') || n.contains('grocery') =>
        'grocery-voucher',
      _
          when n.contains('compost') &&
              (n.contains('kit') || n.contains('starter')) =>
        'compost-kit',
      _ when n.contains('compost') => 'compost-bin',
      _ when n.contains('recycling bin') => 'recycling-bins',
      _ when n.contains('utility') => 'utility-voucher',
      _ when n.contains('tree') => 'tree',
      _ when n.contains('solar') => 'solar-lights',
      _ when n.contains('cutlery') => 'cutlery',
      _ when n.contains('notebook') => 'notebook',
      _ => null,
    };
    return key == null ? '' : '/images/rewards/$key.webp';
  }
}
