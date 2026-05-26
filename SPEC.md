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

# 3. Planned Home-Watch Commands

The Bot should add a small set of trusted personal home-monitoring commands. These commands must keep the existing safety boundaries: authorized chats only, no live streaming, no shell-string execution for camera capture, bounded subprocesses, no Telegram secrets in git, and no camera media in git or logs.

## 3.1 `/photo`

`/photo` captures one still image and sends it to the authorized Telegram chat. It is intended to be faster and lower-bandwidth than `/camera_clip`.

Acceptance criteria:

- `/photo` is disabled unless explicitly enabled through environment configuration.
- Still image capture uses a configured argv array template, not a shell string.
- The configured argv array must contain `{output}`.
- `/photo` rejects disabled or malformed capture configuration before starting any capture process.
- Photo file extension, format, and quality are determined by the configured local capture argv and output path; the Bot should not transcode or reinterpret image quality by default.
- Concurrent media captures are rejected consistently with `/camera_clip`.
- Capture timeout returns a bounded timeout response.
- Capture failure or empty output does not call Telegram `sendPhoto`.
- Successful capture sends Telegram `sendPhoto`.
- Temporary photo files are deleted after Telegram send success or failure.
- Default tests use fake capture and fake Telegram transport only.

## 3.2 `/schedule_photo 09:00`

`/schedule_photo HH:MM` schedules one daily still photo capture at the requested local time.

Acceptance criteria:

- The command accepts only 24-hour `HH:MM` values.
- The schedule uses the server Mac's local timezone, not Telegram or user-local timezone.
- The schedule is persisted in repository runtime state so Bot restart does not lose it.
- At most one daily photo schedule is active unless a later requirement explicitly allows multiple schedules.
- If a daily photo schedule already exists, `/schedule_photo` rejects the new request and tells the user to run `/cancel_schedule` first.
- Scheduling requires the `/photo` capture configuration to be enabled and valid.
- Scheduled captures reuse the same safety, timeout, cleanup, and send behavior as `/photo`.
- Scheduled captures do not overlap with an active manual or scheduled media capture.
- The Bot reports schedule creation with the configured local time and timezone context.
- The scheduler does not run hidden continuous monitoring beyond the explicitly requested daily trigger.

## 3.3 `/cancel_schedule`

`/cancel_schedule` cancels the active daily photo schedule.

Acceptance criteria:

- The command is authorized-chat only.
- It clears the persisted schedule state.
- It is idempotent when no schedule exists.
- It reports whether a schedule was cancelled or no schedule was active.
- It does not interrupt a media capture that has already started unless a later requirement explicitly requests cancellation of in-flight work.

## 3.4 `/sound_alarm 5`

`/sound_alarm <seconds>` plays a local audible alert on the Mac for a bounded duration. This command is safety-sensitive and should be documented as a cautious-use command.

Acceptance criteria:

- The command is disabled unless explicitly enabled through environment configuration.
- The command accepts integer seconds from 1 through 30.
- Sound playback uses a configured argv array template or a verified built-in platform command, not an unbounded shell string.
- The playback process is time-bounded and cleaned up after completion or timeout.
- Concurrent alarms are rejected.
- Authorized-chat access is sufficient; the command does not require a two-step confirmation.
- The Bot returns a cautious-use status message after accepting the command.
- Tests must not play real audio by default.

## 3.5 Enhanced `/status`

`/status` should continue to be bounded and safe, while reporting enough host state to confirm the Bot is online and responsive.

Acceptance criteria:

- `/status` reports Bot uptime.
- `/status` reports whether the camera clip configuration is enabled and valid.
- `/status` reports whether the photo capture configuration is enabled and valid.
- `/status` reports whether a capture or alarm is active.
- `/status` reports Mac battery level when available.
- `/status` reports Mac power source or charging state when available.
- `/status` reports private local network IP information without exposing secrets, and does not perform public-IP lookup by default.
- `/status` reports remaining disk space.
- `/status` includes a current response timestamp so the caller can infer Bot online state and latency from Telegram delivery.
- Missing host telemetry commands degrade gracefully with bounded `unavailable` values.
- Host telemetry collection is bounded and must not block the polling loop indefinitely.

## 3.6 `/logs`

`/logs` returns only recent Bot runtime errors. It must not return video content, photo content, Telegram tokens, camera media paths containing sensitive data, or general host logs.

Acceptance criteria:

- The Bot maintains a bounded persisted local error log on the server for its own recent runtime errors.
- `/logs` returns only those Bot-owned recent errors.
- `/logs` redacts secrets and avoids camera media content.
- `/logs` output is length-bounded for Telegram.
- `/logs` reports a clear empty state when no recent errors are available.

## 3.7 `/camera_test`

`/camera_test` runs a short ffmpeg dry probe and returns the last few stderr lines to help diagnose camera permissions, device index, and timeout behavior.

Acceptance criteria:

- The command is disabled unless explicitly enabled through environment configuration.
- The probe command uses a configured argv array or a verified ffmpeg argv, not a shell string.
- The probe is short and time-bounded.
- The response includes only the last bounded stderr lines.
- The response redacts secrets and does not include media content.
- The implementation verifies real ffmpeg behavior or documents why direct verification was not possible.
- Default tests use fake probe output and do not require a real camera.

## 3.8 Open Questions Before Implementation

None currently open.
