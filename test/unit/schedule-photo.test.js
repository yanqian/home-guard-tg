import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDailyPhotoScheduler,
  handleCancelSchedule,
  millisecondsUntilNextLocalTime,
  parseSchedulePhotoTime,
} from "../../src/schedule-photo.js";
import { saveRuntimeState } from "../../src/runtime-state.js";

test("parseSchedulePhotoTime accepts only 24-hour HH:MM values", () => {
  assert.equal(parseSchedulePhotoTime("00:00"), "00:00");
  assert.equal(parseSchedulePhotoTime("23:59"), "23:59");
  assert.equal(parseSchedulePhotoTime("7:30"), null);
  assert.equal(parseSchedulePhotoTime("24:00"), null);
  assert.equal(parseSchedulePhotoTime("12:60"), null);
});

test("millisecondsUntilNextLocalTime uses server-local Date semantics", () => {
  assert.equal(
    millisecondsUntilNextLocalTime("09:30", new Date(2026, 4, 26, 9, 0, 0, 0)),
    30 * 60 * 1000,
  );
  assert.equal(
    millisecondsUntilNextLocalTime("09:00", new Date(2026, 4, 26, 9, 0, 0, 0)),
    24 * 60 * 60 * 1000,
  );
});

test("handleCancelSchedule clears persisted schedule idempotently", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-cancel-schedule-"));
  const statePath = join(rootDir, "runtime_state.json");
  let refreshCount = 0;
  try {
    saveRuntimeState(statePath, {
      telegramUpdateOffset: 42,
      dailyPhotoSchedule: { type: "daily_photo", time: "09:30", chatId: "123" },
    });

    assert.deepEqual(await handleCancelSchedule({
      statePath,
      onScheduleChanged() {
        refreshCount += 1;
      },
    }), {
      response: "Daily photo schedule cancelled.",
      stateChanged: true,
    });
    assert.equal(refreshCount, 1);
    assert.deepEqual(JSON.parse(readFileSync(statePath, "utf8")), {
      telegramUpdateOffset: 42,
      dailyPhotoSchedule: null,
      errorLog: [],
    });

    assert.deepEqual(await handleCancelSchedule({
      statePath,
      onScheduleChanged() {
        refreshCount += 1;
      },
    }), {
      response: "No daily photo schedule is active.",
      stateChanged: false,
    });
    assert.equal(refreshCount, 1);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("createDailyPhotoScheduler sends scheduled photos through the photo reply path", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-schedule-"));
  const statePath = join(rootDir, "runtime_state.json");
  const fetchCalls = [];
  let timeoutCallback = null;
  let capturedOutputPath = null;
  try {
    saveRuntimeState(statePath, {
      telegramUpdateOffset: 1,
      dailyPhotoSchedule: { type: "daily_photo", time: "09:30", chatId: "123" },
    });

    const scheduler = createDailyPhotoScheduler({
      statePath,
      telegramBotToken: "token",
      photoConfig: {
        enabled: true,
        argvTemplate: ["fake-photo", "{output}"],
        outputFileName: "photo.jpg",
        error: null,
      },
      photoOptions: {
        timeoutMs: 1000,
        spawnImpl(command, args) {
          const child = new EventEmitter();
          setImmediate(() => {
            capturedOutputPath = args[0];
            writeFileSync(args[0], "fake-photo");
            child.emit("close", 0);
          });
          child.kill = () => true;
          return child;
        },
      },
      fetchImpl(url, options) {
        fetchCalls.push({ url: url.toString(), options });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      },
      now: () => new Date(2026, 4, 26, 9, 0, 0, 0),
      setTimeoutImpl(callback, delayMs) {
        timeoutCallback = callback;
        assert.equal(delayMs, 30 * 60 * 1000);
        return { unref() {} };
      },
      clearTimeoutImpl() {},
    });

    scheduler.refresh();
    await timeoutCallback();
    scheduler.stop();

    assert.equal(fetchCalls[0].url, "https://api.telegram.org/bottoken/sendPhoto");
    assert.equal(fetchCalls[0].options.method, "POST");
    assert.equal(existsSync(capturedOutputPath), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
