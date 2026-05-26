export const COMMANDS = Object.freeze([
  "/camera_clip",
  "/camera_test",
  "/photo",
  "/schedule_photo",
  "/cancel_schedule",
  "/sound_alarm",
  "/logs",
  "/status",
  "/help",
]);

export const COMMANDS_REQUIRING_ARGS = Object.freeze({
  "/camera_clip": "Usage: /camera_clip <seconds>",
  "/schedule_photo": "Usage: /schedule_photo HH:MM",
  "/sound_alarm": "Usage: /sound_alarm <seconds>",
});

export const UNAUTHORIZED_RESPONSE = "Unauthorized chat.";
export const UNKNOWN_COMMAND_RESPONSE = "Unknown command.\nUse /help.";

export const HELP_RESPONSE = [
  "Available commands:",
  "/camera_clip <seconds> - capture and send a short local camera clip",
  "/camera_test - run a short ffmpeg camera diagnostic probe",
  "/photo - capture and send one still image",
  "/schedule_photo HH:MM - schedule one daily still image at server-local time",
  "/cancel_schedule - cancel the active daily photo schedule",
  "/sound_alarm <seconds> - play a local audible alert; cautious use only",
  "/logs - show recent Bot-owned runtime errors",
  "/status - show Bot status",
  "/help - show this command list",
].join("\n");

export const DEFAULT_STATE = Object.freeze({
  telegramUpdateOffset: null,
  dailyPhotoSchedule: null,
  errorLog: [],
});

export const MAX_ERROR_LOG_ENTRIES = 20;
export const MAX_ERROR_LOG_MESSAGE_LENGTH = 300;
export const MAX_LOGS_RESPONSE_LENGTH = 3500;
