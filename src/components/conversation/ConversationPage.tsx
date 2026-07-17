// @ts-nocheck
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  shouldHideConversationRecord,
} from "../../lib/conversation";
import {
  getConversationMergeKey,
  mergeConversationRecords,
} from "../../lib/conversationMerge";
import { getConversationRenderId } from "../../lib/conversationIdentity";
import { bubbleRevealLedger } from "../../lib/BubbleRevealLedger";
import {
  ConversationEntryMetrics,
  ConversationScrollCauseLedger,
  resolveBubbleRevealAnchorTop,
  shouldAnimateConversationBubble,
  shouldShowFloatingDate,
} from "../../lib/conversationScrollPolicy";
import { CardScrollArea } from "../layout/CardScrollArea";
import { PageCard } from "../layout/PageCard";
import { ChatBubble } from "./ChatBubble";
import { AssistantTurn } from "./AssistantTurn";
import { ConversationComposer } from "./ConversationComposer";
import { ConversationEmptyState } from "./ConversationEmptyState";
import {
  getConversationMessageDate as getMessageDate,
  groupConversationDisplayRecords,
  messageMatchesConversationDisplayTarget,
} from "../../lib/conversationDisplayGroups";
import {
  buildAssistantTurnDisplayModel,
  expandRangeToAssistantTurnBoundaries,
} from "../../lib/assistantTurnModel";

const CONVERSATION_RECENT_RENDER_LIMIT = 200;
const CONVERSATION_HIT_CONTEXT_LIMIT = 80;
const CONVERSATION_SCROLL_EDGE_THRESHOLD = 80;
const FLOATING_DATE_HIDE_DELAY_MS = 1200;
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateDivider(dateText) {
  const [year, month, day] = String(dateText).split(".").map(Number);
  const date = new Date(year, month - 1, day);
  return `${year}.${month}.${day} ${weekdayLabels[date.getDay()] || ""}`;
}

function formatFloatingDate(dateText) {
  const [year, month, day] = String(dateText).split(".").map(Number);
  return year && month && day ? `${year}/${month}/${day}` : "";
}

function getBubbleAnimationEntries(messages, selectedThreadId) {
  const byKey = new Map();
  messages.forEach((message) => {
    if (!["assistant", "user"].includes(message?.type)) return;
    const key = getConversationMergeKey(message, selectedThreadId);
    if (!key || byKey.has(key)) return;
    byKey.set(key, {
      key,
      live: Boolean(message?.meta?.webChatLive),
    });
  });
  return Array.from(byKey.values());
}

