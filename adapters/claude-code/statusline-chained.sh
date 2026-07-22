#!/usr/bin/env bash
# Chained statusline: feed BOTH the ulanzi-lab broker (silent) and the user's
# original statusline (for the displayed line) from one stdin payload.
#
# settings.json -> statusLine.command should point here. The user's original
# script path and node path are baked in at install time by install.mjs.
set -euo pipefail

ORIGINAL="${ULANZI_ORIGINAL_STATUSLINE:-}"
NODE_BIN="${ULANZI_NODE_BIN:-node}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

input="$(cat)"

# 1) Mirror session state into the broker (never let it affect the display).
printf '%s' "$input" | "$NODE_BIN" "$HERE/statusline.mjs" >/dev/null 2>&1 || true

# 2) Produce the actual status line from the user's original script (if any).
if [ -n "$ORIGINAL" ] && [ -f "$ORIGINAL" ]; then
  printf '%s' "$input" | bash "$ORIGINAL"
fi
