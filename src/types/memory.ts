export type MemoryMode =
  | "Diary"
  | "DailySummary"
  | "Letters"
  | "Project"
  | "Preference"
  | "Openloops"
  | "Facts"
  | "Patterns";

export type XiaoyeMode = "Ins" | "Anchor" | string;

export interface MemorySection {
  no: string;
  title: string;
  text: string;
  checked?: boolean;
  date?: string | null;
  group?: string;
}

export interface MemoryEntry {
  title: string;
  excerpt: string;
  sections: MemorySection[];
  blankText?: string;
}

export interface MemoryEntryResponse {
  found: boolean;
  entry: MemoryEntry | null;
}

export type DatedMemoryEntries = Record<string, MemoryEntry>;

export type StaticMemoryEntries = Record<string, MemoryEntry>;

export type XiaoyeEntries = Record<string, MemoryEntry>;

export interface ReminderPayload {
  id: string;
  text: string;
  dueAtMs?: number;
  createdAt?: string;
}

export interface ReminderHistoryEntry {
  archivedAt?: string;
  sourceFile?: string;
  reminder: ReminderPayload;
}

export interface ReminderHistoryResponse {
  found: boolean;
  entries: ReminderHistoryEntry[];
}