export function ConversationPage({
  page,
  selectedThreadId,
  highlightResult,
  userProfile,
  threadProfile,
  onEditThread,
  targetDate,
  onTargetDateHandled,
  onLoadEarlier,
  hasEarlierDate,
  earlierDateLoading,
  onFloatingDateChange,
  liveMessages = [],
  webChat = null,
}) {
  const [quoteMessage, setQuoteMessage] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const reduceMotion = useReducedMotion();
  const bubbleAnimationThreadRef = useRef(null);
  const observedBubbleKeysRef = useRef(new Set());
  const historicalBubbleKeysRef = useRef(new Set());
  const awaitingInitialBubbleBatchRef = useRef(false);
  useEffect(() => {
    setActiveAction(null);
  }, [selectedThreadId]);
  const mergedMessages = useMemo(
    () => mergeConversationRecords(
      [...(page.messages || []), ...(liveMessages || [])],
      selectedThreadId,
    ),
    [liveMessages, page.messages, selectedThreadId],
  );
  const visibleMessages = useMemo(
    () =>
      groupConversationDisplayRecords(
        mergedMessages.filter(
          (message) => !shouldHideConversationRecord(message),
        ),
      ),
    [mergedMessages],
  );
  const bubbleAnimationEntries = useMemo(
    () => getBubbleAnimationEntries(visibleMessages, selectedThreadId),
    [visibleMessages, selectedThreadId],
  );
  const pageHasEntry = Boolean(page.hasEntry || visibleMessages.length);
  const [visibleRange, setVisibleRange] = useState(() => ({
    start: Math.max(0, visibleMessages.length - CONVERSATION_RECENT_RENDER_LIMIT),
    end: visibleMessages.length,
  }));
  const visibleRangeRef = useRef(visibleRange);
  const topScrollAdjustmentRef = useRef(null);
  const shouldStickToBottomRef = useRef(false);
  const shouldStickToBottomCauseRef = useRef(null);
  const shouldResetToBottomRef = useRef(false);
  const resetVisibleRangeRef = useRef(null);
  const pendingHighlightTargetRef = useRef(null);
  const pendingDateTargetRef = useRef(null);
  const pendingEarlierAnchorRef = useRef(null);
  const floatingDateTimerRef = useRef(null);
  const conversationKeyRef = useRef(null);
  const pendingBubbleRevealAnchorsRef = useRef(new Map());
  const scrollCauseLedgerRef = useRef(new ConversationScrollCauseLedger());
  const entryMetricsRef = useRef(new ConversationEntryMetrics());
  const historyLoadInFlightRef = useRef(false);
  const messageCountRef = useRef({
    key: selectedThreadId,
    count: visibleMessages.length,
  });
  const isNearBottomRef = useRef(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const conversationKey = selectedThreadId;
  entryMetricsRef.current.beginEntry(conversationKey);

  const publishEntryMetrics = () => {
    const snapshot = entryMetricsRef.current.snapshot();
    const scrollBox = typeof document === "undefined"
      ? null
      : document.getElementById("conversation-message-scroll");
    if (scrollBox) {
      scrollBox.dataset.initialBottomPositioningCount = String(
        snapshot.initialBottomPositioningCount,
      );
      scrollBox.dataset.historicalBubbleEnterCount = String(
        snapshot.historicalBubbleEnterCount,
      );
      scrollBox.dataset.logicalMessageMountCount = String(
        snapshot.logicalMessageMountCount,
      );
    }
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    window.__MURMURLANE_CONVERSATION_ENTRY_METRICS__ = snapshot;
  };

  const scrollWithCause = (scrollBox, requestedTop, cause) => {
    const plan = scrollCauseLedgerRef.current.beginProgrammaticScroll({
      cause,
      requestedTop,
      currentTop: scrollBox.scrollTop,
      scrollHeight: scrollBox.scrollHeight,
      clientHeight: scrollBox.clientHeight,
    });
    scrollBox.dataset.scrollCause = cause;
    const distanceFromBottom =
      scrollBox.scrollHeight - plan.targetTop - scrollBox.clientHeight;
    isNearBottomRef.current =
      distanceFromBottom <= CONVERSATION_SCROLL_EDGE_THRESHOLD;
    if (!plan.shouldScroll) return false;
    scrollBox.scrollTo({ top: plan.targetTop, behavior: "auto" });
    return true;
  };
  const hasConversationHit =
    highlightResult?.mode === "Conversation" &&
    highlightResult.threadId === selectedThreadId;
  const hitIndex = useMemo(() => {
    if (!hasConversationHit) return -1;
    return visibleMessages.findIndex(
      (message) =>
        messageMatchesConversationDisplayTarget(
          message,
          highlightResult.targetId,
        ),
    );
  }, [hasConversationHit, visibleMessages, highlightResult?.targetId]);
  const clampedVisibleRange = useMemo(() => {
    const end = Math.min(
      visibleMessages.length,
      Math.max(0, visibleRange.end),
    );
    const start = Math.min(
      end,
      Math.max(0, Math.min(visibleRange.start, visibleMessages.length)),
    );
    return { start, end };
  }, [visibleMessages.length, visibleRange]);
  const renderedRange = useMemo(
    () => expandRangeToAssistantTurnBoundaries(
      visibleMessages,
      clampedVisibleRange,
      selectedThreadId,
    ),
    [clampedVisibleRange, selectedThreadId, visibleMessages],
  );
  const renderedMessages = useMemo(
    () =>
      visibleMessages.slice(
        renderedRange.start,
        renderedRange.end,
      ),
    [visibleMessages, renderedRange],
  );
  const renderedDisplayItems = useMemo(
    () => buildAssistantTurnDisplayModel(
      renderedMessages,
      selectedThreadId,
      renderedRange.start,
    ),
    [renderedMessages, renderedRange.start, selectedThreadId],
  );
  const renderedBubbleAnimationEntries = useMemo(
    () => getBubbleAnimationEntries(renderedMessages, selectedThreadId),
    [renderedMessages, selectedThreadId],
  );
  const targetDateIndex = useMemo(() => {
    if (!targetDate) return -1;
    const normalizedTarget = String(targetDate).replace(/-/g, ".");
    return visibleMessages.findIndex(
      (message) => getMessageDate(message) === normalizedTarget,
    );
  }, [targetDate, visibleMessages]);

  useEffect(() => {
    visibleRangeRef.current = clampedVisibleRange;
  }, [clampedVisibleRange]);

  useEffect(
    () => {
      if (floatingDateTimerRef.current) {
        window.clearTimeout(floatingDateTimerRef.current);
      }
      onFloatingDateChange?.("");
      return () => {
        if (floatingDateTimerRef.current) {
          window.clearTimeout(floatingDateTimerRef.current);
        }
        onFloatingDateChange?.("");
      };
    },
    [onFloatingDateChange, selectedThreadId],
  );

  useLayoutEffect(() => {
    entryMetricsRef.current.observeLogicalMessages(
      bubbleAnimationEntries.map((entry) => entry.key),
    );
    publishEntryMetrics();
  }, [bubbleAnimationEntries, selectedThreadId]);

  useEffect(() => {
    pendingBubbleRevealAnchorsRef.current.clear();
    return bubbleRevealLedger.subscribeLifecycle((event) => {
      if (
        event.phase === "entering"
        && historicalBubbleKeysRef.current.has(event.renderId)
      ) {
        entryMetricsRef.current.recordHistoricalBubbleEnter();
        publishEntryMetrics();
        return;
      }

      const scrollBox = document.getElementById("conversation-message-scroll");
      if (!scrollBox) return;

      if (event.phase === "will-mount") {
        if (!isNearBottomRef.current) return;
        pendingBubbleRevealAnchorsRef.current.set(event.bubbleId, {
          threadId: selectedThreadId,
          wasNearBottom: true,
          scrollHeight: scrollBox.scrollHeight,
          scrollTop: scrollBox.scrollTop,
          userRevision: scrollCauseLedgerRef.current.getUserRevision(),
        });
        return;
      }

      if (event.phase !== "mounted") return;
      const anchor = pendingBubbleRevealAnchorsRef.current.get(event.bubbleId);
      if (!anchor) return;
      pendingBubbleRevealAnchorsRef.current.delete(event.bubbleId);
      if (anchor.threadId !== selectedThreadId) return;
      const anchoredTop = resolveBubbleRevealAnchorTop({
        wasNearBottom: anchor.wasNearBottom,
        anchorScrollTop: anchor.scrollTop,
        anchorScrollHeight: anchor.scrollHeight,
        currentScrollHeight: scrollBox.scrollHeight,
        anchorUserRevision: anchor.userRevision,
        currentUserRevision: scrollCauseLedgerRef.current.getUserRevision(),
      });
      if (anchoredTop === null) return;
      scrollWithCause(
        scrollBox,
        anchoredTop,
        "bubble-reveal",
      );
    });
  }, [selectedThreadId]);

  useLayoutEffect(() => {
    if (!targetDate || targetDateIndex < 0) return;
    const nextRange = {
      start: Math.max(0, targetDateIndex - 20),
      end: Math.min(
        visibleMessages.length,
        targetDateIndex + CONVERSATION_RECENT_RENDER_LIMIT,
      ),
    };
    pendingDateTargetRef.current = String(targetDate).replace(/-/g, ".");
    shouldResetToBottomRef.current = false;
    resetVisibleRangeRef.current = null;
    setVisibleRange(nextRange);
  }, [targetDate, targetDateIndex, visibleMessages.length]);

  useLayoutEffect(() => {
    const pending = pendingEarlierAnchorRef.current;
    if (!pending || visibleMessages.length <= pending.messageCount) return;
    const anchorIndex = visibleMessages.findIndex(
      (message) => message.id === pending.messageId,
    );
    if (anchorIndex < 0) return;

    pendingEarlierAnchorRef.current = null;
    setVisibleRange({
      start: Math.max(0, anchorIndex - CONVERSATION_RECENT_RENDER_LIMIT),
      end: Math.min(
        visibleMessages.length,
        anchorIndex + pending.renderedCount,
      ),
    });
  }, [visibleMessages]);

  useLayoutEffect(() => {
    const keyChanged = conversationKeyRef.current !== conversationKey;

    if (keyChanged) {
      conversationKeyRef.current = conversationKey;
      topScrollAdjustmentRef.current = null;
      pendingHighlightTargetRef.current = null;
      shouldStickToBottomRef.current = false;
      shouldStickToBottomCauseRef.current = null;
      pendingBubbleRevealAnchorsRef.current.clear();
      scrollCauseLedgerRef.current.reset();
    }

    if (hasConversationHit) {
      topScrollAdjustmentRef.current = null;
      shouldStickToBottomRef.current = false;
      shouldStickToBottomCauseRef.current = null;
      shouldResetToBottomRef.current = false;
      resetVisibleRangeRef.current = null;

      if (hitIndex !== -1) {
        setVisibleRange({
          start: Math.max(0, hitIndex - CONVERSATION_HIT_CONTEXT_LIMIT),
          end: Math.min(
            visibleMessages.length,
            hitIndex + CONVERSATION_HIT_CONTEXT_LIMIT + 1,
          ),
        });
        pendingHighlightTargetRef.current = visibleMessages[hitIndex].id;
      }
      return;
    }

    if (!keyChanged && !shouldResetToBottomRef.current) {
      return;
    }

    topScrollAdjustmentRef.current = null;
    pendingHighlightTargetRef.current = null;
    shouldStickToBottomRef.current = false;
    shouldStickToBottomCauseRef.current = null;
    const nextRange = {
      start: Math.max(
        0,
        visibleMessages.length - CONVERSATION_RECENT_RENDER_LIMIT,
      ),
      end: visibleMessages.length,
    };
    resetVisibleRangeRef.current = {
      date: page.date,
      threadId: selectedThreadId,
      ...nextRange,
    };
    setVisibleRange(nextRange);
    shouldResetToBottomRef.current = true;
  }, [
    conversationKey,
    page.date,
    selectedThreadId,
    visibleMessages.length,
    hasConversationHit,
    hitIndex,
    highlightResult?.targetId,
  ]);

  useLayoutEffect(() => {
    const threadChanged = bubbleAnimationThreadRef.current !== selectedThreadId;
    const baselineEntries = (entries) => {
      entries.forEach((entry) => {
        observedBubbleKeysRef.current.add(entry.key);
        if (!entry.live) historicalBubbleKeysRef.current.add(entry.key);
      });
    };

    if (threadChanged) {
      bubbleAnimationThreadRef.current = selectedThreadId;
      observedBubbleKeysRef.current = new Set();
      historicalBubbleKeysRef.current = new Set();
      baselineEntries(bubbleAnimationEntries);
      awaitingInitialBubbleBatchRef.current = bubbleAnimationEntries.length === 0;
      return;
    }

    const shouldBaselineCurrentMessages = Boolean(
      reduceMotion ||
        historyLoadInFlightRef.current ||
        pendingDateTargetRef.current ||
        targetDate ||
        hasConversationHit,
    );
    if (shouldBaselineCurrentMessages) {
      baselineEntries(bubbleAnimationEntries);
      if (bubbleAnimationEntries.length) {
        awaitingInitialBubbleBatchRef.current = false;
      }
      return;
    }

    const newEntries = renderedBubbleAnimationEntries.filter(
      (entry) => !observedBubbleKeysRef.current.has(entry.key),
    );
    if (!newEntries.length) return;

    // Commit the keys only after their first render. The render that introduced
    // a realtime message can therefore mount it in its hidden enter state,
    // instead of painting it once and resetting it in a follow-up effect.
    newEntries.forEach((entry) => {
      observedBubbleKeysRef.current.add(entry.key);
    });

    if (awaitingInitialBubbleBatchRef.current) {
      awaitingInitialBubbleBatchRef.current = false;
      // The first async history batch can be larger than the rendered window.
      // Baseline every loaded key now so older rows do not animate on scroll.
      baselineEntries(bubbleAnimationEntries);
    }
  }, [
    bubbleAnimationEntries,
    renderedBubbleAnimationEntries,
    selectedThreadId,
    reduceMotion,
    targetDate,
    hasConversationHit,
  ]);

  useLayoutEffect(() => {
    const previous = messageCountRef.current;
    messageCountRef.current = {
      key: conversationKey,
      count: visibleMessages.length,
    };

    if (previous.key !== conversationKey) {
      isNearBottomRef.current = true;
      shouldStickToBottomCauseRef.current = null;
      setNewMessageCount(0);
      return;
    }

    const addedCount = visibleMessages.length - previous.count;
    if (historyLoadInFlightRef.current) {
      historyLoadInFlightRef.current = false;
      setNewMessageCount(0);
      return;
    }
    if (pendingDateTargetRef.current || targetDate) {
      setNewMessageCount(0);
      return;
    }
    if (addedCount <= 0 || hasConversationHit) return;

    if (isNearBottomRef.current) {
      shouldStickToBottomRef.current = true;
      shouldStickToBottomCauseRef.current = "new-message";
      setVisibleRange({
        start: Math.max(
          0,
          visibleMessages.length - CONVERSATION_RECENT_RENDER_LIMIT,
        ),
        end: visibleMessages.length,
      });
      setNewMessageCount(0);
      return;
    }

    setNewMessageCount((current) => current + addedCount);
  }, [conversationKey, visibleMessages.length, hasConversationHit]);

  useLayoutEffect(() => {
    const scrollBox = document.getElementById("conversation-message-scroll");

    if (!scrollBox) return;

    if (shouldResetToBottomRef.current) {
      const resetRange = resetVisibleRangeRef.current;

      if (
        !resetRange ||
        resetRange.date !== page.date ||
        resetRange.threadId !== selectedThreadId
      ) {
        shouldResetToBottomRef.current = false;
        resetVisibleRangeRef.current = null;
        topScrollAdjustmentRef.current = null;
        shouldStickToBottomRef.current = false;
        shouldStickToBottomCauseRef.current = null;
        return;
      }

      if (
        clampedVisibleRange.start !== resetRange.start ||
        clampedVisibleRange.end !== resetRange.end
      ) {
        return;
      }

      topScrollAdjustmentRef.current = null;
      shouldStickToBottomRef.current = false;
      shouldStickToBottomCauseRef.current = null;
      if (!entryMetricsRef.current.claimInitialBottomPositioning()) {
        shouldResetToBottomRef.current = false;
        resetVisibleRangeRef.current = null;
        return;
      }
      scrollWithCause(scrollBox, scrollBox.scrollHeight, "initial-position");
      publishEntryMetrics();
      shouldResetToBottomRef.current = false;
      resetVisibleRangeRef.current = null;
      return;
    }

    const topScrollAdjustment = topScrollAdjustmentRef.current;
    if (topScrollAdjustment) {
      topScrollAdjustmentRef.current = null;

      if (
        topScrollAdjustment.date === page.date &&
        topScrollAdjustment.threadId === selectedThreadId
      ) {
        scrollWithCause(
          scrollBox,
          scrollBox.scrollHeight -
            topScrollAdjustment.scrollHeight +
            topScrollAdjustment.scrollTop,
          "history-prepend",
        );
        return;
      }
    }

    if (pendingHighlightTargetRef.current) {
      const target = document.getElementById(
        `hit-message-${pendingHighlightTargetRef.current}`,
      );

      if (!target) return;

      pendingHighlightTargetRef.current = null;
      const boxRect = scrollBox.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetTop =
        targetRect.top - boxRect.top + scrollBox.scrollTop;
      const centeredTop =
        targetTop - scrollBox.clientHeight / 2 + targetRect.height / 2;

      scrollWithCause(scrollBox, centeredTop, "date-jump");
      return;
    }

    if (pendingDateTargetRef.current) {
      const date = pendingDateTargetRef.current;
      const target = document.getElementById(`conversation-date-${date}`);
      if (!target) return;
      pendingDateTargetRef.current = null;
      scrollWithCause(scrollBox, target.offsetTop - 12, "date-jump");
      onTargetDateHandled?.();
      return;
    }

    if (shouldStickToBottomRef.current) {
      const cause = shouldStickToBottomCauseRef.current || "new-message";
      shouldStickToBottomRef.current = false;
      shouldStickToBottomCauseRef.current = null;
      scrollWithCause(scrollBox, scrollBox.scrollHeight, cause);
    }
  }, [
    clampedVisibleRange.start,
    clampedVisibleRange.end,
    renderedMessages.length,
    page.date,
    selectedThreadId,
  ]);

  const updateFloatingDate = (scrollBox) => {
    const boxTop = scrollBox.getBoundingClientRect().top;
    const messageElements = Array.from(
      scrollBox.querySelectorAll("[data-conversation-date]"),
    );
    const current =
      messageElements.find(
        (element) => element.getBoundingClientRect().bottom > boxTop + 8,
      ) || messageElements[messageElements.length - 1];
    const date = current?.getAttribute("data-conversation-date") || "";
    onFloatingDateChange?.(formatFloatingDate(date));
    if (floatingDateTimerRef.current) {
      window.clearTimeout(floatingDateTimerRef.current);
    }
    floatingDateTimerRef.current = window.setTimeout(
      () => onFloatingDateChange?.(""),
      FLOATING_DATE_HIDE_DELAY_MS,
    );
  };

  const noteUserScrollIntent = () => {
    scrollCauseLedgerRef.current.noteUserScrollIntent();
  };

  const handleScrollPointerDown = (event) => {
    if (event.target === event.currentTarget) noteUserScrollIntent();
  };

  const handleScrollKeyDown = (event) => {
    if (
      ["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]
        .includes(event.key)
    ) {
      noteUserScrollIntent();
    }
  };

  const handleConversationScroll = (event) => {
    const scrollBox = event.currentTarget;
    const cause = scrollCauseLedgerRef.current.resolveScrollEvent(
      scrollBox.scrollTop,
    );
    if (cause) scrollBox.dataset.scrollCause = cause;
    const currentRange = visibleRangeRef.current;
    const distanceFromBottom =
      scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight;
    isNearBottomRef.current =
      distanceFromBottom <= CONVERSATION_SCROLL_EDGE_THRESHOLD;
    if (isNearBottomRef.current && newMessageCount) setNewMessageCount(0);
    if (shouldShowFloatingDate(cause)) updateFloatingDate(scrollBox);
    if (cause !== "user") return;

    if (
      scrollBox.scrollTop <= CONVERSATION_SCROLL_EDGE_THRESHOLD &&
      currentRange.start > 0
    ) {
      topScrollAdjustmentRef.current = {
        date: page.date,
        threadId: selectedThreadId,
        scrollHeight: scrollBox.scrollHeight,
        scrollTop: scrollBox.scrollTop,
      };
      setVisibleRange((current) => ({
        start: Math.max(0, current.start - CONVERSATION_RECENT_RENDER_LIMIT),
        end: current.end,
      }));
      return;
    }

    if (
      scrollBox.scrollTop <= CONVERSATION_SCROLL_EDGE_THRESHOLD &&
      currentRange.start === 0 &&
      hasEarlierDate &&
      !earlierDateLoading &&
      renderedMessages.length > 0
    ) {
      topScrollAdjustmentRef.current = {
        date: page.date,
        threadId: selectedThreadId,
        scrollHeight: scrollBox.scrollHeight,
        scrollTop: scrollBox.scrollTop,
      };
      pendingEarlierAnchorRef.current = {
        messageId: renderedMessages[0].id,
        messageCount: visibleMessages.length,
        renderedCount: renderedMessages.length,
      };
      isNearBottomRef.current = false;
      historyLoadInFlightRef.current = true;
      const request = onLoadEarlier?.();
      if (request && typeof request.then === "function") {
        request.then((loaded) => {
          // Keep the guard through the React commit when an earlier date was
          // actually added. The message-count effect clears it after the
          // prepended records land, so they cannot become a false "new" badge.
          if (!loaded) historyLoadInFlightRef.current = false;
        }, () => {
          historyLoadInFlightRef.current = false;
        });
      } else {
        historyLoadInFlightRef.current = false;
      }
      return;
    }

    if (
      distanceFromBottom <= CONVERSATION_SCROLL_EDGE_THRESHOLD &&
      currentRange.end < visibleMessages.length
    ) {
      setVisibleRange((current) => ({
        start: current.start,
        end: Math.min(
          visibleMessages.length,
          current.end + CONVERSATION_RECENT_RENDER_LIMIT,
        ),
      }));
    }
  };

  const handleShowNewMessages = () => {
    pendingDateTargetRef.current = null;
    pendingHighlightTargetRef.current = null;
    pendingEarlierAnchorRef.current = null;
    topScrollAdjustmentRef.current = null;
    resetVisibleRangeRef.current = null;
    shouldResetToBottomRef.current = false;
    isNearBottomRef.current = true;
    shouldStickToBottomRef.current = true;
    shouldStickToBottomCauseRef.current = "new-message";
    setNewMessageCount(0);
    setVisibleRange({
      start: Math.max(
        0,
        visibleMessages.length - CONVERSATION_RECENT_RENDER_LIMIT,
      ),
      end: visibleMessages.length,
    });
  };

  const renderRecordEntry = (entry, showDateDivider = true) => {
    const message = entry.record;
    const animationKey = getConversationRenderId(message, selectedThreadId);
    const isBubbleMessage = ["assistant", "user"].includes(message.type);
    const isUnseenBubble =
      isBubbleMessage &&
      bubbleAnimationThreadRef.current === selectedThreadId &&
      !observedBubbleKeysRef.current.has(animationKey);
    const animateBubbleSequence = shouldAnimateConversationBubble({
      isUnseen: isUnseenBubble,
      awaitingInitialBatch: awaitingInitialBubbleBatchRef.current,
      isLive: Boolean(message.meta?.webChatLive),
      reduceMotion: Boolean(reduceMotion),
      historyLoading: historyLoadInFlightRef.current,
      navigating: Boolean(
        pendingDateTargetRef.current || targetDate || hasConversationHit
      ),
    });
    const date = getMessageDate(message);
    const previousDate = entry.index > 0
      ? getMessageDate(visibleMessages[entry.index - 1])
      : "";
    const shouldShowDateDivider = Boolean(
      showDateDivider && date && date !== previousDate,
    );
    const active =
      highlightResult?.mode === "Conversation" &&
      messageMatchesConversationDisplayTarget(
        message,
        highlightResult?.targetId,
      ) &&
      highlightResult?.threadId === selectedThreadId;
    return (
      <div key={animationKey} data-message-render-id={animationKey}>
        {shouldShowDateDivider && (
          <div
            id={`conversation-date-${date}`}
            className="my-5 text-center font-sans text-[11px] font-semibold tracking-[0.04em] text-black/[0.28]"
          >
            {formatDateDivider(date)}
          </div>
        )}
        <div
          id={`hit-message-${message.id}`}
          data-conversation-date={date}
          className="relative mb-4 border-l-2 pl-1 transition"
          style={{
            borderLeftColor: active ? page.color : "transparent",
            background: active ? `${page.color}12` : "transparent",
          }}
        >
          <ChatBubble
            message={message}
            bubbleIdentityKey={animationKey}
            page={page}
            messages={visibleMessages}
            userProfile={userProfile}
            threadProfile={threadProfile}
            onEditThread={onEditThread}
            onQuote={(nextMessage) => {
              setQuoteMessage(nextMessage);
              setActiveAction(null);
            }}
            activeActionId={activeAction?.id || null}
            onActionOpen={setActiveAction}
            onActionClose={() => setActiveAction(null)}
            animateBubbleSequence={animateBubbleSequence}
          />
        </div>
      </div>
    );
  };

  return (
    <PageCard
      page={page}
      motionKey={`conversation-${selectedThreadId}`}
      initial={false}
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        backgroundColor: threadProfile?.background || page.paper,
        backgroundImage: threadProfile?.backgroundImage
          ? `linear-gradient(rgba(255,255,255,.22), rgba(255,255,255,.22)), url(${threadProfile.backgroundImage})`
          : "none",
        backgroundSize: "100% 100%, cover",
        backgroundPosition: `center, ${threadProfile?.backgroundPositionX ?? 50}% ${threadProfile?.backgroundPositionY ?? 50}%`,
        backgroundRepeat: "no-repeat, no-repeat",
      }}
      showTexture={false}
    >
      {pageHasEntry ? (
        <div className="relative flex min-h-0 flex-1">
          <CardScrollArea
            id="conversation-message-scroll"
            className="z-10 px-3 pb-[122px] pt-[184px]"
            onScroll={handleConversationScroll}
            onWheel={noteUserScrollIntent}
            onTouchMove={noteUserScrollIntent}
            onPointerDown={handleScrollPointerDown}
            onKeyDown={handleScrollKeyDown}
            style={{
              background: "transparent",
            }}
          >
          {renderedDisplayItems.map((item) => {
            if (item.kind === "record") {
              return renderRecordEntry(item.entry);
            }
            const firstEntry = item.entries[0];
            const date = getMessageDate(firstEntry.record);
            const previousDate = item.firstIndex > 0
              ? getMessageDate(visibleMessages[item.firstIndex - 1])
              : "";
            const showDateDivider = Boolean(date && date !== previousDate);
            return (
              <div
                key={item.renderId}
                data-turn-render-id={item.renderId}
                data-conversation-date={date}
              >
                {showDateDivider && (
                  <div
                    id={`conversation-date-${date}`}
                    className="my-5 text-center font-sans text-[11px] font-semibold tracking-[0.04em] text-black/[0.28]"
                  >
                    {formatDateDivider(date)}
                  </div>
                )}
                <AssistantTurn
                  turn={item}
                  thinkingFace={threadProfile?.thinkingFace}
                  renderRecord={(entry) => renderRecordEntry(entry, false)}
                />
              </div>
            );
          })}
          </CardScrollArea>
          {newMessageCount > 0 && (
            <button
              type="button"
              className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-black/[0.08] bg-white/95 px-4 py-2 font-sans text-[12px] font-semibold text-black/[0.68] shadow-[0_8px_24px_rgba(0,0,0,.14)] backdrop-blur"
              onClick={handleShowNewMessages}
            >
              {newMessageCount} 条新消息
            </button>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ConversationEmptyState />
        </div>
      )}
      {webChat?.sendMessages ? (
        <ConversationComposer
          status={webChat.status}
          models={webChat.models}
          connection={webChat.connection}
          quoteMessage={quoteMessage}
          onClearQuote={() => setQuoteMessage(null)}
          onSendMessages={({ messages, newThread }) => webChat.sendMessages({ messages, newThread })}
          onChooseModel={webChat.chooseModel}
          isNewThread={String(selectedThreadId).startsWith("draft-")}
          error={webChat.error}
        />
      ) : null}
    </PageCard>
  );
}
