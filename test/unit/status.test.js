import test from "node:test";
import assert from "node:assert/strict";
import {
  collectDiskTelemetry,
  collectMacPowerTelemetry,
  collectPrivateLocalIps,
  formatStatus,
  parseDfAvailable,
  parsePmsetBattery,
} from "../../src/status.js";

test("formatStatus reports bot, config, activity, host telemetry, and timestamp", async () => {
  const response = await formatStatus({
    cameraStatus: { enabled: true, configValid: true, activeCapture: false },
    photoStatus: { enabled: false, configValid: false, activeCapture: true },
    startedAtMs: Date.parse("2026-05-26T00:00:00.000Z"),
    now: () => new Date("2026-05-26T01:02:03.000Z"),
    collectHostTelemetry: async () => ({
      batteryLevel: "87%",
      powerSource: "Battery Power, discharging",
      localIps: ["en0:192.168.1.20"],
      diskAvailable: "12.3 GiB",
    }),
  });

  assert.equal(response, [
    "Home watch Bot is running.",
    "Response timestamp: 2026-05-26T01:02:03.000Z",
    "Bot uptime: 1h 2m 3s",
    "Camera command: enabled",
    "Camera config: valid",
    "Photo command: disabled",
    "Photo config: invalid",
    "Media capture: active",
    "Alarm command: disabled (cautious use)",
    "Alarm config: invalid",
    "Alarm activity: idle",
    "Battery level: 87%",
    "Power source: Battery Power, discharging",
    "Local IPs: en0:192.168.1.20",
    "Disk available: 12.3 GiB",
  ].join("\n"));
});

test("formatStatus degrades when host telemetry collection throws", async () => {
  const response = await formatStatus({
    cameraStatus: { enabled: false, configValid: false, activeCapture: false },
    photoStatus: { enabled: false, configValid: false, activeCapture: false },
    startedAtMs: Date.parse("2026-05-26T00:00:00.000Z"),
    now: () => new Date("2026-05-26T00:00:01.000Z"),
    collectHostTelemetry: async () => {
      throw new Error("telemetry failed");
    },
  });

  assert.match(response, /Battery level: unavailable/);
  assert.match(response, /Power source: unavailable/);
  assert.match(response, /Local IPs: unavailable/);
  assert.match(response, /Disk available: unavailable/);
});

test("parsePmsetBattery extracts Mac power and battery state", () => {
  assert.deepEqual(parsePmsetBattery([
    "Now drawing from 'AC Power'",
    " -InternalBattery-0 (id=1)\t100%; charged; 0:00 remaining present: true",
  ].join("\n")), {
    batteryLevel: "100%",
    powerSource: "AC Power, charged",
  });
  assert.deepEqual(parsePmsetBattery("No batteries currently available"), {
    batteryLevel: "unavailable",
    powerSource: "unavailable",
  });
});

test("parseDfAvailable formats available disk space from df output", () => {
  assert.equal(parseDfAvailable([
    "Filesystem 1024-blocks Used Available Capacity Mounted on",
    "/dev/disk1 1000 488 512 49% /",
  ].join("\n")), "512.0 KiB");
  assert.equal(parseDfAvailable("bad output"), "unavailable");
});

test("collectPrivateLocalIps returns only non-internal private addresses", () => {
  assert.deepEqual(collectPrivateLocalIps({
    lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    en0: [
      { address: "192.168.1.20", family: "IPv4", internal: false },
      { address: "8.8.8.8", family: "IPv4", internal: false },
    ],
    utun0: [
      { address: "fd7a:115c:a1e0::1", family: "IPv6", internal: false },
      { address: "fe80::1", family: "IPv6", internal: false },
    ],
  }), ["en0:192.168.1.20", "utun0:fd7a:115c:a1e0::1"]);
});

test("host telemetry collectors degrade gracefully on unsupported or failed commands", async () => {
  assert.deepEqual(await collectMacPowerTelemetry({ platformValue: "linux" }), {
    batteryLevel: "unavailable",
    powerSource: "unavailable",
  });
  assert.deepEqual(await collectMacPowerTelemetry({
    platformValue: "darwin",
    runCommand: async () => ({ ok: false, stdout: "" }),
  }), {
    batteryLevel: "unavailable",
    powerSource: "unavailable",
  });
  assert.deepEqual(await collectDiskTelemetry({
    runCommand: async () => ({ ok: false, stdout: "" }),
  }), {
    diskAvailable: "unavailable",
  });
});
