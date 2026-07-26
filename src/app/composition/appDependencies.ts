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

import type { WebChatPort } from "../../workspaces/conversation/webChatPort";

export type WebChatAdapter = WebChatPort;

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
