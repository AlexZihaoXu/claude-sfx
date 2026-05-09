#!/usr/bin/env bash
# claude-sfx uninstaller (POSIX).
set -euo pipefail
err() { echo "✗ $*" >&2; }
say() { echo "→ $*"; }
ok()  { echo "✓ $*"; }

BUN_BIN="${BUN_INSTALL:-$HOME/.bun}/bin"
if [ -d "$BUN_BIN" ] && [[ ":$PATH:" != *":$BUN_BIN:"* ]]; then
  export PATH="$BUN_BIN:$PATH"
fi

if command -v claude-sfx-uninstall >/dev/null 2>&1; then
  say "removing hooks from ~/.claude/settings.json…"
  claude-sfx-uninstall
fi

if command -v bun >/dev/null 2>&1; then
  say "removing global package…"
  bun remove -g claude-sfx 2>/dev/null || true
fi

ok "claude-sfx uninstalled."
echo "  state dir kept at ~/.claude-sfx (logs); remove manually if you want."
