import type {
  ConversationMediaItem,
  ConversationQuote,
  ConversationRecord,
} from "../types/conversation";

export interface StableConversationBubbleSegment {
  segmentId: string;
  text: string;
  quote?: ConversationQuote | null;
  attachments?: ConversationMediaItem[];
}

export function getStableUserBubbleSegments(
  record: ConversationRecord,
): StableConversationBubbleSegment[] {
  const type = String(record.type || record.role || "").trim();
  if (type !== "user" || !Array.isArray(record.meta?.bubbleSegments)) {
    return [];
  }
  const seen = new Set<string>();
  return record.meta.bubbleSegments.flatMap((segment) => {
    const segmentId = String(segment?.segmentId || "").trim();
    if (!segmentId || seen.has(segmentId)) return [];
    seen.add(segmentId);
    return [{
      segmentId,
      text: String(segment.text || "").trim(),
      ...(segment.quote ? { quote: segment.quote } : {}),
      ...(Array.isArray(segment.attachments) && segment.attachments.length
        ? { attachments: segment.attachments }
        : {}),
    }];
  });
}
