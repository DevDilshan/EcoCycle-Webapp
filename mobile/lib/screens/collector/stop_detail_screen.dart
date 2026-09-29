import 'package:flutter/material.dart';

import '../../theme/eco_theme.dart';
import '../../utils/user_helpers.dart';
import '../../widgets/eco_components.dart';

class StopDetailScreen extends StatelessWidget {
  const StopDetailScreen({super.key, required this.stop, required this.stopNumber});

  final Map<String, dynamic> stop;
  final int stopNumber;

  @override
  Widget build(BuildContext context) {
    final id = stop['pickupRequestId'] as String? ?? stop['id'] as String? ?? '';
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EcoBackHeader(
            title: 'Stop $stopNumber · ${stop['address'] ?? 'Address'}',
            subtitle: id.isNotEmpty ? shortPickupId(id) : null,
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const StripedPhotoZone(height: 130, subtitle: "resident's waste photo"),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    children: [
                      StatusBadge(
                        label: stop['category'] as String? ?? 'Recyclable',
                        tone: BadgeTone.category,
                      ),
                      StatusBadge(
                        label: stop['status'] as String? ?? 'Scheduled',
                        tone: BadgeTone.scheduled,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: EcoColors.cardBorder),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        _Row(label: 'Resident', value: stop['residentName'] as String? ?? '—'),
                        _Row(label: 'Items', value: stop['description'] as String? ?? '—'),
                        _Row(label: 'Window', value: stop['timeWindow'] as String? ?? '8–11 AM'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                      foregroundColor: EcoColors.danger,
                      side: const BorderSide(color: EcoColors.danger, width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Flag issue', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: EcoPrimaryButton(label: '✓ Mark collected', onPressed: () => Navigator.pop(context)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: ecoMono(color: EcoColors.monoMuted)),
          Flexible(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
        ],
      ),
    );
  }
}
