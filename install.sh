#!/usr/bin/env bash
# claude-sfx installer (POSIX).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/AlexZihaoXu/claude-sfx/main/install.sh | bash
#
# Or with a fork / branch:
#   CLAUDE_SFX_REPO=foo/claude-sfx CLAUDE_SFX_REF=dev \
#     curl -fsSL https://raw.githubusercontent.com/foo/claude-sfx/dev/install.sh | bash

set -euo pipefail

REPO="${CLAUDE_SFX_REPO:-AlexZihaoXu/claude-sfx}"
REF="${CLAUDE_SFX_REF:-main}"

err() { echo "✗ $*" >&2; }
say() { echo "→ $*"; }
ok()  { echo "✓ $*"; }

if ! command -v bun >/dev/null 2>&1; then
  err "bun not found on PATH. Install it from https://bun.sh first."
  exit 1
fi

say "installing claude-sfx from github:$REPO#$REF (global)…"
bun install -g "github:$REPO#$REF"

# Ensure bun's global bin is on PATH for THIS shell so the post-install can
# find claude-sfx-install.
BUN_BIN="${BUN_INSTALL:-$HOME/.bun}/bin"
if [ -d "$BUN_BIN" ] && [[ ":$PATH:" != *":$BUN_BIN:"* ]]; then
  export PATH="$BUN_BIN:$PATH"
fi

if ! command -v claude-sfx-install >/dev/null 2>&1; then
  err "claude-sfx-install not on PATH after install."
  err "Bun's global bin is usually at $BUN_BIN. Add it to your shell rc:"
  err "  export PATH=\"$BUN_BIN:\$PATH\""
  exit 1
fi

say "wiring hooks into ~/.claude/settings.json…"
claude-sfx-install install
ok "done. Restart Claude Code to pick up the hooks."
echo
echo "Uninstall: claude-sfx-uninstall && bun remove -g claude-sfx"
