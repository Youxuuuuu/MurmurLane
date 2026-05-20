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

export interface ApiRequestOptions {
  signal?: AbortSignal;
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
