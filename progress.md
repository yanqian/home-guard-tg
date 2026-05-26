# Progress

## Current System Status

The repository contains a standalone trusted-host Telegram polling Bot for personal home-watch use.

Implemented behavior:

- Startup configuration validates `TELEGRAM_BOT_TOKEN` and `ALLOWED_CHAT_IDS` outside `NODE_ENV=test`.
- Runtime state persists Telegram update offset in `runtime_state.json`.
- Command parsing supports `/camera_clip <seconds>`, `/photo`, `/status`, and `/help`.
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
- Default tests use fake capture and fake Telegram transport without real camera or network requirements.

## Last Completed Feature

`F003` - `/schedule_photo HH:MM` daily still image scheduling.

## Next Feature

`F004` - Await evaluator verification for `/cancel_schedule` daily photo schedule cancellation.

## Known Issues

- Real camera use depends on host camera permissions and a valid capture command such as `ffmpeg` with a correct AVFoundation device index.
- Real photo capture depends on host camera permissions and a valid still-image command such as `ffmpeg` with a correct AVFoundation device index.
- Newly planned commands have no currently open implementation questions in `SPEC.md` section 3.8.
