export interface MurmurLaneDataAdapter {
  readonly hasEditCredential: boolean;
  readonly fetchEditableMemoryDocument: typeof import("../../data/api").fetchEditableMemoryDocument;
  readonly fetchConversations: typeof import("../../data/api").fetchConversations;
  readonly fetchConversationMoments: typeof import("../../data/api").fetchConversationMoments;
  readonly fetchDateIndex: typeof import("../../data/api").fetchDateIndex;
  readonly fetchMemoryDailySummary: typeof import("../../data/api").fetchMemoryDailySummary;
  readonly fetchMemoryDiary: typeof import("../../data/api").fetchMemoryDiary;
  readonly fetchMemoryLetters: typeof import("../../data/api").fetchMemoryLetters;
  readonly fetchMemoryStatic: typeof import("../../data/api").fetchMemoryStatic;
  readonly fetchReminderHistory: typeof import("../../data/api").fetchReminderHistory;
  readonly fetchTimeline: typeof import("../../data/api").fetchTimeline;
  readonly fetchXiaoyeStatic: typeof import("../../data/api").fetchXiaoyeStatic;
  readonly toggleOpenLoopsChecklistItem: typeof import("../../data/api").toggleOpenLoopsChecklistItem;
  readonly subscribeToLiveUpdates: typeof import("../../data/api").subscribeToLiveUpdates;
}

export interface WebChatAdapter {
  readonly fetchModels: typeof import("../../data/chatApi").fetchWebChatModels;
  readonly fetchStatus: typeof import("../../data/chatApi").fetchWebChatStatus;
  readonly isAmbiguousSendError: typeof import("../../data/chatApi").isAmbiguousWebChatSendError;
  readonly resolveAssetUrl: typeof import("../../data/chatApi").resolveWebChatAssetUrl;
  readonly selectThread: typeof import("../../data/chatApi").selectWebChatThread;
  readonly sendMessages: typeof import("../../data/chatApi").sendWebChatMessages;
  readonly setModel: typeof import("../../data/chatApi").setWebChatModel;
  readonly subscribe: typeof import("../../data/chatApi").subscribeToWebChat;
  readonly uploadFile: typeof import("../../data/chatApi").uploadWebChatFile;
}

export interface AppDependencies {
  readonly murmurLaneData: MurmurLaneDataAdapter;
  readonly webChat: WebChatAdapter;
}

export function createAppDependencies(
  dependencies: AppDependencies,
): AppDependencies {
  return Object.freeze({
    murmurLaneData: dependencies.murmurLaneData,
    webChat: dependencies.webChat,
  });
}
