export type ConversationRecordRole =
  | "user"
  | "assistant"
  | "thinking"
  | "operation"
  | string;

export type ConversationSourceType =
  | "attachment"
  | "sticker"
  | "file"
  | string;

export interface ConversationQuoteObject {
  text?: string;
  title?: string;
  [key: string]: unknown;
}

export type ConversationQuote = string | ConversationQuoteObject;

export interface ConversationMediaItem {
  label?: string;
  fileName?: string;
  relativePath?: string;
  path?: string;
  url?: string;
  contentType?: string;
  stickerId?: string;
  kind?: string;
  isImage?: boolean;
  sourceType?: ConversationSourceType;
  mediaKey?: string;
  fileMeta?: string;
  [key: string]: unknown;
}

export interface ConversationRecordMeta {
  messageId?: string;
  itemId?: string;
  sourceKey?: string;
  deliveryState?: "sending" | "sent" | "failed" | string;
  visibleAs?: string;
  displayText?: string;
  quote?: ConversationQuote;
  toolName?: string;
  pattern?: string;
  displayPath?: string;
  relativePath?: string;
  path?: string;
  files?: ConversationMediaItem[];
  attachments?: ConversationMediaItem[];
  stickers?: ConversationMediaItem[];
  legacyType?: string;
  [key: string]: unknown;
}

export interface ConversationRecord {
  id: string;
  messageId?: string;
  itemId?: string;
  sourceKey?: string;
  type?: ConversationRecordRole;
  role?: string;
  timestamp?: string;
  createdAt?: string;
  time?: string;
  threadId?: string;
  turnId?: string;
  workspaceRoot?: string;
  text?: string;
  meta?: ConversationRecordMeta;
  source?: {
    sourceKey?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LegacyConversationMessage {
  id: string;
  role?: string;
  type?: string;
  time?: string;
  text?: string;
  quote?: ConversationQuote;
  turnId?: string;
  workspaceRoot?: string;
  fileName?: string;
  fileMeta?: string;
  caption?: string;
  attachmentPaths?: string[];
  [key: string]: unknown;
}

export interface ConversationActionPayload {
  action?: string;
  message?: string;
  [key: string]: unknown;
}

export type ConversationThreadRecords = Record<string, ConversationRecord[]>;

export type ConversationDateEntries = Record<string, ConversationThreadRecords>;
