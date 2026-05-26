import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { createApp } from "../../src/app.js";

test("app rejects unauthorized and handles help/status", async () => {
  const app = createApp({
    allowedChatIds: ["123"],
    cameraClipConfig: { enabled: false },
  });
  assert.equal(await app.handleMessage({ chatId: "999", text: "/help" }), "Unauthorized chat.");
  assert.match(await app.handleMessage({ chatId: "123", text: "/help" }), /Available commands/);
  assert.match(await app.handleMessage({ chatId: "123", text: "/status" }), /Camera command: disabled/);
  assert.match(await app.handleMessage({ chatId: "123", text: "/status" }), /Photo command: disabled/);
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
