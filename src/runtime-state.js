import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { DEFAULT_STATE, MAX_ERROR_LOG_ENTRIES, MAX_ERROR_LOG_MESSAGE_LENGTH } from "./constants.js";

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
    errorLog: normalizeErrorLog(value.errorLog),
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

function normalizeErrorLog(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isValidErrorLogEntry)
    .slice(-MAX_ERROR_LOG_ENTRIES)
    .map((entry) => ({
      ts: entry.ts,
      source: entry.source,
      message: entry.message.slice(0, MAX_ERROR_LOG_MESSAGE_LENGTH),
    }));
}

function isValidErrorLogEntry(value) {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && typeof value.ts === "string"
      && !Number.isNaN(Date.parse(value.ts))
      && typeof value.source === "string"
      && /^[a-z0-9_.:-]{1,40}$/i.test(value.source)
      && typeof value.message === "string"
      && value.message.trim().length > 0,
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
