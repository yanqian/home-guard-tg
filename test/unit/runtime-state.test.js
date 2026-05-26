import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRuntimeState, normalizeRuntimeState, saveRuntimeState } from "../../src/runtime-state.js";

test("normalizeRuntimeState preserves valid offset only", () => {
  assert.deepEqual(normalizeRuntimeState({ telegramUpdateOffset: 10 }), {
    telegramUpdateOffset: 10,
    dailyPhotoSchedule: null,
    errorLog: [],
  });
  assert.deepEqual(normalizeRuntimeState({ telegramUpdateOffset: -1 }), {
    telegramUpdateOffset: null,
    dailyPhotoSchedule: null,
    errorLog: [],
  });
  assert.deepEqual(normalizeRuntimeState({ telegramUpdateOffset: "10" }), {
    telegramUpdateOffset: null,
    dailyPhotoSchedule: null,
    errorLog: [],
  });
});

test("normalizeRuntimeState preserves only valid daily photo schedules", () => {
  assert.deepEqual(normalizeRuntimeState({
    telegramUpdateOffset: 10,
    dailyPhotoSchedule: { type: "daily_photo", time: "23:59", chatId: "123" },
  }), {
    telegramUpdateOffset: 10,
    dailyPhotoSchedule: { type: "daily_photo", time: "23:59", chatId: "123" },
    errorLog: [],
  });
  assert.equal(normalizeRuntimeState({
    dailyPhotoSchedule: { type: "daily_photo", time: "24:00", chatId: "123" },
  }).dailyPhotoSchedule, null);
  assert.equal(normalizeRuntimeState({
    dailyPhotoSchedule: { type: "daily_photo", time: "09:00", chatId: "" },
  }).dailyPhotoSchedule, null);
});

test("normalizeRuntimeState keeps bounded valid error log entries", () => {
  const entries = Array.from({ length: 25 }, (_, index) => ({
    ts: `2026-05-26T00:00:${String(index).padStart(2, "0")}.000Z`,
    source: "polling",
    message: `error ${index}`,
  }));
  const normalized = normalizeRuntimeState({
    errorLog: [
      { ts: "not-a-date", source: "polling", message: "bad" },
      { ts: "2026-05-26T00:00:00.000Z", source: "../host", message: "bad" },
      ...entries,
    ],
  });
  assert.equal(normalized.errorLog.length, 20);
  assert.equal(normalized.errorLog[0].message, "error 5");
  assert.equal(normalized.errorLog[19].message, "error 24");
});

test("loadRuntimeState creates default state and saveRuntimeState writes normalized JSON", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-state-"));
  const statePath = join(rootDir, "runtime_state.json");
  try {
    assert.deepEqual(loadRuntimeState(statePath), {
      telegramUpdateOffset: null,
      dailyPhotoSchedule: null,
      errorLog: [],
    });
    saveRuntimeState(statePath, {
      telegramUpdateOffset: 4,
      dailyPhotoSchedule: { type: "daily_photo", time: "06:30", chatId: "123" },
      extra: "ignored",
    });
    assert.deepEqual(JSON.parse(readFileSync(statePath, "utf8")), {
      telegramUpdateOffset: 4,
      dailyPhotoSchedule: { type: "daily_photo", time: "06:30", chatId: "123" },
      errorLog: [],
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
