#!/usr/bin/env bun
// Wires claude-sfx hooks into ~/.claude/settings.json. Idempotent.
// Usage: claude-sfx-install [install|uninstall]
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const here = __dirname;
const localPlayPath = path.join(here, "play.js");
const settingsDir = path.join(os.homedir(), ".claude");
const settingsPath = path.join(settingsDir, "settings.json");

// Hook entries we install. `matcher` is only meaningful for PreToolUse —
// it scopes the hook to a single tool name so we don't fire on every call.
//
// PreToolUse:AskUserQuestion chimes on the built-in AskUserQuestion tool —
// it's a normal tool call, not an MCP Elicitation, so neither Notification
// nor Elicitation fires for it.
//
// PermissionRequest only fires when a tool actually needs a permission
// decision (anything in permissions.allow never fires it). The `pending`
// hook arms a lock, spawns a detached worker that waits ~300ms, then plays
// notify — async so the hook itself doesn't block Claude Code. The
// unmatched PreToolUse `clear` hook deletes any stale lock left by a
// crashed worker (defensive cleanup, normally a no-op).
const EVENTS = [
  { event: "Stop", sound: "finish" },
  { event: "Notification", sound: "notify" },
  { event: "Elicitation", sound: "notify" },
  { event: "PreToolUse", sound: "notify", matcher: "AskUserQuestion" },
  { event: "PermissionRequest", sound: "pending" },
  { event: "PreToolUse", sound: "clear" },
];

// Marker substring written into every hook command we own. Matched on
// uninstall and on re-install (to dedupe). Survives the package being moved.
const MARKER = "#claude-sfx";

function q(s) {
  return `"${String(s).replace(/"/g, '\\"')}"`;
}

// Prefer the PATH-based bin if `bun install -g` made it available — it
// survives the package being moved and reads as a plain command. Fall back
// to invoking play.js directly through the current runtime for local-dev /
// from-source installs.
function resolvePlayCommand() {
  const probe = process.platform === "win32" ? "where" : "command -v";
  try {
    execSync(`${probe} claude-sfx-play`, { stdio: "ignore" });
    return "claude-sfx-play";
  } catch (_) {
    return `${q(process.execPath)} ${q(localPlayPath)}`;
  }
}

function buildCommand(playCmd, sound) {
  return `${playCmd} ${sound} ${MARKER}`;
}

function isOurs(entry) {
  return (
    entry &&
    typeof entry.command === "string" &&
    entry.command.includes(MARKER)
  );
}

function readSettings() {
  if (!fs.existsSync(settingsPath)) return {};
  const raw = fs.readFileSync(settingsPath, "utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`✗ cannot parse ${settingsPath}: ${e.message}`);
    process.exit(1);
  }
}

function writeSettings(s) {
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n");
}

function stripExisting(settings) {
  if (!settings.hooks) return;
  for (const event of Object.keys(settings.hooks)) {
    const groups = settings.hooks[event];
    if (!Array.isArray(groups)) continue;
    const cleaned = groups
      .map((g) => ({
        ...g,
        hooks: Array.isArray(g.hooks) ? g.hooks.filter((h) => !isOurs(h)) : [],
      }))
      .filter((g) => g.hooks.length > 0);
    if (cleaned.length > 0) settings.hooks[event] = cleaned;
    else delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
}

const action = (process.argv[2] || "install").toLowerCase();
if (action !== "install" && action !== "uninstall") {
  console.error("Usage: claude-sfx-install [install|uninstall]");
  process.exit(1);
}

const settings = readSettings();
stripExisting(settings);

if (action === "install") {
  const playCmd = resolvePlayCommand();
  settings.hooks = settings.hooks || {};
  for (const { event, sound, matcher } of EVENTS) {
    settings.hooks[event] = settings.hooks[event] || [];
    const entry = {
      hooks: [{ type: "command", command: buildCommand(playCmd, sound) }],
    };
    if (matcher) entry.matcher = matcher;
    settings.hooks[event].push(entry);
  }
  writeSettings(settings);
  const summary = EVENTS.map(({ event, sound, matcher }) =>
    matcher ? `${event}:${matcher} (${sound})` : `${event} (${sound})`,
  ).join(", ");
  console.log(`✓ claude-sfx hooks installed in ${settingsPath}`);
  console.log(`  events: ${summary}`);
  console.log(`  player: ${playCmd}`);
  console.log("  restart Claude Code to pick up the new hooks.");
} else {
  writeSettings(settings);
  console.log(`✓ claude-sfx hooks removed from ${settingsPath}`);
}
