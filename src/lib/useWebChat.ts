import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchWebChatModels,
  fetchWebChatStatus,
  sendWebChatMessages,
  setWebChatModel,
  subscribeToWebChat,
} from "../data/chatApi";
import { mergeConversationRecords } from "./conversationMerge";
import type { ConversationRecord } from "../types/conversation";
import type {
  WebChatEvent,
  WebChatMessageInput,
  WebChatModelResponse,
  WebChatStatus,
  WebChatUsage,
} from "../types/webChat";

function createClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  if (existing.some((item) => item.id === nextRecord.id)) return current;
  return {
    ...current,
    [threadId]: mergeConversationRecords([...existing, nextRecord], threadId),
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
  const cursorRef = useRef(0);
  const currentThreadIdRef = useRef(threadId);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ConversationRecord[]>>({});
  const [usageByThread, setUsageByThread] = useState<Record<string, WebChatUsage>>({});
  const [status, setStatus] = useState<WebChatStatus | null>(null);
  const [models, setModels] = useState<WebChatModelResponse | null>(null);
  const [connection, setConnection] = useState<"idle" | "connecting" | "open" | "offline">("idle");
  const [error, setError] = useState("");

  currentThreadIdRef.current = threadId;

  const handleEvent = useCallback(
    (event: WebChatEvent) => {
      cursorRef.current = Math.max(cursorRef.current, Number(event.cursor) || 0);
      const selectedThreadId = currentThreadIdRef.current;
      const eventThreadId = String(event.threadId || "");

      if (event.kind === "thread.created" && eventThreadId) {
        const draftThreadId = String(event.previousThreadId || selectedThreadId || "");
        setMessagesByThread((current) => {
          const draftMessages = draftThreadId ? current[draftThreadId] ?? [] : [];
          const actualMessages = current[eventThreadId] ?? [];
          const merged = [...actualMessages];
          draftMessages.forEach((record) => {
            if (!merged.some((item) => item.id === record.id)) {
              merged.push({ ...record, threadId: eventThreadId });
            }
          });
          const next = { ...current, [eventThreadId]: merged };
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
          const liveRecord: ConversationRecord = {
            ...event.record,
            meta: {
              ...(event.record.meta || {}),
              ephemeral: true,
              webChatLive: true,
            },
          };
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

      if (event.kind === "turn.started" || event.kind === "typing") {
        setStatus((current) => ({ ...(current || {}), threadId: targetThreadId, status: "running" }));
        return;
      }

      if (event.kind === "turn.completed") {
        setStatus((current) => ({ ...(current || {}), threadId: targetThreadId, status: "idle" }));
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
    setConnection("connecting");
    const stop = subscribeToWebChat({
      threadId,
      after: cursorRef.current,
      clientId: clientIdRef.current,
      onEvent: handleEvent,
      onConnectionChange: (connected) => setConnection(connected ? "open" : "offline"),
    });
    return stop;
  }, [enabled, threadId, handleEvent]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    Promise.all([fetchWebChatStatus(threadId), fetchWebChatModels()])
      .then(([nextStatus, nextModels]) => {
        if (cancelled) return;
        setStatus(nextStatus);
        setModels(nextModels);
        setError("");
      })
      .catch((nextError) => {
        if (!cancelled) setError(String(nextError?.message || nextError));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, threadId]);

  const sendMessages = useCallback(
    async ({ messages, model = "", modelProvider = "", newThread = false }: {
      messages: WebChatMessageInput[];
      model?: string;
      modelProvider?: string;
      newThread?: boolean;
    }) => {
      setError("");
      const result = await sendWebChatMessages({
        threadId: currentThreadIdRef.current,
        clientId: clientIdRef.current,
        newThread,
        model,
        modelProvider,
        messages,
      });
      if (result.threadId && result.threadId !== currentThreadIdRef.current && newThread) {
        onThreadCreated?.({
          draftThreadId: currentThreadIdRef.current,
          threadId: result.threadId,
          clientId: result.clientMessageId,
        });
      }
      return result;
    },
    [onThreadCreated],
  );

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
    refreshModels,
    chooseModel,
  };
}
