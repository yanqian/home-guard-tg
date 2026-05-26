# Progress

## Current System Status

The repository contains a standalone trusted-host Telegram polling Bot for personal home-watch use.

Implemented behavior:

- Startup configuration validates `TELEGRAM_BOT_TOKEN` and `ALLOWED_CHAT_IDS` outside `NODE_ENV=test`.
- Runtime state persists Telegram update offset in `runtime_state.json`.
- Command parsing supports `/camera_clip <seconds>`, `/photo`, `/schedule_photo HH:MM`, `/cancel_schedule`, `/sound_alarm <seconds>`, `/logs`, `/status`, and `/help`.
- Unauthorized chats and unknown commands receive bounded responses.
- `/camera_clip <seconds>` is disabled unless `ENABLE_CAMERA_CLIP_COMMAND=1`.
- `CAMERA_CLIP_COMMAND_JSON` must be a JSON argv array template containing `{seconds}` and `{output}`.
- Camera capture validates integer durations from 1 through 10.
- Camera capture uses `shell=false`, ignored stdio, bounded timeout, and one active capture at a time.
- Successful clips are sent through Telegram `sendVideo`.
- Temporary clips are deleted after send success or failure.
- `/photo` is disabled unless `ENABLE_PHOTO_COMMAND=1`.
- `PHOTO_COMMAND_JSON` must be a JSON argv array template containing `{output}`.
- Photo capture uses shell-disabled stdio-ignored subprocess execution with a bounded timeout and the shared media-capture lock.
- Successful photos are sent through Telegram `sendPhoto`.
- Temporary photos are deleted after send success or failure.
- `/schedule_photo HH:MM` schedules one active daily still-photo capture using server-local 24-hour time.
- Daily photo schedule state is persisted in `runtime_state.json` and re-armed on Bot restart.
- Scheduled photo captures reuse `/photo` capture timeout, cleanup, shared media-capture locking, and Telegram `sendPhoto` behavior.
- Schedule creation reports the configured local time and server timezone context.
- `/cancel_schedule` clears the persisted active daily photo schedule for authorized chats.
- `/cancel_schedule` is idempotent when no schedule exists and does not interrupt an already-started media capture.
- `/sound_alarm <seconds>` is disabled unless `ENABLE_SOUND_ALARM_COMMAND=1`.
- `SOUND_ALARM_COMMAND_JSON` must be a JSON argv array template containing `{seconds}`.
- Sound alarm playback validates integer durations from 1 through 30.
- Sound alarm playback uses `shell=false`, ignored stdio, bounded timeout, and one active alarm at a time.
- Help and status output label `/sound_alarm` as cautious use.
- `/status` reports Bot uptime, response timestamp, camera/photo enabled and valid state, active media capture state, alarm availability, Mac power telemetry when available, private local IPs, and remaining disk space.
- Status host telemetry uses bounded local collection, avoids public-IP lookup, and degrades to `unavailable` values when telemetry is unsupported or fails.
- `/logs` returns recent Bot-owned runtime errors for authorized chats, using bounded persisted local state with one-line secret- and media-path-redacted messages.
- Runtime error logging records polling, Telegram media reply, text reply, and scheduled-photo runtime failures without returning general host logs or media content.
- Default tests use fake capture and fake Telegram transport without real camera or network requirements.
- Default tests use fake alarm subprocesses and never play real audio.

## Last Completed Feature

`F006` - Enhanced `/status` host and Bot state reporting.

## Next Feature

`F007` - Implemented `/logs` for recent Bot-owned runtime errors; awaiting evaluator verification.

## Known Issues

- Real camera use depends on host camera permissions and a valid capture command such as `ffmpeg` with a correct AVFoundation device index.
- Real photo capture depends on host camera permissions and a valid still-image command such as `ffmpeg` with a correct AVFoundation device index.
- Real alarm playback depends on an explicitly configured local alarm command and safe local volume.
- Status power telemetry depends on the macOS `pmset -g batt` command being available and responsive.
- Status disk telemetry depends on the local `df -k` command being available and responsive.
- Newly planned commands have no currently open implementation questions in `SPEC.md` section 3.8.
