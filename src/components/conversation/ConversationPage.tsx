// @ts-nocheck
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { shouldHideConversationRecord } from "../../lib/conversation";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { CardScrollArea } from "../layout/CardScrollArea";
import { PageCard } from "../layout/PageCard";
import { ChatBubble } from "./ChatBubble";
import { ConversationEmptyState } from "./ConversationEmptyState";

const CONVERSATION_RECENT_RENDER_LIMIT = 200;
const CONVERSATION_HIT_CONTEXT_LIMIT = 80;
const CONVERSATION_SCROLL_EDGE_THRESHOLD = 80;

export function ConversationPage({
  page,
  selectedThreadId,
  highlightResult,
  onOpenDatePicker,
  onMonthSelect,
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
  const conversationKeyRef = useRef(null);
  const conversationKey = `${page.date}:${selectedThreadId}`;
  const hasConversationHit =
    highlightResult?.mode === "Conversation" &&
    highlightResult.date === page.date &&
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

  useEffect(() => {
    visibleRangeRef.current = clampedVisibleRange;
  }, [clampedVisibleRange]);

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

  const handleConversationScroll = (event) => {
    const scrollBox = event.currentTarget;
    const currentRange = visibleRangeRef.current;

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
      motionKey={`${page.id}-conversation-${page.date}-${selectedThreadId}`}
      className="relative flex h-full min-h-0 flex-col overflow-hidden border bg-[#f7f5ee] p-5"
    >
      <div className="relative z-10 shrink-0">
        <CalendarStrip
          page={page}
          onOpenDatePicker={onOpenDatePicker}
          onMonthSelect={onMonthSelect}
        />
      </div>
      {page.hasEntry ? (
        <CardScrollArea
          id="conversation-message-scroll"
          className="z-10 -mx-2 pt-1 pb-3"
          onScroll={handleConversationScroll}
        >
          {renderedMessages.map((message) => {
            const active =
              highlightResult?.mode === "Conversation" &&
              highlightResult?.targetId === message.id &&
              highlightResult?.threadId === selectedThreadId;
            return (
              <div
                id={`hit-message-${message.id}`}
                key={message.id}
                className="relative mb-3.5 border-l-2 pl-1 transition"
                style={{
                  borderLeftColor: active ? page.color : "transparent",
                  background: active ? `${page.color}12` : "transparent",
                }}
              >
                <ChatBubble
                  message={message}
                  page={page}
                  messages={visibleMessages}
                />
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
