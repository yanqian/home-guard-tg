import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { DEFAULT_STATE } from "./constants.js";

export function normalizeRuntimeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_STATE };
  }
  const offset = value.telegramUpdateOffset;
  return {
    telegramUpdateOffset: Number.isSafeInteger(offset) && offset >= 0 ? offset : null,
    dailyPhotoSchedule: isValidDailyPhotoSchedule(value.dailyPhotoSchedule)
      ? { ...value.dailyPhotoSchedule }
      : null,
  };
}

function isValidDailyPhotoSchedule(value) {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && value.type === "daily_photo"
      && typeof value.time === "string"
      && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.time)
      && typeof value.chatId === "string"
      && value.chatId.length > 0,
  );
}

export function loadRuntimeState(statePath) {
  if (!existsSync(statePath)) {
    const state = { ...DEFAULT_STATE };
    saveRuntimeState(statePath, state);
    return state;
  }
  return normalizeRuntimeState(JSON.parse(readFileSync(statePath, "utf8")));
}

export function saveRuntimeState(statePath, state) {
  mkdirSync(dirname(statePath), { recursive: true });
  const normalized = normalizeRuntimeState(state);
  const tempPath = `${statePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`);
  renameSync(tempPath, statePath);
  return normalized;
}
