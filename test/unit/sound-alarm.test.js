import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  SOUND_ALARM_RESPONSES,
  getSoundAlarmStatus,
  handleSoundAlarm,
  parseSoundAlarmConfig,
  parseSoundAlarmSeconds,
} from "../../src/sound-alarm.js";

test("parseSoundAlarmConfig requires explicit enablement and seconds argv template", () => {
  assert.deepEqual(parseSoundAlarmConfig({ enabledValue: "", commandJson: "" }), {
    enabled: false,
    argvTemplate: null,
    error: null,
  });
  assert.equal(parseSoundAlarmConfig({ enabledValue: "1", commandJson: "" }).error.includes("required"), true);
  assert.equal(parseSoundAlarmConfig({ enabledValue: "1", commandJson: "{" }).error.includes("valid JSON"), true);
  assert.equal(parseSoundAlarmConfig({
    enabledValue: "1",
    commandJson: JSON.stringify({ argv: ["alarm", "{seconds}"] }),
  }).error.includes("array"), true);
  assert.equal(parseSoundAlarmConfig({ enabledValue: "1", commandJson: JSON.stringify(["alarm"]) }).error.includes("{seconds}"), true);
  assert.deepEqual(parseSoundAlarmConfig({
    enabledValue: "1",
    commandJson: JSON.stringify(["fake-alarm", "--seconds", "{seconds}"]),
  }), {
    enabled: true,
    argvTemplate: ["fake-alarm", "--seconds", "{seconds}"],
    error: null,
  });
});

test("parseSoundAlarmSeconds accepts only integers from one through thirty", () => {
  assert.equal(parseSoundAlarmSeconds("1"), 1);
  assert.equal(parseSoundAlarmSeconds("30"), 30);
  assert.equal(parseSoundAlarmSeconds("0"), null);
  assert.equal(parseSoundAlarmSeconds("31"), null);
  assert.equal(parseSoundAlarmSeconds("1.5"), null);
  assert.equal(parseSoundAlarmSeconds("two"), null);
});

test("handleSoundAlarm runs shell-disabled alarm command", async () => {
  const calls = [];
  const result = await handleSoundAlarm("5", {
    enabled: true,
    argvTemplate: ["fake-alarm", "--seconds", "{seconds}"],
    error: null,
  }, {
    timeoutMs: 1000,
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      setImmediate(() => child.emit("close", 0));
      child.kill = () => true;
      return child;
    },
  });

  assert.equal(result.response, "Sound alarm played for 5s. Cautious use only.");
  assert.equal(calls[0].command, "fake-alarm");
  assert.deepEqual(calls[0].args, ["--seconds", "5"]);
  assert.deepEqual(calls[0].options, {
    shell: false,
    stdio: ["ignore", "ignore", "ignore"],
  });
});

test("handleSoundAlarm rejects disabled, malformed, failed, and timed out alarms", async () => {
  assert.equal((await handleSoundAlarm("2", { enabled: false })).response, SOUND_ALARM_RESPONSES.disabled);
  assert.equal((await handleSoundAlarm("40", { enabled: true })).response, SOUND_ALARM_RESPONSES.usage);
  assert.equal((await handleSoundAlarm("2", { enabled: true, error: "bad" })).response, SOUND_ALARM_RESPONSES.configError);
  assert.equal((await handleSoundAlarm("2", {
    enabled: true,
    argvTemplate: ["fake-alarm", "{seconds}"],
  }, {
    timeoutMs: 1000,
    spawnImpl() {
      const child = new EventEmitter();
      setImmediate(() => child.emit("close", 2));
      child.kill = () => true;
      return child;
    },
  })).response, SOUND_ALARM_RESPONSES.failed);
  assert.equal((await handleSoundAlarm("2", {
    enabled: true,
    argvTemplate: ["fake-alarm", "{seconds}"],
  }, {
    timeoutMs: 1,
    killGraceMs: 1,
    spawnImpl() {
      const child = new EventEmitter();
      child.kill = () => true;
      return child;
    },
  })).response, SOUND_ALARM_RESPONSES.timeout);
});

test("handleSoundAlarm rejects concurrent alarms", async () => {
  const config = { enabled: true, argvTemplate: ["fake-alarm", "{seconds}"], error: null };
  let release;
  let spawned;
  const spawnedPromise = new Promise((resolve) => {
    spawned = resolve;
  });
  const first = handleSoundAlarm("1", config, {
    timeoutMs: 10000,
    spawnImpl() {
      const child = new EventEmitter();
      release = () => child.emit("close", 0);
      child.kill = () => true;
      spawned();
      return child;
    },
  });
  await spawnedPromise;
  assert.equal(getSoundAlarmStatus(config).active, true);
  assert.equal((await handleSoundAlarm("1", config)).response, SOUND_ALARM_RESPONSES.busy);
  release();
  await first;
  assert.equal(getSoundAlarmStatus(config).active, false);
});

test("getSoundAlarmStatus reports enabled, config, and active state", () => {
  assert.deepEqual(getSoundAlarmStatus({ enabled: false }), {
    enabled: false,
    configValid: false,
    active: false,
  });
  assert.deepEqual(getSoundAlarmStatus({ enabled: true, argvTemplate: ["x"], error: null }), {
    enabled: true,
    configValid: true,
    active: false,
  });
});
