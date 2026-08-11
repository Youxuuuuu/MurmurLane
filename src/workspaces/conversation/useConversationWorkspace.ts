import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { mergeConversationRecords } from "../../lib/conversationMerge";
import { buildWebChatSendEnvelope } from "../../lib/webChatSendContract";
import {
  getLegacyStableId,
  upsertConversationRecordByIdentity,
} from "../../lib/conversationIdentity";
import {
  createWebChatLiveRecord,
  createWebChatDraftRecord,
  resolveThreadSubscriptionCursor,
  settleWebChatDrafts,
} from "../../lib/webChatRecords";
import { resolveWebChatActivityStatus } from "../../lib/webChatStatus";
import {
  resolvePendingWebChatMessages,
  toOptimisticWebChatMessages,
} from "../../lib/webChatPendingUploads";
import {
  createWebChatSendTransaction,
  transitionWebChatSendTransaction,
  type WebChatSendTransaction,
} from "../../lib/webChatSendTransaction";
import type { ConversationRecord } from "../../types/conversation";
import type {
  ConversationDeleteResponse,
  ConversationsResponse,
  FetchConversationsOptions,
  RemoteData,
  SearchConversationOptions,
  StickerAsset,
} from "../../types/api";
import type {
  WebChatComposerMessageInput,
  WebChatEvent,
  WebChatMedia,
  WebChatSendResult,
  WebChatStatus,
} from "../../types/webChat";
import type { WebChatPort } from "./webChatPort";
import type { ConversationNavigationTarget } from "../../app/navigation/appNavigation";
import { createConversationWorkspaceOutput } from "./conversationWorkspaceContract";
import {
  createDefaultThreadProfile,
  getConversationSummaryActivityKey,
  isConversationThreadVisibleInList,
  useConversationProfiles,
  type ConversationProfileCommands,
} from "../../lib/conversationProfiles";
import {
  createConversationWorkspaceState,
  reduceConversationWorkspaceState,
  type ConversationNotification,
  type ConversationPageMode,
  type ConversationPlaceholder,
  resolveConversationNavigationTarget,
} from "./conversationWorkspaceState";
import {
  buildConversationThreadPage,
  getAllConversationThreadIds,
  getAdjacentConversationDateToLoad,
  getContiguousLoadedConversationDates,
  getConversationThreadSummaries,
  getLatestConversationThreadId,
} from "../../lib/conversationPageData";
import { getTodayDateText, toDotDate } from "../../lib/date";
import { buildConversationTranscript } from "./buildConversationTranscript";
import type { ConversationMediaUrlPort } from "../../lib/conversation";
import {
  createCanonicalConversationObserver,
  type CanonicalConversationBatch,
  type CanonicalConversationObservation,
} from "./canonicalConversationObserver";
import {
  getConversationCommandErrorMessage,
  toConversationCommandError,
} from "./conversationCommandError";
import { shouldReleaseDeletedThreadOverlay } from "./conversationListActions";
import { useConversationRuntime } from "./runtime/useConversationRuntime";

interface StagedWebChatSend {
  requestId: string;
  messageId: string;
  draftThreadId: string;
  newThread: boolean;
  model: string;
  modelProvider: string;
  messages: WebChatComposerMessageInput[];
  resolvedUploads: Map<string, WebChatMedia>;
}

interface StagedVoiceSend {
  requestId: string;
  messageId: string;
  receivedAt: string;
  draftThreadId: string;
  newThread: boolean;
}

function createClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createMessageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `message-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function appendRecord(
  current: Record<string, ConversationRecord[]>,
  threadId: string,
  record: ConversationRecord,
) {
  if (!threadId) return current;
  const nextRecord = { ...record, threadId };
  const existing = current[threadId] ?? [];
  return {
    ...current,
    [threadId]: mergeConversationRecords(
      upsertConversationRecordByIdentity(existing, nextRecord, threadId),
      threadId,
    ),
  };
}

export function useConversationWorkspace({
  webChat,
  active,
  initialThreadId,
  initialDate,
  profileCommands,
  archiveCommands,
  loadConversationRecords,
  loadStickerAssets,
  loadStickerAsset,
  searchConversationRecords,
  resolveLocalMediaUrl,
  navigation,
  remoteData,
  styleTheme,
}: {
  webChat: WebChatPort;
  active: boolean;
  initialThreadId: string;
  initialDate: string;
  profileCommands: ConversationProfileCommands;
  archiveCommands: {
    deleteThread(
      threadId: string,
    ): Promise<ConversationDeleteResponse>;
  };
  navigation: {
    readonly revision: number;
    readonly target?: ConversationNavigationTarget;
    acknowledge(revision: number): void;
  } | null;
  loadConversationRecords(
    date: string,
    options?: FetchConversationsOptions,
  ): Promise<ConversationRecord[] | null>;
  loadStickerAssets(): Promise<{
    stickers: StickerAsset[];
  }>;
  loadStickerAsset(sticker: StickerAsset): Promise<Blob>;
  searchConversationRecords(
    options: SearchConversationOptions,
  ): Promise<ConversationsResponse>;
  resolveLocalMediaUrl(path: string): string;
  remoteData: RemoteData;
  styleTheme: Record<string, unknown>;
}) {
  const [workspaceState, dispatch] = useReducer(
    reduceConversationWorkspaceState,
    { threadId: initialThreadId, date: initialDate },
    createConversationWorkspaceState,
  );
  const threadId = workspaceState.selectedThreadId;
  const enabled =
    active &&
    workspaceState.view === "chat" &&
    !workspaceState.placeholder;
  const runtime = useConversationRuntime({
    webChat,
    enabled,
    threadId,
  });
  const availableThreadIds = useMemo(
    () => getAllConversationThreadIds(remoteData),
    [remoteData],
  );
  const latestThreadId = useMemo(
    () => getLatestConversationThreadId(remoteData),
    [remoteData],
  );
  const profileThreadIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...availableThreadIds,
          ...workspaceState.webThreadIds,
        ]),
      ),
    [availableThreadIds, workspaceState.webThreadIds],
  );
  const {
    userProfile,
    setUserProfile,
    threadProfiles,
    updateThreadProfile,
    profileError,
  } = useConversationProfiles(
    profileThreadIds,
    remoteData.conversationProfiles,
    profileCommands,
  );
  const effectiveThreadProfiles = useMemo(
    () => {
      const profiles: Record<
        string,
        ReturnType<typeof createDefaultThreadProfile>
      > = { ...threadProfiles };
      Object.entries(
        workspaceState.webThreadProfileOverrides,
      ).forEach(([threadId, override]) => {
        profiles[threadId] = {
          ...(threadProfiles[threadId] ??
            createDefaultThreadProfile(
              threadId,
              profileThreadIds.indexOf(threadId),
            )),
          ...override,
        };
      });
      if (workspaceState.profilePreview?.threadId) {
        profiles[workspaceState.profilePreview.threadId] =
          workspaceState.profilePreview.profile;
      }
      return profiles;
    },
    [
      threadProfiles,
      profileThreadIds,
      workspaceState.profilePreview,
      workspaceState.webThreadProfileOverrides,
    ],
  );
  const threadProfilesRef = useRef(effectiveThreadProfiles);
  threadProfilesRef.current = effectiveThreadProfiles;
  const activityRef = useRef({
    active,
    pageMode: workspaceState.view,
    selectedThreadId: workspaceState.selectedThreadId,
  });
  activityRef.current = {
    active,
    pageMode: workspaceState.view,
    selectedThreadId: workspaceState.selectedThreadId,
  };
  const canonicalObserverRef = useRef(
    createCanonicalConversationObserver(),
  );
  const clientIdRef = useRef(createClientId());
  const cursorByThreadRef = useRef(new Map<string, number>());
  const currentThreadIdRef = useRef(threadId);
  const transactionsByRequestIdRef = useRef(new Map<string, WebChatSendTransaction>());
  const stagedSendsByRequestIdRef = useRef(new Map<string, StagedWebChatSend>());
  const stagedVoiceSendsByDraftIdRef = useRef(new Map<string, StagedVoiceSend>());
  const preparingRequestIdsRef = useRef(new Set<string>());
  const requestIdByMessageIdRef = useRef(new Map<string, string>());
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ConversationRecord[]>>({});
  const [status, setStatus] = useState<WebChatStatus | null>(null);
  const [connection, setConnection] = useState<"idle" | "connecting" | "open" | "offline">("idle");
  const [error, setError] = useState("");
  const [deletedThreadIds, setDeletedThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deletingThreadId, setDeletingThreadId] = useState("");
  const [threadActionError, setThreadActionError] = useState("");
  const autoUnhidePendingRef = useRef(new Set<string>());
  const deletedSourceKeysByThreadRef = useRef(
    new Map<string, Set<string>>(),
  );
  const [dateLoading, setDateLoading] = useState(false);
  const dateLoadingKeysRef = useRef(new Set<string>());
  const lastNavigationRevisionRef = useRef(-1);

  useEffect(() => {
    if (String(threadId).startsWith("draft-")) return;
    if (!profileThreadIds.length) return;
    if (!profileThreadIds.includes(threadId)) {
      dispatch({
        type: "replace-selected-thread",
        threadId: latestThreadId ?? profileThreadIds[0],
      });
      return;
    }
    if (
      !workspaceState.threadSelectionTouched &&
      latestThreadId &&
      latestThreadId !== threadId
    ) {
      dispatch({
        type: "replace-selected-thread",
        threadId: latestThreadId,
      });
    }
  }, [
    latestThreadId,
    profileThreadIds,
    threadId,
    workspaceState.threadSelectionTouched,
  ]);

  useEffect(() => {
    if (active) {
      dispatch({ type: "clear-notifications" });
    }
  }, [active]);

  const handleThreadCreated = useCallback(
    ({
      draftThreadId,
      threadId: createdThreadId,
    }: {
      draftThreadId: string;
      threadId: string;
      clientId?: string;
    }) => {
      if (!createdThreadId) return;
      const draftProfile = {
        ...createDefaultThreadProfile(createdThreadId, 0),
        ...(threadProfilesRef.current[draftThreadId] ?? {}),
      };
      dispatch({
        type: "settle-draft",
        draftThreadId,
        threadId: createdThreadId,
        date: getTodayDateText(),
        profile: draftProfile,
      });
    },
    [],
  );

  currentThreadIdRef.current = threadId;

  const handleEvent = useCallback(
    (event: WebChatEvent) => {
      const selectedThreadId = currentThreadIdRef.current;
      const eventThreadId = String(event.threadId || "");
      const previousThreadId = String(event.previousThreadId || "");
      const eventCursor = Number(event.cursor) || 0;
      for (const cursorThreadId of new Set([
        selectedThreadId,
        eventThreadId,
        previousThreadId,
      ].filter(Boolean))) {
        cursorByThreadRef.current.set(
          cursorThreadId,
          Math.max(cursorByThreadRef.current.get(cursorThreadId) || 0, eventCursor),
        );
      }

      if (runtime.handleEvent(event, selectedThreadId)) return;

      if (event.kind === "thread.created" && eventThreadId) {
        const draftThreadId = String(event.previousThreadId || selectedThreadId || "");
        setMessagesByThread((current) => {
          const draftMessages = draftThreadId ? current[draftThreadId] ?? [] : [];
          const actualMessages = current[eventThreadId] ?? [];
          let merged = [...actualMessages];
          draftMessages.forEach((record) => {
            merged = upsertConversationRecordByIdentity(
              merged,
              { ...record, threadId: eventThreadId },
              eventThreadId,
            );
          });
          const next = {
            ...current,
            [eventThreadId]: mergeConversationRecords(merged, eventThreadId),
          };
          if (draftThreadId && draftThreadId !== eventThreadId) delete next[draftThreadId];
          return next;
        });
        handleThreadCreated({
          draftThreadId,
          threadId: eventThreadId,
          clientId: String(event.clientId || clientIdRef.current),
        });
        return;
      }

      const targetThreadId = eventThreadId || selectedThreadId;
      if (event.kind === "message" && event.record) {
        setMessagesByThread((current) => {
          const liveRecord = createWebChatLiveRecord(event, targetThreadId);
          return appendRecord(current, targetThreadId, liveRecord);
        });
        return;
      }

      if (event.kind === "assistant.delta" || event.kind === "assistant.partial") {
        // Delta 只表示传输进度，不是最终聊天气泡。
        // 同时渲染流式内容和完成消息会让回复播放两次，
        // 因此下方完整的 message 事件是唯一展示入口。
        return;
      }

      if (
        event.kind === "turn.started"
        || event.kind === "turn.completed"
        || event.kind === "turn.failed"
        || event.kind === "typing"
      ) {
        setStatus((current) => ({
          ...(current || {}),
          threadId: targetThreadId,
          status: resolveWebChatActivityStatus(event, current?.status) || current?.status,
        }));
        return;
      }

      if (event.kind === "error") {
        setError("执行失败，请稍后重试。");
        setStatus((current) => ({ ...(current || {}), threadId: targetThreadId, status: "failed" }));
        return;
      }

    },
    [handleThreadCreated, runtime.handleEvent],
  );

  useEffect(() => {
    if (!enabled || !threadId) {
      setConnection("idle");
      return undefined;
    }
    let cancelled = false;
    let stopSubscription: (() => void) | undefined;
    setConnection("connecting");
    void webChat.fetchStatus(threadId)
      .then((nextStatus) => {
        if (cancelled) return;
        const snapshotCursor = resolveThreadSubscriptionCursor(
          cursorByThreadRef.current.get(threadId),
          nextStatus.eventCursor,
        );
        cursorByThreadRef.current.set(threadId, snapshotCursor);
        runtime.absorbStatus(nextStatus, threadId);
        setStatus(selectConversationActivityStatus(nextStatus));
        setError("");
        stopSubscription = webChat.subscribe({
          threadId,
          after: snapshotCursor,
          clientId: clientIdRef.current,
          onEvent: handleEvent,
          onConnectionChange: (connected) => {
            if (!cancelled) setConnection(connected ? "open" : "offline");
          },
        });
      })
      .catch((nextError) => {
        if (cancelled) return;
        setConnection("offline");
        setError(
          getConversationCommandErrorMessage(
            "connect",
            nextError,
          ),
        );
      });
    return () => {
      cancelled = true;
      stopSubscription?.();
    };
  }, [enabled, threadId, handleEvent, runtime.absorbStatus]);

  const executeTransaction = useCallback(async (
    requestId: string,
    retry = false,
  ) => {
    const current = transactionsByRequestIdRef.current.get(requestId);
    if (!current) return;
    let transaction: WebChatSendTransaction;
    try {
      transaction = transitionWebChatSendTransaction(
        current,
        { type: retry ? "retry" : "submit" },
      );
    } catch {
      return;
    }
    transactionsByRequestIdRef.current.set(requestId, transaction);
    const envelope = transaction.envelope;
    const draftThreadId = String(envelope.threadId || "");
    const messageIds = [envelope.messageId];

    setMessagesByThread((messages) => settleWebChatDrafts(messages, {
      sourceThreadId: draftThreadId,
      messageIds,
      deliveryState: "submitting",
    }));

    const accept = (result: WebChatSendResult) => {
      const latest = transactionsByRequestIdRef.current.get(requestId);
      if (!latest || latest.state === "accepted") return;
      const accepted = transitionWebChatSendTransaction(latest, {
        type: "accepted",
        result,
      });
      transactionsByRequestIdRef.current.set(requestId, accepted);
      const targetThreadId = String(result.threadId || draftThreadId);
      setMessagesByThread((messages) => settleWebChatDrafts(messages, {
        sourceThreadId: draftThreadId,
        targetThreadId,
        messageIds,
        turnId: String(result.turnId || ""),
        deliveryState: "sent",
      }));
      setError("");
      if (targetThreadId && targetThreadId !== draftThreadId && envelope.newThread) {
        handleThreadCreated({
          draftThreadId,
          threadId: targetThreadId,
          clientId: result.clientId || clientIdRef.current,
        });
      }
    };

    const markTerminal = (
      state: "failed" | "unknown",
      nextError?: unknown,
    ) => {
      const latest = transactionsByRequestIdRef.current.get(requestId);
      if (!latest || latest.state !== "submitting") return;
      const errorText =
        state === "unknown"
          ? "发送状态暂时无法确认"
          : getConversationCommandErrorMessage(
              "send",
              nextError,
            );
      const next = transitionWebChatSendTransaction(latest, {
        type: state,
        error: errorText,
      });
      transactionsByRequestIdRef.current.set(requestId, next);
      setMessagesByThread((messages) => settleWebChatDrafts(messages, {
        sourceThreadId: draftThreadId,
        messageIds,
        deliveryState: state,
        deliveryError: errorText,
      }));
      if (state === "failed") setError(errorText);
    };

    try {
      const result = await webChat.sendMessages(envelope);
      if (result.accepted) {
        accept(result);
      } else if (result.status === "unknown") {
        markTerminal("unknown");
      } else {
        markTerminal("failed");
      }
    } catch (nextError) {
      console.error("[MurmurLane WebChat] 消息提交失败", {
        requestId,
        messageId: envelope.messageId,
        error: getConversationCommandErrorMessage(
          "send",
          nextError,
        ),
      });
      if (!webChat.isAmbiguousSendError(nextError)) {
        markTerminal("failed", nextError);
        return;
      }
      let snapshot: WebChatStatus | null = null;
      try {
        snapshot = await webChat.fetchStatus(draftThreadId, requestId);
        setStatus(snapshot);
      } catch {
        // 请求与恢复查询都无法确认结果时保留现有气泡，
        // 由用户明确重试并复用同一个 requestId。
      }
      if (snapshot?.sendRequest?.status === "accepted") {
        accept(snapshot.sendRequest.result || {
          accepted: true,
          status: "accepted",
          requestId,
          messageId: envelope.messageId,
          logicalTurnId: envelope.logicalTurnId,
          threadId: draftThreadId,
        });
        return;
      }
      markTerminal("unknown", nextError);
    }
  }, [handleThreadCreated]);

  const prepareStagedSend = useCallback(async (requestId: string) => {
    const staged = stagedSendsByRequestIdRef.current.get(requestId);
    if (!staged || preparingRequestIdsRef.current.has(requestId)) return;
    preparingRequestIdsRef.current.add(requestId);
    setMessagesByThread((messages) => settleWebChatDrafts(messages, {
      sourceThreadId: staged.draftThreadId,
      messageIds: [staged.messageId],
      deliveryState: "submitting",
    }));

    try {
      const uploadedMessages = await resolvePendingWebChatMessages(
        staged.messages,
        webChat.uploadFile,
        staged.resolvedUploads,
      );
      const envelope = buildWebChatSendEnvelope({
        requestId: staged.requestId,
        messageId: staged.messageId,
        clientId: clientIdRef.current,
        threadId: staged.draftThreadId,
        newThread: staged.newThread,
        model: staged.model,
        modelProvider: staged.modelProvider,
        messages: uploadedMessages,
      });
      transactionsByRequestIdRef.current.set(
        requestId,
        createWebChatSendTransaction(envelope),
      );
      stagedSendsByRequestIdRef.current.delete(requestId);
      setMessagesByThread((current) => {
        const draft = createWebChatDraftRecord(
          envelope.messages[0],
          staged.draftThreadId,
          {
            requestId: envelope.requestId,
            logicalTurnId: envelope.logicalTurnId,
          },
        );
        return appendRecord(current, staged.draftThreadId, {
          ...draft,
          meta: {
            ...draft.meta,
            deliveryState: "submitting",
          },
        });
      });
      void executeTransaction(requestId);
    } catch (nextError) {
      const errorText =
        getConversationCommandErrorMessage(
          "upload",
          nextError,
        );
      console.error("[MurmurLane WebChat] 附件准备失败", {
        requestId,
        messageId: staged.messageId,
        error: errorText,
      });
      setMessagesByThread((messages) => settleWebChatDrafts(messages, {
        sourceThreadId: staged.draftThreadId,
        messageIds: [staged.messageId],
        deliveryState: "failed",
        deliveryError: errorText,
      }));
      setError(errorText);
    } finally {
      preparingRequestIdsRef.current.delete(requestId);
    }
  }, [executeTransaction]);

  const sendMessages = useCallback(
    ({ messages, model = "", modelProvider = "", newThread = false }: {
      messages: WebChatComposerMessageInput[];
      model?: string;
      modelProvider?: string;
      newThread?: boolean;
    }) => {
      setError("");
      const draftThreadId = currentThreadIdRef.current;
      const identifiedSegments = messages.map((message) => ({
        ...message,
        segmentId: String(message.segmentId || message.messageId || createMessageId()),
        receivedAt: message.receivedAt || new Date().toISOString(),
      }));
      const requestId = createMessageId();
      const messageId = createMessageId();
      const optimisticEnvelope = buildWebChatSendEnvelope({
        requestId,
        messageId,
        clientId: clientIdRef.current,
        threadId: draftThreadId,
        newThread,
        model,
        modelProvider,
        messages: toOptimisticWebChatMessages(identifiedSegments),
      });
      stagedSendsByRequestIdRef.current.set(requestId, {
        requestId,
        messageId,
        draftThreadId,
        newThread,
        model,
        modelProvider,
        messages: identifiedSegments,
        resolvedUploads: new Map(),
      });
      requestIdByMessageIdRef.current.set(messageId, requestId);

      flushSync(() => {
        setMessagesByThread((current) => {
          const draft = createWebChatDraftRecord(
            optimisticEnvelope.messages[0],
            draftThreadId,
            {
              requestId: optimisticEnvelope.requestId,
              logicalTurnId: optimisticEnvelope.logicalTurnId,
            },
          );
          return appendRecord(current, draftThreadId, draft);
        });
      });
      void prepareStagedSend(requestId);
      return {
        accepted: false,
        status: "submitting",
        requestId,
        messageId,
        logicalTurnId: optimisticEnvelope.logicalTurnId,
        threadId: draftThreadId,
      } satisfies WebChatSendResult;
    },
    [prepareStagedSend],
  );

  const retryMessage = useCallback((messageId: string) => {
    const requestId = requestIdByMessageIdRef.current.get(String(messageId || "").trim());
    if (!requestId) return Promise.resolve();
    if (stagedSendsByRequestIdRef.current.has(requestId)) {
      return prepareStagedSend(requestId);
    }
    return executeTransaction(requestId, true);
  }, [executeTransaction, prepareStagedSend]);

  const sendVoiceDraft = useCallback(async (draft: {
    id: string;
    blob: Blob;
    durationMs: number;
    mimeType: string;
  }) => {
    const draftId = String(draft.id || "").trim();
    if (!draftId || !(draft.blob instanceof Blob)) throw new Error("语音草稿无效");
    const draftThreadId = currentThreadIdRef.current;
    const staged = stagedVoiceSendsByDraftIdRef.current.get(draftId) || {
      requestId: createMessageId(),
      messageId: createMessageId(),
      receivedAt: new Date().toISOString(),
      draftThreadId,
      newThread: String(draftThreadId).startsWith("draft-"),
    };
    stagedVoiceSendsByDraftIdRef.current.set(draftId, staged);
    setError("");
    try {
      const result = await webChat.sendVoiceMessage({
        blob: draft.blob,
        requestId: staged.requestId,
        messageId: staged.messageId,
        threadId: staged.draftThreadId,
        clientId: clientIdRef.current,
        newThread: staged.newThread,
        receivedAt: staged.receivedAt,
      });
      if (!result.accepted) throw new Error("语音发送未被接受");
      stagedVoiceSendsByDraftIdRef.current.delete(draftId);
      const targetThreadId = String(result.threadId || "");
      if (staged.newThread && targetThreadId && targetThreadId !== staged.draftThreadId) {
        handleThreadCreated({
          draftThreadId: staged.draftThreadId,
          threadId: targetThreadId,
          clientId: clientIdRef.current,
        });
      }
      return result;
    } catch (nextError) {
      setError("语音发送失败，草稿已保留，可再次点击发送重试。");
      throw nextError;
    }
  }, [handleThreadCreated, webChat]);

  const retryVoiceMessage = useCallback(async (messageId: string) => {
    setError("");
    try {
      return await webChat.retryVoiceMessage({
        messageId,
        requestId: createMessageId(),
        clientId: clientIdRef.current,
      });
    } catch (nextError) {
      setError("重新转写失败，请稍后再试。");
      throw nextError;
    }
  }, [webChat]);

  const confirmVoiceTranscript = useCallback(async (messageId: string, normalizedText: string) => {
    setError("");
    try {
      return await webChat.confirmVoiceTranscript({
        messageId,
        normalizedText,
        requestId: createMessageId(),
        clientId: clientIdRef.current,
      });
    } catch (nextError) {
      setError("文字确认失败，修改内容已保留。");
      throw nextError;
    }
  }, [webChat]);

  const generateSpeechRendition = useCallback(async (messageId: string) => {
    setError("");
    try {
      return await webChat.generateSpeechRendition({
        messageId,
        requestId: createMessageId(),
      });
    } catch (nextError) {
      setError("语音生成失败，请稍后再试。");
      throw nextError;
    }
  }, [webChat]);

  const searchRecords = useCallback(
    async (options: SearchConversationOptions) => {
      try {
        return await searchConversationRecords(options);
      } catch (error) {
        throw toConversationCommandError("search", error);
      }
    },
    [searchConversationRecords],
  );

  const loadStickers = useCallback(async () => {
    try {
      return await loadStickerAssets();
    } catch (error) {
      throw toConversationCommandError(
        "load-stickers",
        error,
      );
    }
  }, [loadStickerAssets]);

  const loadSticker = useCallback(
    async (sticker: StickerAsset) => {
      try {
        return await loadStickerAsset(sticker);
      } catch (error) {
        throw toConversationCommandError(
          "load-stickers",
          error,
        );
      }
    },
    [loadStickerAsset],
  );

  const selectThread = useCallback((nextThreadId: string) => {
    dispatch({ type: "select-thread", threadId: nextThreadId });
  }, []);

  const openDate = useCallback(
    (date: string, options: { jump?: boolean } = {}) => {
      dispatch({
        type: "open-date",
        date,
        jump: options.jump === true,
      });
    },
    [],
  );

  const setPageMode = useCallback((view: ConversationPageMode) => {
    dispatch({ type: "set-view", view });
  }, []);

  const setSettingsMode = useCallback((mode: string | null) => {
    dispatch({ type: "set-settings-mode", mode });
  }, []);

  const setProfilePreview = useCallback(
    (
      preview: {
        threadId: string;
        profile: ReturnType<typeof createDefaultThreadProfile>;
      } | null,
    ) => {
      dispatch({ type: "set-profile-preview", preview });
    },
    [],
  );

  const setPlaceholder = useCallback((placeholder: ConversationPlaceholder | null) => {
    dispatch({ type: "set-placeholder", placeholder });
  }, []);

  const setJumpDate = useCallback((date: string | null) => {
    dispatch({ type: "set-jump-date", date });
  }, []);

  const openNewThread = useCallback(() => {
    const draftThreadId = `draft-${createMessageId()}`;
    dispatch({
      type: "create-draft",
      threadId: draftThreadId,
      date: getTodayDateText(),
      profile: {
        ...createDefaultThreadProfile(draftThreadId, 0),
        name: "新聊天",
        handle: "@new-chat",
        signature: "从网页开始的聊天",
      },
    });
    return draftThreadId;
  }, []);

  const receiveNotification = useCallback(
    (
      notification: ConversationNotification,
      options: { enqueue?: boolean } = {},
    ) => {
      dispatch({
        type: "receive-notification",
        notification,
        enqueue: options.enqueue !== false,
      });
    },
    [],
  );

  const observeCanonicalBatches = useCallback(
    (
      batches: readonly CanonicalConversationBatch[],
      observation: CanonicalConversationObservation,
    ) => {
      canonicalObserverRef.current
        .observe(batches, observation, {
          ...activityRef.current,
          threadProfiles: threadProfilesRef.current,
          now: Date.now(),
        })
        .forEach(({ notification, enqueue }) => {
          dispatch({
            type: "receive-notification",
            notification,
            enqueue,
          });
        });
    },
    [],
  );

  const dismissNotification = useCallback(() => {
    dispatch({ type: "dismiss-notification" });
  }, []);

  const loadThreadDate = useCallback(
    async (
      date: string,
      targetThreadId = workspaceState.selectedThreadId,
    ) => {
      const loadingKey = `${date}:${targetThreadId}`;
      const alreadyLoaded =
        remoteData.conversationEntries[date]?.[targetThreadId] ||
        remoteData.searchCache.conversations[date]?.[targetThreadId];
      if (
        alreadyLoaded ||
        dateLoadingKeysRef.current.has(loadingKey)
      ) {
        return false;
      }
      dateLoadingKeysRef.current.add(loadingKey);
      setDateLoading(true);
      try {
        const records = await loadConversationRecords(date, {
          threadId: targetThreadId,
        });
        if (records) {
          observeCanonicalBatches(
            [{ date, records }],
            "cache-fill",
          );
        }
        return Boolean(
          records?.some(
            (record) =>
              String(record.threadId || "") === targetThreadId,
          ),
        );
      } finally {
        dateLoadingKeysRef.current.delete(loadingKey);
        setDateLoading(dateLoadingKeysRef.current.size > 0);
      }
    },
    [
      loadConversationRecords,
      observeCanonicalBatches,
      remoteData.conversationEntries,
      remoteData.searchCache.conversations,
      workspaceState.selectedThreadId,
    ],
  );

  useEffect(() => {
    if (!navigation) return;
    if (
      navigation.revision <=
      lastNavigationRevisionRef.current
    ) {
      return;
    }
    lastNavigationRevisionRef.current = navigation.revision;
    if (!navigation.target) {
      dispatch({
        type: "apply-navigation",
        revision: navigation.revision,
        target: null,
      });
      return;
    }
    const target = resolveConversationNavigationTarget(
      navigation.target,
      {
        currentThreadId: workspaceState.selectedThreadId,
        currentDate: workspaceState.calendarDate,
      },
    );
    dispatch({
      type: "apply-navigation",
      revision: navigation.revision,
      target,
    });
    navigation.acknowledge(navigation.revision);
    if (target) {
      void loadThreadDate(target.date, target.threadId);
    }
  }, [
    loadThreadDate,
    navigation,
    workspaceState.calendarDate,
    workspaceState.selectedThreadId,
  ]);

  const openThread = useCallback(
    (
      targetThreadId: string,
      fallbackLatestDate = "",
    ) => {
      const indexedDates = (
        remoteData.dateIndex?.conversationThreads?.[
          targetThreadId
        ] ?? []
      )
        .map(toDotDate)
        .sort();
      const date =
        indexedDates[indexedDates.length - 1] ||
        toDotDate(fallbackLatestDate) ||
        workspaceState.calendarDate;
      const target = resolveConversationNavigationTarget(
        { threadId: targetThreadId, date },
        {
          currentThreadId: workspaceState.selectedThreadId,
          currentDate: workspaceState.calendarDate,
        },
      );
      if (!target) return false;
      dispatch({ type: "open-target", target });
      void loadThreadDate(target.date, target.threadId);
      return true;
    },
    [
      loadThreadDate,
      remoteData.dateIndex,
      workspaceState.calendarDate,
      workspaceState.selectedThreadId,
    ],
  );

  const openSearchResult = useCallback(
    async ({
      threadId: targetThreadId,
      date,
      messageId,
      query = "",
    }: {
      readonly threadId?: string;
      readonly date: string;
      readonly messageId?: string;
      readonly query?: string;
    }) => {
      const target = resolveConversationNavigationTarget(
        {
          threadId: targetThreadId,
          date,
          messageId,
          query,
        },
        {
          currentThreadId: workspaceState.selectedThreadId,
          currentDate: workspaceState.calendarDate,
        },
      );
      if (!target) return false;
      await loadThreadDate(target.date, target.threadId);
      dispatch({ type: "open-target", target });
      return true;
    },
    [
      loadThreadDate,
      workspaceState.calendarDate,
      workspaceState.selectedThreadId,
    ],
  );

  const page = useMemo(
    () =>
      buildConversationThreadPage(
        styleTheme,
        workspaceState.selectedThreadId,
        remoteData,
        workspaceState.calendarDate,
      ),
    [
      remoteData,
      styleTheme,
      workspaceState.calendarDate,
      workspaceState.selectedThreadId,
    ],
  );
  const transcript = useMemo(
    () =>
      buildConversationTranscript({
        canonicalRecords: page.messages,
        liveRecords:
          messagesByThread[workspaceState.selectedThreadId] ?? [],
        threadId: workspaceState.selectedThreadId,
      }),
    [
      messagesByThread,
      page.messages,
      workspaceState.selectedThreadId,
    ],
  );
  const archiveThreadSummaries = useMemo(
    () =>
      getConversationThreadSummaries(
        profileThreadIds,
        remoteData,
      ),
    [profileThreadIds, remoteData],
  );
  const threadSummaries = useMemo(
    () =>
      archiveThreadSummaries.filter(
        (summary) => !deletedThreadIds.has(summary.threadId),
      ),
    [archiveThreadSummaries, deletedThreadIds],
  );
  useEffect(() => {
    if (!deletedThreadIds.size) return;
    const available = new Set(availableThreadIds);
    const summaries = new Map(
      archiveThreadSummaries.map((summary) => [
        summary.threadId,
        summary,
      ]),
    );
    setDeletedThreadIds((current) => {
      let changed = false;
      const next = new Set(current);
      current.forEach((deletedThreadId) => {
        const summary = summaries.get(deletedThreadId);
        const latestSourceKey = summary?.latestRecord
          ? getLegacyStableId(summary.latestRecord)
          : "";
        const deletedSourceKeys =
          deletedSourceKeysByThreadRef.current.get(
            deletedThreadId,
          );
        if (
          !shouldReleaseDeletedThreadOverlay({
            archiveContainsThread:
              available.has(deletedThreadId),
            latestSourceKey,
            deletedSourceKeys,
          })
        ) {
          return;
        }
        next.delete(deletedThreadId);
        deletedSourceKeysByThreadRef.current.delete(
          deletedThreadId,
        );
        changed = true;
      });
      return changed ? next : current;
    });
  }, [
    archiveThreadSummaries,
    availableThreadIds,
    deletedThreadIds,
  ]);
  const visibleThreadSummaries = useMemo(
    () =>
      threadSummaries.filter((summary) =>
        isConversationThreadVisibleInList(
          effectiveThreadProfiles[summary.threadId],
          summary,
        ),
      ),
    [effectiveThreadProfiles, threadSummaries],
  );
  useEffect(() => {
    threadSummaries.forEach((summary) => {
      const profile =
        effectiveThreadProfiles[summary.threadId];
      if (
        !profile?.listHidden ||
        !isConversationThreadVisibleInList(profile, summary) ||
        autoUnhidePendingRef.current.has(summary.threadId)
      ) {
        return;
      }
      autoUnhidePendingRef.current.add(summary.threadId);
      void updateThreadProfile(summary.threadId, {
        listHidden: false,
        listHiddenThrough: "",
      })
        .catch(() => undefined)
        .finally(() => {
          autoUnhidePendingRef.current.delete(summary.threadId);
        });
    });
  }, [
    effectiveThreadProfiles,
    threadSummaries,
    updateThreadProfile,
  ]);

  const hideThread = useCallback(
    async (requestedThreadId: string) => {
      const summary = threadSummaries.find(
        (item) => item.threadId === requestedThreadId,
      );
      const boundary = summary
        ? getConversationSummaryActivityKey(summary)
        : "";
      if (!summary || !boundary) {
        const actionError = new Error(
          "尚未载入这则对话的最新消息，请稍后再试。",
        );
        setThreadActionError(actionError.message);
        throw actionError;
      }
      setThreadActionError("");
      return updateThreadProfile(requestedThreadId, {
        listHidden: true,
        listHiddenThrough: boundary,
      });
    },
    [threadSummaries, updateThreadProfile],
  );

  const deleteThread = useCallback(
    async (requestedThreadId: string) => {
      if (deletingThreadId) return null;
      setDeletingThreadId(requestedThreadId);
      setThreadActionError("");
      try {
        const result = await archiveCommands.deleteThread(
          requestedThreadId,
        );
        deletedSourceKeysByThreadRef.current.set(
          requestedThreadId,
          new Set(result.deletedSourceKeys),
        );
        setDeletedThreadIds((current) => {
          const next = new Set(current);
          next.add(requestedThreadId);
          return next;
        });
        setMessagesByThread((current) => {
          if (!(requestedThreadId in current)) return current;
          const next = { ...current };
          delete next[requestedThreadId];
          return next;
        });
        runtime.clearThread(requestedThreadId);
        return result;
      } catch (cause) {
        const message =
          cause instanceof Error &&
          /active work|409|conflict/i.test(cause.message)
            ? "这则对话仍在回复或等待操作，暂时不能删除。"
            : "删除对话失败，请稍后重试。";
        setThreadActionError(message);
        throw cause;
      } finally {
        setDeletingThreadId("");
      }
    },
    [archiveCommands, deletingThreadId, runtime.clearThread],
  );
  const selectedThreadDates = useMemo(
    () =>
      (
        remoteData.dateIndex?.conversationThreads?.[
          workspaceState.selectedThreadId
        ] ?? []
      )
        .map(toDotDate)
        .sort(),
    [remoteData.dateIndex, workspaceState.selectedThreadId],
  );
  const allConversationDates = useMemo(
    () =>
      (remoteData.dateIndex?.conversations ?? [])
        .map(toDotDate)
        .sort(),
    [remoteData.dateIndex],
  );
  const loadedSelectedThreadDates = useMemo(
    () =>
      getContiguousLoadedConversationDates(
        workspaceState.selectedThreadId,
        remoteData,
        workspaceState.calendarDate,
      ),
    [
      remoteData,
      workspaceState.calendarDate,
      workspaceState.selectedThreadId,
    ],
  );
  const earlierDateToLoad = useMemo(
    () =>
      getAdjacentConversationDateToLoad(
        selectedThreadDates,
        loadedSelectedThreadDates,
        "earlier",
      ),
    [loadedSelectedThreadDates, selectedThreadDates],
  );
  const laterDateToLoad = useMemo(
    () =>
      getAdjacentConversationDateToLoad(
        selectedThreadDates,
        loadedSelectedThreadDates,
        "later",
      ),
    [loadedSelectedThreadDates, selectedThreadDates],
  );
  const navigationHighlightTarget = useMemo(
    () =>
      workspaceState.navigationTarget
        ? {
            mode: "Conversation" as const,
            threadId: workspaceState.navigationTarget.threadId,
            date: workspaceState.navigationTarget.date,
            targetId: workspaceState.navigationTarget.messageId,
            query: workspaceState.navigationTarget.query,
          }
        : null,
    [workspaceState.navigationTarget],
  );
  const mediaUrls = useMemo<ConversationMediaUrlPort>(
    () => ({
      resolveLocalFile: resolveLocalMediaUrl,
      resolveWebChatAsset: webChat.resolveAssetUrl,
    }),
    [resolveLocalMediaUrl, webChat.resolveAssetUrl],
  );
  const viewStatus = useMemo<WebChatStatus | null>(
    () =>
      status
        ? {
            ...status,
            ...runtime.statusSnapshot,
          }
        : null,
    [runtime.statusSnapshot, status],
  );

  const viewModel = useMemo(
    () => ({
      clientId: clientIdRef.current,
      messages: messagesByThread[threadId] ?? [],
      messagesByThread,
      usageTotals: runtime.usageTotals,
      contextUsage: runtime.contextUsage,
      status: viewStatus,
      models: runtime.models,
      modelCatalogError: runtime.modelCatalogError,
      runtimeSettingsNotice: runtime.runtimeSettingsNotice,
      connection,
      error,
      selectedThreadId: workspaceState.selectedThreadId,
      calendarDate: workspaceState.calendarDate,
      pageMode: workspaceState.view,
      settingsMode: workspaceState.settingsMode,
      profilePreview: workspaceState.profilePreview,
      placeholder: workspaceState.placeholder,
      jumpDate: workspaceState.jumpDate,
      webThreadIds: workspaceState.webThreadIds,
      threadIds: profileThreadIds,
      unreadCounts: workspaceState.unreadCounts,
      notificationQueue: workspaceState.notificationQueue,
      navigationTarget: navigationHighlightTarget,
      userProfile,
      threadProfiles: effectiveThreadProfiles,
      profileError,
      dateLoading,
      page,
      transcript,
      threadSummaries,
      visibleThreadSummaries,
      deletingThreadId,
      threadActionError,
      selectedThreadDates,
      allConversationDates,
      earlierDateToLoad,
      laterDateToLoad,
      mediaUrls,
    }),
    [
      connection,
      dateLoading,
      deletingThreadId,
      error,
      messagesByThread,
      navigationHighlightTarget,
      page,
      earlierDateToLoad,
      transcript,
      threadId,
      runtime.contextUsage,
      runtime.modelCatalogError,
      runtime.models,
      runtime.runtimeSettingsNotice,
      runtime.usageTotals,
      effectiveThreadProfiles,
      profileError,
      profileThreadIds,
      laterDateToLoad,
      mediaUrls,
      selectedThreadDates,
      allConversationDates,
      threadSummaries,
      threadActionError,
      userProfile,
      visibleThreadSummaries,
      viewStatus,
      workspaceState,
    ],
  );
  const commands = useMemo(
    () => ({
      sendMessages,
      sendVoiceDraft,
      retryVoiceMessage,
      confirmVoiceTranscript,
      generateSpeechRendition,
      retryMessage,
      refreshModels: runtime.refreshModels,
      chooseModel: runtime.chooseModel,
      chooseEffort: runtime.chooseEffort,
      selectThread,
      openDate,
      setPageMode,
      setSettingsMode,
      setProfilePreview,
      setPlaceholder,
      setJumpDate,
      openNewThread,
      receiveNotification,
      observeCanonicalBatches,
      searchRecords,
      loadStickers,
      loadSticker,
      dismissNotification,
      loadThreadDate,
      openThread,
      openSearchResult,
      saveUserProfile: setUserProfile,
      updateThreadProfile,
      hideThread,
      deleteThread,
    }),
    [
      runtime.chooseModel,
      runtime.chooseEffort,
      dismissNotification,
      deleteThread,
      hideThread,
      loadThreadDate,
      openDate,
      openNewThread,
      openSearchResult,
      openThread,
      receiveNotification,
      observeCanonicalBatches,
      searchRecords,
      loadStickers,
      loadSticker,
      runtime.refreshModels,
      retryMessage,
      retryVoiceMessage,
      selectThread,
      sendMessages,
      sendVoiceDraft,
      confirmVoiceTranscript,
      generateSpeechRendition,
      setJumpDate,
      setPageMode,
      setPlaceholder,
      setProfilePreview,
      setSettingsMode,
      setUserProfile,
      updateThreadProfile,
    ],
  );

  return createConversationWorkspaceOutput(viewModel, commands);
}

function selectConversationActivityStatus(
  status: WebChatStatus,
): WebChatStatus {
  const {
    model: _model,
    modelProvider: _modelProvider,
    effort: _effort,
    contextUsage: _contextUsage,
    usageTotals: _usageTotals,
    runtimeSettings: _runtimeSettings,
    ...activityStatus
  } = status;
  return activityStatus;
}
