const env = (import.meta as { env?: Record<string, string | undefined> }).env;

const API_BASE_URL = String(env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");

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

async function requestJson(path: string) {
  const response = await fetch(buildApiUrl(path));

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function fetchConversations(
  date: string,
  options: { threadId?: string; limit?: number } = {},
) {
  const query = buildQuery({
    date: normalizeDate(date),
    threadId: options.threadId,
    limit: options.limit,
  });

  return requestJson(`/api/conversations?${query}`);
}

export function fetchTimeline(options: { date?: string; month?: string } = {}) {
  const query = buildQuery({
    date: options.date ? normalizeDate(options.date) : undefined,
    month: options.month ? normalizeDate(options.month).slice(0, 7) : undefined,
  });

  return requestJson(query ? `/api/timeline?${query}` : "/api/timeline");
}

export function fetchDateIndex() {
  return requestJson("/api/index/dates");
}

export function fetchReminderHistory() {
  return requestJson("/api/reminders/history");
}

export function fetchMemoryDiary(date: string) {
  return requestJson(
    `/api/memory/diary?date=${encodeURIComponent(normalizeDate(date))}`,
  );
}

export function fetchMemoryDailySummary(date: string) {
  return requestJson(
    `/api/memory/daily-summary?date=${encodeURIComponent(normalizeDate(date))}`,
  );
}

export function fetchMemoryLetters(date: string) {
  return requestJson(
    `/api/memory/letters?date=${encodeURIComponent(normalizeDate(date))}`,
  );
}

export function fetchMemoryStatic(mode: string) {
  return requestJson(`/api/memory/static?mode=${encodeURIComponent(mode)}`);
}

export function fetchXiaoyeStatic(mode: string) {
  return requestJson(`/api/xiaoye/static?mode=${encodeURIComponent(mode)}`);
}

export function resolveApiFileUrl(filePath: string) {
  return buildApiUrl(
    `/api/file?path=${encodeURIComponent(String(filePath ?? ""))}`,
  );
}

export { API_BASE_URL, buildApiUrl };
