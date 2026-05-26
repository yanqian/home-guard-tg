import test from "node:test";
import assert from "node:assert/strict";
import { commandList, parseCommand } from "../../src/commands.js";
import { HELP_RESPONSE } from "../../src/constants.js";

test("commandList exposes only home-watch commands", () => {
  assert.deepEqual(commandList(), ["/camera_clip", "/photo", "/schedule_photo", "/cancel_schedule", "/status", "/help"]);
});

test("parseCommand parses known commands and required args", () => {
  assert.deepEqual(parseCommand("/status"), { ok: true, command: "/status", args: "" });
  assert.deepEqual(parseCommand("/camera_clip 3"), { ok: true, command: "/camera_clip", args: "3" });
  assert.deepEqual(parseCommand("/photo"), { ok: true, command: "/photo", args: "" });
  assert.deepEqual(parseCommand("/schedule_photo 09:00"), { ok: true, command: "/schedule_photo", args: "09:00" });
  assert.deepEqual(parseCommand("/cancel_schedule"), { ok: true, command: "/cancel_schedule", args: "" });
  assert.deepEqual(parseCommand("/camera_clip"), {
    ok: false,
    response: "Usage: /camera_clip <seconds>",
  });
  assert.deepEqual(parseCommand("/schedule_photo"), {
    ok: false,
    response: "Usage: /schedule_photo HH:MM",
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
  "/schedule_photo HH:MM - schedule one daily still image at server-local time",
  "/cancel_schedule - cancel the active daily photo schedule",
  "/status - show Bot status",
  "/help - show this command list",
].join("\n"));
});
