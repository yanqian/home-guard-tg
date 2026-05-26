# home-watch-tg

Personal trusted-host Telegram Bot for short home-watch utilities.

This repository is intentionally separate from `agent-remote-tg`. It does not include Codex agent commands, repository selection, or remote code execution.

## Commands

- `/camera_clip <seconds>` - capture and send a short local camera clip
- `/photo` - capture and send one still image
- `/schedule_photo HH:MM` - schedule one daily still image at server-local time
- `/cancel_schedule` - cancel the active daily photo schedule
- `/sound_alarm <seconds>` - play a local audible alert for cautious use
- `/status` - show Bot, media, alarm, and host status
- `/help` - show commands

## BotFather Command Menu

Use BotFather `/setcommands`:

```text
camera_clip - Capture a short local camera clip
photo - Capture one still image
schedule_photo - Schedule one daily still image
cancel_schedule - Cancel the daily photo schedule
sound_alarm - Play a local audible alert; cautious use only
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
ENABLE_PHOTO_COMMAND=1
PHOTO_COMMAND_JSON='["ffmpeg","-f","avfoundation","-i","0:none","-frames:v","1","-y","{output}"]'
PHOTO_OUTPUT_FILENAME='photo.jpg'
ENABLE_SOUND_ALARM_COMMAND=1
SOUND_ALARM_COMMAND_JSON='["/usr/local/bin/home-watch-alarm","{seconds}"]'
```

`CAMERA_CLIP_COMMAND_JSON` must be a JSON array of strings. It must include `{seconds}` and `{output}`. The Bot runs it with shell execution disabled.

`PHOTO_COMMAND_JSON` must be a JSON array of strings. It must include `{output}`. The Bot runs it with shell execution disabled and sends the captured file through Telegram `sendPhoto` without Bot-side transcoding. `PHOTO_OUTPUT_FILENAME` controls the temporary output filename and extension; it must be a filename, not a path.

`SOUND_ALARM_COMMAND_JSON` must be a JSON array of strings. It must include `{seconds}` so the configured command can bound playback duration; the Bot also enforces its own timeout. The Bot runs it with shell execution disabled. Keep `/sound_alarm` disabled unless you understand the local command and the alert volume.

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

## Feature Workflow

This repository follows the same file-based agent workflow as `agent-remote-tg`.

For a new feature:

1. Append the requirement to `SPEC.md`.
2. Append one new feature entry to `feature_list.json`.
3. Keep existing feature IDs, status fields, attempts, and history unchanged.
4. Run:

```bash
./init.sh
python3 orchestrator.py --max-rounds 1
```

The orchestrator runs a Coding Agent, then an Evaluator Agent, and commits only after the evaluator returns `EVAL_PASS: Fxxx`.

Useful commands:

```bash
python3 orchestrator.py --dry-run
python3 orchestrator.py --eval-only F001
python3 orchestrator.py --eval-only all
```
