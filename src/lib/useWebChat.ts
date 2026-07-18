import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  fetchWebChatModels,
  fetchWebChatStatus,
  isAmbiguousWebChatSendError,
  sendWebChatMessages,
  setWebChatModel,
  subscribeToWebChat,
} from "../data/chatApi";
import { mergeConversationRecords } from "./conversationMerge";
import { buildWebChatSendEnvelope } from "./webChatSendContract";
import {
  upsertConversationRecordByIdentity,
} from "./conversationIdentity";
import {
  createWebChatLiveRecord,
  createWebChatDraftRecord,
  resolveThreadSubscriptionCursor,
  settleWebChatDrafts,
} from "./webChatRecords";
import { resolveWebChatActivityStatus } from "./webChatStatus";
import {
  createWebChatSendTransaction,
  transitionWebChatSendTransaction,
  type WebChatSendTransaction,
} from "./webChatSendTransaction";
import type { ConversationRecord } from "../types/conversation";
import type {
  WebChatEvent,
  WebChatMessageInput,
  WebChatModelResponse,
  WebChatSendResult,
  WebChatStatus,
  WebChatUsage,
} from "../types/webChat";

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

export function useWebChat({
  enabled,
  threadId,
  onThreadCreated,
}: {
  enabled: boolean;
  threadId: string;
  onThreadCreated?: (input: { draftThreadId: string; threadId: string; clientId?: string }) => void;
}) {
  const clientIdRef = useRef(createClientId());
  const cursorByThreadRef = useRef(new Map<string, number>());
  const currentThreadIdRef = useRef(threadId);
  const transactionsByRequestIdRef = useRef(new Map<string, WebChatSendTransaction>());
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
        // Deltas are transport progress, not final chat bubbles. Rendering
        // both the stream and the completed message caused every reply to play
        // twice. The complete `message` event below is the single display path.
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
    void fetchWebChatStatus(threadId)
      .then((nextStatus) => {
        if (cancelled) return;
        const snapshotCursor = resolveThreadSubscriptionCursor(
          cursorByThreadRef.current.get(threadId),
          nextStatus.eventCursor,
        );
        cursorByThreadRef.current.set(threadId, snapshotCursor);
        setStatus(nextStatus);
        setError("");
        stopSubscription = subscribeToWebChat({
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
    fetchWebChatModels()
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
      const result = await sendWebChatMessages(envelope);
      if (result.accepted) {
        accept(result);
      } else if (result.status === "unknown") {
        markTerminal("unknown", "服务端正在确认这次发送");
      } else {
        markTerminal("failed", result.status || "发送失败");
      }
    } catch (nextError) {
      if (!isAmbiguousWebChatSendError(nextError)) {
        markTerminal("failed", nextError);
        return;
      }
      let snapshot: WebChatStatus | null = null;
      try {
        snapshot = await fetchWebChatStatus(draftThreadId, requestId);
        setStatus(snapshot);
      } catch {
        // The request and the recovery query are both ambiguous. Preserve the
        // existing bubble and let an explicit retry reuse the same requestId.
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

  const sendMessages = useCallback(
    async ({ messages, model = "", modelProvider = "", newThread = false }: {
      messages: WebChatMessageInput[];
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
      const envelope = buildWebChatSendEnvelope({
        requestId,
        messageId,
        clientId: clientIdRef.current,
        threadId: draftThreadId,
        newThread,
        model,
        modelProvider,
        messages: identifiedSegments,
      });
      const transaction = createWebChatSendTransaction(envelope);
      transactionsByRequestIdRef.current.set(requestId, transaction);
      requestIdByMessageIdRef.current.set(messageId, requestId);

      flushSync(() => {
        setMessagesByThread((current) => {
          const draft = createWebChatDraftRecord(
            envelope.messages[0],
            draftThreadId,
            { requestId: envelope.requestId, logicalTurnId: envelope.logicalTurnId },
          );
          return appendRecord(current, draftThreadId, draft);
        });
      });
      void executeTransaction(requestId);
      return {
        accepted: false,
        status: "submitting",
        requestId,
        messageId,
        logicalTurnId: envelope.logicalTurnId,
        threadId: draftThreadId,
      } satisfies WebChatSendResult;
    },
    [executeTransaction],
  );

  const retryMessage = useCallback((messageId: string) => {
    const requestId = requestIdByMessageIdRef.current.get(String(messageId || "").trim());
    if (!requestId) return Promise.resolve();
    return executeTransaction(requestId, true);
  }, [executeTransaction]);

  const refreshModels = useCallback(async () => {
    const result = await fetchWebChatModels();
    setModels(result);
    return result;
  }, []);

  const chooseModel = useCallback(async (model: string, modelProvider = "") => {
    const result = await setWebChatModel(model, modelProvider);
    setStatus(result);
    setModels((current) => current ? { ...current, currentModel: result.model, currentModelProvider: result.modelProvider } : current);
    return result;
  }, []);

  return {
    clientId: clientIdRef.current,
    messages: messagesByThread[threadId] ?? [],
    messagesByThread,
    usage: usageByThread[threadId] || status?.usage || null,
    status,
    models,
    connection,
    error,
    sendMessages,
    retryMessage,
    refreshModels,
    chooseModel,
  };
}
