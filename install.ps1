# claude-sfx installer (Windows PowerShell).
#
# Usage:
#   irm https://raw.githubusercontent.com/AlexZihaoXu/claude-sfx/main/install.ps1 | iex
#
# Or with a fork / branch:
#   $env:CLAUDE_SFX_REPO = 'foo/claude-sfx'
#   $env:CLAUDE_SFX_REF  = 'dev'
#   irm https://raw.githubusercontent.com/foo/claude-sfx/dev/install.ps1 | iex

$ErrorActionPreference = 'Stop'

function Write-Err($msg) { Write-Host "X $msg" -ForegroundColor Red }
function Write-Say($msg) { Write-Host "-> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)  { Write-Host "OK $msg" -ForegroundColor Green }

$Repo = if ($env:CLAUDE_SFX_REPO) { $env:CLAUDE_SFX_REPO } else { 'AlexZihaoXu/claude-sfx' }
$Ref  = if ($env:CLAUDE_SFX_REF)  { $env:CLAUDE_SFX_REF }  else { 'main' }

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Err "bun not found on PATH. Install it from https://bun.sh first."
    exit 1
}

Write-Say "installing claude-sfx from github:$Repo#$Ref (global)..."
bun install -g "github:$Repo#$Ref"
if ($LASTEXITCODE -ne 0) { Write-Err "bun install failed."; exit $LASTEXITCODE }

# Ensure bun global bin is on PATH for this shell.
$BunBin = if ($env:BUN_INSTALL) { Join-Path $env:BUN_INSTALL 'bin' } else { Join-Path $env:USERPROFILE '.bun\bin' }
if ((Test-Path $BunBin) -and ($env:PATH -notlike "*$BunBin*")) {
    $env:PATH = "$BunBin;$env:PATH"
}

if (-not (Get-Command claude-sfx-install -ErrorAction SilentlyContinue)) {
    Write-Err "claude-sfx-install not on PATH after install."
    Write-Err "Bun's global bin is usually at $BunBin. Add it to PATH and re-run."
    exit 1
}

Write-Say "wiring hooks into ~/.claude/settings.json..."
claude-sfx-install install
Write-Ok "done. Restart Claude Code to pick up the hooks."
Write-Host ""
Write-Host "Uninstall: claude-sfx-uninstall ; bun remove -g claude-sfx"
