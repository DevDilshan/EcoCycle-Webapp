import 'package:ecocycle_mobile/utils/pickup_approval_ui.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('rejected pickups prefer residentMessage over review notes', () {
    final body = residentApprovalBannerBody({
      'hasApprovalRequest': true,
      'approvalStatus': 'Rejected',
      'residentMessage': 'This pickup cannot be approved as submitted.',
      'approvalReviewNotes': 'Internal shorthand',
    });
    expect(body, 'This pickup cannot be approved as submitted.');
  });

  test('badges reflect approval state on the pickup list', () {
    expect(
      residentApprovalBadge({'approvalStatus': 'Pending'}).$1,
      'In review',
    );
    expect(
      residentApprovalBadge({'approvalStatus': 'Rejected'}).$1,
      'Not approved',
    );
  });

  test('banner shows for pending and rejected flagged pickups', () {
    expect(showResidentApprovalBanner({'hasApprovalRequest': true, 'approvalStatus': 'Pending'}), isTrue);
    expect(showResidentApprovalBanner({'hasApprovalRequest': true, 'approvalStatus': 'Rejected'}), isTrue);
    expect(showResidentApprovalBanner({'hasApprovalRequest': false, 'approvalStatus': 'Pending'}), isFalse);
  });
}
