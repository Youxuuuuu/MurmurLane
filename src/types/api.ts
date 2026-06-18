import type {
  ConversationDateEntries,
  ConversationRecord,
} from "./conversation";
import type {
  DatedMemoryEntries,
  MemoryEntryResponse,
  ReminderHistoryEntry,
  ReminderHistoryResponse,
  StaticMemoryEntries,
  XiaoyeEntries,
} from "./memory";
import type { TimelineResponse, TimelineState } from "./timeline";
import type { MemoryEntry } from "./memory";
import type {
  EditableMemoryDocumentId,
  EditableMemoryDocumentType,
} from "../lib/editableMemory";

export interface ApiRequestOptions {
  signal?: AbortSignal;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface FetchConversationsOptions {
  threadId?: string;
  limit?: number;
}

export interface FetchTimelineOptions {
  date?: string;
  month?: string;
}

export interface DateIndexResponse {
  conversations: string[];
  conversationThreads?: Record<string, string[]>;
  diary: string[];
  dailySummary: string[];
  letters: string[];
  timeline: string[];
}

export interface RemoteSearchCache {
  conversations: ConversationDateEntries;
  diary: DatedMemoryEntries;
  dailySummary: DatedMemoryEntries;
  letters: DatedMemoryEntries;
  timeline: TimelineState;
}

export interface RemoteData {
  conversationEntries: ConversationDateEntries;
  timelineState: TimelineState;
  diaryEntries: DatedMemoryEntries;
  dailySummaryEntries: DatedMemoryEntries;
  letterEntries: DatedMemoryEntries;
  staticModeEntries: StaticMemoryEntries;
  xiaoyeEntries: XiaoyeEntries;
  reminderHistoryEntries: ReminderHistoryEntry[];
  dateIndex: DateIndexResponse | null;
  searchCache: RemoteSearchCache;
}

export type ConversationsResponse = ConversationRecord[];

export type TimelineApiResponse = TimelineResponse;

export type MemoryApiResponse = MemoryEntryResponse;

export type ReminderHistoryApiResponse = ReminderHistoryResponse;

export interface EditableMemoryDocumentApiRequest {
  documentType: EditableMemoryDocumentType;
  documentId: EditableMemoryDocumentId;
  date?: string;
}

export interface EditableMemoryDocumentApiResponse {
  found: boolean;
  writeEnabled?: boolean;
  path: string;
  content: string;
  entry: MemoryEntry | null;
}

export interface TimelineEventApiResponse {
  found: boolean;
  date?: string;
  event: Record<string, unknown> | null;
  deleted?: boolean;
}
