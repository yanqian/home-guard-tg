# Deployment

Run this Bot on a trusted local Mac that has access to the camera.

## Environment

- `TELEGRAM_BOT_TOKEN` - Telegram Bot token.
- `ALLOWED_CHAT_IDS` - comma-separated authorized Telegram chat IDs.
- `ENABLE_CAMERA_CLIP_COMMAND` - set to `1` to enable `/camera_clip`.
- `CAMERA_CLIP_COMMAND_JSON` - JSON argv array template for the local capture command.
- `ENABLE_CAMERA_TEST_COMMAND` - set to `1` to enable `/camera_test`.
- `CAMERA_TEST_COMMAND_JSON` - optional JSON argv array for a local ffmpeg probe; omitted uses the verified AVFoundation device-list probe.
- `ENABLE_PHOTO_COMMAND` - set to `1` to enable `/photo` and scheduled photos.
- `PHOTO_COMMAND_JSON` - JSON argv array template for the local still-image command.
- `ENABLE_SOUND_ALARM_COMMAND` - set to `1` to enable `/sound_alarm`.
- `SOUND_ALARM_COMMAND_JSON` - JSON argv array template for the local alarm command; must include `{seconds}`.

Example:

```bash
CAMERA_CLIP_COMMAND_JSON='["ffmpeg","-f","avfoundation","-i","0:none","-t","{seconds}","-y","{output}"]'
CAMERA_TEST_COMMAND_JSON='["ffmpeg","-hide_banner","-f","avfoundation","-i","0:none","-t","1","-f","null","-"]'
PHOTO_COMMAND_JSON='["ffmpeg","-f","avfoundation","-i","0:none","-frames:v","1","-y","{output}"]'
SOUND_ALARM_COMMAND_JSON='["/usr/local/bin/home-watch-alarm","{seconds}"]'
```

Use a known local alarm command for `SOUND_ALARM_COMMAND_JSON`; it is executed with `shell=false`, ignored stdio, and a Bot-enforced timeout. Keep it disabled unless you have tested the command locally at a safe volume.

## Start

```bash
source .env.local
npm run start
```

## Camera Permission

macOS may prompt the terminal application for Camera access on first use. Allow access, then retry `/camera_clip <seconds>` if the first capture times out.

Use `/camera_test` after enabling it to return the last bounded stderr lines from a short shell-disabled ffmpeg probe. This is intended for diagnosing AVFoundation permission, device index, and timeout issues without returning media content.

## Runtime Files

- `runtime_state.json` stores Telegram update offset.
- Temporary clips are created under the OS temp directory and deleted after send success or failure.
- Temporary photos are created under the OS temp directory and deleted after send success or failure.
- Camera media must not be committed.
