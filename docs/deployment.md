# Deployment

Run this Bot on a trusted local Mac that has camera access and stays online while you are away.

## 1. Create A Telegram Bot

Open Telegram and talk to `@BotFather`.

1. Send `/newbot`.
2. Choose a display name.
3. Choose a username ending in `bot`.
4. Copy the token BotFather returns.

The token looks like:

```text
123456789:AAExampleTokenFromBotFather
```

Keep this token out of git.

## 2. Set The Bot Command Menu

In `@BotFather`, send `/setcommands`, choose your Bot, and paste:

```text
camera_clip - Capture a short local camera clip
camera_test - Run a camera diagnostic probe
photo - Capture one still image
schedule_photo - Schedule one daily still image
cancel_schedule - Cancel the daily photo schedule
sound_alarm - Play a local audible alert; cautious use only
logs - Show recent Bot runtime errors
status - Show Bot status
help - Show commands
```

## 3. Get Your Telegram Chat ID

Start a chat with the Bot and send `/start` or `/help`.

Then run this from the Mac, replacing the token:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
```

Look for:

```json
"chat":{"id":123456789}
```

Use that number in `ALLOWED_CHAT_IDS`.

For multiple allowed chats:

```bash
ALLOWED_CHAT_IDS='123456789,987654321'
```

## 4. Install Local Dependencies

Install Node.js and ffmpeg. With Homebrew:

```bash
brew install node ffmpeg
```

Use Node.js 18 or newer so the Bot has built-in `fetch` support.

Check ffmpeg can see AVFoundation:

```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

On macOS, the useful camera input is usually something like `0:none`, but the exact index depends on the machine.

## 5. Create `.env.local`

Create `.env.local` in the repository root:

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

Important details:

- `CAMERA_CLIP_COMMAND_JSON`, `PHOTO_COMMAND_JSON`, `CAMERA_TEST_COMMAND_JSON`, and `SOUND_ALARM_COMMAND_JSON` are JSON argv arrays.
- They are executed with `shell=false`.
- Do not put shell pipelines, redirects, or untrusted strings in these values.
- `/camera_test` uses the default verified ffmpeg device-list probe when `CAMERA_TEST_COMMAND_JSON` is omitted.
- `/sound_alarm` should remain disabled until the local command and volume are tested.

## 6. Verify Before Running

```bash
set -a
source .env.local
set +a
./init.sh
```

`./init.sh` runs build, unit, harness, contract, and smoke checks. It does not require a real Telegram network call or real camera capture.

## 7. Start The Bot

```bash
set -a
source .env.local
set +a
npm run start
```

In Telegram, test in this order:

```text
/status
/camera_test
/photo
/camera_clip 3
```

If macOS prompts for camera permission, allow it for the terminal app you used to start the Bot, then retry.

## 8. Keep It Running

For a short trip or a quick test, a terminal session is enough.

For a more durable setup, run it with your normal process manager. A simple `launchd` setup is usually the right macOS option. The important requirements are:

- Start in the repository directory.
- Load the same environment variables as `.env.local`.
- Restart on failure if desired.
- Keep logs local and do not persist camera media.

## Environment Reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | yes | Telegram Bot token from BotFather. |
| `ALLOWED_CHAT_IDS` | yes | Comma-separated authorized Telegram chat IDs. |
| `ENABLE_CAMERA_CLIP_COMMAND` | for `/camera_clip` | Set to `1` to enable video clips. |
| `CAMERA_CLIP_COMMAND_JSON` | for `/camera_clip` | JSON argv template; must include `{seconds}` and `{output}`. |
| `ENABLE_CAMERA_TEST_COMMAND` | for `/camera_test` | Set to `1` to enable diagnostics. |
| `CAMERA_TEST_COMMAND_JSON` | optional | JSON argv for a custom ffmpeg probe. |
| `ENABLE_PHOTO_COMMAND` | for `/photo` and scheduling | Set to `1` to enable still photos. |
| `PHOTO_COMMAND_JSON` | for `/photo` and scheduling | JSON argv template; must include `{output}`. |
| `PHOTO_OUTPUT_FILENAME` | optional | Temporary photo filename and extension. Defaults to the app's configured fallback. |
| `ENABLE_SOUND_ALARM_COMMAND` | for `/sound_alarm` | Set to `1` to enable alarm playback. |
| `SOUND_ALARM_COMMAND_JSON` | for `/sound_alarm` | JSON argv template; must include `{seconds}`. |

## Runtime Files

- `runtime_state.json` stores Telegram update offset, the active daily photo schedule, and bounded Bot-owned runtime errors.
- Temporary clips are created under the OS temp directory and deleted after send success or failure.
- Temporary photos are created under the OS temp directory and deleted after send success or failure.
- Camera media must not be committed.

## Troubleshooting

Use `/status` to confirm the Bot is alive and to check config validity, battery, power, private IPs, disk space, active capture state, and response timestamp.

Use `/camera_test` to inspect the last bounded ffmpeg stderr lines. This is useful for camera permission, device index, and timeout problems.

Common issues:

- `Unauthorized chat.` means the chat ID is not in `ALLOWED_CHAT_IDS`.
- `Camera clip command is disabled.` means `ENABLE_CAMERA_CLIP_COMMAND=1` is missing.
- Empty or failed captures usually mean the AVFoundation device index is wrong or macOS camera permission was denied.
- `/schedule_photo` uses the Mac local timezone.
- `/logs` returns only recent Bot-owned runtime errors, not host logs and not media content.
