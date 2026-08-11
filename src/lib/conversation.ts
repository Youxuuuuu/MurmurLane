import type {
  ConversationActionPayload,
  ConversationMediaItem,
  ConversationRecord,
  ConversationRecordMeta,
  LegacyConversationMessage,
} from "../types/conversation";
import { toHyphenDate } from "./date";

export type CloudMusicDevice = "mobile" | "desktop";

export interface CloudMusicCardData {
  device: CloudMusicDevice;
  songId: string;
  title: string;
  artist: string;
  sourceLabel: string;
}

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

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getCloudMusicToolHints(record: ConversationRecord) {
  return [
    record?.meta?.toolName,
    record?.meta?.rawToolName,
    record?.text,
  ].map((value) => String(value ?? ""));
}

export function getCloudMusicDevice(
  record: ConversationRecord,
): CloudMusicDevice | null {
  const [toolName, rawToolName, text] = getCloudMusicToolHints(record);

  if (
    toolName === "cloud_music_android_play" ||
    rawToolName.includes("cloud_music_android_play") ||
    text.includes("[cloud_music_android_play]")
  ) {
    return "mobile";
  }

  if (
    toolName === "cloud_music_play" ||
    rawToolName.includes("cloud_music_play") ||
    text.includes("[cloud_music_play]")
  ) {
    return "desktop";
  }

  return null;
}

export function isCloudMusicRecord(record: ConversationRecord) {
  return Boolean(getCloudMusicDevice(record));
}

function decodeText(value: unknown) {
  return String(value ?? "")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .trim();
}

function pickString(value: unknown) {
  const text = decodeText(value);
  return text || "";
}

