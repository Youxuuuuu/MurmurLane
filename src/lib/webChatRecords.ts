import type { ConversationRecord } from "../types/conversation";
import type {
  WebChatEvent,
  WebChatLogicalMessageInput,
  WebChatMessageInput,
} from "../types/webChat";
import {
  getConversationMessageId,
  upsertConversationRecordByIdentity,
} from "./conversationIdentity";

export type WebChatRecordsByThread = Record<string, ConversationRecord[]>;

export function resolveThreadSubscriptionCursor(
  currentCursor: number | undefined,
  statusCursor: number | undefined,
) {
  return Math.max(Number(currentCursor) || 0, Number(statusCursor) || 0);
}

export function createWebChatDraftRecord(
  message: (WebChatMessageInput & { messageId: string }) | WebChatLogicalMessageInput,
  threadId: string,
  identity: { requestId?: string; logicalTurnId?: string } = {},
): ConversationRecord {
  const timestamp = message.receivedAt || new Date().toISOString();
  const bubbleSegments = Array.isArray((message as WebChatLogicalMessageInput).bubbleSegments)
    ? (message as WebChatLogicalMessageInput).bubbleSegments
    : [{
        segmentId: String((message as WebChatMessageInput).segmentId || message.messageId),
        text: message.text,
        ...((message as WebChatMessageInput).quote ? { quote: (message as WebChatMessageInput).quote } : {}),
        ...((message as WebChatMessageInput).attachments?.length
          ? { attachments: (message as WebChatMessageInput).attachments }
          : {}),
      }];
  return {
    id: `web-user-${message.messageId}`,
    messageId: message.messageId,
    type: "user",
    role: "user",
    timestamp,
    threadId,
    turnId: "",
    text: message.text,
    meta: {
      messageId: message.messageId,
      ...(identity.requestId ? { requestId: identity.requestId } : {}),
      ...(identity.logicalTurnId ? {
        logicalTurnId: identity.logicalTurnId,
        displayTurnId: identity.logicalTurnId,
      } : {}),
      bubbleSegments,
      ...(message.quote ? { quote: message.quote } : {}),
      ...(message.attachments?.length ? { attachments: message.attachments } : {}),
      deliveryState: "sending",
      ephemeral: true,
      webChatLive: true,
      draft: true,
    },
  };
}

export function createWebChatLiveRecord(
  event: WebChatEvent,
  targetThreadId: string,
): ConversationRecord {
  if (!event.record) {
    throw new Error("web chat message event requires a record");
  }
  const record = event.record;
  const type = String(record.type || record.role || "").trim();
  const messageId = String(
    record.messageId
      || record.meta?.messageId
      || (type === "user" ? event.messageId : "")
      || "",
  ).trim();
  const itemId = String(record.itemId || event.itemId || record.meta?.itemId || "").trim();
  const identity = {
    requestId: String(event.requestId || record.meta?.requestId || "").trim(),
    logicalTurnId: String(event.logicalTurnId || record.meta?.logicalTurnId || "").trim(),
    displayTurnId: String(event.displayTurnId || record.meta?.displayTurnId || "").trim(),
    transportTurnId: String(event.transportTurnId || record.meta?.transportTurnId || "").trim(),
    canonicalTurnId: String(event.canonicalTurnId || record.meta?.canonicalTurnId || "").trim(),
  };
  if (!identity.displayTurnId && identity.logicalTurnId) {
    identity.displayTurnId = identity.logicalTurnId;
  }

  return {
    ...record,
    ...(messageId ? { messageId } : {}),
    ...(itemId ? { itemId } : {}),
    threadId: String(record.threadId || event.threadId || targetThreadId || "").trim(),
    turnId: String(record.turnId || event.turnId || identity.transportTurnId || "").trim(),
    meta: {
      ...(record.meta || {}),
      ...(messageId ? { messageId } : {}),
      ...(itemId ? { itemId } : {}),
      ...(identity.requestId ? { requestId: identity.requestId } : {}),
      ...(identity.logicalTurnId ? { logicalTurnId: identity.logicalTurnId } : {}),
      ...(identity.displayTurnId ? { displayTurnId: identity.displayTurnId } : {}),
      ...(identity.transportTurnId ? { transportTurnId: identity.transportTurnId } : {}),
      ...(identity.canonicalTurnId ? { canonicalTurnId: identity.canonicalTurnId } : {}),
      ...(Number(event.protocolVersion) > 0
        ? { webChatProtocolVersion: Number(event.protocolVersion) }
        : {}),
      ephemeral: true,
      webChatLive: true,
      deliveryState: type === "user" ? "sent" : record.meta?.deliveryState,
    },
  };
}

export function upsertWebChatThreadRecord(
  current: WebChatRecordsByThread,
  threadId: string,
  record: ConversationRecord,
) {
  if (!threadId) return current;
  const nextRecord = { ...record, threadId };
  const existing = current[threadId] ?? [];
  return {
    ...current,
    [threadId]: upsertConversationRecordByIdentity(existing, nextRecord, threadId),
  };
}

export function settleWebChatDrafts(
  current: WebChatRecordsByThread,
  {
    sourceThreadId,
    targetThreadId,
    messageIds,
    turnId = "",
    deliveryState,
  }: {
    sourceThreadId: string;
    targetThreadId?: string;
    messageIds: string[];
    turnId?: string;
    deliveryState: "sent" | "failed";
  },
) {
  const identitySet = new Set(messageIds.filter(Boolean));
  if (!identitySet.size) return current;
  const destinationThreadId = targetThreadId || sourceThreadId;
  const next = { ...current };
  let destination = next[destinationThreadId] ?? [];

  for (const [candidateThreadId, records] of Object.entries(current)) {
    const retained: ConversationRecord[] = [];
    for (const record of records) {
      const messageId = getConversationMessageId(record);
      if (!identitySet.has(messageId)) {
        retained.push(record);
        continue;
      }
      const updated: ConversationRecord = {
        ...record,
        threadId: destinationThreadId,
        turnId: turnId || record.turnId,
        meta: {
          ...(record.meta || {}),
          deliveryState,
          draft: deliveryState === "failed",
        },
      };
      destination = upsertConversationRecordByIdentity(
        destination,
        updated,
        destinationThreadId,
      );
      if (candidateThreadId === destinationThreadId) {
        retained.push(updated);
      }
    }
    if (candidateThreadId !== destinationThreadId) {
      if (retained.length) next[candidateThreadId] = retained;
      else delete next[candidateThreadId];
    }
  }

  next[destinationThreadId] = destination;
  return next;
}
