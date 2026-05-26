# home-watch-tg

Personal trusted-host Telegram Bot for short home-watch utilities.

This repository is intentionally separate from `agent-remote-tg`. It does not include Codex agent commands, repository selection, or remote code execution.

## Commands

- `/camera_clip <seconds>` - capture and send a short local camera clip
- `/status` - show camera command status
- `/help` - show commands

## BotFather Command Menu

Use BotFather `/setcommands`:

```text
camera_clip - Capture a short local camera clip
status - Show Bot status
help - Show commands
```

## Configuration

Create `.env.local` or export the variables before starting:

```bash
TELEGRAM_BOT_TOKEN='...'
ALLOWED_CHAT_IDS='123456789'
ENABLE_CAMERA_CLIP_COMMAND=1
CAMERA_CLIP_COMMAND_JSON='["ffmpeg","-f","avfoundation","-i","0:none","-t","{seconds}","-y","{output}"]'
```

`CAMERA_CLIP_COMMAND_JSON` must be a JSON array of strings. It must include `{seconds}` and `{output}`. The Bot runs it with shell execution disabled.

Find macOS AVFoundation devices with:

```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

## Run

```bash
source .env.local
npm run start
```

## Verify

```bash
./init.sh
```
