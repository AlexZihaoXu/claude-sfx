# claude-sfx

Sound effects for [Claude Code](https://claude.com/code). Plays a chime when
Claude finishes a turn, and a different one when it needs your input — so you
can tab away and let it work.

Wires six hook entries in `~/.claude/settings.json`:

| Event                          | Sound         | Fires when                                                       |
|--------------------------------|---------------|------------------------------------------------------------------|
| `Stop`                         | `finish.wav`  | Claude finishes responding (debounced — see below)               |
| `Notification`                 | `notify.wav`  | Claude is blocked on you (idle 60s+)                             |
| `Elicitation`                  | `notify.wav`  | An MCP server is asking you a question                           |
| `PreToolUse:AskUserQuestion`   | `notify.wav`  | Claude calls the built-in `AskUserQuestion` tool                 |
| `PermissionRequest`            | `notify.wav`  | A tool needs a permission decision (see "Permission prompts")    |
| `PreToolUse` (unmatched)       | —             | Defensive: clears any stale permission lock                      |

Cross-platform: Windows, macOS, Linux. One binary (Bun), no per-OS scripts.

## Install

```sh
# macOS / Linux:
curl -fsSL https://raw.githubusercontent.com/AlexZihaoXu/claude-sfx/main/install.sh | bash

# Windows (PowerShell):
irm https://raw.githubusercontent.com/AlexZihaoXu/claude-sfx/main/install.ps1 | iex
```

The installer:

1. `bun install -g github:AlexZihaoXu/claude-sfx` — drops `claude-sfx-play`,
   `claude-sfx-install`, and `claude-sfx-uninstall` on PATH (bun's global bin).
2. `claude-sfx-install` — adds the hook entries to `~/.claude/settings.json`,
   safely merged with anything that's already there.

You need [bun](https://bun.sh) installed first (`brew install bun`,
`curl -fsSL https://bun.sh/install | bash`, or `irm bun.sh/install.ps1 | iex`).

Restart Claude Code after installing so it loads the new hooks.

## Uninstall

```sh
# macOS / Linux:
curl -fsSL https://raw.githubusercontent.com/AlexZihaoXu/claude-sfx/main/uninstall.sh | bash

# Windows (PowerShell):
irm https://raw.githubusercontent.com/AlexZihaoXu/claude-sfx/main/uninstall.ps1 | iex

# or, if already installed:
claude-sfx-uninstall && bun remove -g claude-sfx
```

Only entries claude-sfx added are removed — every other field in your
`settings.json` is left alone.

## Permission prompts

`Notification` only fires after ~60s of idle waiting, so it misses prompts
you're actively attending to. The actual signal is `PermissionRequest`,
which fires when a tool needs a permission decision that isn't already
covered by `permissions.allow`.

The flow:

1. `PermissionRequest` arms a lock file
   (`~/.claude-sfx/permission.lock`), spawns a detached worker, and exits
   immediately so the hook doesn't block Claude Code.
2. The worker waits `PERMISSION_PENDING_DELAY_MS` (default 300 ms), then
   atomically claims the lock (via `unlinkSync`) and plays `notify.wav`.
   Multiple rapid prompts collapse to a single sound — only one worker
   wins the unlink.
3. The unmatched `PreToolUse` hook deletes any stale lock left by a
   crashed worker — defensive cleanup, normally a no-op.

Tools covered by your `permissions.allow` list never fire
`PermissionRequest` at all, so they stay silent. Anything that pops a
dialog (or would have, before a session-scope rule auto-resolved it) gets
the chime.

Tunable via `PERMISSION_PENDING_DELAY_MS` at the top of `bin/play.js`.

See [Claude Code hooks docs](https://docs.claude.com/en/docs/claude-code/hooks)
for the full list of events.

## Stop debouncing

If multiple Claude Code sessions finish within a 1-second window (or the same
session emits rapid Stops), the chime collapses to a single sound from the
last one. Each invocation writes a stamp to `~/.claude-sfx/finish.lock`, sleeps
1s, and only plays if its stamp is still the latest writer.

Tunable via `FINISH_DEBOUNCE_MS` at the top of `bin/play.js`.

## Custom sounds

Replace `assets/finish.wav` and `assets/notify.wav`. The hook commands
reference them by relative path inside the package, so no reinstall needed —
just swap the files. Any format `System.Media.SoundPlayer` (Windows) /
`afplay` (macOS) / `paplay`/`aplay`/`ffplay` (Linux) accepts will work; `.wav`
is the safe choice.

## Diagnostics

Every invocation appends a line to `~/.claude-sfx/sfx.log`:

```
2026-05-09T18:09:13.557Z sound=notify event=Notification {"notification_type":"idle_prompt", ...}
2026-05-09T18:09:14.123Z sound=finish event=Stop suppressed=debounce
```

Useful when an unexpected sound fires — grep the log for the timestamp to see
which session and which event triggered it.

Set `CLAUDE_SFX_LOG=0` in the environment to disable logging.

## Develop locally

```sh
git clone https://github.com/AlexZihaoXu/claude-sfx
cd claude-sfx
bun link                       # symlinks bin commands globally
claude-sfx-install install     # wire hooks
bun test:play:finish           # play finish.wav directly
```

## License

MIT.
