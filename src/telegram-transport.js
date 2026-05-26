import { CAMERA_CLIP_RESPONSES, cleanupCameraClipResult, sendTelegramVideo } from "./camera-clip.js";
import { PHOTO_RESPONSES, cleanupPhotoResult, sendTelegramPhoto } from "./photo.js";

export function parseTelegramMessage(update) {
  const source = update?.message;
  const chatId = source?.chat?.id;
  const text = source?.text;
  if (chatId === undefined || chatId === null || typeof text !== "string") {
    return null;
  }
  return {
    chatId: String(chatId),
    text,
  };
}

export async function sendTelegramMessage({ botToken, chatId, text, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required.");
  }
  return fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: String(chatId),
      text,
    }),
  });
}

export async function sendTelegramReply({
  botToken,
  chatId,
  reply,
  fetchImpl = globalThis.fetch,
  onError,
}) {
  if (reply?.telegramPhoto) {
    try {
      await sendTelegramPhoto({
        botToken,
        chatId,
        photoPath: reply.telegramPhoto.path,
        fileName: reply.telegramPhoto.fileName,
        caption: reply.telegramPhoto.caption ?? reply.text,
        fetchImpl,
      });
    } catch (error) {
      onError?.(error);
      await sendTelegramMessage({
        botToken,
        chatId,
        text: PHOTO_RESPONSES.sendFailed,
        fetchImpl,
      });
    } finally {
      cleanupPhotoResult(reply.telegramPhoto);
    }
    return;
  }

  if (reply?.telegramVideo) {
    try {
      await sendTelegramVideo({
        botToken,
        chatId,
        videoPath: reply.telegramVideo.path,
        caption: reply.telegramVideo.caption ?? reply.text,
        fetchImpl,
      });
    } catch (error) {
      onError?.(error);
      await sendTelegramMessage({
        botToken,
        chatId,
        text: CAMERA_CLIP_RESPONSES.sendFailed,
        fetchImpl,
      });
    } finally {
      cleanupCameraClipResult(reply.telegramVideo);
    }
    return;
  }

  await sendTelegramMessage({
    botToken,
    chatId,
    text: typeof reply === "string" ? reply : String(reply?.text ?? ""),
    fetchImpl,
  });
}
