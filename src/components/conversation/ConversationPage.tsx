// @ts-nocheck
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  memo,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";
import { getConversationMergeKey } from "../../lib/conversationMerge";
import { getConversationRenderId } from "../../lib/conversationIdentity";
import { bubbleRevealLedger } from "../../lib/BubbleRevealLedger";
import {
  ConversationEntryMetrics,
  ConversationScrollCauseLedger,
  createConversationRenderWindow,
  expandConversationRangeEarlier,
  expandConversationRangeLater,
  getConversationHistoryPrefetchThreshold,
  shouldPrefetchConversationHistory,
  resolveBubbleRevealAnchorTop,
  resolveConversationRenderWindow,
  resolveConversationViewportAnchorTop,
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
  messageMatchesConversationDisplayTarget,
} from "../../lib/conversationDisplayGroups";
import {
  selectConversationTranscriptWindow,
} from "../../workspaces/conversation";

const CONVERSATION_RECENT_RENDER_LIMIT = 120;
const CONVERSATION_HIT_CONTEXT_LIMIT = 80;
const CONVERSATION_WINDOW_SHIFT = 30;
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

export const ConversationPage = memo(function ConversationPage({
  page,
  selectedThreadId,
  highlightResult: requestedHighlightResult,
  userProfile,
  threadProfile,
  onEditThread,
  targetDate,
  onTargetDateHandled,
  onLoadEarlier,
  hasEarlierDate,
  onLoadLater,
  hasLaterDate,
  earlierDateLoading,
  laterDateLoading = earlierDateLoading,
  onFloatingDateChange,
  transcript,
  webChatViewModel = null,
  webChatCommands = null,
  loadStickers,
  mediaUrls,
  diagnosticsEnabled = false,
}) {
  const [quoteMessage, setQuoteMessage] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [highlightResult, setHighlightResult] = useState(
    requestedHighlightResult,
  );
  useEffect(() => {
    setHighlightResult(requestedHighlightResult);
    if (!requestedHighlightResult) return;
    const timer = window.setTimeout(
      () => setHighlightResult(null),
      3000,
    );
    return () => window.clearTimeout(timer);
  }, [requestedHighlightResult]);
  const handleQuote = useCallback((nextMessage) => {
    setQuoteMessage(nextMessage);
    setActiveAction(null);
  }, []);
  const handleActionClose = useCallback(() => setActiveAction(null), []);
  const reduceMotion = useReducedMotion();
  const bubbleAnimationThreadRef = useRef(null);
  const observedBubbleKeysRef = useRef(new Set());
  const historicalBubbleKeysRef = useRef(new Set());
  const awaitingInitialBubbleBatchRef = useRef(false);
  useEffect(() => {
    setActiveAction(null);
  }, [selectedThreadId]);
  const visibleMessages = transcript.records;
  const bubbleAnimationEntries = useMemo(
    () => getBubbleAnimationEntries(visibleMessages, selectedThreadId),
    [visibleMessages, selectedThreadId],
  );
  const visibleMessageIds = transcript.recordRenderIds;
  const visibleMessageIndexById = useMemo(
    () => new Map(visibleMessageIds.map((id, index) => [id, index])),
    [visibleMessageIds],
  );
  const pageHasEntry = Boolean(page.hasEntry || visibleMessages.length);
  const [visibleWindow, setVisibleWindow] = useState(() =>
    createConversationRenderWindow({
      messageIds: visibleMessageIds,
      scopeKey: selectedThreadId,
      range: {
        start: Math.max(
          0,
          visibleMessages.length - CONVERSATION_RECENT_RENDER_LIMIT,
        ),
        end: visibleMessages.length,
      },
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    }),
  );
  const visibleRangeRef = useRef({
    start: visibleWindow.start,
    end: visibleWindow.end,
  });
  const pendingViewportAnchorRef = useRef(null);
  const shouldStickToBottomRef = useRef(false);
  const shouldStickToBottomCauseRef = useRef(null);
  const shouldResetToBottomRef = useRef(false);
  const resetVisibleRangeRef = useRef(null);
  const pendingHighlightTargetRef = useRef(null);
  const pendingDateTargetRef = useRef(null);
  const pendingEarlierAnchorRef = useRef(null);
  const pendingLaterAnchorRef = useRef(null);
  const floatingDateTimerRef = useRef(null);
  const floatingDateFrameRef = useRef(null);
  const floatingDateScrollBoxRef = useRef(null);
  const lastFloatingDateRef = useRef("");
  const lastTouchYRef = useRef(null);
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
    if (!diagnosticsEnabled || typeof window === "undefined") return;
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
  const captureViewportAnchor = (scrollBox, expectedRange) => {
    const boxRect = scrollBox.getBoundingClientRect();
    const anchors = Array.from(
      scrollBox.querySelectorAll("[data-message-render-id]"),
    );
    const anchor = anchors.find(
      (element) => element.getBoundingClientRect().bottom > boxRect.top + 1,
    ) || anchors[0];
    const renderId = anchor?.getAttribute("data-message-render-id");
    if (!anchor || !renderId) {
      pendingViewportAnchorRef.current = null;
      return false;
    }

    pendingViewportAnchorRef.current = {
      renderId,
      viewportOffset: anchor.getBoundingClientRect().top - boxRect.top,
      scrollHeight: scrollBox.scrollHeight,
      expectedRange,
    };
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
  const clampedVisibleRange = useMemo(
    () => resolveConversationRenderWindow({
      window: visibleWindow,
      messageIds: visibleMessageIds,
      messageIndexById: visibleMessageIndexById,
      scopeKey: selectedThreadId,
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    }),
    [
      selectedThreadId,
      visibleMessageIds,
      visibleMessageIndexById,
      visibleWindow,
    ],
  );
  const transcriptWindow = useMemo(
    () => selectConversationTranscriptWindow(
      transcript,
      clampedVisibleRange,
    ),
    [clampedVisibleRange, transcript],
  );
  const renderedRange = transcriptWindow.range;
  const renderedMessages = transcriptWindow.records;
  const renderedDisplayItems = transcriptWindow.displayItems;
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

  useLayoutEffect(() => {
    visibleRangeRef.current = clampedVisibleRange;
  }, [clampedVisibleRange]);

  useEffect(
    () => {
      if (floatingDateTimerRef.current) {
        window.clearTimeout(floatingDateTimerRef.current);
      }
      if (floatingDateFrameRef.current) {
        window.cancelAnimationFrame(floatingDateFrameRef.current);
      }
      floatingDateFrameRef.current = null;
      floatingDateScrollBoxRef.current = null;
      lastFloatingDateRef.current = "";
      onFloatingDateChange?.("");
      return () => {
        if (floatingDateTimerRef.current) {
          window.clearTimeout(floatingDateTimerRef.current);
        }
        if (floatingDateFrameRef.current) {
          window.cancelAnimationFrame(floatingDateFrameRef.current);
        }
        floatingDateFrameRef.current = null;
        floatingDateScrollBoxRef.current = null;
        lastFloatingDateRef.current = "";
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
    const start = Math.max(0, targetDateIndex - 20);
    const nextRange = {
      start,
      end: Math.min(
        visibleMessages.length,
        start + CONVERSATION_RECENT_RENDER_LIMIT,
      ),
    };
    pendingDateTargetRef.current = String(targetDate).replace(/-/g, ".");
    pendingViewportAnchorRef.current = null;
    shouldResetToBottomRef.current = false;
    resetVisibleRangeRef.current = null;
    setVisibleWindow(createConversationRenderWindow({
      messageIds: visibleMessageIds,
      scopeKey: selectedThreadId,
      range: nextRange,
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    }));
  }, [
    selectedThreadId,
    targetDate,
    targetDateIndex,
    visibleMessageIds,
    visibleMessages.length,
  ]);

  useLayoutEffect(() => {
    const pending = pendingEarlierAnchorRef.current;
    if (!pending || visibleMessages.length <= pending.messageCount) return;
    const nextRange = expandConversationRangeEarlier({
      range: clampedVisibleRange,
      total: visibleMessages.length,
      step: CONVERSATION_WINDOW_SHIFT,
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    });
    const scrollBox = document.getElementById("conversation-message-scroll");
    if (!scrollBox || !captureViewportAnchor(scrollBox, nextRange)) return;
    pendingEarlierAnchorRef.current = null;
    setVisibleWindow(createConversationRenderWindow({
      messageIds: visibleMessageIds,
      scopeKey: selectedThreadId,
      range: nextRange,
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    }));
  }, [
    clampedVisibleRange,
    selectedThreadId,
    visibleMessageIds,
    visibleMessages.length,
  ]);

  useLayoutEffect(() => {
    const pending = pendingLaterAnchorRef.current;
    if (!pending || visibleMessages.length <= pending.messageCount) return;
    const nextRange = expandConversationRangeLater({
      range: clampedVisibleRange,
      total: visibleMessages.length,
      step: CONVERSATION_WINDOW_SHIFT,
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    });
    const scrollBox = document.getElementById("conversation-message-scroll");
    if (!scrollBox || !captureViewportAnchor(scrollBox, nextRange)) return;
    pendingLaterAnchorRef.current = null;
    setVisibleWindow(createConversationRenderWindow({
      messageIds: visibleMessageIds,
      scopeKey: selectedThreadId,
      range: nextRange,
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    }));
  }, [
    clampedVisibleRange,
    selectedThreadId,
    visibleMessageIds,
    visibleMessages.length,
  ]);

  useLayoutEffect(() => {
    const keyChanged = conversationKeyRef.current !== conversationKey;

    if (keyChanged) {
      conversationKeyRef.current = conversationKey;
      pendingEarlierAnchorRef.current = null;
      pendingLaterAnchorRef.current = null;
      pendingViewportAnchorRef.current = null;
      pendingHighlightTargetRef.current = null;
      shouldStickToBottomRef.current = false;
      shouldStickToBottomCauseRef.current = null;
      pendingBubbleRevealAnchorsRef.current.clear();
      scrollCauseLedgerRef.current.reset();
    }

    if (hasConversationHit) {
      pendingViewportAnchorRef.current = null;
      shouldStickToBottomRef.current = false;
      shouldStickToBottomCauseRef.current = null;
      shouldResetToBottomRef.current = false;
      resetVisibleRangeRef.current = null;

      if (hitIndex !== -1) {
        const start = Math.max(0, hitIndex - CONVERSATION_HIT_CONTEXT_LIMIT);
        setVisibleWindow(createConversationRenderWindow({
          messageIds: visibleMessageIds,
          scopeKey: selectedThreadId,
          range: {
            start,
            end: Math.min(
              visibleMessages.length,
              start + CONVERSATION_RECENT_RENDER_LIMIT,
            ),
          },
          maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
        }));
        pendingHighlightTargetRef.current = visibleMessages[hitIndex].id;
      }
      return;
    }

    if (!keyChanged && !shouldResetToBottomRef.current) {
      return;
    }

    pendingViewportAnchorRef.current = null;
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
    setVisibleWindow(createConversationRenderWindow({
      messageIds: visibleMessageIds,
      scopeKey: selectedThreadId,
      range: nextRange,
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    }));
    shouldResetToBottomRef.current = true;
  }, [
    conversationKey,
    page.date,
    selectedThreadId,
    visibleMessages.length,
    hasConversationHit,
    hitIndex,
    highlightResult?.targetId,
    visibleMessageIds,
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
      setVisibleWindow(createConversationRenderWindow({
        messageIds: visibleMessageIds,
        scopeKey: selectedThreadId,
        range: {
          start: Math.max(
            0,
            visibleMessages.length - CONVERSATION_RECENT_RENDER_LIMIT,
          ),
          end: visibleMessages.length,
        },
        maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
      }));
      setNewMessageCount(0);
      return;
    }

    setNewMessageCount((current) => current + addedCount);
  }, [
    conversationKey,
    hasConversationHit,
    selectedThreadId,
    visibleMessageIds,
    visibleMessages.length,
  ]);

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
        pendingViewportAnchorRef.current = null;
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

      pendingViewportAnchorRef.current = null;
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

    const viewportAnchor = pendingViewportAnchorRef.current;
    if (viewportAnchor) {
      if (
        viewportAnchor.expectedRange
        && (
          viewportAnchor.expectedRange.start !== clampedVisibleRange.start
          || viewportAnchor.expectedRange.end !== clampedVisibleRange.end
        )
      ) {
        return;
      }
      pendingViewportAnchorRef.current = null;
      const target = Array.from(
        scrollBox.querySelectorAll("[data-message-render-id]"),
      ).find(
        (element) =>
          element.getAttribute("data-message-render-id")
          === viewportAnchor.renderId,
      );
      if (target) {
        const boxRect = scrollBox.getBoundingClientRect();
        scrollWithCause(
          scrollBox,
          resolveConversationViewportAnchorTop({
            currentScrollTop: scrollBox.scrollTop,
            previousScrollHeight: viewportAnchor.scrollHeight,
            currentScrollHeight: scrollBox.scrollHeight,
            previousAnchorOffset: viewportAnchor.viewportOffset,
            currentAnchorOffset:
              target.getBoundingClientRect().top - boxRect.top,
          }),
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
    targetDate,
    highlightResult?.targetId,
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
    const formattedDate = formatFloatingDate(date);
    if (formattedDate !== lastFloatingDateRef.current) {
      lastFloatingDateRef.current = formattedDate;
      onFloatingDateChange?.(formattedDate);
    }
    if (floatingDateTimerRef.current) {
      window.clearTimeout(floatingDateTimerRef.current);
    }
    floatingDateTimerRef.current = window.setTimeout(
      () => {
        lastFloatingDateRef.current = "";
        onFloatingDateChange?.("");
      },
      FLOATING_DATE_HIDE_DELAY_MS,
    );
  };

  const scheduleFloatingDateUpdate = (scrollBox) => {
    floatingDateScrollBoxRef.current = scrollBox;
    if (floatingDateFrameRef.current) return;
    floatingDateFrameRef.current = window.requestAnimationFrame(() => {
      floatingDateFrameRef.current = null;
      const currentScrollBox = floatingDateScrollBoxRef.current;
      if (currentScrollBox?.isConnected) updateFloatingDate(currentScrollBox);
    });
  };

  const revealEarlierConversationHistory = (scrollBox, projectedDelta = 0) => {
    const edgeThreshold = getConversationHistoryPrefetchThreshold(
      scrollBox.clientHeight,
    );
    if (!shouldPrefetchConversationHistory(
      scrollBox.scrollTop,
      edgeThreshold,
      projectedDelta,
    )) return false;
    if (pendingViewportAnchorRef.current) return true;
    const currentRange = visibleRangeRef.current;

    if (currentRange.start > 0) {
      const nextRange = expandConversationRangeEarlier({
        range: currentRange,
        total: visibleMessages.length,
        step: CONVERSATION_WINDOW_SHIFT,
        maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
      });
      if (!captureViewportAnchor(scrollBox, nextRange)) return false;
      setVisibleWindow(createConversationRenderWindow({
        messageIds: visibleMessageIds,
        scopeKey: selectedThreadId,
        range: nextRange,
        maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
      }));
      return true;
    }

    if (
      !hasEarlierDate
      || earlierDateLoading
      || historyLoadInFlightRef.current
      || renderedMessages.length === 0
    ) {
      return false;
    }

    pendingEarlierAnchorRef.current = {
      messageCount: visibleMessages.length,
    };
    isNearBottomRef.current = false;
    historyLoadInFlightRef.current = true;
    const request = onLoadEarlier?.();
    if (request && typeof request.then === "function") {
      request.then((loaded) => {
        // Keep the guard through the React commit when an earlier date was
        // actually added. The message-count effect clears it after the
        // prepended records land, so they cannot become a false "new" badge.
        if (!loaded) {
          pendingEarlierAnchorRef.current = null;
          historyLoadInFlightRef.current = false;
        }
      }, () => {
        pendingEarlierAnchorRef.current = null;
        historyLoadInFlightRef.current = false;
      });
    } else {
      pendingEarlierAnchorRef.current = null;
      historyLoadInFlightRef.current = false;
    }
    return true;
  };

  const revealLaterConversationHistory = (scrollBox, projectedDelta = 0) => {
    const distanceFromBottom =
      scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight;
    const edgeThreshold = getConversationHistoryPrefetchThreshold(
      scrollBox.clientHeight,
    );
    if (!shouldPrefetchConversationHistory(
      distanceFromBottom,
      edgeThreshold,
      projectedDelta,
    )) return false;
    if (pendingViewportAnchorRef.current) return true;
    const currentRange = visibleRangeRef.current;

    if (currentRange.end < visibleMessages.length) {
      const nextRange = expandConversationRangeLater({
        range: currentRange,
        total: visibleMessages.length,
        step: CONVERSATION_WINDOW_SHIFT,
        maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
      });
      if (!captureViewportAnchor(scrollBox, nextRange)) return false;
      setVisibleWindow(createConversationRenderWindow({
        messageIds: visibleMessageIds,
        scopeKey: selectedThreadId,
        range: nextRange,
        maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
      }));
      return true;
    }

    if (
      !hasLaterDate
      || laterDateLoading
      || historyLoadInFlightRef.current
      || renderedMessages.length === 0
    ) {
      return false;
    }

    pendingLaterAnchorRef.current = {
      messageCount: visibleMessages.length,
    };
    isNearBottomRef.current = false;
    historyLoadInFlightRef.current = true;
    const request = onLoadLater?.();
    if (request && typeof request.then === "function") {
      request.then((loaded) => {
        if (!loaded) {
          pendingLaterAnchorRef.current = null;
          historyLoadInFlightRef.current = false;
        }
      }, () => {
        pendingLaterAnchorRef.current = null;
        historyLoadInFlightRef.current = false;
      });
    } else {
      pendingLaterAnchorRef.current = null;
      historyLoadInFlightRef.current = false;
    }
    return true;
  };

  const noteUserScrollIntent = () => {
    scrollCauseLedgerRef.current.noteUserScrollIntent();
  };

  const handleScrollPointerDown = (event) => {
    if (event.target === event.currentTarget) noteUserScrollIntent();
  };

  const handleScrollWheel = (event) => {
    noteUserScrollIntent();
    const deltaScale = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? event.currentTarget.clientHeight
        : 1;
    const projectedDelta = Math.abs(event.deltaY) * deltaScale;
    const revealed = event.deltaY < 0
      ? revealEarlierConversationHistory(event.currentTarget, projectedDelta)
      : event.deltaY > 0
        ? revealLaterConversationHistory(event.currentTarget, projectedDelta)
        : false;
    if (revealed) {
      scrollCauseLedgerRef.current.clearUserScrollIntent();
    }
  };

  const handleScrollTouchStart = (event) => {
    lastTouchYRef.current = event.touches?.[0]?.clientY ?? null;
    noteUserScrollIntent();
  };

  const handleScrollTouchMove = (event) => {
    const nextY = event.touches?.[0]?.clientY ?? null;
    const previousY = lastTouchYRef.current;
    lastTouchYRef.current = nextY;
    noteUserScrollIntent();
    const revealed = nextY !== null && previousY !== null
      ? nextY > previousY + 2
        ? revealEarlierConversationHistory(
          event.currentTarget,
          nextY - previousY,
        )
        : nextY < previousY - 2
          ? revealLaterConversationHistory(
            event.currentTarget,
            previousY - nextY,
          )
          : false
      : false;
    if (revealed) {
      scrollCauseLedgerRef.current.clearUserScrollIntent();
    }
  };

  const handleScrollTouchEnd = () => {
    lastTouchYRef.current = null;
  };

  const handleScrollKeyDown = (event) => {
    if (
      ["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]
        .includes(event.key)
    ) {
      noteUserScrollIntent();
      const projectedDelta = event.key === "Home" || event.key === "End"
        ? Number.POSITIVE_INFINITY
        : ["PageDown", "PageUp", " "].includes(event.key)
          ? event.currentTarget.clientHeight
          : 40;
      if (
        ["ArrowUp", "Home", "PageUp"].includes(event.key)
        && revealEarlierConversationHistory(event.currentTarget, projectedDelta)
      ) {
        scrollCauseLedgerRef.current.clearUserScrollIntent();
      } else if (
        ["ArrowDown", "End", "PageDown", " "].includes(event.key)
        && revealLaterConversationHistory(event.currentTarget, projectedDelta)
      ) {
        scrollCauseLedgerRef.current.clearUserScrollIntent();
      }
    }
  };

  const handleConversationScroll = (event) => {
    const scrollBox = event.currentTarget;
    const cause = scrollCauseLedgerRef.current.resolveScrollEvent(
      scrollBox.scrollTop,
    );
    if (cause) scrollBox.dataset.scrollCause = cause;
    const distanceFromBottom =
      scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight;
    isNearBottomRef.current =
      distanceFromBottom <= CONVERSATION_SCROLL_EDGE_THRESHOLD;
    if (isNearBottomRef.current && newMessageCount) setNewMessageCount(0);
    if (shouldShowFloatingDate(cause)) scheduleFloatingDateUpdate(scrollBox);
    if (cause !== "user") return;

    if (revealEarlierConversationHistory(scrollBox)) return;
    revealLaterConversationHistory(scrollBox);
  };

  const handleShowNewMessages = () => {
    pendingDateTargetRef.current = null;
    pendingHighlightTargetRef.current = null;
    pendingEarlierAnchorRef.current = null;
    pendingLaterAnchorRef.current = null;
    pendingViewportAnchorRef.current = null;
    resetVisibleRangeRef.current = null;
    shouldResetToBottomRef.current = false;
    isNearBottomRef.current = true;
    shouldStickToBottomRef.current = true;
    shouldStickToBottomCauseRef.current = "new-message";
    setNewMessageCount(0);
    setVisibleWindow(createConversationRenderWindow({
      messageIds: visibleMessageIds,
      scopeKey: selectedThreadId,
      range: {
        start: Math.max(
          0,
          visibleMessages.length - CONVERSATION_RECENT_RENDER_LIMIT,
        ),
        end: visibleMessages.length,
      },
      maximumSize: CONVERSATION_RECENT_RENDER_LIMIT,
    }));
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
      <div
        key={animationKey}
        data-message-render-id={animationKey}
      >
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
            onQuote={handleQuote}
            onRetry={webChatCommands?.retryMessage}
            activeActionId={activeAction?.id || null}
            onActionOpen={setActiveAction}
            onActionClose={handleActionClose}
            animateBubbleSequence={animateBubbleSequence}
            mediaUrls={mediaUrls}
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
            onWheel={handleScrollWheel}
            onTouchStart={handleScrollTouchStart}
            onTouchMove={handleScrollTouchMove}
            onTouchEnd={handleScrollTouchEnd}
            onTouchCancel={handleScrollTouchEnd}
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
      {webChatCommands?.sendMessages ? (
        <ConversationComposer
          status={webChatViewModel.status}
          models={webChatViewModel.models}
          connection={webChatViewModel.connection}
          quoteMessage={quoteMessage}
          onClearQuote={() => setQuoteMessage(null)}
          onSendMessages={({ messages, newThread }) => webChatCommands.sendMessages({ messages, newThread })}
          onChooseModel={webChatCommands.chooseModel}
          isNewThread={String(selectedThreadId).startsWith("draft-")}
          error={webChatViewModel.error}
          loadStickers={loadStickers}
          mediaUrls={mediaUrls}
        />
      ) : null}
    </PageCard>
  );
});
