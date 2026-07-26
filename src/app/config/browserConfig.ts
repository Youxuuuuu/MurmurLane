export type BrowserEnvironment = Readonly<
  Record<string, string | boolean | undefined>
>;

export interface BrowserPublicConfig {
  readonly murmurLaneApiBaseUrl: string;
  readonly webChatApiBaseUrl: string;
  readonly editCredential: string;
  readonly webChatCredential: string;
  readonly webChatSendTimeoutMs: number;
  readonly webChatUploadTimeoutMs: number;
  readonly diagnostics: Readonly<{
    development: boolean;
  }>;
}

function normalizeBaseUrl(value: string | boolean | undefined) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function normalizeCredential(value: string | boolean | undefined) {
  return String(value || "").trim();
}

export function parseBrowserConfig(
  environment: BrowserEnvironment,
): BrowserPublicConfig {
  const development = environment.DEV === true;
  const murmurLaneApiBaseUrl = normalizeBaseUrl(
    environment.VITE_API_BASE_URL,
  );
  const configuredWebChatApiBaseUrl = normalizeBaseUrl(
    environment.VITE_MURMURLANE_CHAT_API_BASE_URL,
  );
  const diagnostics = Object.freeze({ development });

  return Object.freeze({
    murmurLaneApiBaseUrl,
    webChatApiBaseUrl:
      configuredWebChatApiBaseUrl ||
      (development
        ? "http://127.0.0.1:8791"
        : murmurLaneApiBaseUrl),
    editCredential: normalizeCredential(
      environment.VITE_MURMURLANE_EDIT_TOKEN,
    ),
    webChatCredential: normalizeCredential(
      environment.VITE_MURMURLANE_CHAT_TOKEN,
    ),
    webChatSendTimeoutMs: 15_000,
    webChatUploadTimeoutMs: 120_000,
    diagnostics,
  });
}
