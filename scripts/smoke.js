import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { start } from "../src/polling.js";

const rootDir = mkdtempSync(join(tmpdir(), "home-guard-tg-smoke-"));

try {
  const result = start(
    {
      TELEGRAM_BOT_TOKEN: "test-token",
      ALLOWED_CHAT_IDS: "123",
      NODE_ENV: "test",
      ENABLE_CAMERA_CLIP_COMMAND: "1",
      CAMERA_CLIP_COMMAND_JSON: JSON.stringify(["fake-camera", "{seconds}", "{output}"]),
    },
    {
      rootDir,
      fetchImpl() {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: [] }),
        });
      },
      pollTimeoutSeconds: 1,
      pollIntervalMs: 1,
    },
  );
  result.controller.stop();
  if (result.status !== "polling") {
    throw new Error("polling did not start");
  }
  if (!result.cameraClipConfig.enabled || result.cameraClipConfig.error !== null) {
    throw new Error("camera config was not parsed");
  }
  console.log("smoke passed");
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
