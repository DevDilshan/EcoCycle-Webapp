import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

/// True for emulator DNS issues or unreachable Supabase host during auth refresh.
bool isRecoverableAuthNetworkError(Object error) {
  if (error is AuthRetryableFetchException) return true;
  final text = error.toString();
  return error is SocketException ||
      text.contains('SocketException') ||
      text.contains('Failed host lookup') ||
      text.contains('AuthRetryableFetchException');
}

/// Short, actionable message for auth/API network failures.
String friendlyNetworkMessage(Object error) {
  final text = error.toString();
  if (isRecoverableAuthNetworkError(error)) {
    if (text.contains('Failed host lookup')) {
      return 'Cannot reach Supabase (DNS / wrong project URL).\n\n'
          '• In mobile/.env, SUPABASE_URL must match your project '
          '(same as VITE_SUPABASE_URL on web)\n'
          '• Uninstall the app or clear storage to drop an old session\n'
          '• Emulator: run mobile/scripts/fix_emulator_dns.sh, then cold boot the AVD';
    }
    return 'No network on this device/emulator.\n\n'
        '• Android emulator: turn off Private DNS, cold boot the AVD, '
        'or run mobile/scripts/fix_emulator_dns.sh\n'
        '• Confirm the Mac has internet (open your Supabase URL in Safari)';
  }
  return text;
}
