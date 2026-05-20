import type {
  ConversationActionPayload,
  ConversationMediaItem,
  ConversationRecord,
  ConversationRecordMeta,
  LegacyConversationMessage,
} from "../types/conversation";
import { resolveApiFileUrl } from "../data/api";
import { toHyphenDate } from "./date";
export function safeParseActionText(
  text: unknown,
): ConversationActionPayload | null {
  if (!text || typeof text !== "string") return null;

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isAttachmentInputRecord(record: ConversationRecord) {
  return (
    record?.type === "user" &&
    String(record.text ?? "").trimStart().startsWith("Saved attachments:")
  );
}

export function getConversationMediaItems(
  record: ConversationRecord,
): ConversationMediaItem[] {
  const attachments = Array.isArray(record?.meta?.attachments)
    ? record.meta.attachments
    : [];
  const stickers = Array.isArray(record?.meta?.stickers)
    ? record.meta.stickers
    : [];
  const files = Array.isArray(record?.meta?.files) ? record.meta.files : [];

  return [
    ...attachments.map((item, index) => ({
      ...item,
      sourceType: "attachment",
      mediaKey: `attachment-${index}-${item?.fileName || item?.relativePath || item?.path || ""}`,
    })),
    ...stickers.map((item, index) => ({
      ...item,
      sourceType: "sticker",
      mediaKey: `sticker-${index}-${item?.stickerId || item?.fileName || item?.relativePath || ""}`,
    })),
    ...files.map((item, index) => ({
      ...item,
      sourceType: "file",
      mediaKey: `file-${index}-${item?.fileName || item?.relativePath || item?.path || ""}`,
    })),
  ];
}

export function getConversationMediaPath(item: ConversationMediaItem) {
  return (
    item?.url ||
    item?.filePath ||
    item?.path ||
    item?.localPath ||
    item?.savedPath ||
    item?.relativePath ||
    ""
  );
}

export function isImageLikeMedia(item: ConversationMediaItem) {
  const mimeType = String(item?.mimeType || item?.contentType || "").toLowerCase();
  const filePath = String(
    item?.fileName || item?.relativePath || item?.path || item?.url || "",
  ).toLowerCase();

  return Boolean(
    item?.isImage ||
      item?.kind === "image" ||
      item?.type === "image" ||
      mimeType.startsWith("image/") ||
      /\.(png|jpg|jpeg|webp|bmp|svg)$/i.test(filePath),
  );
}

export function isStickerLikeMedia(item: ConversationMediaItem) {
  const filePath = String(
    item?.fileName || item?.relativePath || item?.path || item?.url || "",
  ).toLowerCase();

  return Boolean(
    item?.kind === "sticker" ||
      item?.type === "sticker" ||
      item?.sourceType === "sticker" ||
      /\.gif$/i.test(filePath),
  );
}

export function isFileLikeMedia(item: ConversationMediaItem) {
  return !isStickerLikeMedia(item) && !isImageLikeMedia(item);
}

export function getConversationMediaSrc(item: ConversationMediaItem) {
  const mediaPath = String(getConversationMediaPath(item) || "").trim();

  if (!mediaPath) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(mediaPath)) {
    return mediaPath;
  }

  return resolveApiFileUrl(mediaPath);
}

export function getConversationPrimaryMediaItem(
  record: ConversationRecord,
): ConversationMediaItem | null {
  const items = getConversationMediaItems(record);
  return (
    items.find((item) => isStickerLikeMedia(item)) ??
    items.find((item) => isImageLikeMedia(item)) ??
    items.find((item) => isFileLikeMedia(item)) ??
    null
  );
}

export function hasRecordMedia(record: ConversationRecord) {
  return getConversationMediaItems(record).length > 0;
}

export function shouldHideConversationRecord(record: ConversationRecord) {
  if (record?.meta?.visibleAs === "hidden") return true;

  if (hasRecordMedia(record)) return false;

  if (isAttachmentInputRecord(record)) return true;

  if (record?.type === "assistant") {
    const parsed = safeParseActionText(record.text);
    if (parsed?.action === "silent") return true;
  }

  return false;
}

