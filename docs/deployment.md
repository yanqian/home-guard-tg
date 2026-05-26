# Deployment

Run this Bot on a trusted local Mac that has access to the camera.

## Environment

- `TELEGRAM_BOT_TOKEN` - Telegram Bot token.
- `ALLOWED_CHAT_IDS` - comma-separated authorized Telegram chat IDs.
- `ENABLE_CAMERA_CLIP_COMMAND` - set to `1` to enable `/camera_clip`.
- `CAMERA_CLIP_COMMAND_JSON` - JSON argv array template for the local capture command.

Example:

```bash
CAMERA_CLIP_COMMAND_JSON='["ffmpeg","-f","avfoundation","-i","0:none","-t","{seconds}","-y","{output}"]'
```

## Start

```bash
source .env.local
npm run start
```

## Camera Permission

macOS may prompt the terminal application for Camera access on first use. Allow access, then retry `/camera_clip <seconds>` if the first capture times out.

## Runtime Files

- `runtime_state.json` stores Telegram update offset.
- Temporary clips are created under the OS temp directory and deleted after send success or failure.
- Camera media must not be committed.
