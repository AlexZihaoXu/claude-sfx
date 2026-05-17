#!/usr/bin/env bun
// Universal sound player. Usage: claude-sfx-play finish|notify|pending|clear
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync, spawn } = require("child_process");

const sound = process.argv[2];
const here = __dirname;
const assets = path.join(here, "..", "assets");
const files = {
  finish: path.join(assets, "finish.wav"),
  notify: path.join(assets, "notify.wav"),
};

// State (lock + log) lives in a per-user dir, NOT next to the bin script —
// the bin script may live inside a global node_modules and shouldn't be
// written to.
const stateDir = path.join(os.homedir(), ".claude-sfx");
try {
  fs.mkdirSync(stateDir, { recursive: true });
} catch (_) {}
const logPath = path.join(stateDir, "sfx.log");
const finishLockPath = path.join(stateDir, "finish.lock");
const permissionLockPath = path.join(stateDir, "permission.lock");

// Trailing-edge debounce: rapid Stop events collapse to a single chime.
// Also incidentally lets the UI finish rendering (markdown, suggestions,
// post-turn work) before the chime — Stop fires when the model signals
// completion, not when the UI settles.
const FINISH_DEBOUNCE_MS = 1500;
// PermissionRequest fires only when a tool needs a real permission
// decision (allow-rule auto-approvals are silent). We still defer the
// chime via a detached worker so the hook returns immediately and rapid
// prompts collapse to a single sound (only one worker wins the atomic
// unlinkSync). Also gives a future PreToolUse "clear" hook a window to
// suppress sounds for session-scope auto-resolutions.
const PERMISSION_PENDING_DELAY_MS = 300;

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

function play(file) {
  if (!file || !fs.existsSync(file)) return;
  const env = { ...process.env, SFX_FILE: file };
  const opts = { stdio: "ignore", env };
  const tryRun = (cmd, args) => {
    const r = spawnSync(cmd, args, opts);
    return !r.error && r.status === 0;
  };
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
  switch (sound) {
    case "finish": {
      const myStamp = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}`;
      try {
        fs.writeFileSync(finishLockPath, myStamp);
      } catch (_) {}
      await new Promise((r) => setTimeout(r, FINISH_DEBOUNCE_MS));
      let current = "";
      try {
        current = fs.readFileSync(finishLockPath, "utf8");
      } catch (_) {}
      if (current !== myStamp) {
        log(
          `${new Date().toISOString()} sound=finish event=Stop suppressed=debounce`,
        );
        return;
      }
      play(files.finish);
      return;
    }

    case "notify": {
      play(files.notify);
      return;
    }

    case "pending": {
      // Initial hook invocation: arm the lock and spawn a detached worker
      // that will play the sound after the delay IF the lock survives.
      // We exit immediately so the hook doesn't block Claude Code.
      if (!process.env.CLAUDE_SFX_WORKER) {
        try {
          fs.writeFileSync(permissionLockPath, String(Date.now()));
        } catch (_) {}
        const workerEnv = { ...process.env, CLAUDE_SFX_WORKER: "pending" };
        const worker = spawn(process.execPath, [__filename, "pending"], {
          detached: true,
          stdio: "ignore",
          env: workerEnv,
        });
        worker.unref();
        return;
      }
      // Worker mode: wait, then atomically claim the lock and play.
      // Atomic unlink ensures only one worker plays if multiple are racing.
      await new Promise((r) => setTimeout(r, PERMISSION_PENDING_DELAY_MS));
      try {
        fs.unlinkSync(permissionLockPath);
      } catch (_) {
        // ENOENT — PreToolUse cleared it (auto-approved) or another worker
        // already played. Either way, stay silent.
        return;
      }
      play(files.notify);
      return;
    }

    case "clear": {
      // PreToolUse fires after permission resolves. If we get here, the
      // tool is about to run — so cancel any pending permission sound.
      try {
        fs.unlinkSync(permissionLockPath);
      } catch (_) {}
      return;
    }

    default:
      return;
  }
}

main();
