import type { ConversationRecord } from "../types/conversation";
import type { WebChatMessageInput } from "../types/webChat";
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
  message: WebChatMessageInput & { messageId: string },
  threadId: string,
): ConversationRecord {
  const timestamp = message.receivedAt || new Date().toISOString();
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
      ...(message.quote ? { quote: message.quote } : {}),
      ...(message.attachments?.length ? { attachments: message.attachments } : {}),
      deliveryState: "sending",
      ephemeral: true,
      webChatLive: true,
      draft: true,
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
