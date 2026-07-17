import type {
  ApiRequestOptions,
  ConversationsResponse,
  ConversationMomentsResponse,
  ConversationProfileApiData,
  ConversationProfilesResponse,
  DateIndexResponse,
  EditableMemoryDocumentApiRequest,
  EditableMemoryDocumentApiResponse,
  FetchConversationsOptions,
  SearchConversationOptions,
  FetchTimelineOptions,
  MemoryApiResponse,
  LiveUpdateEvent,
  ReminderHistoryApiResponse,
  TimelineEventApiResponse,
  TimelineApiResponse,
} from "../types/api";

const env = (import.meta as { env?: Record<string, string | undefined> }).env;

const API_BASE_URL = String(env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const EDIT_TOKEN = String(env?.VITE_MURMURLANE_EDIT_TOKEN || "").trim();
export const HAS_EDIT_TOKEN = Boolean(EDIT_TOKEN);

export class ApiError extends Error {
  status: number;
  statusText: string;
  path: string;
  bodyText: string;

  constructor({
    status,
    statusText,
    path,
    bodyText,
  }: {
    status: number;
    statusText: string;
    path: string;
    bodyText: string;
  }) {
    super(`Request failed: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.path = path;
    this.bodyText = bodyText;
  }
}

function normalizeDate(date: string) {
  return String(date).replace(/\./g, "-");
}

function buildApiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  return query.toString();
}

async function requestJson<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (EDIT_TOKEN && !headers.has("X-MurmurLane-Edit-Token")) {
    headers.set("X-MurmurLane-Edit-Token", EDIT_TOKEN);
  }

  const response = await fetch(buildApiUrl(path), {
    signal: options.signal,
    method: options.method,
    headers,
    body: options.body,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new ApiError({
      status: response.status,
      statusText: response.statusText,
      path,
      bodyText,
    });
  }

  return response.json() as Promise<T>;
}

export function fetchConversations(
  date: string,
  options: FetchConversationsOptions = {},
): Promise<ConversationsResponse> {
  const query = buildQuery({
    date: normalizeDate(date),
    threadId: options.threadId,
    limit: options.limit,
  });

  return requestJson<ConversationsResponse>(`/api/conversations?${query}`);
}

export function searchConversation(
  options: SearchConversationOptions,
): Promise<ConversationsResponse> {
  const query = buildQuery({
    threadId: options.threadId,
    q: options.query,
    month: options.month ? normalizeDate(options.month).slice(0, 7) : undefined,
    date: options.date ? normalizeDate(options.date) : undefined,
    limit: options.limit,
  });

  return requestJson<ConversationsResponse>(`/api/conversations/search?${query}`, {
    signal: options.signal,
  });
}

export function fetchConversationMoments(
  days = 3,
): Promise<ConversationMomentsResponse> {
  const query = buildQuery({ days });
  return requestJson<ConversationMomentsResponse>(`/api/moments?${query}`);
}

export function fetchConversationProfiles(): Promise<ConversationProfilesResponse> {
  return requestJson<ConversationProfilesResponse>("/api/conversation-profiles");
}

export type StickerAsset = {
  id: string;
  fileName: string;
  name: string;
  tags: string[];
  category: string;
  description: string;
  src: string;
};

export function fetchStickerAssets(): Promise<{ stickers: StickerAsset[] }> {
  return requestJson<{ stickers: StickerAsset[] }>("/api/stickers");
}

export function saveConversationUserProfile(
  profile: ConversationProfileApiData,
): Promise<ConversationProfileApiData> {
  return requestJson<ConversationProfileApiData>("/api/conversation-profiles/user", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}

export function saveConversationThreadProfile(
  threadId: string,
  profile: ConversationProfileApiData,
): Promise<ConversationProfileApiData> {
  return requestJson<ConversationProfileApiData>(
    `/api/conversation-profiles/thread/${encodeURIComponent(threadId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    },
  );
}

export function fetchTimeline(
  options: FetchTimelineOptions = {},
): Promise<TimelineApiResponse> {
  const query = buildQuery({
    date: options.date ? normalizeDate(options.date) : undefined,
    month: options.month ? normalizeDate(options.month).slice(0, 7) : undefined,
  });

  return requestJson<TimelineApiResponse>(
    query ? `/api/timeline?${query}` : "/api/timeline",
  );
}

export function fetchDateIndex(): Promise<DateIndexResponse> {
  return requestJson<DateIndexResponse>("/api/index/dates");
}

export function fetchReminderHistory(): Promise<ReminderHistoryApiResponse> {
  return requestJson<ReminderHistoryApiResponse>("/api/reminders/history");
}

export function fetchMemoryDiary(date: string): Promise<MemoryApiResponse> {
  return requestJson<MemoryApiResponse>(
    `/api/memory/diary?date=${encodeURIComponent(normalizeDate(date))}`,
  );
}

export function fetchMemoryDailySummary(
  date: string,
): Promise<MemoryApiResponse> {
  return requestJson<MemoryApiResponse>(
    `/api/memory/daily-summary?date=${encodeURIComponent(normalizeDate(date))}`,
  );
}

export function fetchMemoryLetters(date: string): Promise<MemoryApiResponse> {
  return requestJson<MemoryApiResponse>(
    `/api/memory/letters?date=${encodeURIComponent(normalizeDate(date))}`,
  );
}

export function fetchMemoryStatic(mode: string): Promise<MemoryApiResponse> {
  return requestJson<MemoryApiResponse>(
    `/api/memory/static?mode=${encodeURIComponent(mode)}`,
  );
}

export function fetchXiaoyeStatic(mode: string): Promise<MemoryApiResponse> {
  return requestJson<MemoryApiResponse>(
    `/api/xiaoye/static?mode=${encodeURIComponent(mode)}`,
  );
}

export function fetchEditableMemoryDocument(
  input: EditableMemoryDocumentApiRequest,
): Promise<EditableMemoryDocumentApiResponse> {
  const query = buildQuery({
    documentType: input.documentType,
    documentId: input.documentId,
    date: input.date ? normalizeDate(input.date) : undefined,
  });

  return requestJson<EditableMemoryDocumentApiResponse>(
    `/api/editable-memory/document?${query}`,
  );
}

export function saveEditableMemoryDocument(
  input: EditableMemoryDocumentApiRequest & { content: string },
): Promise<EditableMemoryDocumentApiResponse> {
  return requestJson<EditableMemoryDocumentApiResponse>(
    "/api/editable-memory/document",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        date: input.date ? normalizeDate(input.date) : undefined,
      }),
    },
  );
}

