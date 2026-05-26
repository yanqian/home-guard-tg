import { spawn } from "node:child_process";

const SOUND_ALARM_DISABLED_RESPONSE = "Sound alarm command is disabled.";
const SOUND_ALARM_USAGE = "Usage: /sound_alarm <seconds> where seconds is an integer from 1 to 30.";
const SOUND_ALARM_CONFIG_ERROR_RESPONSE = "Sound alarm config is missing or malformed.";
const SOUND_ALARM_BUSY_RESPONSE = "Sound alarm is already running.";
const SOUND_ALARM_FAILED_RESPONSE = "Sound alarm failed.";
const SOUND_ALARM_TIMEOUT_RESPONSE = "Sound alarm timed out.";
const DEFAULT_ALARM_GRACE_MS = 2000;
const DEFAULT_ALARM_KILL_GRACE_MS = 500;

let activeAlarm = false;

export function parseSoundAlarmConfig({ enabledValue, commandJson } = {}) {
  const enabled = String(enabledValue ?? "").trim() === "1";
  if (!enabled) {
    return { enabled: false, argvTemplate: null, error: null };
  }

  if (commandJson === undefined || commandJson === null || String(commandJson).trim() === "") {
    return { enabled: true, argvTemplate: null, error: "SOUND_ALARM_COMMAND_JSON is required when ENABLE_SOUND_ALARM_COMMAND=1." };
  }

  let parsed;
  try {
    parsed = JSON.parse(commandJson);
  } catch {
    return { enabled: true, argvTemplate: null, error: "SOUND_ALARM_COMMAND_JSON must be valid JSON." };
  }

  const validationError = validateSoundAlarmArgvTemplate(parsed);
  return validationError
    ? { enabled: true, argvTemplate: null, error: validationError }
    : { enabled: true, argvTemplate: parsed, error: null };
}

export function validateSoundAlarmArgvTemplate(argvTemplate) {
  if (!Array.isArray(argvTemplate) || argvTemplate.length === 0) {
    return "SOUND_ALARM_COMMAND_JSON must provide a non-empty argv template array.";
  }
  if (!argvTemplate.every((item) => typeof item === "string" && item.length > 0)) {
    return "SOUND_ALARM_COMMAND_JSON argv entries must be non-empty strings.";
  }
  if (!argvTemplate.join("\n").includes("{seconds}")) {
    return "SOUND_ALARM_COMMAND_JSON argv must include {seconds}.";
  }
  return null;
}

export function parseSoundAlarmSeconds(args) {
  const value = String(args ?? "").trim();
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 30 ? seconds : null;
}

export function getSoundAlarmStatus(soundAlarmConfig) {
  if (!soundAlarmConfig?.enabled) {
    return { enabled: false, configValid: false, active: activeAlarm };
  }
  return {
    enabled: true,
    configValid: !soundAlarmConfig.error && Array.isArray(soundAlarmConfig.argvTemplate),
    active: activeAlarm,
  };
}

export async function handleSoundAlarm(args, soundAlarmConfig, options = {}) {
  const seconds = parseSoundAlarmSeconds(args);
  if (seconds === null) {
    return { response: SOUND_ALARM_USAGE, stateChanged: false };
  }

  if (!soundAlarmConfig?.enabled) {
    return { response: SOUND_ALARM_DISABLED_RESPONSE, stateChanged: false };
  }

  if (soundAlarmConfig.error || !soundAlarmConfig.argvTemplate) {
    return { response: SOUND_ALARM_CONFIG_ERROR_RESPONSE, stateChanged: false };
  }

  if (!acquireAlarm()) {
    return { response: SOUND_ALARM_BUSY_RESPONSE, stateChanged: false };
  }

  try {
    const argv = soundAlarmConfig.argvTemplate.map((item) => item.replaceAll("{seconds}", String(seconds)));
    const result = await runAlarm(argv, {
      timeoutMs: options.timeoutMs ?? (seconds * 1000 + DEFAULT_ALARM_GRACE_MS),
      killGraceMs: options.killGraceMs ?? DEFAULT_ALARM_KILL_GRACE_MS,
      spawnImpl: options.spawnImpl,
    });

    if (result.timedOut) {
      return { response: SOUND_ALARM_TIMEOUT_RESPONSE, stateChanged: false };
    }
    if (result.exitCode !== 0) {
      return { response: SOUND_ALARM_FAILED_RESPONSE, stateChanged: false };
    }

    return {
      response: `Sound alarm played for ${seconds}s. Cautious use only.`,
      stateChanged: false,
    };
  } catch {
    return { response: SOUND_ALARM_FAILED_RESPONSE, stateChanged: false };
  } finally {
    releaseAlarm();
  }
}

function acquireAlarm() {
  if (activeAlarm) {
    return false;
  }
  activeAlarm = true;
  return true;
}

function releaseAlarm() {
  activeAlarm = false;
}

function runAlarm(argv, { timeoutMs, killGraceMs = DEFAULT_ALARM_KILL_GRACE_MS, spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnImpl(argv[0], argv.slice(1), {
        shell: false,
        stdio: ["ignore", "ignore", "ignore"],
      });
    } catch {
      resolve({ exitCode: 1, timedOut: false });
      return;
    }

    let settled = false;
    let timedOut = false;
    let killTimer = null;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      timedOut = true;
      if (typeof child.kill === "function") {
        child.kill("SIGTERM");
      }
      killTimer = setTimeout(() => {
        if (settled) {
          return;
        }
        if (typeof child.kill === "function") {
          child.kill("SIGKILL");
        }
        settled = true;
        resolve({ exitCode: null, timedOut: true });
      }, killGraceMs);
    }, timeoutMs);
    child.on("error", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve({ exitCode: 1, timedOut: false });
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve(timedOut
        ? { exitCode: null, timedOut: true }
        : { exitCode: code, timedOut: false });
    });
  });
}

export const SOUND_ALARM_RESPONSES = Object.freeze({
  disabled: SOUND_ALARM_DISABLED_RESPONSE,
  usage: SOUND_ALARM_USAGE,
  configError: SOUND_ALARM_CONFIG_ERROR_RESPONSE,
  busy: SOUND_ALARM_BUSY_RESPONSE,
  failed: SOUND_ALARM_FAILED_RESPONSE,
  timeout: SOUND_ALARM_TIMEOUT_RESPONSE,
});
