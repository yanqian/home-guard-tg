import test from "node:test";
import assert from "node:assert/strict";
import { commandList, parseCommand } from "../../src/commands.js";
import { HELP_RESPONSE } from "../../src/constants.js";

test("commandList exposes only home-watch commands", () => {
  assert.deepEqual(commandList(), ["/camera_clip", "/photo", "/status", "/help"]);
});

test("parseCommand parses known commands and required args", () => {
  assert.deepEqual(parseCommand("/status"), { ok: true, command: "/status", args: "" });
  assert.deepEqual(parseCommand("/camera_clip 3"), { ok: true, command: "/camera_clip", args: "3" });
  assert.deepEqual(parseCommand("/photo"), { ok: true, command: "/photo", args: "" });
  assert.deepEqual(parseCommand("/camera_clip"), {
    ok: false,
    response: "Usage: /camera_clip <seconds>",
  });
});

test("parseCommand rejects unknown command and non-command text", () => {
  assert.equal(parseCommand("/agent test").ok, false);
  assert.equal(parseCommand("hello").ok, false);
});

test("help response documents exact command surface", () => {
  assert.equal(HELP_RESPONSE, [
    "Available commands:",
    "/camera_clip <seconds> - capture and send a short local camera clip",
    "/photo - capture and send one still image",
    "/status - show Bot status",
    "/help - show this command list",
  ].join("\n"));
});
