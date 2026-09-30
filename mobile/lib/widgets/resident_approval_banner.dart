import 'package:intl/intl.dart';

import '../theme/eco_theme.dart';
import '../utils/pickup_approval_ui.dart';

class ResidentApprovalBanner extends StatelessWidget {
  const ResidentApprovalBanner({super.key, required this.pickup});

  final Map<String, dynamic> pickup;

  @override
  Widget build(BuildContext context) {
    if (!showResidentApprovalBanner(pickup)) {
      return const SizedBox.shrink();
    }

    final approval = pickupApprovalStatus(pickup)?.toLowerCase();
    final isRejected = approval == 'rejected';
    final flag = (pickup['flagReason'] as String?)?.trim();
    final reviewedAt = pickup['approvalReviewedAt'] as String?;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isRejected ? EcoColors.dangerBg : const Color(0xFFF5ECD6),
        border: Border.all(
          color: isRejected ? EcoColors.danger.withValues(alpha: 0.35) : EcoColors.border,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            residentApprovalBannerTitle(pickup),
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isRejected ? EcoColors.danger : EcoColors.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            residentApprovalBannerBody(pickup),
            style: TextStyle(
              fontSize: 13,
              height: 1.45,
              color: isRejected ? EcoColors.label : EcoColors.body,
            ),
          ),
          if (isRejected && flag != null && flag.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Originally flagged: $flag',
              style: ecoMono(size: 10, color: EcoColors.body),
            ),
          ],
          if (reviewedAt != null && reviewedAt.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Reviewed ${_formatDate(reviewedAt)}',
              style: ecoMono(size: 10, color: EcoColors.body),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    final date = DateTime.tryParse(iso);
    if (date == null) return iso;
    return DateFormat('d MMM yyyy').format(date.toLocal());
  }
}
