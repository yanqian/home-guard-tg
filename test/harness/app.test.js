import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/app.js";
import { appendRuntimeError } from "../../src/error-log.js";

test("app rejects unauthorized and handles help/status", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-guard-tg-app-"));
  const statePath = join(rootDir, "runtime_state.json");
  const app = createApp({
    allowedChatIds: ["123"],
    cameraClipConfig: { enabled: false },
    logsOptions: { statePath },
    statusOptions: {
      startedAtMs: Date.parse("2026-05-26T00:00:00.000Z"),
      now: () => new Date("2026-05-26T00:00:05.000Z"),
      collectHostTelemetry: async () => ({
        batteryLevel: "unavailable",
        powerSource: "unavailable",
        localIps: [],
        diskAvailable: "unavailable",
      }),
    },
  });
  assert.equal(await app.handleMessage({ chatId: "999", text: "/help" }), "Unauthorized chat.");
  assert.match(await app.handleMessage({ chatId: "123", text: "/help" }), /Available commands/);
  const status = await app.handleMessage({ chatId: "123", text: "/status" });
  assert.match(status, /Camera command: disabled/);
  assert.match(status, /Photo command: disabled/);
  assert.match(status, /Alarm command: disabled \(cautious use\)/);
  assert.match(status, /Bot uptime: 5s/);
  assert.match(status, /Response timestamp: 2026-05-26T00:00:05.000Z/);
  assert.match(status, /Local IPs: unavailable/);
  assert.equal(await app.handleMessage({ chatId: "123", text: "/logs" }), "No recent Bot-owned runtime errors.");
  appendRuntimeError(statePath, {
    source: "polling",
    error: "token=secret failed while sending /private/tmp/home-guard/photo.jpg",
    now: () => new Date("2026-05-26T00:00:06.000Z"),
  });
  const logs = await app.handleMessage({ chatId: "123", text: "/logs" });
  assert.match(logs, /Recent Bot-owned runtime errors:/);
  assert.match(logs, /2026-05-26T00:00:06.000Z \[polling\]/);
  assert.match(logs, /token=\[redacted\]/);
  assert.match(logs, /\[redacted-media-path\]/);
  rmSync(rootDir, { recursive: true, force: true });
});

test("app handles /sound_alarm with fake alarm command", async () => {
  const alarmCalls = [];
  const app = createApp({
    allowedChatIds: ["123"],
    soundAlarmConfig: {
      enabled: true,
      argvTemplate: ["fake-alarm", "--seconds", "{seconds}"],
      error: null,
    },
    soundAlarmOptions: {
      timeoutMs: 1000,
      spawnImpl(command, args, options) {
        alarmCalls.push({ command, args, options });
        const child = new EventEmitter();
        setImmediate(() => child.emit("close", 0));
        child.kill = () => true;
        return child;
      },
    },
  });

  assert.equal((await app.handleMessage({ chatId: "123", text: "/sound_alarm nope" })).response, "Usage: /sound_alarm <seconds> where seconds is an integer from 1 to 30.");
  const reply = await app.handleMessage({ chatId: "123", text: "/sound_alarm 3" });
  assert.equal(reply.response, "Sound alarm played for 3s. Cautious use only.");
  assert.equal(alarmCalls[0].command, "fake-alarm");
  assert.deepEqual(alarmCalls[0].args, ["--seconds", "3"]);
});

test("app handles /camera_clip without unrelated agent behavior", async () => {
  const captureCalls = [];
  const app = createApp({
    allowedChatIds: ["123"],
    cameraClipConfig: {
      enabled: true,
      argvTemplate: ["fake-camera", "--seconds", "{seconds}", "--output", "{output}"],
      error: null,
    },
    cameraClipOptions: {
      timeoutMs: 1000,
      spawnImpl(command, args, options) {
        captureCalls.push({ command, args, options });
        const child = new EventEmitter();
        setImmediate(() => {
          writeFileSync(args[3], "fake-video");
          child.emit("close", 0);
        });
        child.kill = () => true;
        return child;
      },
    },
  });

  assert.equal((await app.handleMessage({ chatId: "123", text: "/camera_clip nope" })).response, "Usage: /camera_clip <seconds> where seconds is an integer from 1 to 10.");
  const reply = await app.handleMessage({ chatId: "123", text: "/camera_clip 2" });
  assert.equal(reply.response, "Camera clip ready: 2s");
  assert.equal(existsSync(reply.telegramVideo.path), true);
  assert.equal(captureCalls[0].command, "fake-camera");
  rmSync(reply.telegramVideo.cleanupPaths[0], { recursive: true, force: true });
});

