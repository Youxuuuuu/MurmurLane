import type { ConversationRecord } from "../types/conversation";

function normalizeIdentityPart(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getConversationMessageId(record: ConversationRecord) {
  return normalizeIdentityPart(record.messageId || record.meta?.messageId);
}

export function getConversationItemId(record: ConversationRecord) {
  return normalizeIdentityPart(record.itemId || record.meta?.itemId);
}

// Assistant runtime records predate WebChat messageId. Their itemId is still
// stable and is the only safe identity that can address a Speech Rendition.
export function getSpeechRenditionRecordId(record: ConversationRecord) {
  return getConversationMessageId(record) || getConversationItemId(record);
}

export function getConversationThreadId(
  record: ConversationRecord,
  selectedThreadId = "",
) {
  return normalizeIdentityPart(record.threadId) || normalizeIdentityPart(selectedThreadId);
}

export function getConversationTurnId(record: ConversationRecord) {
  return normalizeIdentityPart(record.turnId);
}

export function getConversationDisplayTurnId(record: ConversationRecord) {
  return normalizeIdentityPart(record.meta?.displayTurnId)
    || normalizeIdentityPart(record.meta?.logicalTurnId)
    || getConversationTurnId(record);
}

export function getLegacyStableId(record: ConversationRecord) {
  return normalizeIdentityPart(record.sourceKey || record.meta?.sourceKey || record.source?.sourceKey)
    || normalizeIdentityPart(record.id);
}

export function getConversationRenderId(
  record: ConversationRecord,
  selectedThreadId = "",
) {
  const type = normalizeIdentityPart(record.type || record.role) || "record";
  const messageId = getConversationMessageId(record);
  if (type === "user" && messageId) {
    return `user:${messageId}`;
  }

  const itemId = getConversationItemId(record);
  const threadId = getConversationThreadId(record, selectedThreadId);
  if (type === "assistant" && itemId && threadId) {
    return `assistant:${threadId}:${itemId}`;
  }

  const legacyStableId = getLegacyStableId(record);
  return `legacy:${type}:${threadId || "unscoped"}:${legacyStableId || "missing-id"}`;
}

export function getAssistantTurnRenderId(threadId: string, turnId: string) {
  const normalizedThreadId = normalizeIdentityPart(threadId);
  const normalizedTurnId = normalizeIdentityPart(turnId);
  return normalizedThreadId && normalizedTurnId
    ? `assistant-turn:${normalizedThreadId}:${normalizedTurnId}`
    : "";
}

export function createBubbleId(renderId: string, stableSlotId: string) {
  const normalizedRenderId = normalizeIdentityPart(renderId);
  const normalizedSlotId = normalizeIdentityPart(stableSlotId);
  if (!normalizedRenderId || !normalizedSlotId) {
    throw new Error("bubble identity requires a renderId and stable slot id");
  }
  return `${normalizedRenderId}:bubble:${normalizedSlotId}`;
}

export function upsertConversationRecordByIdentity(
  records: ConversationRecord[],
  incoming: ConversationRecord,
  selectedThreadId = "",
) {
  const incomingRenderId = getConversationRenderId(incoming, selectedThreadId);
  const existingIndex = records.findIndex(
    (record) => getConversationRenderId(record, selectedThreadId) === incomingRenderId,
  );
  if (existingIndex < 0) return [...records, incoming];

  const existing = records[existingIndex];
  const nextRecord: ConversationRecord = {
    ...existing,
    ...incoming,
    meta: {
      ...(existing.meta || {}),
      ...(incoming.meta || {}),
    },
  };
  const next = [...records];
  next[existingIndex] = nextRecord;
  return next;
}
