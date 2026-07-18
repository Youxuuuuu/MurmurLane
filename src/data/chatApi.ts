import { API_BASE_URL } from "./api";
import type {
  WebChatEvent,
  WebChatMedia,
  WebChatModelResponse,
  WebChatSendEnvelope,
  WebChatSendResult,
  WebChatStatus,
} from "../types/webChat";

const env = (import.meta as { env?: Record<string, string | undefined> }).env;
const CHAT_API_BASE_URL = String(
  env?.VITE_MURMURLANE_CHAT_API_BASE_URL ||
    (env?.DEV ? "http://127.0.0.1:8791" : API_BASE_URL),
).replace(/\/+$/, "");
const CHAT_TOKEN = String(env?.VITE_MURMURLANE_CHAT_TOKEN || "").trim();
export const WEB_CHAT_SEND_TIMEOUT_MS = 15_000;

export class WebChatHttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "WebChatHttpError";
    this.statusCode = statusCode;
  }
}

export class WebChatSendTimeoutError extends Error {
  constructor() {
    super("Web Chat send timed out");
    this.name = "WebChatSendTimeoutError";
  }
}

function buildChatUrl(path: string) {
  return `${CHAT_API_BASE_URL}${path}`;
}

function buildAuthHeaders(headers: HeadersInit = {}) {
  const next = new Headers(headers);
  if (CHAT_TOKEN) {
    next.set("X-Cyberboss-Web-Token", CHAT_TOKEN);
    next.set("Authorization", `Bearer ${CHAT_TOKEN}`);
  }
  return next;
}

async function requestChatJson<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(buildChatUrl(path), {
    ...init,
    headers: buildAuthHeaders(init.headers),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new WebChatHttpError(
      response.status,
      body || `Web Chat request failed: ${response.status}`,
    );
  }
  return response.json() as Promise<T>;
}

export function fetchWebChatStatus(threadId = "", requestId = "") {
  const query = new URLSearchParams();
  if (threadId) query.set("threadId", threadId);
  if (requestId) query.set("requestId", requestId);
  const suffix = query.size ? `?${query.toString()}` : "";
  return requestChatJson<WebChatStatus>(`/api/chat/status${suffix}`);
}

export function fetchWebChatModels() {
  return requestChatJson<WebChatModelResponse>("/api/chat/models");
}

export function setWebChatModel(model: string, modelProvider = "") {
  return requestChatJson<WebChatStatus>("/api/chat/model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, modelProvider }),
  });
}

export function selectWebChatThread(threadId: string, clientId = "") {
  return requestChatJson<WebChatStatus>("/api/chat/thread/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, clientId }),
  });
}

export async function sendWebChatMessages(
  envelope: WebChatSendEnvelope,
  { timeoutMs = WEB_CHAT_SEND_TIMEOUT_MS }: { timeoutMs?: number } = {},
) {
  const timeout = createSendTimeout(timeoutMs);
  try {
    return await requestChatJson<WebChatSendResult>("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      signal: timeout.signal,
    });
  } catch (error) {
    if (timeout.signal.aborted) {
      throw new WebChatSendTimeoutError();
    }
    throw error;
  } finally {
    timeout.dispose();
  }
}

export function isAmbiguousWebChatSendError(error: unknown) {
  if (error instanceof WebChatHttpError) return false;
  if (error instanceof WebChatSendTimeoutError) return true;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError" || error.name === "TimeoutError";
  }
  return error instanceof TypeError;
}

function createSendTimeout(timeoutMs: number) {
  const duration = Math.max(1, Number(timeoutMs) || WEB_CHAT_SEND_TIMEOUT_MS);
  const timeoutFactory = (AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  }).timeout;
  if (typeof timeoutFactory === "function") {
    return { signal: timeoutFactory(duration), dispose() {} };
  }
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), duration);
  return {
    signal: controller.signal,
    dispose() {
      globalThis.clearTimeout(timer);
    },
  };
}

export async function uploadWebChatFile(
  file: File | Blob,
  fileName = "attachment",
  kind = "file",
): Promise<WebChatMedia> {
  const result = await requestChatJson<{ media: WebChatMedia }>("/api/chat/uploads", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Cyberboss-File-Name": encodeURIComponent(String(fileName || "attachment")),
      "X-Cyberboss-Media-Kind": String(kind || "file"),
    },
    body: file,
  });
  return result.media;
}

export function subscribeToWebChat({
  threadId = "",
  after = 0,
  clientId,
  onEvent,
  onConnectionChange,
}: {
  threadId?: string;
  after?: number;
  clientId: string;
  onEvent: (event: WebChatEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}) {
  const query = new URLSearchParams({
    threadId,
    after: String(after || 0),
    clientId,
  });
  if (CHAT_TOKEN) query.set("token", CHAT_TOKEN);
  const source = new EventSource(`${buildChatUrl("/api/chat/events")}?${query.toString()}`);
  source.addEventListener("open", () => onConnectionChange?.(true));
  source.addEventListener("error", () => onConnectionChange?.(false));
  source.addEventListener("chat", (event) => {
    try {
      onEvent(JSON.parse((event as MessageEvent<string>).data) as WebChatEvent);
    } catch {
      // Ignore a malformed event and let EventSource continue reconnecting.
    }
  });
  return () => source.close();
}

export function resolveWebChatAssetUrl(assetPath: string) {
  const normalized = String(assetPath || "").trim();
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
  return buildChatUrl(normalized);
}

export { CHAT_API_BASE_URL };
