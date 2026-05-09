# claude-sfx

Sound effects for [Claude Code](https://claude.com/code). Plays a chime when
Claude finishes a turn, and a different one when it needs your input — so you
can tab away and let it work.

Wires three hook events in `~/.claude/settings.json`:

| Event          | Sound         | Fires when                                        |
|----------------|---------------|---------------------------------------------------|
| `Stop`         | `finish.wav`  | Claude finishes responding (debounced — see below)|
| `Notification` | `notify.wav`  | Claude is blocked on you (permission, idle 60s+)  |
| `Elicitation`  | `notify.wav`  | An MCP server is asking you a question            |

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
2. `claude-sfx-install` — adds the three hook entries to `~/.claude/settings.json`,
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

## Why these three events (and not `PermissionRequest`)

Claude Code emits `PermissionRequest` for **every** tool permission check,
including auto-approved ones — there's no payload field that distinguishes a
real dialog from a silent pass-through, so wiring it would beep on essentially
every tool call. The `Notification` event with `notification_type =
permission_prompt` fires only when a real dialog appears, which is the actual
"user attention needed" signal. Same for the post-60s idle case.

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
