import type { ConversationMediaItem, ConversationQuote, ConversationRecord } from "./conversation";

export interface WebChatMedia extends ConversationMediaItem {
  absolutePath?: string;
  sizeBytes?: number;
}

export interface WebChatMessageInput {
  messageId?: string;
  segmentId?: string;
  text: string;
  quote?: ConversationQuote | null;
  attachments?: WebChatMedia[];
  receivedAt?: string;
}

export interface WebChatPendingUpload {
  pendingUpload: true;
  uploadId: string;
  file: Blob;
  fileName: string;
  contentType: string;
  kind: string;
  stickerId?: string;
  label?: string;
}

export type WebChatComposerAttachment = WebChatMedia | WebChatPendingUpload;

export interface WebChatComposerMessageInput
  extends Omit<WebChatMessageInput, "attachments"> {
  attachments?: WebChatComposerAttachment[];
}

export interface WebChatBubbleSegment {
  segmentId: string;
  text: string;
  quote?: ConversationQuote | null;
  attachments?: WebChatMedia[];
}

export interface WebChatLogicalMessageInput {
  messageId: string;
  text: string;
  quote?: ConversationQuote | null;
  attachments?: WebChatMedia[];
  receivedAt: string;
  bubbleSegments: WebChatBubbleSegment[];
}

export interface WebChatSendEnvelope {
  requestId: string;
  messageId: string;
  logicalTurnId: string;
  threadId?: string;
  clientId: string;
  newThread?: boolean;
  model?: string;
  modelProvider?: string;
  messages: [WebChatLogicalMessageInput];
}

export interface WebChatUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadInputTokens?: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
  currentTokens?: number;
  contextWindow?: number;
  latestInputTokens?: number;
  latestOutputTokens?: number;
  latestCacheReadInputTokens?: number;
  latestCacheCreationInputTokens?: number;
  [key: string]: unknown;
}

export interface WebChatUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  totalTokens: number;
  cacheHitRate: number;
}

export interface WebChatStatus {
  connected?: boolean;
  workspaceId?: string;
  threadId?: string;
  status?: string;
  model?: string;
  modelProvider?: string;
  effort?: string;
  contextUsage?: WebChatUsage | null;
  usageTotals?: WebChatUsageTotals | null;
  runtimeSettings?: WebChatModelResponse;
  pendingApproval?: unknown;
  webClients?: number;
  eventCursor?: number;
  voiceInput?: {
    enabled?: boolean;
    provider?: string;
    model?: string;
    configured?: boolean;
    available?: boolean;
  };
  assistantVoice?: {
    enabled?: boolean;
    provider?: string;
    model?: string;
    configured?: boolean;
    available?: boolean;
  };
  speechRendition?: {
    enabled?: boolean;
    provider?: string;
    model?: string;
    configured?: boolean;
    available?: boolean;
  };
  sendRequest?: {
    requestId?: string;
    status?: "accepted" | "failed" | "unknown" | string;
    result?: WebChatSendResult;
  } | null;
}

export interface WebChatModel {
  id?: string;
  model?: string;
  displayName?: string;
  provider?: string;
  supportedReasoningEfforts?: string[];
  defaultReasoningEffort?: string;
  catalogStatus?: "available" | "stale" | string;
  isDefault?: boolean;
  contextWindow?: number;
  [key: string]: unknown;
}

export interface WebChatEffortCapabilities {
  supported: boolean;
  options: string[];
  defaultEffort: string;
}

export interface WebChatModelResponse {
  runtime: string;
  currentModel?: string;
  currentModelProvider?: string;
  currentModelStatus?: "available" | "catalog-missing" | "catalog-unloaded" | "unknown" | string;
  currentEffort?: string;
  models: WebChatModel[];
  effort: WebChatEffortCapabilities;
  updatedAt?: string;
  refreshing?: boolean;
  stale?: boolean;
  error?: string;
  canRetry?: boolean;
}

export interface WebChatEvent {
  protocolVersion?: number;
  cursor?: number;
  id?: string;
  kind?: string;
  messageKind?: string;
  senderId?: string;
  threadId?: string;
  previousThreadId?: string;
  turnId?: string;
  itemId?: string;
  requestId?: string;
  messageId?: string;
  logicalTurnId?: string;
  displayTurnId?: string;
  transportTurnId?: string;
  canonicalTurnId?: string;
  text?: string;
  contextUsage?: WebChatUsage;
  usageTotals?: WebChatUsageTotals | null;
  record?: ConversationRecord;
  model?: string;
  modelProvider?: string;
  effort?: string;
  effortReset?: boolean;
  settings?: WebChatModelResponse;
  [key: string]: unknown;
}

export interface WebChatSendResult {
  accepted: boolean;
  status?: "accepted" | "failed" | "unknown" | string;
  requestId?: string;
  messageId?: string;
  logicalTurnId?: string;
  deduplicated?: boolean;
  queued?: boolean;
  threadId?: string;
  turnId?: string;
  clientId?: string;
  clientMessageId?: string;
  messageIds?: string[];
}

export interface WebChatVoiceMessageCommand {
  blob: Blob;
  requestId: string;
  messageId: string;
  threadId?: string;
  clientId: string;
  newThread?: boolean;
  receivedAt?: string;
}

export interface WebChatVoiceActionCommand {
  messageId: string;
  requestId: string;
  clientId: string;
  normalizedText?: string;
}

export interface WebChatSpeechRenditionCommand {
  messageId: string;
  requestId: string;
}
