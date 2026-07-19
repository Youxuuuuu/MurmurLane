import {
  isImageLikeMedia,
  isStickerLikeMedia,
} from "./conversation";
import type { ConversationMediaItem } from "../types/conversation";

export interface ConversationMediaDisplayGroups {
  stickers: ConversationMediaItem[];
  images: ConversationMediaItem[];
  files: ConversationMediaItem[];
}

function normalizedMediaIdentity(item: ConversationMediaItem) {
  const location = String(
    item.path
      || item.relativePath
      || item.url
      || item.fileName
      || "",
  )
    .trim()
    .replace(/\\/g, "/")
    .toLowerCase();

  return location || [item.kind, item.stickerId, item.label]
    .map((value) => String(value || "").trim().toLowerCase())
    .join(":");
}

/**
 * 归档记录与实时 Web Chat 分段统一使用这一份媒体展示契约。
 * 表情包本身也属于图片，必须优先分类；同一表情包还可能同时出现在
 * attachments 与 stickers 中，因此在这里按媒体身份统一去重。
 */
export function getConversationMediaDisplayGroups(
  items: ConversationMediaItem[] = [],
): ConversationMediaDisplayGroups {
  const uniqueItems: ConversationMediaItem[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    const identity = normalizedMediaIdentity(item) || `media-${index}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    uniqueItems.push(item);
  });

  return uniqueItems.reduce<ConversationMediaDisplayGroups>(
    (groups, item) => {
      if (isStickerLikeMedia(item)) {
        groups.stickers.push(item);
      } else if (isImageLikeMedia(item)) {
        groups.images.push(item);
      } else {
        groups.files.push(item);
      }
      return groups;
    },
    { stickers: [], images: [], files: [] },
  );
}
