import 'package:flutter/material.dart';

import '../../services/api.dart';
import '../../services/pickup_photo_service.dart';
import '../../theme/eco_theme.dart';
import '../../utils/user_helpers.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/waste_photo_preview.dart';

class StopDetailScreen extends StatefulWidget {
  const StopDetailScreen({super.key, required this.stop, required this.stopNumber});

  final Map<String, dynamic> stop;
  final int stopNumber;

  @override
  State<StopDetailScreen> createState() => _StopDetailScreenState();
}

class _StopDetailScreenState extends State<StopDetailScreen> {
  final _api = Api();
  String? _photoUrl;

  @override
  void initState() {
    super.initState();
    _photoUrl = pickupPhotoUrl(widget.stop);
    _loadPhotoIfNeeded();
  }

  Future<void> _loadPhotoIfNeeded() async {
    if (_photoUrl != null) return;
    final id = widget.stop['pickupRequestId'] as String? ?? widget.stop['id'] as String? ?? '';
    if (id.isEmpty) return;
    try {
      final json = await _api.get('/pickuprequests/$id');
      if (!mounted) return;
      setState(() => _photoUrl = pickupPhotoUrl(json as Map<String, dynamic>));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final stop = widget.stop;
    final id = stop['pickupRequestId'] as String? ?? stop['id'] as String? ?? '';
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EcoBackHeader(
            title: 'Stop ${widget.stopNumber} · ${stop['address'] ?? 'Address'}',
            subtitle: id.isNotEmpty ? shortPickupId(id) : null,
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  WastePhotoPreview(
                    height: 130,
                    subtitle: "resident's waste photo",
                    photoUrl: _photoUrl,
                  ),
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
                  child: EcoPrimaryButton(
                    label: '✓ Mark collected',
                    onPressed: () => Navigator.pop(context),
                  ),
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
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
