import {
  MAX_ERROR_LOG_ENTRIES,
  MAX_ERROR_LOG_MESSAGE_LENGTH,
  MAX_LOGS_RESPONSE_LENGTH,
} from "./constants.js";
import { loadRuntimeState, saveRuntimeState } from "./runtime-state.js";

const EMPTY_LOG_RESPONSE = "No recent Bot-owned runtime errors.";

export function appendRuntimeError(statePath, {
  source = "runtime",
  error,
  now = () => new Date(),
} = {}) {
  const state = loadRuntimeState(statePath);
  const entry = {
    ts: now().toISOString(),
    source: sanitizeSource(source),
    message: sanitizeErrorMessage(error),
  };
  const errorLog = [...state.errorLog, entry].slice(-MAX_ERROR_LOG_ENTRIES);
  saveRuntimeState(statePath, { ...state, errorLog });
  return entry;
}

export function formatRecentErrorLogs(statePath, { limit = 8 } = {}) {
  if (!statePath) {
    return EMPTY_LOG_RESPONSE;
  }
  const state = loadRuntimeState(statePath);
  const entries = state.errorLog.slice(-limit).reverse();
  if (entries.length === 0) {
    return EMPTY_LOG_RESPONSE;
  }

  const lines = entries.map((entry) => {
    const ts = Number.isNaN(Date.parse(entry.ts)) ? new Date(0).toISOString() : new Date(entry.ts).toISOString();
    return `${ts} [${sanitizeSource(entry.source)}] ${sanitizeErrorMessage(entry.message)}`;
  });
  return boundTelegramText(["Recent Bot-owned runtime errors:", ...lines].join("\n"));
}

export function sanitizeErrorMessage(error) {
  const raw = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error ?? "Unknown error");
  const redacted = redactSecrets(raw)
    .replace(/\S+\.(mp4|mov|m4v|jpg|jpeg|png|heic|webp)\b/gi, "[redacted-media-path]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (redacted || "Unknown error").slice(0, MAX_ERROR_LOG_MESSAGE_LENGTH);
}

export function redactSecrets(text) {
  return String(text ?? "")
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g, "[redacted-token]")
    .replace(/(api\.telegram\.org\/bot)[^/\s]+/gi, "$1[redacted-token]")
    .replace(
      /\b(botToken|token|authorization|password|secret)\b\s*[:=]\s*["']?[^"',\s]+/gi,
      "$1=[redacted]",
    );
}

function sanitizeSource(source) {
  const safe = String(source ?? "runtime").replace(/[^a-z0-9_.:-]/gi, "_").slice(0, 40);
  return safe || "runtime";
}

function boundTelegramText(text) {
  if (text.length <= MAX_LOGS_RESPONSE_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_LOGS_RESPONSE_LENGTH - 14)}\n[truncated]`;
}