function extractQuotedField(source: string, field: "title" | "artist") {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`, "i"),
    new RegExp(`\\\\"${field}\\\\"\\s*:\\s*\\\\"([^"]+)\\\\"`, "i"),
    new RegExp(`${field}\\s*[:=]\\s*["']([^"']+)["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern)?.[1];
    if (match) return decodeText(match);
  }

  return "";
}

function extractSongIdFromText(source: string) {
  const text = decodeText(source);
  const patterns = [
    /\[cloud_music_(?:android_)?play\]\s*(\d{4,})/i,
    /orpheus:\/\/song\/(\d{4,})/i,
    /"id"\s*:\s*"?(\d{4,})"?/i,
    /\\"id\\"\s*:\s*\\"?(\d{4,})\\"?/i,
    /\bsong\s+(\d{4,})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1];
    if (match) return match;
  }

  return "";
}

function mergeCloudMusicMeta(
  current: Partial<CloudMusicCardData>,
  next: Partial<CloudMusicCardData>,
) {
  if (!current.songId && next.songId) current.songId = next.songId;
  if (!current.title && next.title) current.title = next.title;
  if (!current.artist && next.artist) current.artist = next.artist;
}

function extractCloudMusicMetaFromValue(
  value: unknown,
  seen = new Set<unknown>(),
): Partial<CloudMusicCardData> {
  const result: Partial<CloudMusicCardData> = {};

  if (value === null || value === undefined) return result;

  if (typeof value === "string") {
    const parsed = safeJsonParse(value);
    if (parsed && !seen.has(parsed)) {
      mergeCloudMusicMeta(
        result,
        extractCloudMusicMetaFromValue(parsed, seen),
      );
    }

    const reparsed = parsed && typeof parsed === "string" ? safeJsonParse(parsed) : null;
    if (reparsed && !seen.has(reparsed)) {
      mergeCloudMusicMeta(
        result,
        extractCloudMusicMetaFromValue(reparsed, seen),
      );
    }

    if (!result.songId) result.songId = extractSongIdFromText(value);
    if (!result.title) result.title = extractQuotedField(value, "title");
    if (!result.artist) result.artist = extractQuotedField(value, "artist");
    return result;
  }

  if (typeof value !== "object") {
    return result;
  }

  if (seen.has(value)) return result;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => {
      mergeCloudMusicMeta(
        result,
        extractCloudMusicMetaFromValue(item, seen),
      );
    });
    return result;
  }

  const objectValue = value as Record<string, unknown>;
  const id = pickString(objectValue.id);
  const title = pickString(objectValue.title);
  const artist = pickString(objectValue.artist);
  const deepLink = pickString(objectValue.deepLink);

  if (id) result.songId = id;
  if (title) result.title = title;
  if (artist) result.artist = artist;
  if (!result.songId && deepLink) {
    result.songId = extractSongIdFromText(deepLink);
  }

  Object.values(objectValue).forEach((item) => {
    mergeCloudMusicMeta(
      result,
      extractCloudMusicMetaFromValue(item, seen),
    );
  });

  return result;
}

function getCloudMusicMetaCandidates(record: ConversationRecord) {
  return [
    record?.meta?.toolResultPreview,
    record?.meta?.resultSummary,
    record?.text,
  ];
}

export function extractCloudMusicSongId(record: ConversationRecord) {
  for (const candidate of getCloudMusicMetaCandidates(record)) {
    const meta = extractCloudMusicMetaFromValue(candidate);
    if (meta.songId) return meta.songId;
  }

  return "";
}

export function extractCloudMusicSongMeta(record: ConversationRecord) {
  const result: Partial<CloudMusicCardData> = {};

  getCloudMusicMetaCandidates(record).forEach((candidate) => {
    mergeCloudMusicMeta(result, extractCloudMusicMetaFromValue(candidate));
  });

  return result;
}

export function buildCloudMusicCardData(
  record: ConversationRecord,
  records: ConversationRecord[] = [],
): CloudMusicCardData | null {
  const device = getCloudMusicDevice(record);
  if (!device) return null;

  const currentMeta = extractCloudMusicSongMeta(record);
  const songId = currentMeta.songId || extractCloudMusicSongId(record);
  if (!songId) return null;

  let title = currentMeta.title || "";
  let artist = currentMeta.artist || "";

  if (!title || !artist) {
    records.some((candidate) => {
      if (candidate === record) return false;
      const candidateMeta = extractCloudMusicSongMeta(candidate);
      const candidateSongId =
        candidateMeta.songId || extractCloudMusicSongId(candidate);

      if (candidateSongId !== songId) return false;

      if (!title && candidateMeta.title) title = candidateMeta.title;
      if (!artist && candidateMeta.artist) artist = candidateMeta.artist;

      return Boolean(title && artist);
    });
  }

  const deviceLabel = device === "mobile" ? "手机播放" : "电脑播放";

  return {
    device,
    songId,
    title: title || `歌曲 ${songId}`,
    artist: artist || deviceLabel,
    sourceLabel: "Cloud Music",
  };
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
  const voiceAsset = record?.meta?.voiceMessage && typeof record.meta.voiceMessage === "object"
    ? (record.meta.voiceMessage as { asset?: { relativePath?: unknown; mimeType?: unknown; durationMs?: unknown } }).asset
    : null;
  const voiceAssetPath = typeof voiceAsset?.relativePath === "string"
    ? voiceAsset.relativePath.trim().replace(/\\/g, "/")
    : "";
  const hasVoiceAttachment = [...attachments, ...files].some((item) => isAudioLikeMedia(item));
  const safeVoiceAssetPath = isSafeVoiceAssetPath(voiceAssetPath) ? voiceAssetPath : "";
  // A processing/failed Voice Message can legitimately have no asset yet.
  // Keep it classified as voice so the same bubble can expose the backend
  // state and transcript without inventing a playable URL.
  const voiceMessage = record?.meta?.voiceMessage && typeof record.meta.voiceMessage === "object"
    ? record.meta.voiceMessage
    : null;
  const syntheticVoice = voiceMessage && !hasVoiceAttachment
    ? [{
        kind: "voice",
        contentType: String(voiceAsset?.mimeType || "audio/mpeg"),
        durationMs: Number(voiceAsset?.durationMs) || 0,
        path: safeVoiceAssetPath
          ? `/api/chat/media?path=${encodeURIComponent(`MLane/voice/${safeVoiceAssetPath}`)}`
          : "",
      }]
    : [];

  return [
    ...attachments.map((item, index) => ({
      ...item,
      sourceType: "attachment",
      mediaKey: `attachment-${index}-${item?.fileName || item?.relativePath || item?.path || item?.url || ""}`,
    })),
    ...stickers.map((item, index) => ({
      ...item,
      sourceType: "sticker",
      mediaKey: `sticker-${index}-${item?.stickerId || item?.fileName || item?.relativePath || ""}`,
    })),
    ...files.map((item, index) => ({
      ...item,
      sourceType: "file",
      mediaKey: `file-${index}-${item?.fileName || item?.relativePath || item?.path || item?.url || ""}`,
    })),
    ...syntheticVoice.map((item, index) => ({
      ...item,
      sourceType: "attachment",
      mediaKey: `voice-asset-${index}-${voiceAssetPath}`,
    })),
  ];
}

function isSafeVoiceAssetPath(value: string) {
  if (!/^(?:self|threads)\//u.test(value)) return false;
  const segments = value.split("/");
  return segments.length >= 3
    && segments.every((segment) => Boolean(segment) && segment !== "." && segment !== ".." && /^[A-Za-z0-9._-]+$/u.test(segment));
}

export function getConversationMediaPath(item: ConversationMediaItem) {
  const directUrl = String(item?.url || "").trim();

  if (/^(https?:|data:|blob:)/i.test(directUrl)) {
    return directUrl;
  }

  return (
    item?.relativePath ||
    item?.path ||
    item?.absolutePath ||
    directUrl ||
    ""
  );
}

function getWebChatMediaFilePath(mediaPath: string) {
  try {
    const parsed = new URL(mediaPath, "http://murmurlane.local");
    if (parsed.pathname !== "/api/chat/media") return "";
    return String(parsed.searchParams.get("path") || "").trim();
  } catch {
    return "";
  }
}

export function isImageLikeMedia(item: ConversationMediaItem) {
  const contentType = String(item?.contentType || "").toLowerCase();
  const filePath = String(
    item?.fileName || item?.relativePath || item?.path || item?.url || "",
  ).toLowerCase();

  return Boolean(
      item?.isImage ||
      item?.kind === "image" ||
      contentType.startsWith("image/") ||
      /\.(png|jpg|jpeg|webp|bmp|svg)$/i.test(filePath),
  );
}

export function isStickerLikeMedia(item: ConversationMediaItem) {
  const filePath = String(
    item?.fileName || item?.relativePath || item?.path || item?.url || "",
  ).toLowerCase();

  return Boolean(
    item?.kind === "sticker" ||
      item?.sourceType === "sticker" ||
      /\.gif$/i.test(filePath),
  );
}

export function isAudioLikeMedia(item: ConversationMediaItem) {
  const contentType = String(item?.contentType || "").toLowerCase();
  const filePath = String(
    item?.fileName || item?.relativePath || item?.path || item?.url || "",
  ).toLowerCase();
  return Boolean(
    item?.kind === "voice" ||
      item?.kind === "audio" ||
      contentType.startsWith("audio/") ||
      /\.(mp3|m4a|wav|ogg|oga|webm|aac|flac)$/i.test(filePath),
  );
}

export function isFileLikeMedia(item: ConversationMediaItem) {
  return !isStickerLikeMedia(item) && !isImageLikeMedia(item) && !isAudioLikeMedia(item);
}

export interface ConversationMediaUrlPort {
  readonly resolveLocalFile: (filePath: string) => string;
  readonly resolveWebChatAsset: (assetPath: string) => string;
}

export function getConversationMediaSrc(
  item: ConversationMediaItem,
  mediaUrls: ConversationMediaUrlPort,
) {
  const mediaPath = String(getConversationMediaPath(item) || "").trim();

  if (!mediaPath) {
    return "";
  }

  const webChatMediaFilePath = getWebChatMediaFilePath(mediaPath);
  if (webChatMediaFilePath) {
    return mediaUrls.resolveLocalFile(webChatMediaFilePath);
  }

  if (/^(https?:|data:|blob:)/i.test(mediaPath)) {
    return mediaPath;
  }

  if (mediaPath.startsWith("/api/chat/")) {
    return mediaUrls.resolveWebChatAsset(mediaPath);
  }

  return mediaUrls.resolveLocalFile(mediaPath);
}

export function getConversationStickerFallbackSrc(
  item: ConversationMediaItem,
  mediaUrls: ConversationMediaUrlPort,
) {
  const relativePath = String(item?.relativePath || "").trim();
  const fileName = String(item?.fileName || relativePath).trim();
  const hasStickerIdentity = Boolean(item?.stickerId || item?.fileName);
  const isBasenameOnly = Boolean(
    relativePath && !/[\\/]/.test(relativePath),
  );

  if (
    item?.kind !== "sticker" ||
    !hasStickerIdentity ||
    !isBasenameOnly ||
    !fileName ||
    /[\\/]/.test(fileName)
  ) {
    return "";
  }

  return mediaUrls.resolveLocalFile(`stickers/assets/${fileName}`);
}

export function getConversationPrimaryMediaItem(
  record: ConversationRecord,
): ConversationMediaItem | null {
  const items = getConversationMediaItems(record);
  return (
    items.find((item) => isStickerLikeMedia(item)) ??
    items.find((item) => isImageLikeMedia(item)) ??
    items.find((item) => isAudioLikeMedia(item)) ??
    items.find((item) => isFileLikeMedia(item)) ??
    null
  );
}

export function hasRecordMedia(record: ConversationRecord) {
  return getConversationMediaItems(record).length > 0;
}

export function shouldHideConversationRecord(record: ConversationRecord) {
  if (record?.meta?.visibleAs === "hidden") return true;

  if (
    record?.type === "error" &&
    String(record.text || "").trim() === "❌ Runtime process exited unexpectedly"
  ) {
    return true;
  }

  if (hasRecordMedia(record)) return false;

  if (isAttachmentInputRecord(record)) return true;

  if (record?.type === "assistant") {
    const parsed = safeParseActionText(record.text);
    if (parsed?.action === "silent") return true;
  }

  return false;
}

const WEB_CHAT_UI_NOTE_RE =
  /\s*Web chat UI note:\s*when you need to quote the user's words in your reply,\s*start the reply with \[Quoted: exact quoted text\] on its own line,\s*then write your response\.\s*Keep the quote short\.\s*$/i;

export function stripWebChatUiNote(value: unknown) {
  return String(value ?? "").replace(WEB_CHAT_UI_NOTE_RE, "").trim();
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
      return stripWebChatUiNote(parsed.message || "");
    }
  }

  return stripWebChatUiNote(record?.text || "");
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
    if (isAudioLikeMedia(mediaItem)) return "voice";
    if (isFileLikeMedia(mediaItem)) return "file";
  }

  if (isAttachmentInputRecord(record)) return "hidden";

  if (record?.type === "thinking") return "thinking";
  if (isCloudMusicRecord(record)) return "music";
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

  const normalized: Array<{ value: string; normalized: string }> = [];

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

