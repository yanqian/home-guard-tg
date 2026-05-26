import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { commandList } from "../../src/commands.js";
import { HELP_RESPONSE } from "../../src/constants.js";

test("command surface contains only home-watch commands", () => {
  assert.deepEqual(commandList(), ["/camera_clip", "/status", "/help"]);
  assert.equal(commandList().includes("/agent"), false);
  assert.equal(commandList().includes("/work"), false);
});

test("help output matches documented command surface", () => {
  assert.equal(HELP_RESPONSE, [
    "Available commands:",
    "/camera_clip <seconds> - capture and send a short local camera clip",
    "/status - show Bot status",
    "/help - show this command list",
  ].join("\n"));
});

test("feature_list contains unique completed initial feature", () => {
  const data = JSON.parse(readFileSync("feature_list.json", "utf8"));
  const ids = data.features.map((feature) => feature.id);
  assert.equal(new Set(ids).size, ids.length);
  const initialFeature = data.features.find((feature) => feature.id === "F001");
  assert.ok(initialFeature);
  assert.equal(initialFeature.passes, true);
  assert.equal(initialFeature.status, "done");
});

test("AGENTS external behavior rule is present", () => {
  const text = readFileSync("AGENTS.md", "utf8");
  assert.match(text, /External Behavior Verification/);
  assert.match(text, /Do not infer unknown external behavior/);
  assert.match(text, /process semantics such as argv, stdio, cwd, env, timeout, signal handling, or shell mode/);
});
