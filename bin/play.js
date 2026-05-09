#!/usr/bin/env bun
// Universal sound player. Usage: claude-sfx-play finish|notify
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");

const sound = process.argv[2];
const here = __dirname;
const assets = path.join(here, "..", "assets");
const files = {
  finish: path.join(assets, "finish.wav"),
  notify: path.join(assets, "notify.wav"),
};
const file = files[sound];

// State (lock + log) lives in a per-user dir, NOT next to the bin script —
// the bin script may live inside a global node_modules and shouldn't be
// written to.
const stateDir = path.join(os.homedir(), ".claude-sfx");
try {
  fs.mkdirSync(stateDir, { recursive: true });
} catch (_) {}
const logPath = path.join(stateDir, "sfx.log");
const lockPath = path.join(stateDir, "finish.lock");

// Trailing-edge debounce: rapid Stop events collapse to a single chime.
const FINISH_DEBOUNCE_MS = 1000;

let event = null;
try {
  if (!process.stdin.isTTY) {
    const raw = fs.readFileSync(0, "utf8");
    if (raw.trim()) event = JSON.parse(raw);
  }
} catch (_) {}

function log(line) {
  if (process.env.CLAUDE_SFX_LOG === "0") return;
  try {
    fs.appendFileSync(logPath, line + "\n");
  } catch (_) {}
}

log(
  `${new Date().toISOString()} sound=${sound} event=${event?.hook_event_name ?? "?"} ${event ? JSON.stringify(event) : "{}"}`,
);

if (!file || !fs.existsSync(file)) process.exit(0);

const env = { ...process.env, SFX_FILE: file };
const opts = { stdio: "ignore", env };

function tryRun(cmd, args) {
  const r = spawnSync(cmd, args, opts);
  return !r.error && r.status === 0;
}

function playNow() {
  switch (process.platform) {
    case "win32":
      spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          "(New-Object Media.SoundPlayer $env:SFX_FILE).PlaySync()",
        ],
        opts,
      );
      break;
    case "darwin":
      spawnSync("afplay", [file], opts);
      break;
    default:
      if (
        !tryRun("paplay", [file]) &&
        !tryRun("aplay", ["-q", file]) &&
        !tryRun("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", file])
      ) {
        process.stdout.write("\x07");
      }
  }
}

async function main() {
  if (sound === "finish") {
    const myStamp = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}`;
    try {
      fs.writeFileSync(lockPath, myStamp);
    } catch (_) {}
    await new Promise((r) => setTimeout(r, FINISH_DEBOUNCE_MS));
    let current = "";
    try {
      current = fs.readFileSync(lockPath, "utf8");
    } catch (_) {}
    if (current !== myStamp) {
      log(
        `${new Date().toISOString()} sound=finish event=Stop suppressed=debounce`,
      );
      return;
    }
  }
  playNow();
}

main();
