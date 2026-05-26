# Progress

## Current System Status

The repository contains a standalone trusted-host Telegram polling Bot for personal home-watch use.

Implemented behavior:

- Startup configuration validates `TELEGRAM_BOT_TOKEN` and `ALLOWED_CHAT_IDS` outside `NODE_ENV=test`.
- Runtime state persists Telegram update offset in `runtime_state.json`.
- Command parsing supports `/camera_clip <seconds>`, `/status`, and `/help`.
- Unauthorized chats and unknown commands receive bounded responses.
- `/camera_clip <seconds>` is disabled unless `ENABLE_CAMERA_CLIP_COMMAND=1`.
- `CAMERA_CLIP_COMMAND_JSON` must be a JSON argv array template containing `{seconds}` and `{output}`.
- Camera capture validates integer durations from 1 through 10.
- Camera capture uses `shell=false`, ignored stdio, bounded timeout, and one active capture at a time.
- Successful clips are sent through Telegram `sendVideo`.
- Temporary clips are deleted after send success or failure.
- Default tests use fake capture and fake Telegram transport without real camera or network requirements.

## Last Completed Feature

`F001` - Standalone trusted-host Telegram polling Bot with short camera clip support.

## Next Feature

`F002` - Add `/photo` still image capture and Telegram send support.

## Known Issues

- Real camera use depends on host camera permissions and a valid capture command such as `ffmpeg` with a correct AVFoundation device index.
- Newly planned commands have no currently open implementation questions in `SPEC.md` section 3.8.
