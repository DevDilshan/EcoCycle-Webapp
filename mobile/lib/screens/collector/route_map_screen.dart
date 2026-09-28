import 'package:flutter/material.dart';

import '../../theme/eco_theme.dart';

class RouteMapScreen extends StatelessWidget {
  const RouteMapScreen({super.key, required this.collectorId});

  final String collectorId;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        CustomPaint(painter: _MapGridPainter()),
        Positioned(
          top: 12,
          right: 14,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 10)],
            ),
            child: Text('Zone route', style: ecoMono(color: EcoColors.body)),
          ),
        ),
        const Positioned(top: 74, left: 44, child: _MapPin(number: '7', color: EcoColors.primary)),
        const Positioned(top: 184, left: 200, child: _MapPin(number: '8', color: EcoColors.purple)),
        const Positioned(top: 330, left: 132, child: _MapPin(number: '9', color: EcoColors.danger)),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 20, offset: const Offset(0, -8))],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: const Color(0xFFDBE3DB), borderRadius: BorderRadius.circular(3)),
                ),
                const SizedBox(height: 12),
                const Row(
                  children: [
                    _MapPin(number: '7', color: EcoColors.primary, small: true),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Next stop', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          Text('Recyclables · follow route order', style: TextStyle(fontSize: 12, color: EcoColors.body)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(color: const Color(0xFFEEF3EE), borderRadius: BorderRadius.circular(12)),
                        alignment: Alignment.center,
                        child: const Text('Navigate', style: TextStyle(fontWeight: FontWeight.w700, color: EcoColors.primary)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(color: EcoColors.primary, borderRadius: BorderRadius.circular(12)),
                        alignment: Alignment.center,
                        child: const Text('Open stop', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
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

class _MapPin extends StatelessWidget {
  const _MapPin({required this.number, required this.color, this.small = false});
  final String number;
  final Color color;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final size = small ? 34.0 : 30.0;
    return Transform.rotate(
      angle: -0.785,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(50),
            topRight: Radius.circular(50),
            bottomRight: Radius.circular(50),
          ),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 8)],
        ),
        alignment: Alignment.center,
        child: Transform.rotate(
          angle: 0.785,
          child: Text(number, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: small ? 13 : 12)),
        ),
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), Paint()..color = const Color(0xFFE8EEE6));
    final grid = Paint()..color = const Color(0xFFDFE7DD)..strokeWidth = 1;
    for (var y = 0.0; y < size.height; y += 46) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    for (var x = 0.0; x < size.width; x += 46) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    final road = Paint()..color = const Color(0xFFF4F7F2);
    canvas.drawRect(Rect.fromLTWH(0, 130, size.width, 14), road);
    canvas.drawRect(Rect.fromLTWH(0, 340, size.width, 14), road);
    canvas.drawRect(Rect.fromLTWH(90, 0, 14, size.height), road);
    canvas.drawRect(Rect.fromLTWH(210, 0, 14, size.height), road);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
