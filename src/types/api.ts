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

export interface StickerAsset {
  id: string;
  fileName: string;
  name: string;
  tags: string[];
  category: string;
  description: string;
  src: string;
}

export interface LiveUpdateEvent {
  id: number;
  type:
    | "conversations"
    | "timeline"
    | "diary"
    | "dailySummary"
    | "letters"
    | "staticMemory"
    | "xiaoye"
    | "reminders"
    | "profiles"
    | "moments"
    | "resync";
  date?: string;
  mode?: string;
  threadId?: string;
}

export interface FetchConversationsOptions {
  threadId?: string;
  limit?: number;
}

export interface SearchConversationOptions {
  threadId?: string;
  query: string;
  month?: string;
  date?: string;
  limit?: number;
  signal?: AbortSignal;
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

export interface ConversationMoment {
  id: string;
  date: string;
  fileName: string;
  path: string;
  src: string;
}

export interface ConversationMomentsResponse {
  root: string;
  days: number;
  moments: ConversationMoment[];
}

export interface ConversationProfileApiData {
  name: string;
  handle: string;
  signature: string;
  avatar: string;
  groups?: string[];
  background?: string;
  backgroundImage?: string;
  backgroundPositionX?: number;
  backgroundPositionY?: number;
  group?: string;
  pinned?: boolean;
  thinkingFace?: string;
  threadId?: string;
  updatedAt?: string;
}

export interface ConversationProfilesResponse {
  root: string;
  user: ConversationProfileApiData | null;
  threads: Record<string, ConversationProfileApiData>;
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
  conversationMoments: ConversationMoment[];
  conversationProfiles: ConversationProfilesResponse | null;
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
