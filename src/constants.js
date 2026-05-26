export const COMMANDS = Object.freeze([
  "/camera_clip",
  "/status",
  "/help",
]);

export const COMMANDS_REQUIRING_ARGS = Object.freeze({
  "/camera_clip": "Usage: /camera_clip <seconds>",
});

export const UNAUTHORIZED_RESPONSE = "Unauthorized chat.";
export const UNKNOWN_COMMAND_RESPONSE = "Unknown command.\nUse /help.";

export const HELP_RESPONSE = [
  "Available commands:",
  "/camera_clip <seconds> - capture and send a short local camera clip",
  "/status - show Bot status",
  "/help - show this command list",
].join("\n");

export const DEFAULT_STATE = Object.freeze({
  telegramUpdateOffset: null,
});
