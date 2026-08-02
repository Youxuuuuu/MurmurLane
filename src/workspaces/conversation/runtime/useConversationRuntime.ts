import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  WebChatEvent,
  WebChatStatus,
} from "../../../types/webChat";
import { toConversationCommandError } from "../conversationCommandError";
import type { WebChatPort } from "../webChatPort";
import {
  absorbConversationRuntimeModels,
  absorbConversationRuntimeStatus,
  clearConversationRuntimeThread,
  createConversationRuntimeState,
  isConversationRuntimeEvent,
  reduceConversationRuntimeEvent,
  selectConversationRuntimeThread,
  setConversationRuntimeCatalogError,
  setConversationRuntimeNotice,
} from "./conversationRuntimeState";

const MODEL_CATALOG_ERROR = "模型目录暂时无法加载";
const EFFORT_RESET_NOTICE = "已切换为该模型的默认 Effort";

type ConversationRuntimePort = Pick<
  WebChatPort,
  "fetchModels" | "setModel" | "setEffort"
>;

interface ConversationRuntimeModelRequestRevision {
  current: number;
}

export function invalidateConversationRuntimeModelRequest(
  revisionRef: ConversationRuntimeModelRequestRevision,
) {
  revisionRef.current += 1;
}

export async function runConversationRuntimeModelRequest({
  revisionRef,
  fetchModels,
  applyModels,
  applyError,
}: {
  revisionRef: ConversationRuntimeModelRequestRevision;
  fetchModels: () => ReturnType<ConversationRuntimePort["fetchModels"]>;
  applyModels: (
    models: Awaited<ReturnType<ConversationRuntimePort["fetchModels"]>>,
  ) => void;
  applyError?: (error: unknown) => void;
}) {
  const requestRevision = ++revisionRef.current;
  try {
    const result = await fetchModels();
    if (requestRevision === revisionRef.current) {
      applyModels(result);
    }
    return result;
  } catch (error) {
    if (requestRevision === revisionRef.current) {
      applyError?.(error);
    }
    throw error;
  }
}

export function useConversationRuntime({
  webChat,
  enabled,
  threadId,
}: {
  webChat: ConversationRuntimePort;
  enabled: boolean;
  threadId: string;
}) {
  const [state, setState] = useState(createConversationRuntimeState);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelRequestRevisionRef = useRef(0);

  const invalidateModelRequest = useCallback(() => {
    invalidateConversationRuntimeModelRequest(
      modelRequestRevisionRef,
    );
  }, []);

  const absorbStatus = useCallback(
    (status: WebChatStatus, fallbackThreadId = "") => {
      invalidateModelRequest();
      setState((current) =>
        absorbConversationRuntimeStatus(
          current,
          status,
          fallbackThreadId,
        ),
      );
    },
    [invalidateModelRequest],
  );

  const fetchModels = useCallback(async () => {
    try {
      return await runConversationRuntimeModelRequest({
        revisionRef: modelRequestRevisionRef,
        fetchModels: webChat.fetchModels,
        applyModels: (result) => {
          setState((current) =>
            absorbConversationRuntimeModels(current, result),
          );
        },
        applyError: () => {
          setState((current) =>
            setConversationRuntimeCatalogError(
              current,
              MODEL_CATALOG_ERROR,
            ),
          );
        },
      });
    } catch (error) {
      throw toConversationCommandError("load-models", error);
    }
  }, [webChat]);

  const refreshModels = fetchModels;

  useEffect(() => {
    if (!enabled) return undefined;
    void fetchModels().catch(() => undefined);
    return () => {
      invalidateModelRequest();
    };
  }, [enabled, fetchModels, invalidateModelRequest]);

  useEffect(
    () => () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    },
    [],
  );

  const showEffortResetNotice = useCallback(() => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    setState((current) =>
      setConversationRuntimeNotice(current, EFFORT_RESET_NOTICE),
    );
    noticeTimerRef.current = setTimeout(() => {
      setState((current) =>
        setConversationRuntimeNotice(current, ""),
      );
      noticeTimerRef.current = null;
    }, 2_400);
  }, []);

  const handleEvent = useCallback(
    (event: WebChatEvent, activeThreadId: string) => {
      if (!isConversationRuntimeEvent(event)) return false;
      if (
        event.kind === "runtime.settings.updated"
        || event.kind === "model.updated"
      ) {
        invalidateModelRequest();
      }
      setState((current) =>
        reduceConversationRuntimeEvent(
          current,
          event,
          activeThreadId,
        ),
      );
      if (event.effortReset) showEffortResetNotice();
      return true;
    },
    [invalidateModelRequest, showEffortResetNotice],
  );

  const chooseModel = useCallback(
    async (model: string, modelProvider = "") => {
      invalidateModelRequest();
      try {
        const result = await webChat.setModel(model, modelProvider);
        absorbStatus(result);
        return result;
      } catch (error) {
        throw toConversationCommandError("choose-model", error);
      }
    },
    [absorbStatus, invalidateModelRequest, webChat],
  );

  const chooseEffort = useCallback(
    async (effort: string) => {
      invalidateModelRequest();
      try {
        const result = await webChat.setEffort(effort);
        absorbStatus(result);
        return result;
      } catch (error) {
        throw toConversationCommandError("choose-effort", error);
      }
    },
    [absorbStatus, invalidateModelRequest, webChat],
  );

  const clearThread = useCallback((removedThreadId: string) => {
    setState((current) =>
      clearConversationRuntimeThread(current, removedThreadId),
    );
  }, []);

  const threadSnapshot = useMemo(
    () => selectConversationRuntimeThread(state, threadId),
    [state, threadId],
  );

  const statusSnapshot = useMemo<Partial<WebChatStatus>>(
    () => ({
      model: state.model || undefined,
      modelProvider: state.modelProvider || undefined,
      effort: state.effort || undefined,
      contextUsage: threadSnapshot.contextUsage,
      usageTotals: threadSnapshot.usageTotals,
      runtimeSettings: state.models || undefined,
    }),
    [
      state.effort,
      state.model,
      state.modelProvider,
      state.models,
      threadSnapshot,
    ],
  );

  return {
    models: state.models,
    modelCatalogError: state.modelCatalogError,
    runtimeSettingsNotice: state.runtimeSettingsNotice,
    usageTotals: threadSnapshot.usageTotals,
    contextUsage: threadSnapshot.contextUsage,
    statusSnapshot,
    fetchModels,
    refreshModels,
    chooseModel,
    chooseEffort,
    absorbStatus,
    handleEvent,
    clearThread,
  };
}
