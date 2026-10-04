import 'package:flutter/material.dart';

import '../theme/eco_theme.dart';
import '../services/pickup_photo_service.dart';
import '../utils/pickup_approval_ui.dart';
import '../widgets/eco_components.dart';
import '../widgets/resident_approval_banner.dart';
import '../widgets/waste_photo_preview.dart';

class PickupSubmittedScreen extends StatelessWidget {
  const PickupSubmittedScreen({
    super.key,
    required this.pickup,
    this.localPhotoPath,
  });

  final Map<String, dynamic> pickup;
  final String? localPhotoPath;

  @override
  Widget build(BuildContext context) {
    final category = pickup['category'] as String? ?? 'Pending';
    var confidence = (pickup['confidence'] as num?)?.toDouble();
    if (confidence != null && confidence > 1) confidence = confidence / 100;
    final reasoning =
        pickup['reasoning'] as String? ??
        'Your request is queued for AI classification.';

    // A flagged pickup is not routed to a collector until an admin decides, so
    // the heading and the next-step line below cannot promise that it will be.
    final needsReview = showResidentApprovalBanner(pickup);

    return EcoScreen(
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 24, 22, 24),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: const BoxDecoration(
                      color: EcoColors.mintBg,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.check_rounded,
                      size: 32,
                      color: EcoColors.green,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Request submitted',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    needsReview
                        ? 'Classified, and sent to the team for a decision'
                        : 'Your photo has been assessed for collection',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      color: EcoColors.body,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ResidentApprovalBanner(pickup: pickup),
                  WastePhotoPreview(
                    height: 120,
                    subtitle: 'waste photo',
                    photoUrl: pickupPhotoUrl(pickup),
                    localPath: localPhotoPath,
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: EcoColors.cardBorder),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Wrap(
                          alignment: WrapAlignment.spaceBetween,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 12,
                          runSpacing: 8,
                          children: [
                            const Text(
                              'Category',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: EcoColors.body,
                              ),
                            ),
                            StatusBadge(
                              label: category,
                              tone: BadgeTone.category,
                            ),
                          ],
                        ),
                        if (confidence != null) ...[
                          const SizedBox(height: 16),
                          const Text(
                            'Confidence',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: EcoColors.body,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(999),
                                  child: LinearProgressIndicator(
                                    value: confidence.clamp(0, 1),
                                    minHeight: 8,
                                    backgroundColor: const Color(0xFFEEF3EE),
                                    color: EcoColors.primary,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                '${(confidence * 100).round()}%',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: EcoColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 16),
                        const Text(
                          'Assessment notes',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: EcoColors.body,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          reasoning,
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.5,
                            color: EcoColors.label,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: EcoColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          needsReview
                              ? 'Next: an admin reviews this request'
                              : 'Next: we arrange your collection',
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.5,
                            color: EcoColors.body,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
            child: EcoPrimaryButton(
              label: 'Track request',
              onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
            ),
          ),
        ],
      ),
    );
  }
}
