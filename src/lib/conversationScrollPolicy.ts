export const conversationScrollCauses = [
  "user",
  "initial-position",
  "new-message",
  "date-jump",
  "history-prepend",
  "bubble-reveal",
] as const;

export type ConversationScrollCause = typeof conversationScrollCauses[number];

export type ConversationVisibleRange = {
  start: number;
  end: number;
};

export type ConversationRenderWindow = ConversationVisibleRange & {
  scopeKey: string;
  anchorId: string;
};

export function getConversationHistoryPrefetchThreshold(clientHeight: number) {
  return Math.max(320, Math.round(Math.max(0, clientHeight) * 1.5));
}

export function shouldPrefetchConversationHistory(
  distanceToEdge: number,
  threshold: number,
  projectedDelta = 0,
) {
  const safeDistance = Math.max(0, Number(distanceToEdge) || 0);
  const safeThreshold = Math.max(0, Number(threshold) || 0);
  const safeProjectedDelta = Math.max(0, Number(projectedDelta) || 0);
  return safeDistance <= safeThreshold + safeProjectedDelta;
}

function clampRange(
  range: ConversationVisibleRange,
  total: number,
  maximumSize: number,
) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeMaximumSize = Math.max(1, Number(maximumSize) || 1);
  const requestedSize = Math.max(1, range.end - range.start);
  const size = Math.min(safeMaximumSize, requestedSize, safeTotal || 1);
  let start = Math.max(0, Math.min(safeTotal, Number(range.start) || 0));
  let end = Math.min(safeTotal, start + size);
  if (end - start < size) start = Math.max(0, end - size);
  return { start, end };
}

export function createConversationRenderWindow({
  messageIds,
  scopeKey,
  range,
  maximumSize,
}: {
  messageIds: string[];
  scopeKey: string;
  range: ConversationVisibleRange;
  maximumSize: number;
}): ConversationRenderWindow {
  const resolved = clampRange(range, messageIds.length, maximumSize);
  return {
    ...resolved,
    scopeKey,
    anchorId: messageIds[resolved.start] || "",
  };
}

export function resolveConversationRenderWindow({
  window,
  messageIds,
  messageIndexById,
  scopeKey,
  maximumSize,
}: {
  window: ConversationRenderWindow;
  messageIds: string[];
  messageIndexById: ReadonlyMap<string, number>;
  scopeKey: string;
  maximumSize: number;
}): ConversationVisibleRange {
  const total = messageIds.length;
  if (!total) return { start: 0, end: 0 };
  if (window.scopeKey !== scopeKey) {
    return {
      start: Math.max(0, total - maximumSize),
      end: total,
    };
  }

  const anchoredStart = window.anchorId
    ? messageIndexById.get(window.anchorId)
    : undefined;
  if (anchoredStart === undefined && window.end <= window.start) {
    return {
      start: Math.max(0, total - maximumSize),
      end: total,
    };
  }

  return clampRange(
    {
      start: anchoredStart ?? window.start,
      end:
        (anchoredStart ?? window.start)
        + Math.max(1, window.end - window.start),
    },
    total,
    maximumSize,
  );
}

export function expandConversationRangeEarlier({
  range,
  total,
  step,
  maximumSize,
}: {
  range: ConversationVisibleRange;
  total: number;
  step: number;
  maximumSize?: number;
}): ConversationVisibleRange {
  const currentSize = Math.max(0, range.end - range.start);
  const size = Math.min(
    total,
    maximumSize === undefined
      ? currentSize
      : Math.max(currentSize, maximumSize),
  );
  const start = Math.max(0, Math.min(total, range.start) - step);
  return {
    start,
    end: Math.min(total, start + size),
  };
}

export function expandConversationRangeLater({
  range,
  total,
  step,
  maximumSize,
}: {
  range: ConversationVisibleRange;
  total: number;
  step: number;
  maximumSize?: number;
}): ConversationVisibleRange {
  const currentSize = Math.max(0, range.end - range.start);
  const size = Math.min(
    total,
    maximumSize === undefined
      ? currentSize
      : Math.max(currentSize, maximumSize),
  );
  const end = Math.min(total, Math.max(0, range.end) + step);
  return {
    start: Math.max(0, end - size),
    end,
  };
}

export function resolveConversationViewportAnchorTop({
  currentScrollTop,
  previousScrollHeight,
  currentScrollHeight,
  previousAnchorOffset,
  currentAnchorOffset,
}: {
  currentScrollTop: number;
  previousScrollHeight: number;
  currentScrollHeight: number;
  previousAnchorOffset?: number;
  currentAnchorOffset?: number;
}) {
  if (
    Number.isFinite(previousAnchorOffset)
    && Number.isFinite(currentAnchorOffset)
  ) {
    return (
      Number(currentScrollTop)
      + Number(currentAnchorOffset)
      - Number(previousAnchorOffset)
    );
  }
  return (
    Number(currentScrollTop)
    + Number(currentScrollHeight)
    - Number(previousScrollHeight)
  );
}

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
