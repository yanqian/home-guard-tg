import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertStartupEnv, createStartupContext, parseAllowedChatIds } from "../../src/config.js";

test("parseAllowedChatIds trims comma-separated values", () => {
  assert.deepEqual(parseAllowedChatIds(" 123,456 ,, "), ["123", "456"]);
});

test("assertStartupEnv validates token and chat ids", () => {
  assert.throws(() => assertStartupEnv({ ALLOWED_CHAT_IDS: "123" }), /TELEGRAM_BOT_TOKEN/);
  assert.throws(() => assertStartupEnv({ TELEGRAM_BOT_TOKEN: "token" }), /ALLOWED_CHAT_IDS/);
  assert.doesNotThrow(() => assertStartupEnv({ TELEGRAM_BOT_TOKEN: "token", NODE_ENV: "test" }));
});

test("createStartupContext parses camera config and paths", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-config-"));
  try {
    const context = createStartupContext({
      TELEGRAM_BOT_TOKEN: "token",
      ALLOWED_CHAT_IDS: "123",
      NODE_ENV: "test",
      ENABLE_CAMERA_CLIP_COMMAND: "1",
      CAMERA_CLIP_COMMAND_JSON: JSON.stringify(["fake-camera", "{seconds}", "{output}"]),
      ENABLE_PHOTO_COMMAND: "1",
      PHOTO_COMMAND_JSON: JSON.stringify(["fake-photo", "{output}"]),
      PHOTO_OUTPUT_FILENAME: "still.png",
      ENABLE_SOUND_ALARM_COMMAND: "1",
      SOUND_ALARM_COMMAND_JSON: JSON.stringify(["fake-alarm", "{seconds}"]),
    }, { rootDir });
    assert.equal(context.telegramBotToken, "token");
    assert.deepEqual(context.allowedChatIds, ["123"]);
    assert.equal(context.cameraClipConfig.enabled, true);
    assert.equal(context.cameraClipConfig.error, null);
    assert.equal(context.photoConfig.enabled, true);
    assert.equal(context.photoConfig.error, null);
    assert.equal(context.photoConfig.outputFileName, "still.png");
    assert.equal(context.soundAlarmConfig.enabled, true);
    assert.equal(context.soundAlarmConfig.error, null);
    assert.equal(context.rootDir, rootDir);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
