import { spawn } from "node:child_process";
import { redactSecrets } from "./error-log.js";

const CAMERA_TEST_DISABLED_RESPONSE = "Camera test command is disabled.";
const CAMERA_TEST_CONFIG_ERROR_RESPONSE = "Camera test config is missing or malformed.";
const CAMERA_TEST_TIMEOUT_RESPONSE = "Camera test timed out.";
const CAMERA_TEST_FAILED_RESPONSE = "Camera test failed to start.";
const DEFAULT_CAMERA_TEST_TIMEOUT_MS = 5000;
const MAX_CAMERA_TEST_STDERR_BYTES = 16 * 1024;
const MAX_CAMERA_TEST_STDERR_LINES = 20;
const DEFAULT_FFMPEG_CAMERA_TEST_ARGV = Object.freeze([
  "ffmpeg",
  "-hide_banner",
  "-f",
  "avfoundation",
  "-list_devices",
  "true",
  "-i",
  "",
]);

export function parseCameraTestConfig({ enabledValue, commandJson } = {}) {
  const enabled = String(enabledValue ?? "").trim() === "1";
  if (!enabled) {
    return { enabled: false, argv: null, error: null, usesDefaultFfmpegProbe: false };
  }

  if (commandJson === undefined || commandJson === null || String(commandJson).trim() === "") {
    return {
      enabled: true,
      argv: [...DEFAULT_FFMPEG_CAMERA_TEST_ARGV],
      error: null,
      usesDefaultFfmpegProbe: true,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(commandJson);
  } catch {
    return { enabled: true, argv: null, error: "CAMERA_TEST_COMMAND_JSON must be valid JSON.", usesDefaultFfmpegProbe: false };
  }

  const validationError = validateCameraTestArgv(parsed);
  return validationError
    ? { enabled: true, argv: null, error: validationError, usesDefaultFfmpegProbe: false }
    : { enabled: true, argv: parsed, error: null, usesDefaultFfmpegProbe: false };
}

export function validateCameraTestArgv(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    return "CAMERA_TEST_COMMAND_JSON must provide a non-empty argv array.";
  }
  if (!argv.every((item) => typeof item === "string" && item.length > 0)) {
    return "CAMERA_TEST_COMMAND_JSON argv entries must be non-empty strings.";
  }
  return null;
}

export async function handleCameraTest(cameraTestConfig, options = {}) {
  if (!cameraTestConfig?.enabled) {
    return CAMERA_TEST_DISABLED_RESPONSE;
  }

  if (cameraTestConfig.error || !cameraTestConfig.argv) {
    return CAMERA_TEST_CONFIG_ERROR_RESPONSE;
  }

  const result = await runCameraProbe(cameraTestConfig.argv, {
    spawnImpl: options.spawnImpl,
    timeoutMs: Math.min(
      Math.max(Number(options.timeoutMs ?? DEFAULT_CAMERA_TEST_TIMEOUT_MS), 1),
      DEFAULT_CAMERA_TEST_TIMEOUT_MS,
    ),
  });

  if (result.spawnError) {
    return CAMERA_TEST_FAILED_RESPONSE;
  }

  const header = result.timedOut
    ? CAMERA_TEST_TIMEOUT_RESPONSE
    : `Camera test finished with exit code ${result.exitCode ?? "unknown"}.`;
  return `${header}\nLast stderr lines:\n${formatCameraTestStderr(result.stderr)}`;
}

export function formatCameraTestStderr(stderr) {
  const redacted = redactCameraTestText(stderr)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-MAX_CAMERA_TEST_STDERR_LINES);
  return redacted.length > 0 ? redacted.join("\n") : "(no stderr captured)";
}

export function redactCameraTestText(text) {
  return redactSecrets(text)
    .replace(/\S+\.(mp4|mov|m4v|jpg|jpeg|png|heic|webp)\b/gi, "[redacted-media-path]")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ");
}

function runCameraProbe(argv, { timeoutMs, spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnImpl(argv[0], argv.slice(1), {
        shell: false,
        stdio: ["ignore", "ignore", "pipe"],
      });
    } catch {
      resolve({ exitCode: null, timedOut: false, spawnError: true, stderr: "" });
      return;
    }

    let settled = false;
    let stderr = "";
    const appendStderr = (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-MAX_CAMERA_TEST_STDERR_BYTES);
    };

    if (child.stderr && typeof child.stderr.on === "function") {
      child.stderr.on("data", appendStderr);
    }

    const settle = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stderr });
    };

    const timer = setTimeout(() => {
      if (typeof child.kill === "function") {
        child.kill("SIGTERM");
      }
      settle({ exitCode: null, timedOut: true, spawnError: false });
    }, timeoutMs);

    child.on("error", () => {
      settle({ exitCode: null, timedOut: false, spawnError: true });
    });
    child.on("close", (code) => {
      settle({ exitCode: code, timedOut: false, spawnError: false });
    });
  });
}

export const CAMERA_TEST_RESPONSES = Object.freeze({
  disabled: CAMERA_TEST_DISABLED_RESPONSE,
  configError: CAMERA_TEST_CONFIG_ERROR_RESPONSE,
  timeout: CAMERA_TEST_TIMEOUT_RESPONSE,
  failed: CAMERA_TEST_FAILED_RESPONSE,
});