export function toggleOpenLoopsChecklistItem(input: {
  no: string;
  checked: boolean;
}) {
  return requestJson<EditableMemoryDocumentApiResponse>(
    "/api/editable-memory/open-loops/toggle",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export function fetchTimelineEvent(
  date: string,
  eventId: string,
): Promise<TimelineEventApiResponse> {
  const query = buildQuery({
    date: normalizeDate(date),
    eventId,
  });

  return requestJson<TimelineEventApiResponse>(`/api/timeline/event?${query}`);
}

export function patchTimelineEvent(input: {
  date: string;
  eventId: string;
  changes: Record<string, unknown>;
}) {
  return requestJson<TimelineEventApiResponse>("/api/timeline/event", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      date: normalizeDate(input.date),
    }),
  });
}

export function createTimelineEvent(input: {
  date: string;
  event: Record<string, unknown>;
}) {
  return requestJson<TimelineEventApiResponse>("/api/timeline/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      date: normalizeDate(input.date),
    }),
  });
}

export function deleteTimelineEvent(input: { date: string; eventId: string }) {
  return requestJson<TimelineEventApiResponse>("/api/timeline/event", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      date: normalizeDate(input.date),
    }),
  });
}

export function resolveApiFileUrl(filePath: string) {
  return buildApiUrl(
    `/api/file?path=${encodeURIComponent(String(filePath ?? ""))}`,
  );
}

export function subscribeToLiveUpdates(
  onEvent: (event: LiveUpdateEvent) => void,
  onConnectionChange?: (connected: boolean) => void,
) {
  const source = new EventSource(buildApiUrl("/api/events"));

  source.addEventListener("open", () => onConnectionChange?.(true));
  source.addEventListener("error", () => onConnectionChange?.(false));
  source.addEventListener("change", (event) => {
    try {
      onEvent(JSON.parse((event as MessageEvent<string>).data) as LiveUpdateEvent);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("[MurmurLane Debug] ignored invalid live update", error);
      }
    }
  });

  return () => source.close();
}

export { API_BASE_URL, buildApiUrl };
