import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseCameraClipConfig } from "./camera-clip.js";

export function parseAllowedChatIds(value) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function assertStartupEnv(env = process.env) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is required.");
  }
  const allowedChatIds = parseAllowedChatIds(env.ALLOWED_CHAT_IDS);
  if (env.NODE_ENV !== "test" && allowedChatIds.length === 0) {
    throw new Error("ALLOWED_CHAT_IDS must be non-empty outside NODE_ENV=test.");
  }
  return {
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    allowedChatIds,
    cameraClipConfig: parseCameraClipConfig({
      enabledValue: env.ENABLE_CAMERA_CLIP_COMMAND,
      commandJson: env.CAMERA_CLIP_COMMAND_JSON,
    }),
  };
}

export function initializeRuntimePaths(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const statePath = resolve(rootDir, options.statePath ?? "runtime_state.json");
  mkdirSync(rootDir, { recursive: true });
  return { rootDir, statePath };
}

export function createStartupContext(env = process.env, options = {}) {
  return {
    ...assertStartupEnv(env),
    ...initializeRuntimePaths(options),
  };
}
