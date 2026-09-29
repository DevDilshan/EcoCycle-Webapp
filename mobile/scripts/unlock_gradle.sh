#!/usr/bin/env bash
# Clears a stuck Gradle buildLogic lock (Timeout waiting to lock build logic queue).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$ROOT/android/.gradle/noVersion/buildLogic.lock"

echo "Stopping Gradle daemons…"
pkill -f 'GradleDaemon' 2>/dev/null || true
pkill -f 'kotlin-compiler-daemon' 2>/dev/null || true

if [[ -f "$LOCK" ]]; then
  rm -f "$LOCK"
  echo "Removed $LOCK"
else
  echo "No lock file at $LOCK"
fi

echo "Done. Run: cd mobile && flutter run"
