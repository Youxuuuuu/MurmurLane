const env = (import.meta as { env?: Record<string, string | undefined> }).env;

const API_BASE_URL = String(env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function normalizeDate(date: string) {
  return String(date).replace(/\./g, "-");
}

function buildApiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

async function requestJson(path: string) {
  const response = await fetch(buildApiUrl(path));

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function fetchConversations(date: string) {
  return requestJson(
    `/api/conversations?date=${encodeURIComponent(normalizeDate(date))}`,
  );
}

export function fetchTimeline() {
  return requestJson("/api/timeline");
}

export function fetchDateIndex() {
  return requestJson("/api/index/dates");
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
