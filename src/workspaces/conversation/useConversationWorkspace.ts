import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { mergeConversationRecords } from "../../lib/conversationMerge";
import { buildWebChatSendEnvelope } from "../../lib/webChatSendContract";
import {
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
  WebChatComposerMessageInput,
  WebChatEvent,
  WebChatMedia,
  WebChatModelResponse,
  WebChatSendResult,
  WebChatStatus,
  WebChatUsage,
} from "../../types/webChat";
import type { WebChatPort } from "./webChatPort";
import { createConversationWorkspaceOutput } from "./conversationWorkspaceContract";

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

function hasDetailedUsage(usage: WebChatUsage | null | undefined) {
  return Boolean(
    Number(usage?.outputTokens) ||
      Number(usage?.cacheReadInputTokens) ||
      Number(usage?.cachedInputTokens) ||
      Number(usage?.cacheCreationInputTokens),
  );
}

function mergeUsageSnapshot(
  previous: WebChatUsage | null | undefined,
  incoming: WebChatUsage | null | undefined,
) {
  if (!previous) return incoming || {};
  if (!incoming) return previous;
  if (hasDetailedUsage(incoming) || !hasDetailedUsage(previous)) {
    return incoming;
  }

  // ClaudeCode 会先后上报“思考上下文”和“最终回复”两类 usage。
  // 只有输入量的思考快照不能覆盖最终回复里的输出与缓存明细。
  return {
    ...incoming,
    inputTokens: previous.inputTokens,
    outputTokens: previous.outputTokens,
    cacheReadInputTokens: previous.cacheReadInputTokens,
    cachedInputTokens: previous.cachedInputTokens,
    cacheCreationInputTokens: previous.cacheCreationInputTokens,
  };
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
  enabled,
  threadId,
  onThreadCreated,
}: {
  webChat: WebChatPort;
  enabled: boolean;
  threadId: string;
  onThreadCreated?: (input: { draftThreadId: string; threadId: string; clientId?: string }) => void;
}) {
  const clientIdRef = useRef(createClientId());
  const cursorByThreadRef = useRef(new Map<string, number>());
  const currentThreadIdRef = useRef(threadId);
  const transactionsByRequestIdRef = useRef(new Map<string, WebChatSendTransaction>());
  const stagedSendsByRequestIdRef = useRef(new Map<string, StagedWebChatSend>());
  const preparingRequestIdsRef = useRef(new Set<string>());
  const requestIdByMessageIdRef = useRef(new Map<string, string>());
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ConversationRecord[]>>({});
  const [usageByThread, setUsageByThread] = useState<Record<string, WebChatUsage>>({});
  const [status, setStatus] = useState<WebChatStatus | null>(null);
  const [models, setModels] = useState<WebChatModelResponse | null>(null);
  const [connection, setConnection] = useState<"idle" | "connecting" | "open" | "offline">("idle");
  const [error, setError] = useState("");

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
        onThreadCreated?.({
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

      if (event.kind === "usage" && targetThreadId) {
        setUsageByThread((current) => ({
          ...current,
          [targetThreadId]: mergeUsageSnapshot(current[targetThreadId], event.usage),
        }));
        setStatus((current) => ({
          ...(current || {}),
          threadId: targetThreadId,
          usage: mergeUsageSnapshot(current?.usage, event.usage),
        }));
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
        setError(String(event.text || "执行失败"));
        setStatus((current) => ({ ...(current || {}), threadId: targetThreadId, status: "failed" }));
        return;
      }

      if (event.kind === "model.updated") {
        setStatus((current) => ({
          ...(current || {}),
          model: String(event.model || ""),
          modelProvider: String(event.modelProvider || ""),
        }));
      }
    },
    [onThreadCreated],
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
        setStatus(nextStatus);
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
        setError(String(nextError?.message || nextError));
      });
    return () => {
      cancelled = true;
      stopSubscription?.();
    };
  }, [enabled, threadId, handleEvent]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    webChat.fetchModels()
      .then((nextModels) => {
        if (cancelled) return;
        setModels(nextModels);
      })
      .catch((nextError) => {
        if (!cancelled) setError(String(nextError?.message || nextError));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

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
        onThreadCreated?.({
          draftThreadId,
          threadId: targetThreadId,
          clientId: result.clientId || clientIdRef.current,
        });
      }
    };

    const markTerminal = (state: "failed" | "unknown", nextError: unknown) => {
      const latest = transactionsByRequestIdRef.current.get(requestId);
      if (!latest || latest.state !== "submitting") return;
      const errorText = String(
        nextError instanceof Error ? nextError.message : nextError || "",
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
      if (state === "failed") setError(errorText || "发送失败");
    };

    try {
      const result = await webChat.sendMessages(envelope);
      if (result.accepted) {
        accept(result);
      } else if (result.status === "unknown") {
        markTerminal("unknown", "服务端正在确认这次发送");
      } else {
        markTerminal("failed", result.status || "发送失败");
      }
    } catch (nextError) {
      console.error("[MurmurLane WebChat] 消息提交失败", {
        requestId,
        messageId: envelope.messageId,
        error: String(nextError instanceof Error ? nextError.message : nextError || ""),
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
  }, [onThreadCreated]);

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
      const detail = String(
        nextError instanceof Error ? nextError.message : nextError || "",
      );
      const errorText = detail ? `附件上传失败：${detail}` : "附件上传失败";
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

  const refreshModels = useCallback(async () => {
    const result = await webChat.fetchModels();
    setModels(result);
    return result;
  }, []);

  const chooseModel = useCallback(async (model: string, modelProvider = "") => {
    const result = await webChat.setModel(model, modelProvider);
    setStatus(result);
    setModels((current) => current ? { ...current, currentModel: result.model, currentModelProvider: result.modelProvider } : current);
    return result;
  }, []);

  const viewModel = useMemo(
    () => ({
      clientId: clientIdRef.current,
      messages: messagesByThread[threadId] ?? [],
      messagesByThread,
      usage: usageByThread[threadId] || status?.usage || null,
      status,
      models,
      connection,
      error,
    }),
    [
      connection,
      error,
      messagesByThread,
      models,
      status,
      threadId,
      usageByThread,
    ],
  );
  const commands = useMemo(
    () => ({
      sendMessages,
      retryMessage,
      refreshModels,
      chooseModel,
    }),
    [chooseModel, refreshModels, retryMessage, sendMessages],
  );

  return createConversationWorkspaceOutput(viewModel, commands);
}
