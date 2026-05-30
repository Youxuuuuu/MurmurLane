export interface SearchField {
  label: string;
  value: string;
  normalizedValue?: string;
  sectionNo?: string;
  sectionDate?: string | null;
  [key: string]: unknown;
}

export interface SearchFilters {
  modeFilter?: string;
  timeFilter?: string;
  conversationThreadScope?: "all" | "current";
  conversationThreadId?: string | null;
}

export interface SearchResult {
  mode: string;
  date: string | null;
  filterDate: string | null;
  timestamp: string | null;
  threadId: string | null;
  xiaoyeMode: string | null;
  timelineView?: "line" | "stats" | "reminders" | null;
  targetId: string;
  title: string;
  query: string;
  label: string;
  excerpt: string;
  fieldLabel: string;
}

export interface SearchResultState {
  results: SearchResult[];
  totalOccurrences: number;
}

export interface SearchSnippetMatch {
  fieldLabel: string;
  snippet: string;
  matchedText: string;
}
