import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/app.js";
import { appendRuntimeError } from "../../src/error-log.js";
import { pollOnce } from "../../src/polling.js";
import { saveRuntimeState } from "../../src/runtime-state.js";

test("pollOnce dispatches camera clip and sends Telegram video", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-poll-"));
  const statePath = join(rootDir, "runtime_state.json");
  const calls = [];
  const outputs = [];
  try {
    saveRuntimeState(statePath, { telegramUpdateOffset: 5 });
    const app = createApp({
      allowedChatIds: ["123"],
      cameraClipConfig: {
        enabled: true,
        argvTemplate: ["fake-camera", "--seconds", "{seconds}", "--output", "{output}"],
        error: null,
      },
      cameraClipOptions: {
        timeoutMs: 1000,
        spawnImpl(command, args) {
          const child = new EventEmitter();
          setImmediate(() => {
            outputs.push(args[3]);
            writeFileSync(args[3], "fake-video");
            child.emit("close", 0);
          });
          child.kill = () => true;
          return child;
        },
      },
    });

    await pollOnce({
      app,
      statePath,
      telegramBotToken: "token",
      fetchImpl(url, options) {
        calls.push({ url: url.toString(), options });
        if (url.toString().includes("/getUpdates")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              ok: true,
              result: [{ update_id: 5, message: { chat: { id: 123 }, text: "/camera_clip 2" } }],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      },
    });

    assert.equal(calls[1].url, "https://api.telegram.org/bottoken/sendVideo");
    assert.equal(calls[1].options.method, "POST");
    assert.equal(existsSync(outputs[0]), false);
    assert.equal(JSON.parse(readFileSync(statePath, "utf8")).telegramUpdateOffset, 6);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("pollOnce reports video send failure with bounded text and deletes temp file", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-poll-"));
  const statePath = join(rootDir, "runtime_state.json");
  const calls = [];
  const outputs = [];
  try {
    saveRuntimeState(statePath, { telegramUpdateOffset: 10 });
    const app = createApp({
      allowedChatIds: ["123"],
      cameraClipConfig: {
        enabled: true,
        argvTemplate: ["fake-camera", "{seconds}", "{output}"],
        error: null,
      },
      cameraClipOptions: {
        timeoutMs: 1000,
        spawnImpl(command, args) {
          const child = new EventEmitter();
          setImmediate(() => {
            outputs.push(args[1]);
            writeFileSync(args[1], "fake-video");
            child.emit("close", 0);
          });
          child.kill = () => true;
          return child;
        },
      },
    });

    await pollOnce({
      app,
      statePath,
      telegramBotToken: "token",
      onReplyError(error) {
        appendRuntimeError(statePath, {
          source: "telegram_reply",
          error,
          now: () => new Date("2026-05-26T00:00:00.000Z"),
        });
      },
      fetchImpl(url, options) {
        calls.push({ url: url.toString(), options });
        if (url.toString().includes("/getUpdates")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              ok: true,
              result: [{ update_id: 10, message: { chat: { id: 123 }, text: "/camera_clip 1" } }],
            }),
          });
        }
        if (url.toString().includes("/sendVideo")) {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      },
    });

    assert.equal(calls[1].url, "https://api.telegram.org/bottoken/sendVideo");
    assert.equal(calls[2].url, "https://api.telegram.org/bottoken/sendMessage");
    assert.deepEqual(JSON.parse(calls[2].options.body), {
      chat_id: "123",
      text: "Camera clip send failed.",
    });
    assert.deepEqual(JSON.parse(readFileSync(statePath, "utf8")).errorLog, [{
      ts: "2026-05-26T00:00:00.000Z",
      source: "telegram_reply",
      message: "Error: Telegram sendVideo failed.",
    }]);
    assert.equal(existsSync(outputs[0]), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("pollOnce dispatches photo and sends Telegram photo", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-poll-"));
  const statePath = join(rootDir, "runtime_state.json");
  const calls = [];
  const outputs = [];
  try {
    saveRuntimeState(statePath, { telegramUpdateOffset: 20 });
    const app = createApp({
      allowedChatIds: ["123"],
      photoConfig: {
        enabled: true,
        argvTemplate: ["fake-photo", "--output", "{output}"],
        outputFileName: "still.png",
        error: null,
      },
      photoOptions: {
        timeoutMs: 1000,
        spawnImpl(command, args) {
          const child = new EventEmitter();
          setImmediate(() => {
            outputs.push(args[1]);
            writeFileSync(args[1], "fake-photo");
            child.emit("close", 0);
          });
          child.kill = () => true;
          return child;
        },
      },
    });

    await pollOnce({
      app,
      statePath,
      telegramBotToken: "token",
      fetchImpl(url, options) {
        calls.push({ url: url.toString(), options });
        if (url.toString().includes("/getUpdates")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              ok: true,
              result: [{ update_id: 20, message: { chat: { id: 123 }, text: "/photo" } }],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      },
    });

    assert.equal(calls[1].url, "https://api.telegram.org/bottoken/sendPhoto");
    assert.equal(calls[1].options.method, "POST");
    assert.equal(existsSync(outputs[0]), false);
    assert.equal(JSON.parse(readFileSync(statePath, "utf8")).telegramUpdateOffset, 21);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("pollOnce reports photo send failure with bounded text and deletes temp file", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "home-watch-tg-poll-"));
  const statePath = join(rootDir, "runtime_state.json");
  const calls = [];
  const outputs = [];
  try {
    saveRuntimeState(statePath, { telegramUpdateOffset: 30 });
    const app = createApp({
      allowedChatIds: ["123"],
      photoConfig: {
        enabled: true,
        argvTemplate: ["fake-photo", "{output}"],
        outputFileName: "photo.jpg",
        error: null,
      },
      photoOptions: {
        timeoutMs: 1000,
        spawnImpl(command, args) {
          const child = new EventEmitter();
          setImmediate(() => {
            outputs.push(args[0]);
            writeFileSync(args[0], "fake-photo");
            child.emit("close", 0);
          });
          child.kill = () => true;
          return child;
        },
      },
    });

    await pollOnce({
      app,
      statePath,
      telegramBotToken: "token",
      fetchImpl(url, options) {
        calls.push({ url: url.toString(), options });
        if (url.toString().includes("/getUpdates")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              ok: true,
              result: [{ update_id: 30, message: { chat: { id: 123 }, text: "/photo" } }],
            }),
          });
        }
        if (url.toString().includes("/sendPhoto")) {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      },
    });

    assert.equal(calls[1].url, "https://api.telegram.org/bottoken/sendPhoto");
    assert.equal(calls[2].url, "https://api.telegram.org/bottoken/sendMessage");
    assert.deepEqual(JSON.parse(calls[2].options.body), {
      chat_id: "123",
      text: "Photo send failed.",
    });
    assert.equal(existsSync(outputs[0]), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
