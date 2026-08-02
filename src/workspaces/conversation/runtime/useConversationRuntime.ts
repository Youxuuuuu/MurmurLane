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

  const absorbStatus = useCallback(
    (status: WebChatStatus, fallbackThreadId = "") => {
      setState((current) =>
        absorbConversationRuntimeStatus(
          current,
          status,
          fallbackThreadId,
        ),
      );
    },
    [],
  );

  const fetchModels = useCallback(async () => {
    const requestRevision = ++modelRequestRevisionRef.current;
    try {
      const result = await webChat.fetchModels();
      if (requestRevision === modelRequestRevisionRef.current) {
        setState((current) =>
          absorbConversationRuntimeModels(current, result),
        );
      }
      return result;
    } catch (error) {
      if (requestRevision === modelRequestRevisionRef.current) {
        setState((current) =>
          setConversationRuntimeCatalogError(
            current,
            MODEL_CATALOG_ERROR,
          ),
        );
      }
      throw toConversationCommandError("load-models", error);
    }
  }, [webChat]);

  const refreshModels = fetchModels;

  useEffect(() => {
    if (!enabled) return undefined;
    void fetchModels().catch(() => undefined);
    return () => {
      modelRequestRevisionRef.current += 1;
    };
  }, [enabled, fetchModels]);

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
    [showEffortResetNotice],
  );

  const chooseModel = useCallback(
    async (model: string, modelProvider = "") => {
      try {
        const result = await webChat.setModel(model, modelProvider);
        absorbStatus(result);
        return result;
      } catch (error) {
        throw toConversationCommandError("choose-model", error);
      }
    },
    [absorbStatus, webChat],
  );

  const chooseEffort = useCallback(
    async (effort: string) => {
      try {
        const result = await webChat.setEffort(effort);
        absorbStatus(result);
        return result;
      } catch (error) {
        throw toConversationCommandError("choose-model", error);
      }
    },
    [absorbStatus, webChat],
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
