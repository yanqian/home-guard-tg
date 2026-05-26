export const COMMANDS = Object.freeze([
  "/camera_clip",
  "/photo",
  "/schedule_photo",
  "/cancel_schedule",
  "/status",
  "/help",
]);

export const COMMANDS_REQUIRING_ARGS = Object.freeze({
  "/camera_clip": "Usage: /camera_clip <seconds>",
  "/schedule_photo": "Usage: /schedule_photo HH:MM",
});

export const UNAUTHORIZED_RESPONSE = "Unauthorized chat.";
export const UNKNOWN_COMMAND_RESPONSE = "Unknown command.\nUse /help.";

export const HELP_RESPONSE = [
  "Available commands:",
  "/camera_clip <seconds> - capture and send a short local camera clip",
  "/photo - capture and send one still image",
  "/schedule_photo HH:MM - schedule one daily still image at server-local time",
  "/cancel_schedule - cancel the active daily photo schedule",
  "/status - show Bot status",
  "/help - show this command list",
].join("\n");

export const DEFAULT_STATE = Object.freeze({
  telegramUpdateOffset: null,
  dailyPhotoSchedule: null,
});