export function getConversationDisplayText(record: ConversationRecord) {
  if (
    record?.type === "user" &&
    record?.meta?.visibleAs === "system_compact"
  ) {
    return record.meta?.displayText || "已触发 checkin";
  }

  if (isAttachmentInputRecord(record)) {
    return "";
  }

  if (record?.type === "assistant") {
    const parsed = safeParseActionText(record.text);
    if (parsed?.action === "send_message") {
      return parsed.message || "";
    }
  }

  return record?.text || "";
}

export function getConversationQuoteText(record: ConversationRecord) {
  const quote = record?.meta?.quote;

  if (!quote) return "";
  if (typeof quote === "string") return quote;
  if (typeof quote?.text === "string" && quote.text.trim()) return quote.text;
  if (typeof quote?.title === "string" && quote.title.trim()) return quote.title;

  return "";
}

export function getConversationVisualKind(record: ConversationRecord) {
  if (
    record?.type === "user" &&
    record?.meta?.visibleAs === "system_compact"
  ) {
    return "system";
  }

  const mediaItem = getConversationPrimaryMediaItem(record);

  if (mediaItem) {
    if (isStickerLikeMedia(mediaItem)) return "sticker";
    if (isImageLikeMedia(mediaItem)) return "image";
    if (isFileLikeMedia(mediaItem)) return "file";
  }

  if (isAttachmentInputRecord(record)) return "hidden";

  if (record?.type === "thinking") return "thinking";
  if (record?.type === "operation") return "operation";
  if (record?.type === "user") return "user";
  if (record?.type === "assistant") return "assistant";

  return "assistant";
}

export function getOperationDisplayPaths(record: ConversationRecord) {
  const candidates = [
    record?.meta?.displayPath,
    record?.meta?.relativePath,
    record?.meta?.path,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  const normalized = [];

  candidates.forEach((candidate) => {
    const normalizedCandidate = candidate.replace(/\\/g, "/").toLowerCase();
    const duplicateIndex = normalized.findIndex((item) => {
      if (item.normalized === normalizedCandidate) {
        return true;
      }

      if (
        item.normalized.length < normalizedCandidate.length &&
        normalizedCandidate.endsWith(item.normalized)
      ) {
        return true;
      }

      if (
        normalizedCandidate.length < item.normalized.length &&
        item.normalized.endsWith(normalizedCandidate)
      ) {
        item.value = candidate;
        item.normalized = normalizedCandidate;
        return true;
      }

      return false;
    });

    if (duplicateIndex === -1) {
      normalized.push({
        value: candidate,
        normalized: normalizedCandidate,
      });
    }
  });

  return normalized
    .map((item) => item.value)
    .sort((left, right) => left.length - right.length)
    .slice(0, 2);
}

export function legacyConversationMessageToRecord(
  message: LegacyConversationMessage,
  dateText: string,
  threadId: string,
): ConversationRecord {
  const timestamp = `${toHyphenDate(dateText)}T${message.time || "00:00"}:00+08:00`;
  let type = "assistant";

  if (message.role === "user") {
    type = "user";
  } else if (message.type === "thinking") {
    type = "thinking";
  } else if (message.type === "action") {
    type = "operation";
  }

  const meta: ConversationRecordMeta = {
    legacyType: message.type,
    quote: message.quote,
    displayPath: message.attachmentPaths?.join(" ") || "",
  };

  if (message.type === "file" || message.fileName) {
    meta.files = [
      {
        fileName: message.fileName || message.text || "file",
        label: message.text || message.fileName || "file",
        fileMeta: message.fileMeta || "",
      },
    ];
  }

  if (message.type === "image") {
    meta.attachments = [
      {
        kind: "image",
        label: message.caption || "图片",
        fileName: message.caption || "图片",
        isImage: true,
      },
    ];
  }

  if (message.type === "sticker") {
    meta.stickers = [
      {
        kind: "sticker",
        label: message.caption || "表情包",
        fileName: message.caption || "表情包",
      },
    ];
  }

  return {
    id: message.id,
    type,
    timestamp,
    threadId,
    turnId: message.turnId || "",
    workspaceRoot: message.workspaceRoot || "",
    text: message.text || "",
    meta,
  };
}