test("app handles /camera_test with fake ffmpeg stderr", async () => {
  const probeCalls = [];
  const app = createApp({
    allowedChatIds: ["123"],
    cameraTestConfig: {
      enabled: true,
      argv: ["fake-ffmpeg", "-hide_banner", "-f", "avfoundation", "-i", "0:none"],
      error: null,
    },
    cameraTestOptions: {
      timeoutMs: 1000,
      spawnImpl(command, args) {
        probeCalls.push({ command, args });
        const child = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = () => true;
        setImmediate(() => {
          child.stderr.emit("data", "[AVFoundation indev] device permission denied\n");
          child.emit("close", 1);
        });
        return child;
      },
    },
  });

  const reply = await app.handleMessage({ chatId: "123", text: "/camera_test" });
  assert.match(reply, /Camera test finished with exit code 1\./);
  assert.match(reply, /device permission denied/);
  assert.equal(probeCalls[0].command, "fake-ffmpeg");
  assert.deepEqual(probeCalls[0].args, ["-hide_banner", "-f", "avfoundation", "-i", "0:none"]);
});

test("app handles /photo with fake capture", async () => {
  const captureCalls = [];
  const app = createApp({
    allowedChatIds: ["123"],
    photoConfig: {
      enabled: true,
      argvTemplate: ["fake-photo", "--output", "{output}"],
      outputFileName: "still.png",
      error: null,
    },
    photoOptions: {
      timeoutMs: 1000,
      spawnImpl(command, args, options) {
        captureCalls.push({ command, args, options });
        const child = new EventEmitter();
        setImmediate(() => {
          writeFileSync(args[1], "fake-photo");
          child.emit("close", 0);
        });
        child.kill = () => true;
        return child;
      },
    },
  });

  const reply = await app.handleMessage({ chatId: "123", text: "/photo" });
  assert.equal(reply.response, "Photo ready.");
  assert.equal(existsSync(reply.telegramPhoto.path), true);
  assert.equal(captureCalls[0].command, "fake-photo");
  rmSync(reply.telegramPhoto.cleanupPaths[0], { recursive: true, force: true });
});

test("app handles /schedule_photo by persisting one enabled daily photo schedule", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-guard-tg-app-"));
  const statePath = join(rootDir, "runtime_state.json");
  let refreshCount = 0;
  try {
    const app = createApp({
      allowedChatIds: ["123"],
      photoConfig: {
        enabled: true,
        argvTemplate: ["fake-photo", "--output", "{output}"],
        outputFileName: "still.png",
        error: null,
      },
      schedulePhotoOptions: {
        statePath,
        now: () => new Date("2026-05-26T09:00:00+08:00"),
        onScheduleChanged() {
          refreshCount += 1;
        },
      },
    });

    assert.equal(
      (await app.handleMessage({ chatId: "123", text: "/schedule_photo 24:00" })).response,
      "Usage: /schedule_photo HH:MM",
    );
    assert.match(
      (await app.handleMessage({ chatId: "123", text: "/schedule_photo 09:30" })).response,
      /^Daily photo scheduled for 09:30 server-local time \(.+\)\.$/,
    );
    assert.equal(refreshCount, 1);
    assert.deepEqual(JSON.parse(readFileSync(statePath, "utf8")).dailyPhotoSchedule, {
      type: "daily_photo",
      time: "09:30",
      chatId: "123",
    });
    assert.equal(
      (await app.handleMessage({ chatId: "123", text: "/schedule_photo 10:00" })).response,
      "A daily photo schedule is already active. Run /cancel_schedule first.",
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("app handles /cancel_schedule by clearing only active daily photo schedule state", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-guard-tg-app-"));
  const statePath = join(rootDir, "runtime_state.json");
  let refreshCount = 0;
  try {
    writeFileSync(statePath, JSON.stringify({
      telegramUpdateOffset: 7,
      dailyPhotoSchedule: { type: "daily_photo", time: "09:30", chatId: "123" },
    }));

    const app = createApp({
      allowedChatIds: ["123"],
      schedulePhotoOptions: {
        statePath,
        onScheduleChanged() {
          refreshCount += 1;
        },
      },
    });

    assert.equal(
      (await app.handleMessage({ chatId: "123", text: "/cancel_schedule" })).response,
      "Daily photo schedule cancelled.",
    );
    assert.equal(refreshCount, 1);
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(state.telegramUpdateOffset, 7);
    assert.equal(state.dailyPhotoSchedule, null);

    assert.equal(
      (await app.handleMessage({ chatId: "123", text: "/cancel_schedule" })).response,
      "No daily photo schedule is active.",
    );
    assert.equal(refreshCount, 1);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("app rejects /schedule_photo before persistence when photo config is disabled or malformed", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-guard-tg-app-"));
  const statePath = join(rootDir, "runtime_state.json");
  try {
    const disabledApp = createApp({
      allowedChatIds: ["123"],
      photoConfig: { enabled: false },
      schedulePhotoOptions: { statePath },
    });
    assert.equal(
      (await disabledApp.handleMessage({ chatId: "123", text: "/schedule_photo 09:30" })).response,
      "Photo command is disabled.",
    );
    assert.equal(existsSync(statePath), false);

    const malformedApp = createApp({
      allowedChatIds: ["123"],
      photoConfig: { enabled: true, argvTemplate: null, error: "bad config" },
      schedulePhotoOptions: { statePath },
    });
    assert.equal(
      (await malformedApp.handleMessage({ chatId: "123", text: "/schedule_photo 09:30" })).response,
      "Photo capture config is missing or malformed.",
    );
    assert.equal(existsSync(statePath), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
