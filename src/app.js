import { authorizeMessage } from "./auth.js";
import { parseCommand } from "./commands.js";
import { HELP_RESPONSE } from "./constants.js";
import { getCameraClipStatus, handleCameraClip } from "./camera-clip.js";
import { getPhotoStatus, handlePhoto } from "./photo.js";
import { handleCancelSchedule, handleSchedulePhoto } from "./schedule-photo.js";

export function createApp({
  allowedChatIds,
  cameraClipConfig,
  cameraClipOptions = {},
  photoConfig,
  photoOptions = {},
  schedulePhotoOptions = {},
} = {}) {
  return {
    async handleMessage(message) {
      const auth = authorizeMessage(message, allowedChatIds);
      if (!auth.ok) {
        return auth.response;
      }

      const parsed = parseCommand(message.text);
      if (!parsed.ok) {
        return parsed.response;
      }

      if (parsed.command === "/help") {
        return HELP_RESPONSE;
      }
      if (parsed.command === "/status") {
        return formatStatus(getCameraClipStatus(cameraClipConfig), getPhotoStatus(photoConfig));
      }
      if (parsed.command === "/camera_clip") {
        return handleCameraClip(parsed.args, cameraClipConfig, cameraClipOptions);
      }
      if (parsed.command === "/photo") {
        return handlePhoto(photoConfig, photoOptions);
      }
      if (parsed.command === "/schedule_photo") {
        return handleSchedulePhoto({
          args: parsed.args,
          chatId: message.chatId,
          photoConfig,
          statePath: schedulePhotoOptions.statePath,
          onScheduleChanged: schedulePhotoOptions.onScheduleChanged,
          now: schedulePhotoOptions.now,
        });
      }
      if (parsed.command === "/cancel_schedule") {
        return handleCancelSchedule({
          statePath: schedulePhotoOptions.statePath,
          onScheduleChanged: schedulePhotoOptions.onScheduleChanged,
        });
      }

      return HELP_RESPONSE;
    },
  };
}

function formatStatus(cameraStatus, photoStatus) {
  return [
    "Home watch Bot is running.",
    `Camera command: ${cameraStatus.enabled ? "enabled" : "disabled"}`,
    `Camera config: ${cameraStatus.configValid ? "valid" : "invalid"}`,
    `Photo command: ${photoStatus.enabled ? "enabled" : "disabled"}`,
    `Photo config: ${photoStatus.configValid ? "valid" : "invalid"}`,
    `Media capture: ${cameraStatus.activeCapture || photoStatus.activeCapture ? "active" : "idle"}`,
  ].join("\n");
}
