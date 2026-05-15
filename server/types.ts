export const DEFAULT_CYBERBOSS_DATA_ROOT = "D:/study/.cyberboss";

export type StaticMemoryMode =
  | "projects"
  | "preferences"
  | "open_loops"
  | "facts"
  | "patterns";

export interface MemorySection {
  no: string;
  title: string;
  text: string;
  checked?: boolean;
  date?: string;
  group?: string;
}

export interface MemoryEntry {
  title: string;
  excerpt: string;
  sections: MemorySection[];
}

export interface MemoryEntryResponse {
  found: boolean;
  entry: MemoryEntry | null;
}

export interface ConversationRecord {
  [key: string]: unknown;
}

export interface DateIndexResponse {
  conversations: string[];
  diary: string[];
  dailySummary: string[];
  letters: string[];
  timeline: string[];
}

export interface JsonFileResult<T> {
  found: boolean;
  path: string;
  data: T | null;
}

export interface TextFileResult {
  found: boolean;
  path: string;
  content: string | null;
}
