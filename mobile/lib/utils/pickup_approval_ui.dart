import '../widgets/eco_components.dart';

String? pickupApprovalStatus(Map<String, dynamic> pickup) {
  final raw = pickup['approvalStatus'];
  if (raw == null) return null;
  return raw.toString();
}

/// List/detail badge when a pickup has an approval record.
(String label, BadgeTone tone) residentApprovalBadge(Map<String, dynamic> pickup) {
  final approval = pickupApprovalStatus(pickup)?.toLowerCase();
  if (approval == 'rejected') {
    return ('Not approved', BadgeTone.pendingApproval);
  }
  if (approval == 'pending') {
    return ('In review', BadgeTone.pendingApproval);
  }
  if (approval == 'approved') {
    return ('Approved', BadgeTone.scheduled);
  }
  return ('In review', BadgeTone.pendingApproval);
}

bool showResidentApprovalBanner(Map<String, dynamic> pickup) {
  if (pickup['hasApprovalRequest'] != true) return false;
  final approval = pickupApprovalStatus(pickup)?.toLowerCase();
  if (approval == 'rejected' || approval == 'pending') return true;
  // An approval with nothing written on it says no more than the badge already
  // does, so it is not shown -- as on web, where the notice needs reviewNotes.
  if (approval == 'approved') {
    return (pickup['approvalReviewNotes'] as String?)?.trim().isNotEmpty == true;
  }
  return false;
}

String residentApprovalBannerTitle(Map<String, dynamic> pickup) {
  final approval = pickupApprovalStatus(pickup)?.toLowerCase();
  return switch (approval) {
    'rejected' => 'Pickup not approved',
    'approved' => 'Admin approved your pickup',
    _ => 'Waiting for admin review',
  };
}

String residentApprovalBannerBody(Map<String, dynamic> pickup) {
  final approval = pickupApprovalStatus(pickup)?.toLowerCase();
  final notes = (pickup['approvalReviewNotes'] as String?)?.trim();
  final flag = (pickup['flagReason'] as String?)?.trim();

  if (approval == 'rejected') {
    final resident = (pickup['residentMessage'] as String?)?.trim();
    if (resident != null && resident.isNotEmpty) return resident;
    return notes?.isNotEmpty == true
        ? notes!
        : 'This request was reviewed and cannot be scheduled as submitted.';
  }
  if (approval == 'approved') {
    return notes?.isNotEmpty == true
        ? notes!
        : 'Your request passed review and is being scheduled.';
  }
  return flag?.isNotEmpty == true
      ? flag!
      : 'Your pickup was flagged and is waiting for a team decision.';
}
