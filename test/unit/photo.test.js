import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, writeFileSync } from "node:fs";
import { cleanupCameraClipResult, handleCameraClip } from "../../src/camera-clip.js";
import {
  PHOTO_RESPONSES,
  cleanupPhotoResult,
  getPhotoStatus,
  handlePhoto,
  parsePhotoConfig,
} from "../../src/photo.js";

test("parsePhotoConfig requires explicit enablement and output argv template", () => {
  assert.deepEqual(parsePhotoConfig({ enabledValue: "", commandJson: "" }), {
    enabled: false,
    argvTemplate: null,
    outputFileName: "photo.jpg",
    error: null,
  });
  assert.equal(parsePhotoConfig({ enabledValue: "1", commandJson: "" }).error.includes("required"), true);
  assert.equal(parsePhotoConfig({ enabledValue: "1", commandJson: "{" }).error.includes("valid JSON"), true);
  assert.equal(parsePhotoConfig({
    enabledValue: "1",
    commandJson: JSON.stringify({ argv: ["camera", "{output}"] }),
  }).error.includes("array"), true);
  assert.equal(parsePhotoConfig({ enabledValue: "1", commandJson: JSON.stringify(["camera"]) }).error.includes("{output}"), true);
  assert.equal(parsePhotoConfig({
    enabledValue: "1",
    commandJson: JSON.stringify(["camera", "{output}"]),
    outputFileName: "../photo.jpg",
  }).error.includes("file name"), true);
  assert.deepEqual(parsePhotoConfig({
    enabledValue: "1",
    commandJson: JSON.stringify(["camera", "--output", "{output}"]),
    outputFileName: "still.png",
  }), {
    enabled: true,
    argvTemplate: ["camera", "--output", "{output}"],
    outputFileName: "still.png",
    error: null,
  });
});

test("handlePhoto runs shell-disabled capture and returns photo result", async () => {
  const calls = [];
  const result = await handlePhoto({
    enabled: true,
    argvTemplate: ["fake-camera", "--output", "{output}"],
    outputFileName: "still.png",
    error: null,
  }, {
    timeoutMs: 1000,
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      setImmediate(() => {
        writeFileSync(args[1], "fake-photo");
        child.emit("close", 0);
      });
      child.kill = () => true;
      return child;
    },
  });

  assert.equal(result.response, "Photo ready.");
  assert.equal(result.telegramPhoto.caption, "Photo");
  assert.equal(result.telegramPhoto.fileName, "still.png");
  assert.equal(existsSync(result.telegramPhoto.path), true);
  assert.equal(calls[0].command, "fake-camera");
  assert.deepEqual(calls[0].args[0], "--output");
  assert.match(calls[0].args[1], /still\.png$/);
  assert.deepEqual(calls[0].options, {
    shell: false,
    stdio: ["ignore", "ignore", "ignore"],
  });
  cleanupPhotoResult(result);
  assert.equal(existsSync(result.telegramPhoto.path), false);
});

test("handlePhoto rejects disabled, malformed, failed, timed out, and empty captures", async () => {
  assert.equal((await handlePhoto({ enabled: false })).response, PHOTO_RESPONSES.disabled);
  assert.equal((await handlePhoto({ enabled: true, error: "bad" })).response, PHOTO_RESPONSES.configError);
  assert.equal((await handlePhoto({
    enabled: true,
    argvTemplate: ["fake-camera", "{output}"],
    outputFileName: "photo.jpg",
  }, {
    timeoutMs: 1000,
    spawnImpl() {
      const child = new EventEmitter();
      setImmediate(() => child.emit("close", 2));
      child.kill = () => true;
      return child;
    },
  })).response, PHOTO_RESPONSES.captureFailed);
  assert.equal((await handlePhoto({
    enabled: true,
    argvTemplate: ["fake-camera", "{output}"],
    outputFileName: "photo.jpg",
  }, {
    timeoutMs: 1,
    spawnImpl() {
      const child = new EventEmitter();
      child.kill = () => true;
      return child;
    },
  })).response, PHOTO_RESPONSES.timeout);
  assert.equal((await handlePhoto({
    enabled: true,
    argvTemplate: ["fake-camera", "{output}"],
    outputFileName: "photo.jpg",
  }, {
    timeoutMs: 1000,
    spawnImpl(command, args) {
      const child = new EventEmitter();
      setImmediate(() => {
        writeFileSync(args[0], "");
        child.emit("close", 0);
      });
      child.kill = () => true;
      return child;
    },
  })).response, PHOTO_RESPONSES.emptyOutput);
});

test("handlePhoto shares media capture concurrency with camera clips", async () => {
  const clipConfig = { enabled: true, argvTemplate: ["fake-camera", "{seconds}", "{output}"], error: null };
  const photoConfig = { enabled: true, argvTemplate: ["fake-camera", "{output}"], outputFileName: "photo.jpg", error: null };
  let release;
  let spawned;
  const spawnedPromise = new Promise((resolve) => {
    spawned = resolve;
  });
  const first = handleCameraClip("1", clipConfig, {
    timeoutMs: 10000,
    spawnImpl(command, args) {
      const child = new EventEmitter();
      release = () => {
        writeFileSync(args[1], "fake-video");
        child.emit("close", 0);
      };
      child.kill = () => true;
      spawned();
      return child;
    },
  });
  await spawnedPromise;
  assert.equal((await handlePhoto(photoConfig)).response, PHOTO_RESPONSES.busy);
  release();
  const result = await first;
  cleanupCameraClipResult(result);
});

test("getPhotoStatus reports enabled, config, and active state", () => {
  assert.deepEqual(getPhotoStatus({ enabled: false }), {
    enabled: false,
    configValid: false,
    activeCapture: false,
  });
  assert.deepEqual(getPhotoStatus({ enabled: true, argvTemplate: ["x"], error: null }), {
    enabled: true,
    configValid: true,
    activeCapture: false,
  });
});
