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
- Default tests use fake capture and fake Telegram transport without real camera or network requirements.

## Last Completed Feature

`F002` - `/photo` still image capture and Telegram send support.

## Next Feature

`F003` - Await evaluator verification for `/schedule_photo HH:MM` daily still image scheduling.

## Known Issues

- Real camera use depends on host camera permissions and a valid capture command such as `ffmpeg` with a correct AVFoundation device index.
- Real photo capture depends on host camera permissions and a valid still-image command such as `ffmpeg` with a correct AVFoundation device index.
- `/cancel_schedule` is planned as `F004`; until then, a persisted schedule can only be cleared by state maintenance or the future command.
- Newly planned commands have no currently open implementation questions in `SPEC.md` section 3.8.
