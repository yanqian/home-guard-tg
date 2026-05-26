import { setTimeout as delay } from "node:timers/promises";
import { createApp } from "./app.js";
import { createStartupContext } from "./config.js";
import { loadRuntimeState, saveRuntimeState } from "./runtime-state.js";
import { parseTelegramMessage, sendTelegramReply } from "./telegram-transport.js";
import { createDailyPhotoScheduler } from "./schedule-photo.js";
import { appendRuntimeError } from "./error-log.js";

const DEFAULT_POLL_TIMEOUT_SECONDS = 25;
const DEFAULT_POLL_INTERVAL_MS = 1000;

export function start(env = process.env, options = {}) {
  const context = createStartupContext(env, options);
  loadRuntimeState(context.statePath);
  const recordRuntimeError = createRuntimeErrorRecorder(context.statePath);
  let scheduleController = null;
  const app = options.app ?? createApp({
    allowedChatIds: context.allowedChatIds,
    cameraClipConfig: context.cameraClipConfig,
    cameraClipOptions: {
      spawnImpl: options.cameraClipSpawn,
      timeoutMs: options.cameraClipTimeoutMs,
    },
    cameraTestConfig: context.cameraTestConfig,
    cameraTestOptions: {
      spawnImpl: options.cameraTestSpawn,
      timeoutMs: options.cameraTestTimeoutMs,
    },
    photoConfig: context.photoConfig,
    photoOptions: {
      spawnImpl: options.photoSpawn,
      timeoutMs: options.photoTimeoutMs,
    },
    soundAlarmConfig: context.soundAlarmConfig,
    soundAlarmOptions: {
      spawnImpl: options.soundAlarmSpawn,
      timeoutMs: options.soundAlarmTimeoutMs,
    },
    schedulePhotoOptions: {
      statePath: context.statePath,
      onScheduleChanged() {
        scheduleController?.refresh();
      },
    },
    logsOptions: {
      statePath: context.statePath,
    },
  });

  scheduleController = createDailyPhotoScheduler({
    statePath: context.statePath,
    photoConfig: context.photoConfig,
    photoOptions: {
      spawnImpl: options.photoSpawn,
      timeoutMs: options.photoTimeoutMs,
    },
    telegramBotToken: context.telegramBotToken,
    fetchImpl: options.fetchImpl,
    setTimeoutImpl: options.scheduleSetTimeout,
    clearTimeoutImpl: options.scheduleClearTimeout,
    now: options.scheduleNow,
    onError(error) {
      recordRuntimeError("schedule_photo", error);
      options.scheduleOnError?.(error);
    },
  });
  scheduleController.refresh();

  const controller = startPolling({
    app,
    statePath: context.statePath,
    telegramBotToken: context.telegramBotToken,
    fetchImpl: options.fetchImpl,
    pollTimeoutSeconds: options.pollTimeoutSeconds,
    pollIntervalMs: options.pollIntervalMs,
    onError: (error) => recordRuntimeError("polling", error),
    onReplyError: (error) => recordRuntimeError("telegram_reply", error),
  });

  return {
    status: "polling",
    rootDir: context.rootDir,
    statePath: context.statePath,
    cameraClipConfig: context.cameraClipConfig,
    cameraTestConfig: context.cameraTestConfig,
    photoConfig: context.photoConfig,
    soundAlarmConfig: context.soundAlarmConfig,
    controller: {
      stop() {
        scheduleController.stop();
        controller.stop();
      },
      done: controller.done,
    },
  };
}

export function startPolling(options) {
  let stopped = false;
  const loop = (async () => {
    while (!stopped) {
      try {
        await pollOnce(options);
      } catch (error) {
        options.onError?.(error);
        console.error(error instanceof Error ? error.message : String(error));
      }
      if (!stopped) {
        await delay(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
      }
    }
  })();

  return {
    stop() {
      stopped = true;
    },
    done: loop,
  };
}

export async function pollOnce({
  app,
  statePath,
  telegramBotToken,
  fetchImpl = globalThis.fetch,
  pollTimeoutSeconds = DEFAULT_POLL_TIMEOUT_SECONDS,
  onReplyError,
}) {
  if (!app || typeof app.handleMessage !== "function") {
    throw new Error("app.handleMessage is required.");
  }
  const state = loadRuntimeState(statePath);
  const updates = await getTelegramUpdates({
    botToken: telegramBotToken,
    offset: state.telegramUpdateOffset,
    timeoutSeconds: pollTimeoutSeconds,
    fetchImpl,
  });

  for (const update of updates) {
    const updateId = update?.update_id;
    if (!Number.isSafeInteger(updateId) || updateId < 0) {
      continue;
    }

    const message = parseTelegramMessage(update);
    if (message) {
      const reply = await app.handleMessage(message);
      await attemptTelegramReply({
        botToken: telegramBotToken,
        chatId: message.chatId,
        reply,
        fetchImpl,
        onReplyError,
      });
    }

    persistTelegramUpdateOffset(statePath, updateId + 1);
  }

  return updates.length;
}

export async function getTelegramUpdates({
  botToken,
  offset,
  timeoutSeconds = DEFAULT_POLL_TIMEOUT_SECONDS,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required.");
  }
  const url = new URL(`https://api.telegram.org/bot${botToken}/getUpdates`);
  if (offset !== null && offset !== undefined) {
    url.searchParams.set("offset", String(offset));
  }
  url.searchParams.set("timeout", String(timeoutSeconds));

  const response = await fetchImpl(url);
  if (!response?.ok) {
    throw new Error("Telegram getUpdates failed.");
  }
  const json = await response.json();
  if (json?.ok !== true || !Array.isArray(json.result)) {
    throw new Error("Telegram getUpdates returned an invalid response.");
  }
  return json.result;
}

function persistTelegramUpdateOffset(statePath, nextOffset) {
  const state = loadRuntimeState(statePath);
  const currentOffset = state.telegramUpdateOffset;
  const telegramUpdateOffset = currentOffset === null || nextOffset > currentOffset
    ? nextOffset
    : currentOffset;
  saveRuntimeState(statePath, { ...state, telegramUpdateOffset });
}

async function attemptTelegramReply({ botToken, chatId, reply, fetchImpl, onReplyError }) {
  try {
    await sendTelegramReply({ botToken, chatId, reply, fetchImpl, onError: onReplyError });
  } catch (error) {
    onReplyError?.(error);
    // Avoid retry loops from transient Telegram send failures.
  }
}

function createRuntimeErrorRecorder(statePath) {
  return (source, error) => {
    try {
      appendRuntimeError(statePath, { source, error });
    } catch (logError) {
      console.error(logError instanceof Error ? logError.message : String(logError));
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
