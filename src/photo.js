import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { acquireMediaCapture, isMediaCaptureActive, releaseMediaCapture } from "./media-capture.js";

const PHOTO_DISABLED_RESPONSE = "Photo command is disabled.";
const PHOTO_CONFIG_ERROR_RESPONSE = "Photo capture config is missing or malformed.";
const PHOTO_BUSY_RESPONSE = "Media capture is already running.";
const PHOTO_CAPTURE_FAILED_RESPONSE = "Photo capture failed.";
const PHOTO_TIMEOUT_RESPONSE = "Photo capture timed out.";
const PHOTO_EMPTY_OUTPUT_RESPONSE = "Photo capture did not produce an image.";
const DEFAULT_PHOTO_TIMEOUT_MS = 10000;
const DEFAULT_PHOTO_OUTPUT_FILENAME = "photo.jpg";

export function parsePhotoConfig({ enabledValue, commandJson, outputFileName } = {}) {
  const enabled = String(enabledValue ?? "").trim() === "1";
  if (!enabled) {
    return { enabled: false, argvTemplate: null, outputFileName: DEFAULT_PHOTO_OUTPUT_FILENAME, error: null };
  }

  if (commandJson === undefined || commandJson === null || String(commandJson).trim() === "") {
    return { enabled: true, argvTemplate: null, outputFileName: DEFAULT_PHOTO_OUTPUT_FILENAME, error: "PHOTO_COMMAND_JSON is required when ENABLE_PHOTO_COMMAND=1." };
  }

  let parsed;
  try {
    parsed = JSON.parse(commandJson);
  } catch {
    return { enabled: true, argvTemplate: null, outputFileName: DEFAULT_PHOTO_OUTPUT_FILENAME, error: "PHOTO_COMMAND_JSON must be valid JSON." };
  }

  const normalizedOutputFileName = normalizeOutputFileName(outputFileName);
  const validationError = validatePhotoArgvTemplate(parsed) ?? validateOutputFileName(normalizedOutputFileName);
  return validationError
    ? { enabled: true, argvTemplate: null, outputFileName: normalizedOutputFileName, error: validationError }
    : { enabled: true, argvTemplate: parsed, outputFileName: normalizedOutputFileName, error: null };
}

export function validatePhotoArgvTemplate(argvTemplate) {
  if (!Array.isArray(argvTemplate) || argvTemplate.length === 0) {
    return "PHOTO_COMMAND_JSON must provide a non-empty argv template array.";
  }
  if (!argvTemplate.every((item) => typeof item === "string" && item.length > 0)) {
    return "PHOTO_COMMAND_JSON argv entries must be non-empty strings.";
  }
  if (!argvTemplate.join("\n").includes("{output}")) {
    return "PHOTO_COMMAND_JSON argv must include {output}.";
  }
  return null;
}

export function getPhotoStatus(photoConfig) {
  if (!photoConfig?.enabled) {
    return { enabled: false, configValid: false, activeCapture: isMediaCaptureActive() };
  }
  return {
    enabled: true,
    configValid: !photoConfig.error && Array.isArray(photoConfig.argvTemplate),
    activeCapture: isMediaCaptureActive(),
  };
}

export async function handlePhoto(photoConfig, options = {}) {
  if (!photoConfig?.enabled) {
    return { response: PHOTO_DISABLED_RESPONSE, stateChanged: false };
  }

  if (photoConfig.error || !photoConfig.argvTemplate) {
    return { response: PHOTO_CONFIG_ERROR_RESPONSE, stateChanged: false };
  }

  if (!acquireMediaCapture()) {
    return { response: PHOTO_BUSY_RESPONSE, stateChanged: false };
  }

  let tempDir = null;
  try {
    tempDir = await mkdtemp(join(tmpdir(), "home-guard-tg-photo-"));
    const outputPath = join(tempDir, normalizeOutputFileName(photoConfig.outputFileName));
    const argv = photoConfig.argvTemplate.map((item) => item.replaceAll("{output}", outputPath));
    const result = await runCapture(argv, {
      timeoutMs: options.timeoutMs ?? DEFAULT_PHOTO_TIMEOUT_MS,
      spawnImpl: options.spawnImpl,
    });

    if (result.timedOut) {
      cleanupPhotoResult({ cleanupPaths: [tempDir] });
      return { response: PHOTO_TIMEOUT_RESPONSE, stateChanged: false };
    }
    if (result.exitCode !== 0) {
      cleanupPhotoResult({ cleanupPaths: [tempDir] });
      return { response: PHOTO_CAPTURE_FAILED_RESPONSE, stateChanged: false };
    }
    if (!existsSync(outputPath) || statSync(outputPath).size <= 0) {
      cleanupPhotoResult({ cleanupPaths: [tempDir] });
      return { response: PHOTO_EMPTY_OUTPUT_RESPONSE, stateChanged: false };
    }

    return {
      response: "Photo ready.",
      stateChanged: false,
      telegramPhoto: {
        path: outputPath,
        fileName: basename(outputPath),
        caption: "Photo",
        cleanupPaths: [tempDir],
      },
    };
  } catch {
    if (tempDir) {
      cleanupPhotoResult({ cleanupPaths: [tempDir] });
    }
    return { response: PHOTO_CAPTURE_FAILED_RESPONSE, stateChanged: false };
  } finally {
    releaseMediaCapture();
  }
}

export function cleanupPhotoResult(result) {
  for (const cleanupPath of result?.cleanupPaths ?? result?.telegramPhoto?.cleanupPaths ?? []) {
    rmSync(cleanupPath, { recursive: true, force: true });
  }
}

export async function sendTelegramPhoto({ botToken, chatId, photoPath, fileName, caption, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required.");
  }

  const body = new FormData();
  body.set("chat_id", String(chatId));
  body.set("caption", String(caption ?? ""));
  body.set("photo", new Blob([readFileSync(photoPath)]), fileName || basename(photoPath));

  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    body,
  });
  if (!response?.ok) {
    throw new Error("Telegram sendPhoto failed.");
  }
  if (typeof response.json === "function") {
    const json = await response.json();
    if (json?.ok !== true) {
      throw new Error("Telegram sendPhoto failed.");
    }
  }
  return response;
}

function runCapture(argv, { timeoutMs, spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    const child = spawnImpl(argv[0], argv.slice(1), {
      shell: false,
      stdio: ["ignore", "ignore", "ignore"],
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      if (typeof child.kill === "function") {
        child.kill("SIGTERM");
      }
      resolve({ exitCode: null, timedOut: true });
    }, timeoutMs);
    child.on("error", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: 1, timedOut: false });
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: code, timedOut: false });
    });
  });
}

function normalizeOutputFileName(outputFileName) {
  return String(outputFileName ?? DEFAULT_PHOTO_OUTPUT_FILENAME).trim() || DEFAULT_PHOTO_OUTPUT_FILENAME;
}

function validateOutputFileName(outputFileName) {
  if (outputFileName !== basename(outputFileName)) {
    return "PHOTO_OUTPUT_FILENAME must be a file name, not a path.";
  }
  return null;
}

export const PHOTO_RESPONSES = Object.freeze({
  disabled: PHOTO_DISABLED_RESPONSE,
  configError: PHOTO_CONFIG_ERROR_RESPONSE,
  busy: PHOTO_BUSY_RESPONSE,
  captureFailed: PHOTO_CAPTURE_FAILED_RESPONSE,
  timeout: PHOTO_TIMEOUT_RESPONSE,
  emptyOutput: PHOTO_EMPTY_OUTPUT_RESPONSE,
  sendFailed: "Photo send failed.",
});
