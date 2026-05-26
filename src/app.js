import { authorizeMessage } from "./auth.js";
import { parseCommand } from "./commands.js";
import { HELP_RESPONSE } from "./constants.js";
import { getCameraClipStatus, handleCameraClip } from "./camera-clip.js";

export function createApp({
  allowedChatIds,
  cameraClipConfig,
  cameraClipOptions = {},
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
        return formatStatus(getCameraClipStatus(cameraClipConfig));
      }
      if (parsed.command === "/camera_clip") {
        return handleCameraClip(parsed.args, cameraClipConfig, cameraClipOptions);
      }

      return HELP_RESPONSE;
    },
  };
}

function formatStatus(status) {
  return [
    "Home watch Bot is running.",
    `Camera command: ${status.enabled ? "enabled" : "disabled"}`,
    `Camera config: ${status.configValid ? "valid" : "invalid"}`,
    `Camera capture: ${status.activeCapture ? "active" : "idle"}`,
  ].join("\n");
}
