export type ConversationSwipeIntent =
  | "pending"
  | "horizontal"
  | "vertical";

export function resolveConversationSwipeIntent(
  deltaX: number,
  deltaY: number,
  threshold = 8,
): ConversationSwipeIntent {
  if (Math.hypot(deltaX, deltaY) < threshold) {
    return "pending";
  }
  return Math.abs(deltaY) > Math.abs(deltaX)
    ? "vertical"
    : "horizontal";
}

export function clampConversationSwipeOffset(
  baseOffset: number,
  deltaX: number,
  actionWidth: number,
) {
  return Math.max(
    -actionWidth,
    Math.min(0, baseOffset + deltaX),
  );
}

export function shouldRevealConversationActions(
  offset: number,
  actionWidth: number,
) {
  return Math.abs(offset) >= Math.min(64, actionWidth * 0.35);
}
