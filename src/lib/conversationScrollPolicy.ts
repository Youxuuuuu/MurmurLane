export const conversationScrollCauses = [
  "user",
  "initial-position",
  "new-message",
  "date-jump",
  "history-prepend",
  "bubble-reveal",
] as const;

export type ConversationScrollCause = typeof conversationScrollCauses[number];

export function clampConversationScrollTop(
  requestedTop: number,
  scrollHeight: number,
  clientHeight: number,
) {
  const maximum = Math.max(0, Number(scrollHeight) - Number(clientHeight));
  return Math.min(maximum, Math.max(0, Number(requestedTop) || 0));
}

export function shouldShowFloatingDate(cause: ConversationScrollCause | null) {
  return cause === "user";
}

export function shouldAnimateConversationBubble({
  isUnseen,
  awaitingInitialBatch,
  isLive,
  reduceMotion,
  historyLoading,
  navigating,
}: {
  isUnseen: boolean;
  awaitingInitialBatch: boolean;
  isLive: boolean;
  reduceMotion: boolean;
  historyLoading: boolean;
  navigating: boolean;
}) {
  return Boolean(
    isUnseen
      && (!awaitingInitialBatch || isLive)
      && !reduceMotion
      && !historyLoading
      && !navigating,
  );
}

export function resolveBubbleRevealAnchorTop({
  wasNearBottom,
  anchorScrollTop,
  anchorScrollHeight,
  currentScrollHeight,
  anchorUserRevision,
  currentUserRevision,
}: {
  wasNearBottom: boolean;
  anchorScrollTop: number;
  anchorScrollHeight: number;
  currentScrollHeight: number;
  anchorUserRevision: number;
  currentUserRevision: number;
}) {
  if (!wasNearBottom || anchorUserRevision !== currentUserRevision) return null;
  const heightDelta = Number(currentScrollHeight) - Number(anchorScrollHeight);
  if (heightDelta <= 0) return null;
  return Number(anchorScrollTop) + heightDelta;
}

type PendingProgrammaticScroll = {
  cause: Exclude<ConversationScrollCause, "user">;
  targetTop: number;
};

export class ConversationScrollCauseLedger {
  private pending: PendingProgrammaticScroll | null = null;
  private hasUserIntent = false;
  private userRevision = 0;

  beginProgrammaticScroll({
    cause,
    requestedTop,
    currentTop,
    scrollHeight,
    clientHeight,
  }: {
    cause: Exclude<ConversationScrollCause, "user">;
    requestedTop: number;
    currentTop: number;
    scrollHeight: number;
    clientHeight: number;
  }) {
    const targetTop = clampConversationScrollTop(
      requestedTop,
      scrollHeight,
      clientHeight,
    );
    this.hasUserIntent = false;
    if (Math.abs(targetTop - Number(currentTop || 0)) <= 0.5) {
      this.pending = null;
      return { shouldScroll: false, targetTop, cause };
    }
    this.pending = { cause, targetTop };
    return { shouldScroll: true, targetTop, cause };
  }

  noteUserScrollIntent() {
    this.pending = null;
    this.hasUserIntent = true;
    this.userRevision += 1;
    return this.userRevision;
  }

  clearUserScrollIntent() {
    this.hasUserIntent = false;
  }

  resolveScrollEvent(actualTop: number): ConversationScrollCause | null {
    if (this.pending) {
      const pending = this.pending;
      if (Math.abs(Number(actualTop || 0) - pending.targetTop) <= 1) {
        this.pending = null;
      }
      return pending.cause;
    }
    if (!this.hasUserIntent) return null;
    this.hasUserIntent = false;
    return "user";
  }

  getUserRevision() {
    return this.userRevision;
  }

  reset() {
    this.pending = null;
    this.hasUserIntent = false;
  }
}

export type ConversationEntryMetricsSnapshot = {
  entryKey: string;
  initialBottomPositioningCount: number;
  historicalBubbleEnterCount: number;
  logicalMessageMountCount: number;
};

export class ConversationEntryMetrics {
  private entryKey = "";
  private initialBottomPositioningCount = 0;
  private historicalBubbleEnterCount = 0;
  private readonly logicalMessageIds = new Set<string>();

  beginEntry(entryKey: string) {
    const normalized = String(entryKey || "");
    if (normalized === this.entryKey) return false;
    this.entryKey = normalized;
    this.initialBottomPositioningCount = 0;
    this.historicalBubbleEnterCount = 0;
    this.logicalMessageIds.clear();
    return true;
  }

  claimInitialBottomPositioning() {
    if (this.initialBottomPositioningCount > 0) return false;
    this.initialBottomPositioningCount = 1;
    return true;
  }

  recordHistoricalBubbleEnter() {
    this.historicalBubbleEnterCount += 1;
  }

  observeLogicalMessages(renderIds: Iterable<string>) {
    for (const renderId of renderIds) {
      const normalized = String(renderId || "");
      if (normalized) this.logicalMessageIds.add(normalized);
    }
    return this.logicalMessageIds.size;
  }

  snapshot(): ConversationEntryMetricsSnapshot {
    return {
      entryKey: this.entryKey,
      initialBottomPositioningCount: this.initialBottomPositioningCount,
      historicalBubbleEnterCount: this.historicalBubbleEnterCount,
      logicalMessageMountCount: this.logicalMessageIds.size,
    };
  }
}
