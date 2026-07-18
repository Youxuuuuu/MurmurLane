import type { WebChatSendEnvelope, WebChatSendResult } from "../types/webChat";

export type WebChatSendTransactionState =
  | "staging"
  | "submitting"
  | "accepted"
  | "failed"
  | "unknown";

export interface WebChatSendTransaction {
  envelope: WebChatSendEnvelope;
  state: WebChatSendTransactionState;
  attempts: number;
  error: string;
  result?: WebChatSendResult;
}

export type WebChatSendTransactionEvent =
  | { type: "submit" }
  | { type: "retry" }
  | { type: "accepted"; result?: WebChatSendResult }
  | { type: "failed"; error?: string }
  | { type: "unknown"; error?: string };

export function createWebChatSendTransaction(
  envelope: WebChatSendEnvelope,
): WebChatSendTransaction {
  return {
    envelope,
    state: "staging",
    attempts: 0,
    error: "",
  };
}

export function transitionWebChatSendTransaction(
  current: WebChatSendTransaction,
  event: WebChatSendTransactionEvent,
): WebChatSendTransaction {
  if (event.type === "submit") {
    requireState(current, ["staging"], "submit");
    return {
      ...current,
      state: "submitting",
      attempts: current.attempts + 1,
      error: "",
    };
  }
  if (event.type === "retry") {
    if (current.state === "accepted") {
      throw new Error("cannot retry accepted web chat send");
    }
    requireState(current, ["failed", "unknown"], "retry");
    return {
      ...current,
      state: "submitting",
      attempts: current.attempts + 1,
      error: "",
    };
  }
  if (event.type === "accepted") {
    requireState(current, ["submitting", "unknown"], "accept");
    return {
      ...current,
      state: "accepted",
      error: "",
      ...(event.result ? { result: event.result } : {}),
    };
  }
  if (event.type === "failed") {
    requireState(current, ["submitting"], "fail");
    return {
      ...current,
      state: "failed",
      error: String(event.error || "发送失败"),
    };
  }
  requireState(current, ["submitting"], "mark unknown");
  return {
    ...current,
    state: "unknown",
    error: String(event.error || "发送状态未知"),
  };
}

function requireState(
  transaction: WebChatSendTransaction,
  expected: WebChatSendTransactionState[],
  action: string,
) {
  if (!expected.includes(transaction.state)) {
    throw new Error(`cannot ${action} web chat send from ${transaction.state}`);
  }
}
