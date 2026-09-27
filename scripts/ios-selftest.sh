#!/usr/bin/env bash
# Runs the self-test build (VITE_AURORA_SELFTEST=1, see src/mobile/selftest.ts)
# in an iPhone Simulator: screenshots at fixed moments, then sends the app to
# the background (by opening Settings) to check the music keeps playing.
# Everything lands in selftest/ for the workflow to upload.
#   usage: scripts/ios-selftest.sh <path/to/App.app>
set -uo pipefail
APP=${1:?usage: ios-selftest.sh <App.app>}
BUNDLE=com.devopsmonk.aurora
OUT=selftest
mkdir -p "$OUT"

DEVICE=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
phones = [d for runtime, ds in devices.items() if "iOS" in runtime for d in ds if d["name"].startswith("iPhone")]
print(phones[-1]["udid"] if phones else "")')
[ -n "$DEVICE" ] || { echo "No iPhone simulator available"; xcrun simctl list devices; exit 1; }
xcrun simctl list devices | grep "$DEVICE"
xcrun simctl boot "$DEVICE" || true
xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl install "$DEVICE" "$APP"

xcrun simctl launch --console-pty "$DEVICE" "$BUNDLE" > "$OUT/console.log" 2>&1 &
CONSOLE=$!
shot() { xcrun simctl io "$DEVICE" screenshot "$OUT/$1.png" >/dev/null 2>&1 || true; }

sleep 45; shot 1-home
sleep 20; shot 2-nowplaying      # the self-test opens Now Playing at 55 s
sleep 15; shot 3-lyrics          # and the lyrics at 70 s
xcrun simctl launch "$DEVICE" com.apple.Preferences >/dev/null   # app to the background
sleep 45; shot 4-background
xcrun simctl launch "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true  # and back
sleep 10; shot 5-returned

kill "$CONSOLE" 2>/dev/null || true
grep -a "AURORA_SELFTEST" "$OUT/console.log" | sed 's/.*AURORA_SELFTEST //' > "$OUT/results.jsonl" || true
echo "── Self-test results ──"
cat "$OUT/results.jsonl"
grep -q '"step":"done","ok":true' "$OUT/results.jsonl"
