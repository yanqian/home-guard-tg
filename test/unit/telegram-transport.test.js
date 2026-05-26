import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTelegramMessage, sendTelegramMessage, sendTelegramReply } from "../../src/telegram-transport.js";

test("parseTelegramMessage extracts chat id and text", () => {
  assert.deepEqual(parseTelegramMessage({ message: { chat: { id: 123 }, text: "/help" } }), {
    chatId: "123",
    text: "/help",
  });
  assert.equal(parseTelegramMessage({ edited_message: { text: "/help" } }), null);
});

test("sendTelegramMessage validates Telegram response success", async () => {
  await assert.rejects(
    sendTelegramMessage({
      botToken: "token",
      chatId: "123",
      text: "hello",
      fetchImpl() {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false }) });
      },
    }),
    /Telegram sendMessage failed\./,
  );

  await assert.rejects(
    sendTelegramMessage({
      botToken: "token",
      chatId: "123",
      text: "hello",
      fetchImpl() {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false }) });
      },
    }),
    /Telegram sendMessage failed\./,
  );
});

test("sendTelegramReply sends videos and cleans up media", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "home-watch-tg-video-"));
  const videoPath = join(tempDir, "clip.mp4");
  const calls = [];
  try {
    writeFileSync(videoPath, "fake-video");
    await sendTelegramReply({
      botToken: "token",
      chatId: "123",
      reply: {
        telegramVideo: {
          path: videoPath,
          caption: "clip",
          cleanupPaths: [tempDir],
        },
      },
      fetchImpl(url, options) {
        calls.push({ url, options });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      },
    });
    assert.equal(calls[0].url, "https://api.telegram.org/bottoken/sendVideo");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(existsSync(videoPath), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("sendTelegramReply sends photos and cleans up media", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "home-watch-tg-photo-"));
  const photoPath = join(tempDir, "still.png");
  const calls = [];
  try {
    writeFileSync(photoPath, "fake-photo");
    await sendTelegramReply({
      botToken: "token",
      chatId: "123",
      reply: {
        telegramPhoto: {
          path: photoPath,
          fileName: "still.png",
          caption: "photo",
          cleanupPaths: [tempDir],
        },
      },
      fetchImpl(url, options) {
        calls.push({ url, options });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      },
    });
    assert.equal(calls[0].url, "https://api.telegram.org/bottoken/sendPhoto");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(existsSync(photoPath), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
