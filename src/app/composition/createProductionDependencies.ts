import * as murmurLaneApi from "../../data/api";
import * as webChatApi from "../../data/chatApi";
import {
  parseBrowserConfig,
  type BrowserEnvironment,
} from "../config/browserConfig";
import {
  createAppDependencies,
  type AppDependencies,
  type MurmurLaneDataAdapter,
  type WebChatAdapter,
} from "./appDependencies";

function createMurmurLaneDataAdapter(
  hasEditCredential: boolean,
): MurmurLaneDataAdapter {
  return Object.freeze({
    hasEditCredential,
    fetchEditableMemoryDocument:
      murmurLaneApi.fetchEditableMemoryDocument,
    fetchConversations: murmurLaneApi.fetchConversations,
    fetchConversationMoments:
      murmurLaneApi.fetchConversationMoments,
    fetchDateIndex: murmurLaneApi.fetchDateIndex,
    fetchMemoryDailySummary: murmurLaneApi.fetchMemoryDailySummary,
    fetchMemoryDiary: murmurLaneApi.fetchMemoryDiary,
    fetchMemoryLetters: murmurLaneApi.fetchMemoryLetters,
    fetchMemoryStatic: murmurLaneApi.fetchMemoryStatic,
    fetchReminderHistory: murmurLaneApi.fetchReminderHistory,
    fetchTimeline: murmurLaneApi.fetchTimeline,
    fetchXiaoyeStatic: murmurLaneApi.fetchXiaoyeStatic,
    toggleOpenLoopsChecklistItem:
      murmurLaneApi.toggleOpenLoopsChecklistItem,
    subscribeToLiveUpdates: murmurLaneApi.subscribeToLiveUpdates,
  });
}

function createWebChatAdapter(): WebChatAdapter {
  return Object.freeze({
    fetchModels: webChatApi.fetchWebChatModels,
    fetchStatus: webChatApi.fetchWebChatStatus,
    isAmbiguousSendError: webChatApi.isAmbiguousWebChatSendError,
    sendMessages: webChatApi.sendWebChatMessages,
    setModel: webChatApi.setWebChatModel,
    subscribe: webChatApi.subscribeToWebChat,
    uploadFile: webChatApi.uploadWebChatFile,
  });
}

export function createProductionDependencies(
  environment: BrowserEnvironment,
): AppDependencies {
  const config = parseBrowserConfig(environment);

  return createAppDependencies({
    murmurLaneData: createMurmurLaneDataAdapter(
      Boolean(config.editCredential),
    ),
    webChat: createWebChatAdapter(),
  });
}
