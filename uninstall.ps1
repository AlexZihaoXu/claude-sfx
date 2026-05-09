# claude-sfx uninstaller (Windows PowerShell).
$ErrorActionPreference = 'Continue'

function Write-Say($msg) { Write-Host "-> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)  { Write-Host "OK $msg" -ForegroundColor Green }

$BunBin = if ($env:BUN_INSTALL) { Join-Path $env:BUN_INSTALL 'bin' } else { Join-Path $env:USERPROFILE '.bun\bin' }
if ((Test-Path $BunBin) -and ($env:PATH -notlike "*$BunBin*")) {
    $env:PATH = "$BunBin;$env:PATH"
}

if (Get-Command claude-sfx-uninstall -ErrorAction SilentlyContinue) {
    Write-Say "removing hooks from ~/.claude/settings.json..."
    claude-sfx-uninstall
}

if (Get-Command bun -ErrorAction SilentlyContinue) {
    Write-Say "removing global package..."
    bun remove -g claude-sfx 2>$null | Out-Null
}

Write-Ok "claude-sfx uninstalled."
Write-Host "  state dir kept at ~/.claude-sfx (logs); remove manually if you want."
