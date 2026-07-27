import type {
  WebChatEvent,
  WebChatMedia,
  WebChatModelResponse,
  WebChatSendEnvelope,
  WebChatSendResult,
  WebChatStatus,
} from "../../types/webChat";

export interface WebChatPort {
  readonly fetchModels: () => Promise<WebChatModelResponse>;
  readonly fetchStatus: (
    threadId?: string,
    requestId?: string,
  ) => Promise<WebChatStatus>;
  readonly isAmbiguousSendError: (error: unknown) => boolean;
  readonly resolveAssetUrl: (assetPath: string) => string;
  readonly sendMessages: (
    envelope: WebChatSendEnvelope,
    options?: { timeoutMs?: number },
  ) => Promise<WebChatSendResult>;
  readonly setModel: (
    model: string,
    modelProvider?: string,
  ) => Promise<WebChatStatus>;
  readonly subscribe: (input: {
    threadId?: string;
    after?: number;
    clientId: string;
    onEvent: (event: WebChatEvent) => void;
    onConnectionChange?: (connected: boolean) => void;
  }) => () => void;
  readonly uploadFile: (
    file: File | Blob,
    fileName?: string,
    kind?: string,
    options?: { timeoutMs?: number },
  ) => Promise<WebChatMedia>;
}
