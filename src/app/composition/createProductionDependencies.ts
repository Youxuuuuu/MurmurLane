import { createMurmurLaneApi } from "../../data/api";
import { createWebChatApi } from "../../data/chatApi";
import {
  parseBrowserConfig,
  type BrowserEnvironment,
} from "../config/browserConfig";
import {
  createAppDependencies,
  type AppDependencies,
  type WebChatAdapter,
} from "./appDependencies";

function createWebChatAdapter(
  config: ReturnType<typeof parseBrowserConfig>,
): WebChatAdapter {
  return createWebChatApi({
    baseUrl: config.webChatApiBaseUrl,
    credential: config.webChatCredential,
    sendTimeoutMs: config.webChatSendTimeoutMs,
    uploadTimeoutMs: config.webChatUploadTimeoutMs,
  });
}

export function createProductionDependencies(
  environment: BrowserEnvironment,
): AppDependencies {
  const config = parseBrowserConfig(environment);

  return createAppDependencies({
    murmurLaneData: createMurmurLaneApi({
      baseUrl: config.murmurLaneApiBaseUrl,
      editCredential: config.editCredential,
      diagnostics: config.diagnostics,
    }),
    webChat: createWebChatAdapter(config),
    diagnostics: config.diagnostics,
  });
}
