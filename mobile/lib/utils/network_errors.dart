import 'dart:io';

/// Short, actionable message for auth/API network failures.
String friendlyNetworkMessage(Object error) {
  final text = error.toString();
  if (error is SocketException ||
      text.contains('SocketException') ||
      text.contains('Failed host lookup')) {
    return 'No network or DNS on this device/emulator.\n\n'
        '• Android emulator: turn off Private DNS (Settings → Network), '
        'cold boot the AVD, or run mobile/scripts/fix_emulator_dns.sh\n'
        '• Confirm the Mac has internet (open your Supabase URL in Safari)\n'
        '• Try a cold boot of the Android emulator or use iOS Simulator';
  }
  return text;
}
