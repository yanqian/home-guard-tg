import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRuntimeState, normalizeRuntimeState, saveRuntimeState } from "../../src/runtime-state.js";

test("normalizeRuntimeState preserves valid offset only", () => {
  assert.deepEqual(normalizeRuntimeState({ telegramUpdateOffset: 10 }), { telegramUpdateOffset: 10 });
  assert.deepEqual(normalizeRuntimeState({ telegramUpdateOffset: -1 }), { telegramUpdateOffset: null });
  assert.deepEqual(normalizeRuntimeState({ telegramUpdateOffset: "10" }), { telegramUpdateOffset: null });
});

test("loadRuntimeState creates default state and saveRuntimeState writes normalized JSON", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-state-"));
  const statePath = join(rootDir, "runtime_state.json");
  try {
    assert.deepEqual(loadRuntimeState(statePath), { telegramUpdateOffset: null });
    saveRuntimeState(statePath, { telegramUpdateOffset: 4, extra: "ignored" });
    assert.deepEqual(JSON.parse(readFileSync(statePath, "utf8")), { telegramUpdateOffset: 4 });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
