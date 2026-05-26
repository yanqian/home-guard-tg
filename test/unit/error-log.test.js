import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendRuntimeError,
  formatRecentErrorLogs,
  redactSecrets,
  sanitizeErrorMessage,
} from "../../src/error-log.js";
import { loadRuntimeState } from "../../src/runtime-state.js";

test("appendRuntimeError persists bounded redacted Bot-owned runtime errors", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-errors-"));
  const statePath = join(rootDir, "runtime_state.json");
  try {
    appendRuntimeError(statePath, {
      source: "polling",
      error: new Error("Telegram failed for 123456789:abcdefghijklmnopqrstuvwxyz"),
      now: () => new Date("2026-05-26T00:00:00.000Z"),
    });
    const state = loadRuntimeState(statePath);
    assert.deepEqual(state.errorLog, [{
      ts: "2026-05-26T00:00:00.000Z",
      source: "polling",
      message: "Error: Telegram failed for [redacted-token]",
    }]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("formatRecentErrorLogs returns clear empty state and bounded recent entries", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-errors-"));
  const statePath = join(rootDir, "runtime_state.json");
  try {
    assert.equal(formatRecentErrorLogs(statePath), "No recent Bot-owned runtime errors.");
    appendRuntimeError(statePath, {
      source: "telegram_reply",
      error: "sendVideo failed with token=secret and media bytes omitted",
      now: () => new Date("2026-05-26T00:00:00.000Z"),
    });
    const logs = formatRecentErrorLogs(statePath);
    assert.match(logs, /^Recent Bot-owned runtime errors:/);
    assert.match(logs, /2026-05-26T00:00:00.000Z \[telegram_reply\]/);
    assert.match(logs, /token=\[redacted\]/);
    assert.equal(logs.includes("secret"), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("redactSecrets and sanitizeErrorMessage avoid multiline or token leakage", () => {
  assert.equal(
    redactSecrets("https://api.telegram.org/bot123456789:abcdefghijklmnopqrstuvwxyz/sendMessage"),
    "https://api.telegram.org/bot[redacted-token]/sendMessage",
  );
  assert.equal(
    sanitizeErrorMessage("authorization=BearerSecret\nnext line"),
    "authorization=[redacted] next line",
  );
});
