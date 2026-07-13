import {
  getConversationDisplayText,
  getConversationMediaItems,
  getConversationQuoteText,
  getConversationVisualKind,
  isImageLikeMedia,
} from "./conversation";
import type {
  ConversationMediaItem,
  ConversationRecord,
} from "../types/conversation";

export function getConversationMessageDate(message: ConversationRecord) {
  return String(message?.conversationDate || "").replace(/-/g, ".");
}

function getImageMessageTimeBucket(message: ConversationRecord) {
  const dateText = getConversationMessageDate(message);
  const timestamp = message?.timestamp || message?.createdAt;
  if (timestamp) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      const dateKey =
        dateText ||
        `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      return `${dateKey}|${date.getHours()}-${date.getMinutes()}`;
    }
  }

  const clock = String(message?.time || "").match(/^(\d{1,2}):(\d{2})/);
  return clock ? `${dateText}|${clock[1].padStart(2, "0")}:${clock[2]}` : "";
}

function getConversationRole(message: ConversationRecord) {
  return String(message?.type || message?.role || "").trim();
}

function isSendFileOperation(message: ConversationRecord) {
  if (getConversationRole(message) !== "operation") return false;

  const toolName = String(
    message?.meta?.toolName || message?.meta?.rawToolName || "",
  ).toLowerCase();
  const text = String(message?.text || "").toLowerCase();

  return (
    toolName.includes("cyberboss_channel_send_file") ||
    text.includes("[cyberboss_channel_send_file]")
  );
}

function isSendFileImageRecord(message: ConversationRecord) {
  if (getConversationRole(message) !== "assistant") return false;
  if (getConversationVisualKind(message) !== "image") return false;

  const sourceKey = String(message?.meta?.sourceKey || "");
  const text = String(getConversationDisplayText(message) || "").trim();

  return (
    sourceKey.includes("|visible|assistant") ||
    /^Sent file\b/i.test(text)
  );
}

function getSendFileGroupKey(message: ConversationRecord) {
  const threadId = String(message?.threadId || "").trim();
  const turnId = String(message?.turnId || "").trim();
  if (turnId) return `turn:${threadId}|${turnId}`;

  const timeBucket = getImageMessageTimeBucket(message);
  return timeBucket ? `time:${threadId}|${timeBucket}` : "";
}

function getMediaIdentity(item: ConversationMediaItem) {
  return [
    item?.filePath,
    item?.path,
    item?.localPath,
    item?.savedPath,
    item?.relativePath,
    item?.url,
    item?.fileName,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

function mergeSendFileImages(messages: ConversationRecord[]) {
  const merged = [];
  const seen = new Set();

  messages.forEach((message) => {
    getConversationMediaItems(message)
      .filter(isImageLikeMedia)
      .forEach((item) => {
        const identity = getMediaIdentity(item);
        if (identity && seen.has(identity)) return;
        if (identity) seen.add(identity);
        merged.push(item);
      });
  });

  return merged;
}

function compareConversationRecordOrder(
  left: ConversationRecord,
  right: ConversationRecord,
) {
  const leftTime = new Date(left?.timestamp || left?.createdAt || "").getTime();
  const rightTime = new Date(right?.timestamp || right?.createdAt || "").getTime();

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  const leftLine = Number((left?.source as any)?.sourceLine);
  const rightLine = Number((right?.source as any)?.sourceLine);
  if (Number.isFinite(leftLine) && Number.isFinite(rightLine) && leftLine !== rightLine) {
    return leftLine - rightLine;
  }

  return 0;
}

function getImageMessageGroupKey(message: ConversationRecord) {
  const sendFileGroupKey = String(message?.meta?.sendFileGroupKey || "");
  if (sendFileGroupKey) return `send-file:${sendFileGroupKey}`;

  const timeBucket = getImageMessageTimeBucket(message);
  return timeBucket ? `time:${timeBucket}` : "";
}

function groupSendFileMessages(messages: ConversationRecord[]) {
  const groups = new Map();

  messages.forEach((message, index) => {
    const relevant =
      isSendFileOperation(message) || isSendFileImageRecord(message);
    if (!relevant) return;

    const key = getSendFileGroupKey(message);
    if (!key) return;

    if (!groups.has(key)) {
      groups.set(key, {
        operationIndexes: [],
        imageIndexes: [],
      });
    }

    const group = groups.get(key);
    if (isSendFileOperation(message)) group.operationIndexes.push(index);
    if (isSendFileImageRecord(message)) group.imageIndexes.push(index);
  });

  const replacements = new Map();
  const hiddenIndexes = new Set();

  groups.forEach((group, key) => {
    const groupIds = [
      ...group.operationIndexes,
      ...group.imageIndexes,
    ]
      .map((index) => messages[index]?.id)
      .filter(Boolean);

    if (group.operationIndexes.length > 0) {
      const firstOperationIndex = group.operationIndexes[0];
      const firstOperation = messages[firstOperationIndex];
      replacements.set(firstOperationIndex, {
        ...firstOperation,
        text: "[cyberboss_channel_send_file]",
        meta: {
          ...firstOperation.meta,
          sendFileGroupKey: key,
          sendFileGroupIds: groupIds,
          sendFileGroupCount: Math.max(
            group.imageIndexes.length,
            group.operationIndexes.length,
          ),
        },
      });

      group.operationIndexes.slice(1).forEach((index) => {
        hiddenIndexes.add(index);
      });
    }

    if (group.imageIndexes.length > 0) {
      const firstImageIndex = group.imageIndexes[0];
      const firstImage = messages[firstImageIndex];
      const imageRecords = group.imageIndexes
        .map((index) => messages[index])
        .sort(compareConversationRecordOrder);
      const attachments = mergeSendFileImages(imageRecords);

      replacements.set(firstImageIndex, {
        ...firstImage,
        text: "",
        meta: {
          ...firstImage.meta,
          attachments,
          files: [],
          stickers: [],
          sendFileGroupKey: key,
          sendFileGroupIds: groupIds,
          sendFileGroupCount: attachments.length,
        },
      });

      group.imageIndexes.slice(1).forEach((index) => {
        hiddenIndexes.add(index);
      });
    }
  });

  return messages.flatMap((message, index) => {
    if (hiddenIndexes.has(index)) return [];
    return [replacements.get(index) || message];
  });
}

function isImageOnlyMessage(message: ConversationRecord) {
  const mediaItems = getConversationMediaItems(message);
  const imageItems = mediaItems.filter(isImageLikeMedia);

  return (
    getConversationVisualKind(message) === "image" &&
    imageItems.length > 0 &&
    imageItems.length === mediaItems.length &&
    !String(getConversationDisplayText(message) || "").trim() &&
    !String(getConversationQuoteText(message) || "").trim()
  );
}

function mergeImageMessageGroup(messages: ConversationRecord[]) {
  const first = messages[0];
  if (!first || messages.length === 1) return first;

  const attachments = messages.flatMap((message) =>
    getConversationMediaItems(message).filter(isImageLikeMedia),
  );

  return {
    ...first,
    meta: {
      ...first.meta,
      attachments,
      files: [],
      stickers: [],
    },
    imageGroupIds: messages.map((message) => message.id).filter(Boolean),
    imageGroupCount: attachments.length,
  };
}

function groupImageMessagesByTime(messages: ConversationRecord[]) {
  const grouped = [];
  let pending = [];
  let pendingKey = "";
  let pendingType = "";

  const flush = () => {
    if (!pending.length) return;
    grouped.push(mergeImageMessageGroup(pending));
    pending = [];
    pendingKey = "";
    pendingType = "";
  };

  messages.forEach((message) => {
    const imageOnly = isImageOnlyMessage(message);
    const timeBucket = imageOnly ? getImageMessageGroupKey(message) : "";
    const messageType = String(message?.type || message?.role || "");
    const canJoin =
      imageOnly &&
      timeBucket &&
      pending.length > 0 &&
      pendingKey === timeBucket &&
      pendingType === messageType;

    if (canJoin) {
      pending.push(message);
      return;
    }

    flush();
    if (imageOnly && timeBucket) {
      pending = [message];
      pendingKey = timeBucket;
      pendingType = messageType;
    } else {
      grouped.push(message);
    }
  });

  flush();
  return grouped;
}

export function groupConversationDisplayRecords(
  messages: ConversationRecord[],
) {
  return groupImageMessagesByTime(groupSendFileMessages(messages));
}

export function messageMatchesConversationDisplayTarget(
  message: ConversationRecord,
  targetId: string,
) {
  return (
    message?.id === targetId ||
    (Array.isArray(message?.imageGroupIds) &&
      message.imageGroupIds.includes(targetId)) ||
    (Array.isArray(message?.meta?.sendFileGroupIds) &&
      message.meta.sendFileGroupIds.includes(targetId))
  );
}
