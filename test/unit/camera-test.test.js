import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  CAMERA_TEST_RESPONSES,
  formatCameraTestStderr,
  handleCameraTest,
  parseCameraTestConfig,
} from "../../src/camera-test.js";

test("parseCameraTestConfig requires explicit enablement and accepts default ffmpeg probe", () => {
  assert.deepEqual(parseCameraTestConfig({ enabledValue: "", commandJson: "" }), {
    enabled: false,
    argv: null,
    error: null,
    usesDefaultFfmpegProbe: false,
  });
  const defaultConfig = parseCameraTestConfig({ enabledValue: "1", commandJson: "" });
  assert.equal(defaultConfig.enabled, true);
  assert.deepEqual(defaultConfig.argv, ["ffmpeg", "-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""]);
  assert.equal(defaultConfig.error, null);
  assert.equal(defaultConfig.usesDefaultFfmpegProbe, true);
  assert.equal(parseCameraTestConfig({ enabledValue: "1", commandJson: "{" }).error.includes("valid JSON"), true);
  assert.equal(parseCameraTestConfig({ enabledValue: "1", commandJson: JSON.stringify({ argv: ["ffmpeg"] }) }).error.includes("array"), true);
  assert.equal(parseCameraTestConfig({ enabledValue: "1", commandJson: JSON.stringify(["ffmpeg", ""]) }).error.includes("non-empty"), true);
  assert.deepEqual(parseCameraTestConfig({
    enabledValue: "1",
    commandJson: JSON.stringify(["ffmpeg", "-hide_banner", "-f", "avfoundation", "-i", "0:none", "-t", "1", "-f", "null", "-"]),
  }), {
    enabled: true,
    argv: ["ffmpeg", "-hide_banner", "-f", "avfoundation", "-i", "0:none", "-t", "1", "-f", "null", "-"],
    error: null,
    usesDefaultFfmpegProbe: false,
  });
});

test("handleCameraTest runs shell-disabled probe and returns bounded stderr diagnostics", async () => {
  const calls = [];
  const result = await handleCameraTest({
    enabled: true,
    argv: ["fake-ffmpeg", "-hide_banner", "-f", "avfoundation", "-i", "0:none"],
    error: null,
  }, {
    timeoutMs: 1000,
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => true;
      setImmediate(() => {
        child.stderr.emit("data", "line 1\n");
        child.stderr.emit("data", "token=secret /private/tmp/home-watch/photo.jpg\n");
        child.emit("close", 251);
      });
      return child;
    },
  });

  assert.equal(calls[0].command, "fake-ffmpeg");
  assert.deepEqual(calls[0].args, ["-hide_banner", "-f", "avfoundation", "-i", "0:none"]);
  assert.deepEqual(calls[0].options, {
    shell: false,
    stdio: ["ignore", "ignore", "pipe"],
  });
  assert.match(result, /^Camera test finished with exit code 251\./);
  assert.match(result, /line 1/);
  assert.match(result, /token=\[redacted\]/);
  assert.match(result, /\[redacted-media-path\]/);
  assert.equal(result.includes("secret"), false);
});

test("handleCameraTest rejects disabled, malformed, failed, and timed out probes", async () => {
  assert.equal(await handleCameraTest({ enabled: false }), CAMERA_TEST_RESPONSES.disabled);
  assert.equal(await handleCameraTest({ enabled: true, error: "bad" }), CAMERA_TEST_RESPONSES.configError);
  assert.equal(await handleCameraTest({
    enabled: true,
    argv: ["fake-ffmpeg"],
    error: null,
  }, {
    spawnImpl() {
      throw new Error("missing");
    },
  }), CAMERA_TEST_RESPONSES.failed);
  const timeoutResult = await handleCameraTest({
    enabled: true,
    argv: ["fake-ffmpeg"],
    error: null,
  }, {
    timeoutMs: 1,
    spawnImpl() {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => true;
      return child;
    },
  });
  assert.match(timeoutResult, /^Camera test timed out\./);
});

test("formatCameraTestStderr returns only recent non-empty stderr lines", () => {
  const stderr = Array.from({ length: 25 }, (_, index) => `line ${index + 1}`).join("\n");
  const formatted = formatCameraTestStderr(stderr);
  assert.equal(formatted.split("\n").includes("line 1"), false);
  assert.equal(formatted.split("\n").includes("line 6"), true);
  assert.equal(formatted.split("\n").includes("line 25"), true);
  assert.equal(formatCameraTestStderr(""), "(no stderr captured)");
});
