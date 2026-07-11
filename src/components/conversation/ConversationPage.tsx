// @ts-nocheck
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { shouldHideConversationRecord } from "../../lib/conversation";
import { CardScrollArea } from "../layout/CardScrollArea";
import { PageCard } from "../layout/PageCard";
import { ChatBubble } from "./ChatBubble";
import { ConversationEmptyState } from "./ConversationEmptyState";

const CONVERSATION_RECENT_RENDER_LIMIT = 200;
const CONVERSATION_HIT_CONTEXT_LIMIT = 80;
const CONVERSATION_SCROLL_EDGE_THRESHOLD = 80;
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMessageDate(message) {
  return String(message?.conversationDate || "").replace(/-/g, ".");
}

function formatDateDivider(dateText) {
  const [year, month, day] = String(dateText).split(".").map(Number);
  const date = new Date(year, month - 1, day);
  return `${year}.${month}.${day} ${weekdayLabels[date.getDay()] || ""}`;
}

function formatFloatingDate(dateText) {
  const [year, month, day] = String(dateText).split(".").map(Number);
  return year && month && day ? `${year}/${month}/${day}` : "";
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
}) {
  const visibleMessages = useMemo(
    () =>
      page.messages.filter(
        (message) => !shouldHideConversationRecord(message),
      ),
    [page.messages],
  );
  const [visibleRange, setVisibleRange] = useState(() => ({
    start: Math.max(0, visibleMessages.length - CONVERSATION_RECENT_RENDER_LIMIT),
    end: visibleMessages.length,
  }));
  const visibleRangeRef = useRef(visibleRange);
  const topScrollAdjustmentRef = useRef(null);
  const shouldStickToBottomRef = useRef(false);
  const shouldResetToBottomRef = useRef(false);
  const resetVisibleRangeRef = useRef(null);
  const pendingHighlightTargetRef = useRef(null);
  const pendingDateTargetRef = useRef(null);
  const pendingEarlierAnchorRef = useRef(null);
  const floatingDateTimerRef = useRef(null);
  const conversationKeyRef = useRef(null);
  const conversationKey = selectedThreadId;
  const hasConversationHit =
    highlightResult?.mode === "Conversation" &&
    highlightResult.threadId === selectedThreadId;
  const hitIndex = useMemo(() => {
    if (!hasConversationHit) return -1;
    return visibleMessages.findIndex(
      (message) => message.id === highlightResult.targetId,
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
  const renderedMessages = useMemo(
    () =>
      visibleMessages.slice(
        clampedVisibleRange.start,
        clampedVisibleRange.end,
      ),
    [visibleMessages, clampedVisibleRange],
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
    () => () => {
      if (floatingDateTimerRef.current) {
        window.clearTimeout(floatingDateTimerRef.current);
      }
      onFloatingDateChange?.("");
    },
    [onFloatingDateChange],
  );

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
    }

    if (hasConversationHit) {
      topScrollAdjustmentRef.current = null;
      shouldStickToBottomRef.current = false;
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
        pendingHighlightTargetRef.current = highlightResult.targetId;
      }
      return;
    }

    if (!keyChanged && !shouldResetToBottomRef.current) {
      return;
    }

    topScrollAdjustmentRef.current = null;
    pendingHighlightTargetRef.current = null;
    shouldStickToBottomRef.current = false;
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
      scrollBox.scrollTo({
        top: scrollBox.scrollHeight,
        behavior: "auto",
      });
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
        scrollBox.scrollTop =
          scrollBox.scrollHeight -
          topScrollAdjustment.scrollHeight +
          topScrollAdjustment.scrollTop;
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

      scrollBox.scrollTo({
        top: Math.max(0, centeredTop),
        behavior: "auto",
      });
      return;
    }

    if (pendingDateTargetRef.current) {
      const date = pendingDateTargetRef.current;
      const target = document.getElementById(`conversation-date-${date}`);
      if (!target) return;
      pendingDateTargetRef.current = null;
      scrollBox.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "auto" });
      onTargetDateHandled?.();
      return;
    }

    if (shouldStickToBottomRef.current) {
      scrollBox.scrollTo({
        top: scrollBox.scrollHeight,
        behavior: "auto",
      });
      shouldStickToBottomRef.current = false;
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
      2600,
    );
  };

  const handleConversationScroll = (event) => {
    const scrollBox = event.currentTarget;
    const currentRange = visibleRangeRef.current;
    updateFloatingDate(scrollBox);

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
      onLoadEarlier?.();
      return;
    }

    const distanceFromBottom =
      scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight;

    if (
      distanceFromBottom <= CONVERSATION_SCROLL_EDGE_THRESHOLD &&
      currentRange.end < visibleMessages.length
    ) {
      shouldStickToBottomRef.current =
        distanceFromBottom <= CONVERSATION_SCROLL_EDGE_THRESHOLD;
      setVisibleRange((current) => ({
        start: current.start,
        end: Math.min(
          visibleMessages.length,
          current.end + CONVERSATION_RECENT_RENDER_LIMIT,
        ),
      }));
    }
  };

  return (
    <PageCard
      page={page}
      motionKey={`conversation-${selectedThreadId}`}
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white"
    >
      {page.hasEntry ? (
        <CardScrollArea
          id="conversation-message-scroll"
          className="z-10 px-3 pb-6 pt-5"
          onScroll={handleConversationScroll}
          style={{
            backgroundColor: threadProfile?.background || "#fbfbfa",
            backgroundImage: threadProfile?.backgroundImage
              ? `linear-gradient(rgba(255,255,255,.22), rgba(255,255,255,.22)), url(${threadProfile.backgroundImage})`
              : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "local",
          }}
        >
          {renderedMessages.map((message, localIndex) => {
            const globalIndex = clampedVisibleRange.start + localIndex;
            const date = getMessageDate(message);
            const previousDate =
              globalIndex > 0 ? getMessageDate(visibleMessages[globalIndex - 1]) : "";
            const showDateDivider = Boolean(date && date !== previousDate);
            const active =
              highlightResult?.mode === "Conversation" &&
              highlightResult?.targetId === message.id &&
              highlightResult?.threadId === selectedThreadId;
            return (
              <div key={message.id}>
                {showDateDivider && (
                  <div
                    id={`conversation-date-${date}`}
                    className="my-5 text-center font-sans text-[11px] font-medium tracking-[0.04em] text-black/28"
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
                    page={page}
                    messages={visibleMessages}
                    userProfile={userProfile}
                    threadProfile={threadProfile}
                    onEditThread={onEditThread}
                  />
                </div>
              </div>
            );
          })}
        </CardScrollArea>
      ) : (
        <ConversationEmptyState />
      )}
    </PageCard>
  );
}
