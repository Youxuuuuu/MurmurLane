import type { MurmurLaneApi } from "../../data/api";
import type { WebChatPort } from "../../workspaces/conversation";

export type MurmurLaneDataAdapter = MurmurLaneApi;
export type WebChatAdapter = WebChatPort;
export interface AppDiagnostics {
  readonly development: boolean;
}

export interface AppDependencies {
  readonly murmurLaneData: MurmurLaneDataAdapter;
  readonly webChat: WebChatAdapter;
  readonly diagnostics: AppDiagnostics;
}

export function createAppDependencies(
  dependencies: AppDependencies,
): AppDependencies {
  return Object.freeze({
    murmurLaneData: dependencies.murmurLaneData,
    webChat: dependencies.webChat,
    diagnostics: dependencies.diagnostics,
  });
}
