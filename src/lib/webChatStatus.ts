import type { WebChatEvent } from "../types/webChat";

export function resolveWebChatActivityStatus(
  event: WebChatEvent,
  currentStatus = "",
) {
  if (event.kind === "turn.started") return "running";
  if (event.kind === "turn.completed") return "idle";
  if (event.kind === "turn.failed") return "failed";
  if (event.kind !== "typing") return null;

  const rawStatus = event.status;
  const typingActive = rawStatus === undefined || rawStatus === null
    ? true
    : Boolean(Number(rawStatus));
  if (typingActive) return "running";
  return currentStatus === "failed" ? "failed" : "idle";
}
