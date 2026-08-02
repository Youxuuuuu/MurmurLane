import type {
  WebChatEvent,
  WebChatModelResponse,
  WebChatStatus,
  WebChatUsage,
  WebChatUsageTotals,
} from "../../../types/webChat";

export interface ConversationRuntimeState {
  readonly models: WebChatModelResponse | null;
  readonly modelCatalogError: string;
  readonly runtimeSettingsNotice: string;
  readonly model: string;
  readonly modelProvider: string;
  readonly effort: string;
  readonly contextUsageSnapshot: {
    readonly threadId: string;
    readonly value: WebChatUsage | null;
  } | null;
  readonly usageTotalsByThread: Readonly<Record<string, WebChatUsageTotals>>;
}

export function createConversationRuntimeState(): ConversationRuntimeState {
  return {
    models: null,
    modelCatalogError: "",
    runtimeSettingsNotice: "",
    model: "",
    modelProvider: "",
    effort: "",
    contextUsageSnapshot: null,
    usageTotalsByThread: {},
  };
}

export function absorbConversationRuntimeModels(
  state: ConversationRuntimeState,
  models: WebChatModelResponse,
): ConversationRuntimeState {
  return {
    ...state,
    models,
    modelCatalogError: "",
    model: String(models.currentModel ?? state.model),
    modelProvider: String(
      models.currentModelProvider ?? state.modelProvider,
    ),
    effort: String(models.currentEffort ?? state.effort),
  };
}

export function setConversationRuntimeCatalogError(
  state: ConversationRuntimeState,
  message: string,
): ConversationRuntimeState {
  return {
    ...state,
    modelCatalogError: message,
  };
}

export function setConversationRuntimeNotice(
  state: ConversationRuntimeState,
  message: string,
): ConversationRuntimeState {
  return {
    ...state,
    runtimeSettingsNotice: message,
  };
}

export function clearConversationRuntimeThread(
  state: ConversationRuntimeState,
  threadId: string,
): ConversationRuntimeState {
  const usageTotalsByThread = { ...state.usageTotalsByThread };
  delete usageTotalsByThread[threadId];
  return {
    ...state,
    usageTotalsByThread,
    contextUsageSnapshot:
      state.contextUsageSnapshot?.threadId === threadId
        ? null
        : state.contextUsageSnapshot,
  };
}

export function absorbConversationRuntimeStatus(
  state: ConversationRuntimeState,
  status: WebChatStatus,
  fallbackThreadId = "",
): ConversationRuntimeState {
  const threadId = String(status.threadId || fallbackThreadId).trim();
  const next = {
    ...state,
    models: status.runtimeSettings ?? state.models,
    model: String(
      status.model
      ?? status.runtimeSettings?.currentModel
      ?? state.model,
    ),
    modelProvider: String(
      status.modelProvider
      ?? status.runtimeSettings?.currentModelProvider
      ?? state.modelProvider,
    ),
    effort: String(
      status.effort
      ?? status.runtimeSettings?.currentEffort
      ?? state.effort,
    ),
  };
  const withContext = threadId && "contextUsage" in status
    ? {
        ...next,
        contextUsageSnapshot: {
          threadId,
          value: status.contextUsage ?? null,
        },
      }
    : next;
  if (!threadId || !("usageTotals" in status)) {
    return withContext;
  }
  const usageTotalsByThread = { ...state.usageTotalsByThread };
  if (!status.usageTotals) {
    delete usageTotalsByThread[threadId];
    return {
      ...withContext,
      usageTotalsByThread,
    };
  }
  return {
    ...withContext,
    usageTotalsByThread: {
      ...usageTotalsByThread,
      [threadId]: status.usageTotals,
    },
  };
}

export function selectConversationRuntimeThread(
  state: ConversationRuntimeState,
  threadId: string,
) {
  return {
    contextUsage:
      state.contextUsageSnapshot?.threadId === threadId
        ? state.contextUsageSnapshot.value
        : null,
    usageTotals: state.usageTotalsByThread[threadId] ?? null,
  };
}

export function isConversationRuntimeEvent(event: WebChatEvent): boolean {
  return event.kind === "usage"
    || event.kind === "runtime.settings.updated"
    || event.kind === "model.updated";
}

export function reduceConversationRuntimeEvent(
  state: ConversationRuntimeState,
  event: WebChatEvent,
  activeThreadId: string,
): ConversationRuntimeState {
  if (
    event.kind === "runtime.settings.updated"
    || event.kind === "model.updated"
  ) {
    const model = String(
      event.model
      ?? event.settings?.currentModel
      ?? state.model,
    );
    const modelProvider = String(
      event.modelProvider
      ?? event.settings?.currentModelProvider
      ?? state.modelProvider,
    );
    const effort = String(
      event.effort
      ?? event.settings?.currentEffort
      ?? state.effort,
    );
    return {
      ...state,
      model,
      modelProvider,
      effort,
      models:
        event.settings
          ? event.settings
          : state.models
            ? {
                ...state.models,
                currentModel: model || state.models.currentModel,
                currentModelProvider: modelProvider,
                currentEffort: effort,
              }
            : state.models,
    };
  }
  if (event.kind !== "usage") return state;
  const threadId = String(event.threadId || activeThreadId).trim();
  if (!threadId) return state;

  let next = state;
  if ("usageTotals" in event) {
    const usageTotalsByThread = { ...next.usageTotalsByThread };
    if (event.usageTotals) {
      usageTotalsByThread[threadId] = event.usageTotals;
    } else {
      delete usageTotalsByThread[threadId];
    }
    next = {
      ...next,
      usageTotalsByThread,
    };
  }
  if (threadId === activeThreadId && "contextUsage" in event) {
    next = {
      ...next,
      contextUsageSnapshot: {
        threadId,
        value: event.contextUsage ?? null,
      },
    };
  }
  return next;
}
