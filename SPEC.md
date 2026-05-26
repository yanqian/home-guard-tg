# SPEC.md

# 1. Project Purpose

`home-watch-tg` is a small trusted-host Telegram Bot for personal home-watch utilities.

The first supported capability is recording a short local camera clip on the Mac running the Bot and sending it to an authorized Telegram chat.

The project is separate from `agent-remote-tg`. It must not contain Codex agent workflow commands, repository selection commands, or code-execution task commands.

## 1.1 Safety Boundaries

- Only explicitly authorized Telegram chat IDs can use commands.
- Camera features are disabled unless explicitly enabled through environment configuration.
- Camera capture must be bounded by user-requested duration and process timeout.
- The Bot must not live stream.
- The Bot must not run camera capture through a shell string.
- The Bot must not store camera clips in git, task logs, or persistent archives.
- Temporary clips must be deleted after Telegram send success or failure.

# 2. Initial Standalone Bot

## 2.1 Goal

Create an independent Telegram polling Bot with `/camera_clip <seconds>`, `/status`, and `/help`.

## 2.2 Commands

- `/camera_clip <seconds>` records a short local camera clip and sends it as Telegram video.
- `/status` reports whether the Bot is running, whether camera capture is enabled, whether the capture config is valid, and whether a capture is active.
- `/help` shows the supported command list.

## 2.3 Configuration

Required:

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_CHAT_IDS`

Camera:

- `ENABLE_CAMERA_CLIP_COMMAND=1` enables `/camera_clip`.
- `CAMERA_CLIP_COMMAND_JSON` must be a JSON argv array template.
- The argv array must contain `{seconds}` and `{output}`.

Example:

```bash
CAMERA_CLIP_COMMAND_JSON='["ffmpeg","-f","avfoundation","-i","0:none","-t","{seconds}","-y","{output}"]'
```

## 2.4 Acceptance Criteria

- Startup validates Telegram token and allowed chat IDs outside `NODE_ENV=test`.
- Runtime state is persisted in `runtime_state.json`.
- Polling persists Telegram update offset.
- Unauthorized chats receive a bounded unauthorized response.
- Unknown commands receive a bounded unknown-command response.
- `/help` returns the exact supported command surface.
- `/status` returns bounded camera configuration and active-capture state.
- `/camera_clip <seconds>` accepts integer seconds from 1 through 10.
- `/camera_clip` rejects disabled camera config before any capture process starts.
- `/camera_clip` rejects malformed `CAMERA_CLIP_COMMAND_JSON`.
- Capture spawns with `shell=false` and ignored stdio.
- Concurrent captures are rejected.
- Capture timeout returns a bounded timeout response.
- Capture failure or empty output does not call Telegram `sendVideo`.
- Successful capture sends Telegram `sendVideo`.
- Temporary files are deleted after send success and send failure.
- Default tests use fake capture and fake Telegram transport only.
- `./init.sh` passes.

## 2.5 Verification Plan

- Run unit tests for command parsing, config parsing, runtime state, camera capture, and Telegram transport.
- Run harness tests for polling update dispatch and media cleanup.
- Run contract tests for command surface and state files.
- Run smoke test.
- Run `./init.sh`.
