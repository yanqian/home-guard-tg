import { handlePhoto } from "./photo.js";
import { loadRuntimeState, saveRuntimeState } from "./runtime-state.js";
import { sendTelegramReply } from "./telegram-transport.js";

const SCHEDULE_PHOTO_USAGE_RESPONSE = "Usage: /schedule_photo HH:MM";
const SCHEDULE_PHOTO_CONFIG_ERROR_RESPONSE = "Photo capture config is missing or malformed.";
const SCHEDULE_PHOTO_DISABLED_RESPONSE = "Photo command is disabled.";
const SCHEDULE_PHOTO_EXISTS_RESPONSE = "A daily photo schedule is already active. Run /cancel_schedule first.";
const CANCEL_SCHEDULE_CANCELLED_RESPONSE = "Daily photo schedule cancelled.";
const CANCEL_SCHEDULE_ABSENT_RESPONSE = "No daily photo schedule is active.";

export function parseSchedulePhotoTime(value) {
  const text = String(value ?? "").trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(text) ? text : null;
}

export function isValidDailyPhotoSchedule(value) {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && value.type === "daily_photo"
      && parseSchedulePhotoTime(value.time)
      && typeof value.chatId === "string"
      && value.chatId.length > 0,
  );
}

export function getServerTimezoneContext(date = new Date()) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "server local timezone";
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const minutes = String(absMinutes % 60).padStart(2, "0");
  return `${timeZone} (UTC${sign}${hours}:${minutes})`;
}

export function formatSchedulePhotoCreatedResponse(time, date = new Date()) {
  return `Daily photo scheduled for ${time} server-local time (${getServerTimezoneContext(date)}).`;
}

export async function handleSchedulePhoto({
  args,
  chatId,
  photoConfig,
  statePath,
  onScheduleChanged,
  now = () => new Date(),
} = {}) {
  const time = parseSchedulePhotoTime(args);
  if (!time) {
    return { response: SCHEDULE_PHOTO_USAGE_RESPONSE, stateChanged: false };
  }

  if (!photoConfig?.enabled) {
    return { response: SCHEDULE_PHOTO_DISABLED_RESPONSE, stateChanged: false };
  }
  if (photoConfig.error || !photoConfig.argvTemplate) {
    return { response: SCHEDULE_PHOTO_CONFIG_ERROR_RESPONSE, stateChanged: false };
  }
  if (!statePath) {
    return { response: "Schedule state path is unavailable.", stateChanged: false };
  }

  const state = loadRuntimeState(statePath);
  if (state.dailyPhotoSchedule) {
    return { response: SCHEDULE_PHOTO_EXISTS_RESPONSE, stateChanged: false };
  }

  const dailyPhotoSchedule = {
    type: "daily_photo",
    time,
    chatId: String(chatId),
  };
  saveRuntimeState(statePath, { ...state, dailyPhotoSchedule });
  if (typeof onScheduleChanged === "function") {
    onScheduleChanged();
  }

  return {
    response: formatSchedulePhotoCreatedResponse(time, now()),
    stateChanged: true,
  };
}

export async function handleCancelSchedule({
  statePath,
  onScheduleChanged,
} = {}) {
  if (!statePath) {
    return { response: "Schedule state path is unavailable.", stateChanged: false };
  }

  const state = loadRuntimeState(statePath);
  if (!state.dailyPhotoSchedule) {
    return { response: CANCEL_SCHEDULE_ABSENT_RESPONSE, stateChanged: false };
  }

  saveRuntimeState(statePath, { ...state, dailyPhotoSchedule: null });
  if (typeof onScheduleChanged === "function") {
    onScheduleChanged();
  }

  return { response: CANCEL_SCHEDULE_CANCELLED_RESPONSE, stateChanged: true };
}

export function millisecondsUntilNextLocalTime(time, date = new Date()) {
  const parsed = parseSchedulePhotoTime(time);
  if (!parsed) {
    return null;
  }
  const [hours, minutes] = parsed.split(":").map(Number);
  const target = new Date(date.getTime());
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() <= date.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - date.getTime();
}

export function createDailyPhotoScheduler({
  statePath,
  photoConfig,
  photoOptions = {},
  telegramBotToken,
  fetchImpl = globalThis.fetch,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  now = () => new Date(),
  onError = console.error,
} = {}) {
  let timer = null;
  let stopped = false;

  function clearTimer() {
    if (timer !== null) {
      clearTimeoutImpl(timer);
      timer = null;
    }
  }

  function refresh() {
    clearTimer();
    if (stopped || !statePath) {
      return;
    }

    const schedule = loadRuntimeState(statePath).dailyPhotoSchedule;
    if (!schedule) {
      return;
    }

    const delayMs = millisecondsUntilNextLocalTime(schedule.time, now());
    if (delayMs === null) {
      return;
    }

    timer = setTimeoutImpl(async () => {
      timer = null;
      try {
        const reply = await handlePhoto(photoConfig, photoOptions);
        await sendTelegramReply({
          botToken: telegramBotToken,
          chatId: schedule.chatId,
          reply,
          fetchImpl,
        });
      } catch (error) {
        if (typeof onError === "function") {
          onError(error);
        }
      } finally {
        if (!stopped) {
          refresh();
        }
      }
    }, delayMs);
    if (typeof timer?.unref === "function") {
      timer.unref();
    }
  }

  return {
    refresh,
    stop() {
      stopped = true;
      clearTimer();
    },
  };
}

export const SCHEDULE_PHOTO_RESPONSES = Object.freeze({
  usage: SCHEDULE_PHOTO_USAGE_RESPONSE,
  disabled: SCHEDULE_PHOTO_DISABLED_RESPONSE,
  configError: SCHEDULE_PHOTO_CONFIG_ERROR_RESPONSE,
  exists: SCHEDULE_PHOTO_EXISTS_RESPONSE,
  cancelled: CANCEL_SCHEDULE_CANCELLED_RESPONSE,
  absent: CANCEL_SCHEDULE_ABSENT_RESPONSE,
});
