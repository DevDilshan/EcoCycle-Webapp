#!/usr/bin/env bash
# Fixes common Android emulator DNS failures (Failed host lookup / errno 7).
set -euo pipefail

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
ADB="$SDK/platform-tools/adb"

if [[ ! -x "$ADB" ]]; then
  echo "adb not found. Set ANDROID_HOME to your Android SDK." >&2
  exit 1
fi

"$ADB" wait-for-device
"$ADB" shell settings put global private_dns_mode off
"$ADB" shell settings put global private_dns_specifier ""
"$ADB" shell settings put global airplane_mode_on 0
echo "Emulator DNS settings updated. If sign-in still fails, cold boot the AVD (Device Manager → dropdown → Cold Boot Now)."
