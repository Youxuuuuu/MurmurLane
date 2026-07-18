import type {
  WebChatLogicalMessageInput,
  WebChatMessageInput,
  WebChatSendEnvelope,
} from "../types/webChat";

export interface BuildWebChatSendEnvelopeInput {
  requestId: string;
  messageId: string;
  clientId: string;
  threadId?: string;
  newThread?: boolean;
  model?: string;
  modelProvider?: string;
  messages: WebChatMessageInput[];
  receivedAt?: string;
}

function requiredIdentity(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`web chat send contract requires ${label}`);
  return normalized;
}

/**
 * Freezes the transport contract at the logical-message boundary.
 * A composer may stage many visual segments, but one submit always becomes
 * exactly one request, one user message, and one runtime turn correlation.
 */
export function buildWebChatSendEnvelope({
  requestId,
  messageId,
  clientId,
  threadId = "",
  newThread = false,
  model = "",
  modelProvider = "",
  messages,
  receivedAt,
}: BuildWebChatSendEnvelopeInput): WebChatSendEnvelope {
  const stableRequestId = requiredIdentity(requestId, "requestId");
  const stableMessageId = requiredIdentity(messageId, "messageId");
  const stableClientId = requiredIdentity(clientId, "clientId");
  const segments = (Array.isArray(messages) ? messages : []).map((message) => ({
    segmentId: requiredIdentity(message.segmentId, "segmentId"),
    text: String(message.text || "").trim(),
    ...(message.quote ? { quote: message.quote } : {}),
    ...(message.attachments?.length ? { attachments: message.attachments } : {}),
  }));
  if (!segments.length) throw new Error("web chat send contract requires at least one segment");
  if (new Set(segments.map((segment) => segment.segmentId)).size !== segments.length) {
    throw new Error("web chat send contract requires unique segmentId values");
  }

  const timestamp = String(
    receivedAt
      || messages.find((message) => message.receivedAt)?.receivedAt
      || new Date().toISOString(),
  );
  const logicalMessage: WebChatLogicalMessageInput = {
    messageId: stableMessageId,
    text: segments.map((segment) => segment.text).filter(Boolean).join("\n\n"),
    ...(segments.length === 1 && segments[0].quote ? { quote: segments[0].quote } : {}),
    attachments: segments.flatMap((segment) => segment.attachments || []),
    receivedAt: timestamp,
    bubbleSegments: segments,
  };

  return {
    requestId: stableRequestId,
    messageId: stableMessageId,
    logicalTurnId: `web:${stableRequestId}`,
    threadId,
    clientId: stableClientId,
    newThread,
    model,
    modelProvider,
    messages: [logicalMessage],
  };
}
