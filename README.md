# home-guard-tg

`home-guard-tg` is a small trusted-host Telegram Bot for checking on home from a Mac.

The original reason was simple: I was about to travel, and my wife felt uneasy about not being able to see what was happening at home. I already had [agent-remote-tg](https://github.com/yanqian/agent-remote-tg) running, so the fastest useful thing was to add one new Telegram command that could ask the Mac camera for a short clip. That became `/camera_clip`.

The first working version took about ten minutes. It ran, sent a clip, and earned immediate approval at home. This repository keeps that idea separate from the remote-agent project: no Codex commands, no repo switching, no remote code execution. Just a personal home-guard Bot for a trusted Mac.

## What It Does

- Captures a short camera video with `/camera_clip <seconds>`.
- Captures a still image with `/photo`.
- Schedules one daily still image with `/schedule_photo HH:MM`.
- Cancels the daily photo schedule with `/cancel_schedule`.
- Plays a local audible alert with `/sound_alarm <seconds>`.
- Reports Bot, camera, alarm, battery, network, and disk status with `/status`.
- Returns recent Bot-owned runtime errors with `/logs`.
- Runs a short ffmpeg camera diagnostic with `/camera_test`.

All sensitive operations are restricted to configured Telegram chat IDs.

## Commands

| Command | Purpose |
| --- | --- |
| `/camera_clip <seconds>` | Capture and send a short local camera clip. Seconds must be `1` through `10`. |
| `/camera_test` | Run a short ffmpeg dry probe and return bounded stderr diagnostics. |
| `/photo` | Capture and send one still image. |
| `/schedule_photo HH:MM` | Schedule one daily still image at server-local time. |
| `/cancel_schedule` | Cancel the active daily photo schedule. |
| `/sound_alarm <seconds>` | Play a local audible alert. Seconds must be `1` through `30`; use cautiously. |
| `/logs` | Show recent Bot-owned runtime errors only. |
| `/status` | Show Bot, media, alarm, and host status. |
| `/help` | Show the command list. |

## Requirements

- macOS on the trusted home Mac.
- Node.js 18 or newer with built-in `fetch` support.
- `ffmpeg` for camera capture and diagnostics.
- A Telegram Bot token from BotFather.
- Your allowed Telegram chat ID.

Install ffmpeg with Homebrew if needed:

```bash
brew install ffmpeg
```

Find local AVFoundation camera devices:

```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

Typical Mac camera input values look like `0:none`, but verify on your own machine.

## Configuration

Create `.env.local` or export the variables before starting the Bot:

```bash
TELEGRAM_BOT_TOKEN='123456789:replace_with_bot_token'
ALLOWED_CHAT_IDS='123456789'

ENABLE_CAMERA_CLIP_COMMAND=1
CAMERA_CLIP_COMMAND_JSON='["ffmpeg","-f","avfoundation","-i","0:none","-t","{seconds}","-y","{output}"]'

ENABLE_CAMERA_TEST_COMMAND=1

ENABLE_PHOTO_COMMAND=1
PHOTO_COMMAND_JSON='["ffmpeg","-f","avfoundation","-i","0:none","-frames:v","1","-y","{output}"]'
PHOTO_OUTPUT_FILENAME='photo.jpg'

ENABLE_SOUND_ALARM_COMMAND=0
SOUND_ALARM_COMMAND_JSON='["/usr/local/bin/home-guard-alarm","{seconds}"]'
```

Notes:

- `ALLOWED_CHAT_IDS` is comma-separated when more than one chat is allowed.
- Capture and alarm commands are JSON argv arrays, not shell strings.
- `CAMERA_CLIP_COMMAND_JSON` must include `{seconds}` and `{output}`.
- `PHOTO_COMMAND_JSON` must include `{output}`.
- `SOUND_ALARM_COMMAND_JSON` must include `{seconds}`.
- `/camera_test` can use the built-in default probe when `CAMERA_TEST_COMMAND_JSON` is omitted.
- `/schedule_photo` uses the Mac/server local timezone, not a Telegram timezone.
- `/sound_alarm` is intentionally disabled by default. Test the local command and volume before enabling it.

## Run

```bash
set -a
source .env.local
set +a
npm run start
```

Then send `/status` or `/camera_test` to the Bot from an authorized Telegram chat.

## Verify

Run the full local verification suite:

```bash
./init.sh
```

This runs syntax checks, unit tests, harness tests, contract tests, and smoke checks.

## Runtime State

The Bot stores local runtime state in `runtime_state.json`:

- Telegram polling offset.
- The active daily photo schedule.
- A bounded Bot-owned runtime error log for `/logs`.

Temporary camera clips and photos are created under the OS temp directory and deleted after send success or failure. Camera media and Telegram secrets should never be committed.

## Deployment

See [docs/deployment.md](docs/deployment.md) for the full setup flow:

- Create the Telegram Bot.
- Set BotFather commands.
- Get your chat ID.
- Configure `.env.local`.
- Grant macOS camera permission.
- Run and keep the Bot alive.

## Development Workflow

This repository uses the file-based agent workflow described in `AGENTS.md`.

For a new feature:

1. Append the requirement to `SPEC.md`.
2. Append one new feature entry to `feature_list.json`.
3. Preserve existing feature IDs, status fields, attempts, and history.
4. Run:

```bash
./init.sh
python3 orchestrator.py --max-rounds 1
```

The orchestrator runs one Coding Agent, then one Evaluator Agent, and commits only after the evaluator returns `EVAL_PASS: Fxxx`.

Useful commands:

```bash
python3 orchestrator.py --dry-run
python3 orchestrator.py --eval-only all
```
