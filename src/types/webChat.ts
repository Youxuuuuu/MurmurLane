import type { ConversationMediaItem, ConversationQuote, ConversationRecord } from "./conversation";

export interface WebChatMedia extends ConversationMediaItem {
  absolutePath?: string;
  sizeBytes?: number;
}

export interface WebChatMessageInput {
  messageId?: string;
  text: string;
  quote?: ConversationQuote | null;
  attachments?: WebChatMedia[];
  receivedAt?: string;
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
  [key: string]: unknown;
}

export interface WebChatStatus {
  connected?: boolean;
  workspaceId?: string;
  threadId?: string;
  status?: string;
  model?: string;
  modelProvider?: string;
  usage?: WebChatUsage | null;
  pendingApproval?: unknown;
  webClients?: number;
}

export interface WebChatModel {
  id?: string;
  model?: string;
  displayName?: string;
  isDefault?: boolean;
  contextWindow?: number;
  [key: string]: unknown;
}

export interface WebChatModelResponse {
  runtime: string;
  currentModel?: string;
  currentModelProvider?: string;
  models: WebChatModel[];
  updatedAt?: string;
}

export interface WebChatEvent {
  cursor?: number;
  id?: string;
  kind?: string;
  messageKind?: string;
  senderId?: string;
  threadId?: string;
  previousThreadId?: string;
  turnId?: string;
  itemId?: string;
  text?: string;
  usage?: WebChatUsage;
  record?: ConversationRecord;
  model?: string;
  modelProvider?: string;
  [key: string]: unknown;
}
