import { authorizeMessage } from "./auth.js";
import { parseCommand } from "./commands.js";
import { HELP_RESPONSE } from "./constants.js";
import { getCameraClipStatus, handleCameraClip } from "./camera-clip.js";
import { getPhotoStatus, handlePhoto } from "./photo.js";
import { handleCancelSchedule, handleSchedulePhoto } from "./schedule-photo.js";
import { getSoundAlarmStatus, handleSoundAlarm } from "./sound-alarm.js";
import { formatStatus } from "./status.js";
import { formatRecentErrorLogs } from "./error-log.js";

export function createApp({
  allowedChatIds,
  cameraClipConfig,
  cameraClipOptions = {},
  photoConfig,
  photoOptions = {},
  soundAlarmConfig,
  soundAlarmOptions = {},
  schedulePhotoOptions = {},
  statusOptions = {},
  logsOptions = {},
} = {}) {
  const startedAtMs = statusOptions.startedAtMs ?? Date.now();
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
        return formatStatus({
          cameraStatus: getCameraClipStatus(cameraClipConfig),
          photoStatus: getPhotoStatus(photoConfig),
          alarmStatus: statusOptions.alarmStatus ?? getSoundAlarmStatus(soundAlarmConfig),
          startedAtMs,
          now: statusOptions.now,
          collectHostTelemetry: statusOptions.collectHostTelemetry,
        });
      }
      if (parsed.command === "/logs") {
        return formatRecentErrorLogs(logsOptions.statePath);
      }
      if (parsed.command === "/camera_clip") {
        return handleCameraClip(parsed.args, cameraClipConfig, cameraClipOptions);
      }
      if (parsed.command === "/photo") {
        return handlePhoto(photoConfig, photoOptions);
      }
      if (parsed.command === "/sound_alarm") {
        return handleSoundAlarm(parsed.args, soundAlarmConfig, soundAlarmOptions);
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
