// @ts-nocheck
import React, { useEffect,useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  fetchConversations,
  fetchDateIndex,
  fetchMemoryDailySummary,
  fetchMemoryDiary,
  fetchMemoryLetters,
  fetchMemoryStatic,
  fetchReminderHistory,
  fetchTimeline,
  fetchXiaoyeStatic,
} from "./data/api";
import { staticModeApiMap } from "./config/contentSources";
import { pageModeMeta, pageModes, xiaoyeModeMeta, xiaoyeModes } from "./config/pageModes";
import { searchModeOptions, searchTimeOptions } from "./config/searchOptions";
import { monthColors, monthPales, styleThemes } from "./config/theme";
import {
  conversationEntries,
  dailySummaryEntries,
  diaryEntries,
  letterEntries,
  reminderHistoryEntries,
  staticModeEntries,
} from "./data/mockEntries";
import { timelineState } from "./data/mockTimeline";
import { emptyRemoteData } from "./data/emptyRemoteData";
import {
  buildContentPath,
  changeDateMonth,
  formatDiaryDate,
  getDateLookupKeys,
  getDateParts,
  getDaysInMonth,
  getFirstWeekday,
  getTodayDateText,
  pad2,
  shiftDate,
  shiftMonth,
  toDotDate,
} from "./lib/date";
import {
  getConversationDisplayText,
  getConversationMediaSrc,
  getConversationPrimaryMediaItem,
  getConversationQuoteText,
  getConversationVisualKind,
  getOperationDisplayPaths,
  hasRecordMedia,
  legacyConversationMessageToRecord,
  shouldHideConversationRecord,
} from "./lib/conversation";
import {
  buildConversationPage,
  conversationThreadIds,
  defaultConversationThreadId,
  formatConversationTime,
  getAllConversationThreadIds,
  getConversationRecordsForDate,
  getConversationThreadIdsForDate,
  getLatestConversationThreadId,
  getRemoteConversationThreadIndex,
  getRealConversationThreadIds,
  getSearchConversationRecordsForDate,
  groupConversationRecordsByThread,
  hasConversationForDate,
} from "./lib/conversationPageData";
import {
  buildMemoryPage,
  buildXiaoyePage,
  getDatedEntriesSource,
  getRemoteDatedEntriesSource,
  getRemoteEntryByDate,
  getStaticEntryForMode,
  hasCalendarMarkForPage,
  hasDatedEntry,
} from "./lib/memoryPageData";
import {
  getReminderDueAt,
  getReminderHistorySource,
  getRemindersForDate,
} from "./lib/reminderPageData";
import {
  buildTimelinePage,
  getRemoteDateIndexKey,
  getTimelineCategoryMeta,
  getTimelineDay,
  getTimelineEventsForPeriod,
  getTimelineStateSource,
  hasRemoteDateIndexMark,
  normalizeTimelineEventCategory,
  timelineCategories,
} from "./lib/timelinePageData";
import {
  DAY_TIMELINE_HEIGHT,
  MIN_TIMELINE_EVENT_HEIGHT,
  getEventDurationMinutes,
  getTimelineEventHeight,
  getTimelineEventVisualTopPx,
  getTimelineRange,
  getZonedDateText,
  layoutTimelineEvents,
  minutesToClock,
  toMinutes,
} from "./lib/timeline";
import {
  buildSearchFields,
  countNormalizedSearchOccurrences,
  findMatchedSnippet,
  matchesSearchFilters,
  normalizeSearchText,
  sortSearchResults,
} from "./lib/search";
import {
  buildSearchResultState,
  getAllSearchResults,
} from "./lib/searchPageData";
import { HighlightText } from "./components/common/HighlightText";
import { PaperTexture } from "./components/common/PaperTexture";
import { TinyIcon } from "./components/common/TinyIcon";
import { CalendarStrip } from "./components/calendar/CalendarStrip";
import { DatePickerModal } from "./components/calendar/DatePickerModal";
import { DiaryShareModal } from "./components/archive/DiaryShareModal";
import {
  ContinuousStaticMemoryContent,
  MemoryContent,
} from "./components/archive/MemoryContent";
import { AppScrollbarStyle } from "./components/layout/AppScrollbarStyle";
import { BottomNav } from "./components/layout/BottomNav";
import { PageBottomMark } from "./components/layout/PageBottomMark";
import { SwipeDateArea } from "./components/layout/SwipeDateArea";
import { DiarySearchBox } from "./components/search/DiarySearchBox";
import { ChapterTabs } from "./components/controls/ChapterTabs";
import { ThreadSwitch } from "./components/controls/ThreadSwitch";
import { TimelineModeSwitch } from "./components/controls/TimelineModeSwitch";
import { TopModeSwitch } from "./components/controls/TopModeSwitch";
import { XiaoyeModeSwitch } from "./components/controls/XiaoyeModeSwitch";
const BLANK_TITLE = `${String.fromCharCode(0x0295)}  ${String.fromCharCode(0x2022)}${String.fromCharCode(0x058a)} ${String.fromCharCode(0x2022)}${String.fromCharCode(0x0294)}…… ${String.fromCharCode(0xa9de)}`;

function aggregateTimelineEvents(events, remoteData = emptyRemoteData) {
  const normalizedEvents = events.map((event) =>
    normalizeTimelineEventCategory(event, remoteData),
  );
  const total = normalizedEvents.reduce(
    (sum, event) => sum + getEventDurationMinutes(event),
    0,
  );
  const map = {};
  normalizedEvents.forEach((event) => {
    const key = event.categoryId || "life";
    map[key] = (map[key] ?? 0) + getEventDurationMinutes(event);
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([categoryId, minutes]) => ({
      categoryId,
      minutes,
      percent: total ? Math.round((minutes / total) * 100) : 0,
    }));
}
function scrollHitIntoView(targetId) {
  const target = document.getElementById(`hit-${targetId}`);

  if (!target) return;

  const scrollBox = target.closest(".diary-scroll");

  if (scrollBox) {
    const boxRect = scrollBox.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetTop =
      targetRect.top - boxRect.top + scrollBox.scrollTop;

    scrollBox.scrollTop = Math.max(
      0,
      targetTop - scrollBox.clientHeight / 2 + targetRect.height / 2,
    );
    return;
  }

  target.scrollIntoView({ block: "center" });
}
function validateTimelineData() {
  const events = getTimelineDay("2026.04.25").events;
  const range = getTimelineRange(events);
  const shortEvent = events.find(
    (event) => event.id === "sky_daily_20260425_0000",
  );
  const longEvent = events.find(
    (event) => event.id === "ear_care_20260425_1725",
  );
  return (
    events.length >= 5 &&
    range.startHour === 0 &&
    range.endHour === 24 &&
    toMinutes("2026-04-24T16:00:00.000Z") === 0 &&
    shortEvent &&
    longEvent &&
    getTimelineEventHeight(shortEvent, range) === MIN_TIMELINE_EVENT_HEIGHT &&
    getTimelineEventHeight(longEvent, range) >
      getTimelineEventHeight(shortEvent, range) &&
    hasDatedEntry("2026.04.28", "Timeline", emptyRemoteData, {
      hasConversationForDate,
      getTimelineDay,
    }) === true &&
    buildSearchResultState("有声小说").results.some(
      (result) => result.mode === "Timeline",
    )
  );
}
function validateConversationData() {
  const allMessages = Object.values(conversationEntries).flatMap((threads) =>
    Object.values(threads).flat(),
  );
  return (
    allMessages.every(
      (message) => message.type !== "voice" && message.type !== "payment",
    ) &&
    allMessages.some(
      (message) =>
        message.type === "file" && String(message.fileName).endsWith(".md"),
    ) &&
    allMessages.some(
      (message) =>
        message.type === "file" && String(message.fileName).endsWith(".txt"),
    ) &&
    allMessages.some((message) => message.type === "sticker") &&
    allMessages
      .filter((message) => message.type === "quote")
      .every((message) => message.role === "user") &&
    buildSearchResultState("日记草稿").results.some(
      (result) => result.fieldLabel === "文件名",
    )
  );
}
function validateAppData() {
  return (
    styleThemes.length === 4 &&
    pageModes.length === 8 &&
    buildContentPath("Letters", "2026.05.14") ===
      "D:/study/.cyberboss/memory/letters/2026-05-14.md" &&
    buildContentPath("Timeline", "2026.04.28") ===
      "D:/study/.cyberboss/timeline/timeline-state.json" &&
    buildContentPath("Reminders", "2026.04.28") ===
      "D:/study/.cyberboss/reminder-archive/reminders-history.jsonl" &&
    normalizeSearchText("a b") === "ab" &&
    validateTimelineData() &&
    validateConversationData()
  );
}
if (import.meta.env.DEV && typeof console !== "undefined")
  console.assert(
    validateAppData(),
    "Prototype data and timeline layout should be valid.",
  );

function DiaryPage({
  page,
  highlightResult,
  onOpenDatePicker,
  onMonthSelect,
  onOpenShare,
}) {
  useEffect(() => {
    if (!highlightResult || highlightResult.mode !== page.mode) return;
    if (page.dateBased && highlightResult.date !== page.date) return;
    scrollHitIntoView(highlightResult.targetId);
  }, [highlightResult, page.mode, page.date, page.dateBased]);

  return (
    <motion.section
      key={`${page.id}-${page.mode}-${page.date}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative min-h-[980px] border bg-[#f7f5ee] p-5 pb-10"
      style={{ background: page.paper, borderColor: page.line }}
    >
      <PaperTexture mode={page.texture} />
      <div className="relative min-h-[920px]">
        <div
          className="absolute right-0 top-0 z-10 font-mono text-[18px] tracking-[0.12em]"
          style={{ color: page.color }}
        >
          {page.date.slice(0, 4)}
        </div>
        <aside
          id={`hit-${page.mode}-${page.dateBased ? page.date : "static"}-title`}
          className="absolute left-0 top-0 z-10 space-y-4"
        >
          <div>
            <div className="mb-1 text-[10px] tracking-[0.22em] text-black/35">
              {page.mode.toUpperCase()} · {page.mark}
            </div>
            <h2 className="max-w-[270px] font-serif text-3xl leading-[1.15] tracking-[0.08em] text-black/75">
              {page.title}
            </h2>
          </div>
        </aside>
        {(page.mode === "Diary" || page.mode === "Letters") &&
          page.hasEntry &&
          onOpenShare && (
          <button
            className="absolute right-0 top-[80px] z-20 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
            style={{ borderColor: page.color, color: page.color }}
            type="button"
            onClick={onOpenShare}
          >
            share
          </button>
        )}
        <article className="relative min-h-[900px] pt-20">
          <CalendarStrip
            page={page}
            onOpenDatePicker={onOpenDatePicker}
            onMonthSelect={onMonthSelect}
          />
          {page.hasEntry ? (
            <div className="relative min-h-[780px] pb-16 pt-2">
              <MemoryContent page={page} highlightResult={highlightResult} />
              <PageBottomMark page={page} />
            </div>
          ) : (
            <div className="relative min-h-[780px] pb-16 pt-3">
              <p className="whitespace-nowrap font-serif text-[11px] leading-none text-black/48">
                {page.blankText}
              </p>
              <PageBottomMark page={page} />
            </div>
          )}
        </article>
      </div>
    </motion.section>
  );
}

function XiaoyePage({
  page,
  highlightResult,
  onOpenDatePicker,
  onMonthSelect,
}) {
  useEffect(() => {
    if (!highlightResult || highlightResult.mode !== "Xiaoye") return;
    scrollHitIntoView(highlightResult.targetId);
  }, [highlightResult, page.xiaoyeMode]);

  return (
    <motion.section
      key={`${page.id}-${page.mode}-${page.xiaoyeMode}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative min-h-[980px] border bg-[#f7f5ee] p-5 pb-10"
      style={{ background: page.paper, borderColor: page.line }}
    >
      <PaperTexture mode={page.texture} />
      <div className="relative min-h-[920px]">
        <div
          className="absolute right-0 top-0 z-10 font-mono text-[18px] tracking-[0.12em]"
          style={{ color: page.color }}
        >
          小叶
        </div>
        <aside
          id="hit-Xiaoye-static-title"
          className="absolute left-0 top-0 z-10 space-y-4"
        >
          <div>
            <div className="mb-1 text-[10px] tracking-[0.22em] text-black/35">
              XIAOYE · {page.mark}
            </div>
            <h2 className="max-w-[270px] font-serif text-3xl leading-[1.15] tracking-[0.08em] text-black/75">
              {page.title}
            </h2>
          </div>
        </aside>
        <article className="relative min-h-[900px] pt-20">
          <CalendarStrip
            page={page}
            onOpenDatePicker={onOpenDatePicker}
            onMonthSelect={onMonthSelect}
          />
          {page.hasEntry ? (
            <div className="relative min-h-[780px] pb-16 pt-2">
              <ContinuousStaticMemoryContent
                page={page}
                highlightResult={highlightResult}
              />
              <div className="absolute bottom-12 right-1 scale-75 opacity-70">
                <TinyIcon color={page.color} />
              </div>
            </div>
          ) : (
            <div className="relative min-h-[780px] pb-16 pt-3">
              <p className="whitespace-nowrap font-serif text-[11px] leading-none text-black/48">
                {page.blankText}
              </p>
              <div className="absolute bottom-12 right-1 scale-75 opacity-70">
                <TinyIcon color={page.color} />
              </div>
            </div>
          )}
        </article>
      </div>
    </motion.section>
  );
}

function BubbleRow({
  message,
  children,
  side = message.type === "user" ? "right" : "left",
}) {
  const fromRight = side === "right";
  return (
    <div
      className={`flex items-end gap-2 ${fromRight ? "justify-end" : "justify-start"}`}
    >
      {fromRight && <MessageTime message={message} align="right" />}
      {children}
      {!fromRight && <MessageTime message={message} align="left" />}
    </div>
  );
}

function MessageTime({ message, align = "left" }) {
  return (
    <span
      className={`shrink-0 pb-1 font-serif text-[9px] italic tracking-[0.1em] text-black/30 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {formatConversationTime(message.timestamp)}
    </span>
  );
}

function ChatBubble({ message, page }) {
  const visualKind = getConversationVisualKind(message);
  const displayText = getConversationDisplayText(message);
  const fromUser = message.type === "user";
  const quoteText = getConversationQuoteText(message);
  const primaryMediaItem = getConversationPrimaryMediaItem(message);
  const operationPaths = getOperationDisplayPaths(message);
  const [actionOpen, setActionOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  if (visualKind === "hidden") {
    return null;
  }

  if (visualKind === "system") {
    return (
      <div className="flex justify-center py-1">
        <div
          className="border bg-white/35 px-2.5 py-1 font-mono text-[9px] tracking-[0.08em] text-black/38"
          style={{ borderColor: page.line }}
        >
          {displayText}
        </div>
      </div>
    );
  }

  if (visualKind === "operation") {
    return (
      <div className="flex justify-center py-0.5">
        <button
          type="button"
          className="max-w-[342px] px-2 text-center font-mono text-[9px] font-semibold tracking-[0.04em] text-black/42"
          onClick={() => setActionOpen((value) => !value)}
        >
          <div className="flex items-center justify-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: page.color }}
            />
            <span className="break-all leading-[1.25]">{displayText}</span>
          </div>
          {actionOpen && operationPaths.length > 0 && (
            <div className="mt-1 space-y-0.5 text-[8px] font-normal leading-[1.25] tracking-normal text-black/34">
              {operationPaths.map((path) => (
                <div key={path} className="break-all">
                  {path}
                </div>
              ))}
            </div>
          )}
        </button>
      </div>
    );
  }

  if (visualKind === "thinking") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[320px] bg-white/28 px-3 py-2 text-left">
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-black/35">
            <span className="h-1.5 w-1.5 rounded-full bg-black/30" />
            Thinking
          </div>
          <div className="whitespace-pre-line text-[9px] leading-[1.45] text-black/48">
            {displayText}
          </div>
        </div>
      </div>
    );
  }

  if (fromUser && quoteText) {
    return (
      <BubbleRow message={message} side="right">
        <div className="max-w-[280px] text-right">
          <div
            className="inline-block border bg-[#cbc5bb] px-2.5 py-1.5 text-left text-[11px] leading-relaxed text-white"
            style={{ borderColor: "transparent" }}
          >
            {displayText}
          </div>
          <div
            className="ml-auto mt-1 max-w-[260px] border-l-4 bg-white/35 px-2 py-1.5 text-left font-mono text-[8px] text-black/42"
            style={{ borderLeftColor: page.line }}
          >
            {quoteText}
          </div>
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "file") {
    const firstFile = primaryMediaItem;
    const fileName =
      firstFile?.fileName || firstFile?.label || displayText || "文件";
    const fileMeta =
      firstFile?.fileMeta ||
      firstFile?.relativePath ||
      firstFile?.path ||
      "FILE";

    return (
      <BubbleRow message={message} side={fromUser ? "right" : "left"}>
        <div
          className="flex max-w-[204px] items-center gap-2 border bg-white/72 px-3 py-2 text-left"
          style={{ borderColor: page.line }}
        >
          <div
            className="flex h-9 w-8 shrink-0 items-center justify-center border bg-white/50 font-mono text-[9px] uppercase tracking-[0.08em]"
            style={{ color: page.color, borderColor: page.line }}
          >
            {String(fileName).split(".").pop()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] leading-4 text-black/72">
              {fileName}
            </div>
            <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-black/35">
              {fileMeta}
            </div>
          </div>
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "image" || visualKind === "sticker") {
    const mediaItem = primaryMediaItem;
    const mediaSrc = getConversationMediaSrc(mediaItem);
    const mediaLabel =
      visualKind === "sticker"
        ? mediaItem?.label ||
          mediaItem?.fileName ||
          mediaItem?.stickerId ||
          "表情包"
        : mediaItem?.label ||
          mediaItem?.fileName ||
          mediaItem?.relativePath ||
          "图片";

    return (
      <BubbleRow message={message} side={fromUser ? "right" : "left"}>
      <div className={visualKind === "sticker" ? "max-w-[96px]" : "max-w-[220px]"}>
  <div
    className={
      visualKind === "sticker"
        ? "flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-xl bg-white/30"
        : "inline-flex max-w-[220px] overflow-hidden rounded-[6px] bg-black/5"
    }
    title={mediaLabel}
  >
    {mediaSrc && !mediaFailed ? (
      <img
        className={
          visualKind === "sticker"
            ? "h-full w-full object-contain"
            : "block max-h-[280px] max-w-[220px] object-contain"
        }
        src={mediaSrc}
        alt={mediaLabel}
        loading="lazy"
        onError={() => setMediaFailed(true)}
      />
    ) : (
      <TinyIcon color="rgba(0,0,0,.38)" />
    )}
  </div>
</div>
      </BubbleRow>
    );
  }

  return (
    <BubbleRow message={message} side={fromUser ? "right" : "left"}>
      <div
        className={`${fromUser ? "bg-[#d7d0c4] text-white" : "border bg-[#f7efe4]/80 text-black/72"} max-w-[300px] border px-2.5 py-1.5 whitespace-pre-line text-[11px] leading-[1.45]`}
        style={{ borderColor: fromUser ? "transparent" : page.line }}
      >
        {displayText}
      </div>
    </BubbleRow>
  );
}

const CONVERSATION_RECENT_RENDER_LIMIT = 200;
const CONVERSATION_HIT_CONTEXT_LIMIT = 80;
const CONVERSATION_SCROLL_EDGE_THRESHOLD = 80;

function ConversationPage({
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
    <motion.section
      key={`${page.id}-conversation-${page.date}-${selectedThreadId}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative flex h-[640px] flex-col overflow-hidden border bg-[#f7f5ee] p-5"
      style={{ background: page.paper, borderColor: page.line }}
    >
      <PaperTexture mode={page.texture} />
      <div className="relative z-10 shrink-0">
        <CalendarStrip
          page={page}
          onOpenDatePicker={onOpenDatePicker}
          onMonthSelect={onMonthSelect}
        />
      </div>
      {page.hasEntry ? (
        <div
          id="conversation-message-scroll"
          className="diary-scroll relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-5"
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
                <ChatBubble message={message} page={page} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative z-10 min-h-0 flex-1 pt-6 font-serif text-[12px] text-black/45">
          暂无对话，速速与家机联络......
        </div>
      )}
    </motion.section>
  );
}

function TimelineStatsPeriodSwitch({ page, period, onSelectPeriod }) {
  const items = [
    { id: "day", label: "日" },
    { id: "month", label: "月" },
    { id: "year", label: "年" },
  ];
  return (
    <div className="mb-4 grid grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-[0.1em]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="border px-3 py-2"
          style={{
            color: period === item.id ? page.color : "rgba(0,0,0,.45)",
            borderColor: period === item.id ? page.color : page.line,
            background: period === item.id ? page.pale : "transparent",
          }}
          onClick={() => onSelectPeriod(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TimelineEventCard({
  event,
  range,
  page,
  layout,
  highlighted,
  highlightQuery,
  elementId,
  onSelectEvent,
}) {
  const {
    normalizedEvent,
    category,
    subcategoryLabel,
    eventNodeLabel,
  } = getTimelineCategoryMeta(event, page.remoteData);
  const start = toMinutes(event.startAt);
  const duration = getEventDurationMinutes(event);
  const detailLabel = [subcategoryLabel, eventNodeLabel]
    .filter(Boolean)
    .join(" · ");
  const topPercent = Math.max(
    0,
    ((start - range.startHour * 60) /
      ((range.endHour - range.startHour) * 60)) *
      100,
  );
  const height = getTimelineEventHeight(event, range);
  const topStyle =
    start === range.startHour * 60
      ? `${getTimelineEventVisualTopPx(event, range)}px`
      : `${topPercent}%`;
  const columnStart = layout?.leftPercent ?? 0;
  const columnWidth = layout?.widthPercent ?? 1;
  const horizontalGap = (layout?.conflictCount ?? 0) > 0 ? 3 : 0;
  const isTinyEvent = height <= 10;
  const isCrampedEvent = height < 16;
  const isCompactEvent = height < 24;

  return (
    <button
      id={elementId}
      type="button"
      className="absolute flex flex-col items-start justify-start overflow-hidden rounded-sm border-l-4 text-left align-top backdrop-blur-[1px] transition hover:z-20 hover:opacity-100"
      style={{
        top: topStyle,
        left: `calc(54px + (100% - 54px) * ${columnStart})`,
        width: `calc((100% - 54px) * ${columnWidth} - ${horizontalGap}px)`,
        height: `${height}px`,
        zIndex: layout?.zIndex ?? 10,
        padding: isTinyEvent
          ? "0 6px"
          : isCrampedEvent
            ? "2px 7px"
            : isCompactEvent
              ? "3px 8px"
              : "4px 10px",
        borderLeftColor: category.color,
        background: highlighted ? `${category.color}28` : category.pale,
        color: category.color,
        opacity: highlighted ? 1 : 0.82,
        outline: highlighted ? `1px solid ${category.color}` : "none",
      }}
      onClick={() => onSelectEvent(event)}
    >
      <div
        className={`w-full truncate text-left font-semibold ${isTinyEvent ? "text-[7px] leading-[8px]" : isCrampedEvent ? "text-[8px] leading-[9px]" : isCompactEvent ? "text-[9px] leading-[10px]" : "text-[10px] leading-4"}`}
      >
        <HighlightText
          text={event.title}
          query={highlighted ? highlightQuery : ""}
          color={category.color}
        />{" "}
        · {duration}分钟
      </div>
      {height >= 32 && (
        <div className="w-full truncate text-left font-mono text-[9px] leading-4 opacity-80">
          {minutesToClock(start)} → {minutesToClock(toMinutes(event.endAt))}
          {detailLabel ? ` · ${detailLabel}` : ""}
        </div>
      )}
      {height >= 58 && (
        <div className="mt-1 w-full line-clamp-2 text-left text-[9px] leading-4 opacity-80">
          {event.note}
        </div>
      )}
    </button>
  );
}

function TimelineEventDetailModal({ event, page, onClose }) {
  const {
    normalizedEvent,
    category,
    categoryLabel,
    subcategoryLabel,
    eventNodeLabel,
  } = getTimelineCategoryMeta(event, page.remoteData);
  const duration = getEventDurationMinutes(event);
  const categoryDetailLabel = [
    categoryLabel,
    subcategoryLabel,
    eventNodeLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/18 px-5 py-[calc(20px+env(safe-area-inset-top))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        className="absolute inset-0"
        type="button"
        aria-label="关闭时间块详情"
        onClick={onClose}
      />
      <motion.section
        className="relative max-h-[72dvh] w-full max-w-[342px] overflow-y-auto border bg-[#f6f0e6] p-5 text-black/72"
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 6 }}
        style={{ borderColor: page.line }}
      >
        <PaperTexture mode={page.texture} />
        <div className="relative">
          <div
            className="mb-3 flex items-start justify-between gap-3 border-b pb-3"
            style={{ borderBottomColor: category.color }}
          >
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/38">
                timeline detail
              </div>
              <h3
                className="mt-1 font-serif text-[23px] leading-tight"
                style={{ color: category.color }}
              >
                {event.title}
              </h3>
            </div>
            <button
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/45"
              type="button"
              onClick={onClose}
            >
              close
            </button>
          </div>
          <div className="space-y-3 text-[12px] leading-6">
            <div className="font-mono text-[11px] tracking-[0.1em] text-black/46">
              {minutesToClock(toMinutes(event.startAt))} →{" "}
              {minutesToClock(toMinutes(event.endAt))} · {duration}分钟
            </div>
            {categoryDetailLabel && (
              <div className="font-mono text-[10px] tracking-[0.1em] text-black/42">
                {categoryDetailLabel}
              </div>
            )}
            <p>{event.note}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(event.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="border px-2 py-1 font-mono text-[9px] text-black/45"
                  style={{ borderColor: page.line }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function TimelineDayView({ page, highlightResult }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const events = getTimelineDay(page.date, page.remoteData).events;
  const range = getTimelineRange(events);
  const laidOutEvents = useMemo(
    () => layoutTimelineEvents(events, range),
    [events, range],
  );
  const hours = Array.from(
    { length: range.endHour - range.startHour + 1 },
    (_, index) => range.startHour + index,
  );

  useEffect(() => {
    if (
      highlightResult?.mode !== "Timeline" ||
      highlightResult.date !== page.date
    )
      return;
    scrollHitIntoView(`timeline-${highlightResult.targetId}`);
  }, [highlightResult, page.date]);

  return (
    <div
      className="relative pt-2"
      style={{ height: `${DAY_TIMELINE_HEIGHT}px` }}
    >
      {hours.map((hour) => {
        const top =
          ((hour - range.startHour) / (range.endHour - range.startHour)) * 100;
        return (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t"
            style={{ top: `${top}%`, borderColor: page.line }}
          >
            <span className="absolute -top-2 left-0 bg-transparent font-mono text-[11px] text-black/38">
              {pad2(hour)}:00
            </span>
          </div>
        );
      })}
      {laidOutEvents.length > 0 ? (
        laidOutEvents.map((item) => (
          <TimelineEventCard
            key={item.event.id}
            elementId={`hit-timeline-${item.event.id}`}
            event={item.event}
            layout={item}
            range={range}
            page={page}
            highlighted={
              highlightResult?.mode === "Timeline" &&
              highlightResult?.targetId === item.event.id
            }
            highlightQuery={highlightResult?.query}
            onSelectEvent={setSelectedEvent}
          />
        ))
      ) : (
        <div
          className="absolute left-[54px] right-0 top-8 border border-dashed bg-white/25 px-3 py-3 font-serif text-[12px] text-black/45"
          style={{ borderColor: page.line }}
        >
          暂无时间轴，速速召唤家机记录......
        </div>
      )}
      <AnimatePresence>
        {selectedEvent && (
          <TimelineEventDetailModal
            event={selectedEvent}
            page={page}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
function hexToRgba(hex, alpha = 0.68) {
  const value = String(hex || "").replace("#", "");

  if (value.length !== 6) return hex;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function TimelineDonut({ aggregates }) {
  const total = aggregates.reduce((sum, item) => sum + item.minutes, 0);
  let current = 0;
  const gradient = aggregates
    .map((item) => {
      const category =
        timelineCategories[item.categoryId] ?? timelineCategories.life;
      const start = current;
      current += total ? (item.minutes / total) * 100 : 0;
      return `${hexToRgba(category.color, 0.65)} ${start}% ${current}%`;
    })
    .join(", ");

  return (
    <div
      className="mx-auto flex h-[210px] w-[210px] items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${gradient || "#ddd 0% 100%"})` }}
    >
      <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full bg-[#f7f5ee] text-center">
        <div className="text-[13px] font-semibold">合计</div>
        <div className="mt-2 font-mono text-[16px]">
          {Math.floor(total / 60)}:{pad2(total % 60)}
        </div>
      </div>
    </div>
  );
}

function TimelineStatsView({ page, period, onSelectPeriod }) {
  const events = getTimelineEventsForPeriod(page.date, period, page.remoteData);
  const aggregates = aggregateTimelineEvents(events, page.remoteData);
  return (
    <div className="pt-2">
      <TimelineStatsPeriodSwitch
        page={page}
        period={period}
        onSelectPeriod={onSelectPeriod}
      />
      <div className="mb-3 font-mono text-[11px] tracking-[0.1em] text-black/45">
        {period === "day"
          ? page.date
          : period === "month"
            ? `${getDateParts(page.date).year}.${getDateParts(page.date).month}`
            : getDateParts(page.date).year}
      </div>
      <TimelineDonut aggregates={aggregates} />
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-1.5">
        {aggregates.map((item) => {
          const category =
            timelineCategories[item.categoryId] ?? timelineCategories.life;
          return (
            <div
              key={item.categoryId}
              className="flex items-center gap-1.5 text-[11px] leading-4"
            >
              <span
                className="h-3.5 w-[3px] shrink-0"
                style={{ background: hexToRgba(category.color, 0.68) }}
              />
              <span className="min-w-0 flex-1 truncate font-semibold text-black/68">
                {category.label}
              </span>
              <span className="shrink-0 text-right font-mono text-[10px] text-black/45">
                {Math.floor(item.minutes / 60)}:{pad2(item.minutes % 60)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineMiniStrip({ page }) {
  const events = getTimelineDay(page.date, page.remoteData).events;
  const ticks = Array.from({ length: 13 }, (_, index) => index * 2);
  const boundaries = Array.from(
    new Set([
      0,
      1440,
      ...events.flatMap((event) => [
        toMinutes(event.startAt),
        toMinutes(event.endAt),
      ]),
    ]),
  ).sort((a, b) => a - b);
  const segments = boundaries
    .slice(0, -1)
    .map((start, index) => {
      const end = boundaries[index + 1];
      const categoryMinutes = {};
      events.forEach((event) => {
        const normalizedEvent = normalizeTimelineEventCategory(
          event,
          page.remoteData,
        );
        const eventStart = toMinutes(event.startAt);
        const eventEnd = toMinutes(event.endAt);
        const overlap = Math.max(
          0,
          Math.min(end, eventEnd) - Math.max(start, eventStart),
        );
        if (overlap > 0)
          categoryMinutes[normalizedEvent.categoryId] =
            (categoryMinutes[normalizedEvent.categoryId] ?? 0) + overlap;
      });
      const dominant = Object.entries(categoryMinutes).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];
      return dominant ? { start, end, categoryId: dominant } : null;
    })
    .filter(Boolean);
  const merged = segments.reduce((list, item) => {
    const last = list[list.length - 1];
    if (last && last.categoryId === item.categoryId && last.end === item.start)
      last.end = item.end;
    else list.push({ ...item });
    return list;
  }, []);

  return (
    <div className="mb-5 border-b pb-4" style={{ borderColor: page.line }}>
      <div className="relative h-12 rounded-full bg-white/24">
        <div
          className="absolute left-0 right-0 top-[24px] border-t border-dashed"
          style={{ borderColor: page.line }}
        />
        {merged.map((segment) => {
          const category =
            timelineCategories[segment.categoryId] ?? timelineCategories.life;
          const left = Math.max(0, Math.min(100, (segment.start / 1440) * 100));
          const width = Math.max(
            2.2,
            Math.min(100 - left, ((segment.end - segment.start) / 1440) * 100),
          );
          return (
            <span
              key={`${segment.start}-${segment.end}-${segment.categoryId}`}
              className="absolute top-[13px] flex h-5 items-center justify-center rounded-full shadow-[0_3px_10px_rgba(0,0,0,.06)]"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: category.color,
                opacity: 0.9,
              }}
            />
          );
        })}
      </div>
      <div
        className="mt-1 grid font-mono text-[9px] text-black/42"
        style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      >
        {ticks.map((hour) => (
          <div key={hour} className="text-center">
            {hour}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReminderList({ page }) {
  const reminders = getRemindersForDate(page.date, page.remoteData);
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-end justify-between">
        <h3
          className="font-serif text-[16px] tracking-[0.08em]"
          style={{ color: page.color }}
        >
          今天的提醒
        </h3>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-black/32">
          reminder-archive
        </span>
      </div>
      {reminders.length ? (
        <div className="space-y-2">
          {reminders.map((entry) => {
            const dueAt = getReminderDueAt(entry);
            return (
              <div
                key={entry.reminder.id}
                className="rounded-[18px] bg-white/48 px-3 py-3 shadow-[0_10px_24px_rgba(0,0,0,.035)]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: page.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] tracking-[0.08em] text-black/42">
                      {minutesToClock(toMinutes(dueAt))}
                    </div>
                    <div className="mt-1 text-[12px] leading-[1.55] text-black/68">
                      {entry.reminder.text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[18px] bg-white/35 px-3 py-4 text-[12px] text-black/42">
          今天暂无提醒，提醒库存小憩中。
        </div>
      )}
    </section>
  );
}

function TimelinePeriodList({ page, onSelectEvent }) {
  const events = [...getTimelineDay(page.date, page.remoteData).events].sort(
    (a, b) => toMinutes(a.startAt) - toMinutes(b.startAt),
  );
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <h3
          className="font-serif text-[16px] tracking-[0.08em]"
          style={{ color: page.color }}
        >
          时间段列表
        </h3>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-black/32">
          timeline-state
        </span>
      </div>
      <div className="space-y-3">
        {events.map((event) => {
          const { category, categoryLabel } =
            getTimelineCategoryMeta(event, page.remoteData);
          const start = toMinutes(event.startAt);
          const end = toMinutes(event.endAt);
          const duration = getEventDurationMinutes(event);
          return (
            <button
              key={event.id}
              type="button"
              className="w-full rounded-[20px] bg-white/50 px-4 py-4 text-left shadow-[0_10px_26px_rgba(0,0,0,.035)] transition active:scale-[0.99]"
              onClick={() => onSelectEvent(event)}
            >
              <div className="flex gap-3">
                <span
                  className="w-1 shrink-0 rounded-full"
                  style={{ background: category.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-[13px] leading-4 text-black/58">
                    {event.title} · {duration}分钟
                  </div>
                  <div className="mt-2 truncate font-mono text-[11px] leading-4 text-black/40">
                    {minutesToClock(start)} - {minutesToClock(end)} · #
                    {categoryLabel} · {event.note}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TimelineReminderView({ page }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <div className="pt-1">
      <TimelineMiniStrip page={page} />
      <ReminderList page={page} />
      <TimelinePeriodList page={page} onSelectEvent={setSelectedEvent} />
      <AnimatePresence>
        {selectedEvent && (
          <TimelineEventDetailModal
            event={selectedEvent}
            page={page}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TimelinePage({
  page,
  timelineView,
  statsPeriod,
  highlightResult,
  onSelectStatsPeriod,
  onOpenDatePicker,
  onMonthSelect,
}) {
  return (
    <motion.section
      key={`${page.id}-timeline-${page.date}-${timelineView}-${statsPeriod}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative min-h-[980px] border bg-[#f7f5ee] p-5 pb-10"
      style={{ background: page.paper, borderColor: page.line }}
    >
      <PaperTexture mode={page.texture} />
      <div className="relative min-h-[920px]">
        <CalendarStrip
          page={page}
          onOpenDatePicker={onOpenDatePicker}
          onMonthSelect={onMonthSelect}
        />
        {timelineView === "line" ? (
          <TimelineDayView page={page} highlightResult={highlightResult} />
        ) : timelineView === "stats" ? (
          <TimelineStatsView
            page={page}
            period={statsPeriod}
            onSelectPeriod={onSelectStatsPeriod}
          />
        ) : (
          <TimelineReminderView page={page} />
        )}
      </div>
    </motion.section>
  );
}

export default function InsDiaryPrototype() {
  const [selectedStyleId, setSelectedStyleId] = useState("cafe");
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateText());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState("Diary");
  const [activeSection, setActiveSection] = useState("Conversation");
  const [selectedThreadId, setSelectedThreadId] = useState(
    defaultConversationThreadId,
  );
  const [timelineView, setTimelineView] = useState("line");
  const [statsPeriod, setStatsPeriod] = useState("day");
  const [highlightResult, setHighlightResult] = useState(null);
  const [diaryShareOpen, setDiaryShareOpen] = useState(false);
  const [selectedXiaoyeMode, setSelectedXiaoyeMode] = useState("Ins");
  const [remoteConversationsState, setRemoteConversationsState] = useState({});
  const [remoteTimelineStateValue, setRemoteTimelineStateValue] = useState({});
  const [remoteDiaryEntriesState, setRemoteDiaryEntriesState] = useState({});
  const [remoteDailySummaryEntriesState, setRemoteDailySummaryEntriesState] =
    useState({});
  const [remoteLetterEntriesState, setRemoteLetterEntriesState] = useState({});
  const [remoteStaticModeEntriesState, setRemoteStaticModeEntriesState] =
    useState({});
  const [remoteXiaoyeEntriesState, setRemoteXiaoyeEntriesState] = useState({});
  const [
    remoteReminderHistoryEntriesState,
    setRemoteReminderHistoryEntriesState,
  ] = useState([]);
  const [remoteDateIndexState, setRemoteDateIndexState] = useState(null);
  const [remoteSearchCacheState, setRemoteSearchCacheState] = useState({
    conversations: {},
    diary: {},
    dailySummary: {},
    letters: {},
    timeline: {},
  });
  const [remoteSearchLoading, setRemoteSearchLoading] = useState(false);
  const [remoteSearchError, setRemoteSearchError] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteLoading, setRemoteLoading] = useState({
    bootstrap: false,
    dated: false,
  });
  const [remoteError, setRemoteError] = useState({});
  const threadSelectionTouchedRef = useRef(false);
  const searchPendingRef = useRef({
    conversations: new Set(),
    diary: new Set(),
    dailySummary: new Set(),
    letters: new Set(),
  });

  const remoteData = useMemo(
    () => ({
      conversationEntries: remoteConversationsState,
      timelineState: remoteTimelineStateValue,
      diaryEntries: remoteDiaryEntriesState,
      dailySummaryEntries: remoteDailySummaryEntriesState,
      letterEntries: remoteLetterEntriesState,
      staticModeEntries: remoteStaticModeEntriesState,
      xiaoyeEntries: remoteXiaoyeEntriesState,
      reminderHistoryEntries: remoteReminderHistoryEntriesState,
      dateIndex: remoteDateIndexState,
      searchCache: remoteSearchCacheState,
    }),
    [
      remoteConversationsState,
      remoteTimelineStateValue,
      remoteDiaryEntriesState,
      remoteDailySummaryEntriesState,
      remoteLetterEntriesState,
      remoteStaticModeEntriesState,
      remoteXiaoyeEntriesState,
      remoteReminderHistoryEntriesState,
      remoteDateIndexState,
      remoteSearchCacheState,
    ],
  );

  const availableThreadIds = useMemo(
    () => getAllConversationThreadIds(remoteData),
    [remoteData],
  );
  const latestConversationThreadId = useMemo(
    () => getLatestConversationThreadId(remoteData),
    [remoteData],
  );

  useEffect(() => {
    if (!availableThreadIds.length) return;

    if (!availableThreadIds.includes(selectedThreadId)) {
      setSelectedThreadId(latestConversationThreadId ?? availableThreadIds[0]);
      return;
    }

    if (
      !threadSelectionTouchedRef.current &&
      latestConversationThreadId &&
      latestConversationThreadId !== selectedThreadId
    ) {
      setSelectedThreadId(latestConversationThreadId);
    }
  }, [availableThreadIds, latestConversationThreadId, selectedThreadId]);

  const handleSelectThread = (threadId) => {
    threadSelectionTouchedRef.current = true;
    setSelectedThreadId(threadId);
  };

  useEffect(() => {
    const dotDate = toDotDate(selectedDate);
    const remoteConversationCount = Object.values(
      remoteConversationsState[dotDate] ?? {},
    ).reduce((sum, records) => sum + records.length, 0);
    const remoteDiaryEntry = getRemoteEntryByDate(
      getRemoteDatedEntriesSource("Diary", remoteData),
      selectedDate,
    );
    const remoteLettersEntry = getRemoteEntryByDate(
      getRemoteDatedEntriesSource("Letters", remoteData),
      selectedDate,
    );
    const diarySource = remoteDiaryEntry
      ? "remote"
      : diaryEntries[selectedDate]
        ? "mock"
        : "blank";
    const lettersSource = remoteLettersEntry
      ? "remote"
      : letterEntries[selectedDate]
        ? "mock"
        : "blank";

    if (import.meta.env.DEV) {
      console.debug("[MurmurLane Debug] remoteDateIndex", remoteDateIndexState);
      console.debug("[MurmurLane Debug] selectedDate", selectedDate);
      console.debug(
        "[MurmurLane Debug] remote conversations count for selectedDate",
        remoteConversationCount,
      );
      console.debug(
        "[MurmurLane Debug] threadIds for selectedDate",
        availableThreadIds,
      );
      console.debug("[MurmurLane Debug] selectedThreadId", selectedThreadId);
      console.debug(
        "[MurmurLane Debug] diary source for selectedDate",
        diarySource,
      );
      console.debug(
        "[MurmurLane Debug] letters source for selectedDate",
        lettersSource,
      );
      console.debug("[MurmurLane Debug] remoteError", remoteError);
    }
  }, [
    selectedDate,
    selectedThreadId,
    availableThreadIds,
    remoteConversationsState,
    remoteDateIndexState,
    remoteData,
    remoteError,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadBootstrapData = async () => {
      setRemoteLoading((current) => ({ ...current, bootstrap: true }));

      const staticRequests = [
        ["Project", staticModeApiMap.Project],
        ["Preference", staticModeApiMap.Preference],
        ["Openloops", staticModeApiMap.Openloops],
        ["Facts", staticModeApiMap.Facts],
        ["Patterns", staticModeApiMap.Patterns],
      ];
      const xiaoyeRequests = xiaoyeModes.map((mode) => [
        mode,
        xiaoyeModeMeta[mode].apiMode,
      ]);

      const [
        timelineResult,
        dateIndexResult,
        reminderHistoryResult,
        ...staticAndXiaoyeResults
      ] =
        await Promise.allSettled([
          fetchTimeline(),
          fetchDateIndex(),
          fetchReminderHistory(),
          ...staticRequests.map(([, mode]) => fetchMemoryStatic(mode)),
          ...xiaoyeRequests.map(([, mode]) => fetchXiaoyeStatic(mode)),
        ]);
      const staticResults = staticAndXiaoyeResults.slice(
        0,
        staticRequests.length,
      );
      const xiaoyeResults = staticAndXiaoyeResults.slice(staticRequests.length);

      if (cancelled) return;

      if (
        timelineResult.status === "fulfilled" &&
        timelineResult.value &&
        timelineResult.value.found !== false &&
        typeof timelineResult.value === "object"
      ) {
        const timelineFacts = timelineResult.value.facts ?? timelineResult.value;
        const nextTimelineState = Object.fromEntries(
          Object.entries(timelineFacts)
            .filter(([, value]) => value?.events)
            .map(([key, value]) => [toDotDate(key), value]),
        );
        setRemoteTimelineStateValue(nextTimelineState);
        setRemoteSearchCacheState((current) => ({
          ...current,
          timeline: {
            ...current.timeline,
            ...nextTimelineState,
          },
        }));
      } else if (timelineResult.status === "rejected") {
        setRemoteError((current) => ({
          ...current,
          timeline: String(timelineResult.reason?.message || timelineResult.reason),
        }));
      }

      if (
        dateIndexResult.status === "fulfilled" &&
        dateIndexResult.value &&
        typeof dateIndexResult.value === "object"
      ) {
        setRemoteDateIndexState(dateIndexResult.value);
      } else if (dateIndexResult.status === "rejected") {
        setRemoteError((current) => ({
          ...current,
          dateIndex: String(
            dateIndexResult.reason?.message || dateIndexResult.reason,
          ),
        }));
      }

      if (reminderHistoryResult.status === "fulfilled") {
        const entries = reminderHistoryResult.value?.entries;
        setRemoteReminderHistoryEntriesState(Array.isArray(entries) ? entries : []);
      } else {
        setRemoteError((current) => ({
          ...current,
          reminders: String(
            reminderHistoryResult.reason?.message ||
              reminderHistoryResult.reason,
          ),
        }));
      }

      const nextStaticEntries = {};
      staticResults.forEach((result, index) => {
        const [mode] = staticRequests[index];
        if (
          result.status === "fulfilled" &&
          result.value?.found === true &&
          result.value?.entry
        ) {
          nextStaticEntries[mode] = result.value.entry;
          return;
        }

        if (result.status === "rejected") {
          setRemoteError((current) => ({
            ...current,
            [mode]: String(result.reason?.message || result.reason),
          }));
        }
      });

      if (Object.keys(nextStaticEntries).length) {
        setRemoteStaticModeEntriesState((current) => ({
          ...current,
          ...nextStaticEntries,
        }));
      }

      const nextXiaoyeEntries = {};
      xiaoyeResults.forEach((result, index) => {
        const [mode] = xiaoyeRequests[index];
        if (
          result.status === "fulfilled" &&
          result.value?.found === true &&
          result.value?.entry
        ) {
          nextXiaoyeEntries[mode] = result.value.entry;
          return;
        }

        if (result.status === "rejected") {
          setRemoteError((current) => ({
            ...current,
            [`Xiaoye:${mode}`]: String(result.reason?.message || result.reason),
          }));
        }
      });

      if (Object.keys(nextXiaoyeEntries).length) {
        setRemoteXiaoyeEntriesState((current) => ({
          ...current,
          ...nextXiaoyeEntries,
        }));
      }

      setRemoteLoading((current) => ({ ...current, bootstrap: false }));
    };

    loadBootstrapData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const dotDate = toDotDate(selectedDate);

    const loadDatedData = async () => {
      setRemoteLoading((current) => ({ ...current, dated: true }));

      const [
        conversationsResult,
        diaryResult,
        dailySummaryResult,
        lettersResult,
      ] = await Promise.allSettled([
        fetchConversations(dotDate),
        fetchMemoryDiary(dotDate),
        fetchMemoryDailySummary(dotDate),
        fetchMemoryLetters(dotDate),
      ]);

      if (cancelled) return;

      if (
        conversationsResult.status === "fulfilled" &&
        Array.isArray(conversationsResult.value) &&
        conversationsResult.value.length
      ) {
        const grouped = groupConversationRecordsByThread(
          conversationsResult.value,
        );

        setRemoteConversationsState((current) => ({
          ...current,
          [dotDate]: grouped,
        }));
      } else {
        setRemoteConversationsState((current) => {
          const next = { ...current };
          delete next[dotDate];
          return next;
        });

        if (conversationsResult.status === "rejected") {
          setRemoteError((current) => ({
            ...current,
            [`conversations:${dotDate}`]: String(
              conversationsResult.reason?.message || conversationsResult.reason,
            ),
          }));
        }
      }

      const memoryLoaders = [
        [
          diaryResult,
          setRemoteDiaryEntriesState,
          `diary:${dotDate}`,
        ],
        [
          dailySummaryResult,
          setRemoteDailySummaryEntriesState,
          `daily-summary:${dotDate}`,
        ],
        [
          lettersResult,
          setRemoteLetterEntriesState,
          `letters:${dotDate}`,
        ],
      ];

      memoryLoaders.forEach(([result, setter, errorKey]) => {
        if (
          result.status === "fulfilled" &&
          result.value?.found === true &&
          result.value?.entry
        ) {
          setter((current) => ({
            ...current,
            [dotDate]: result.value.entry,
          }));
          return;
        }

        setter((current) => {
          const next = { ...current };
          delete next[dotDate];
          return next;
        });

        if (result.status === "rejected") {
          setRemoteError((current) => ({
            ...current,
            [errorKey]: String(result.reason?.message || result.reason),
          }));
        }
      });

      setRemoteLoading((current) => ({ ...current, dated: false }));
    };

    loadDatedData();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    const normalizedQuery = String(searchQuery ?? "").trim();

    if (!normalizedQuery || !remoteDateIndexState) {
      setRemoteSearchLoading(false);
      return;
    }

    let cancelled = false;

    const isConversationDateCached = (date) =>
      Boolean(
        remoteConversationsState[date] ||
          remoteSearchCacheState.conversations[date] ||
          searchPendingRef.current.conversations.has(date),
      );
    const isDiaryDateCached = (date) =>
      Boolean(
        remoteDiaryEntriesState[date] ||
          remoteSearchCacheState.diary[date] ||
          searchPendingRef.current.diary.has(date),
      );
    const isDailySummaryDateCached = (date) =>
      Boolean(
        remoteDailySummaryEntriesState[date] ||
          remoteSearchCacheState.dailySummary[date] ||
          searchPendingRef.current.dailySummary.has(date),
      );
    const isLettersDateCached = (date) =>
      Boolean(
        remoteLetterEntriesState[date] ||
          remoteSearchCacheState.letters[date] ||
          searchPendingRef.current.letters.has(date),
      );

    const tasks = [
      ...(remoteDateIndexState.conversations ?? [])
        .map(toDotDate)
        .filter((date) => !isConversationDateCached(date))
        .map((date) => ({
          type: "conversations",
          date,
          loader: () => fetchConversations(date),
        })),
      ...(remoteDateIndexState.diary ?? [])
        .map(toDotDate)
        .filter((date) => !isDiaryDateCached(date))
        .map((date) => ({
          type: "diary",
          date,
          loader: () => fetchMemoryDiary(date),
        })),
      ...(remoteDateIndexState.dailySummary ?? [])
        .map(toDotDate)
        .filter((date) => !isDailySummaryDateCached(date))
        .map((date) => ({
          type: "dailySummary",
          date,
          loader: () => fetchMemoryDailySummary(date),
        })),
      ...(remoteDateIndexState.letters ?? [])
        .map(toDotDate)
        .filter((date) => !isLettersDateCached(date))
        .map((date) => ({
          type: "letters",
          date,
          loader: () => fetchMemoryLetters(date),
        })),
    ];

    if (!tasks.length) {
      setRemoteSearchLoading(false);
      return;
    }

    const loadSearchData = async () => {
      setRemoteSearchLoading(true);
      const concurrency = 4;
      let cursor = 0;

      const runTask = async () => {
        while (!cancelled && cursor < tasks.length) {
          const task = tasks[cursor];
          cursor += 1;
          searchPendingRef.current[task.type].add(task.date);

          try {
            const result = await task.loader();
            if (cancelled) continue;

            if (task.type === "conversations") {
              if (Array.isArray(result) && result.length) {
                setRemoteSearchCacheState((current) => ({
                  ...current,
                  conversations: {
                    ...current.conversations,
                    [task.date]: groupConversationRecordsByThread(result),
                  },
                }));
              }
            } else if (result?.found === true && result?.entry) {
              setRemoteSearchCacheState((current) => ({
                ...current,
                [task.type]: {
                  ...current[task.type],
                  [task.date]: result.entry,
                },
              }));
            }
          } catch (error) {
            if (!cancelled) {
              setRemoteSearchError((current) => ({
                ...current,
                [`${task.type}:${task.date}`]: String(
                  error?.message || error,
                ),
              }));
            }
          } finally {
            searchPendingRef.current[task.type].delete(task.date);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, tasks.length) }, () =>
          runTask(),
        ),
      );

      if (!cancelled) {
        setRemoteSearchLoading(false);
      }
    };

    loadSearchData();

    return () => {
      cancelled = true;
    };
  }, [
    searchQuery,
    remoteDateIndexState,
    remoteConversationsState,
    remoteDiaryEntriesState,
    remoteDailySummaryEntriesState,
    remoteLetterEntriesState,
    remoteSearchCacheState,
  ]);

  const searchDataVersion = useMemo(
    () =>
      [
        Object.keys(remoteConversationsState).length,
        Object.keys(remoteDiaryEntriesState).length,
        Object.keys(remoteDailySummaryEntriesState).length,
        Object.keys(remoteLetterEntriesState).length,
        Object.keys(remoteTimelineStateValue).length,
        Object.keys(remoteStaticModeEntriesState).length,
        Object.keys(remoteXiaoyeEntriesState).length,
        Object.keys(remoteSearchCacheState.conversations).length,
        Object.keys(remoteSearchCacheState.diary).length,
        Object.keys(remoteSearchCacheState.dailySummary).length,
        Object.keys(remoteSearchCacheState.letters).length,
        Object.keys(remoteSearchCacheState.timeline).length,
      ].join(":"),
    [
      remoteConversationsState,
      remoteDiaryEntriesState,
      remoteDailySummaryEntriesState,
      remoteLetterEntriesState,
      remoteTimelineStateValue,
      remoteStaticModeEntriesState,
      remoteXiaoyeEntriesState,
      remoteReminderHistoryEntriesState,
      remoteSearchCacheState,
    ],
  );

  const styleTheme = useMemo(
    () =>
      styleThemes.find((item) => item.id === selectedStyleId) ?? styleThemes[0],
    [selectedStyleId],
  );
  const timelineStyleTheme = useMemo(
    () => styleThemes.find((item) => item.id === "cafe") ?? styleThemes[0],
    [],
  );
  const page = useMemo(() => {
    if (activeSection === "Conversation")
      return buildConversationPage(
        styleTheme,
        selectedDate,
        selectedThreadId,
        remoteData,
      );
    if (activeSection === "Timeline")
      return buildTimelinePage(timelineStyleTheme, selectedDate, remoteData);
    if (activeSection === "Xiaoye")
      return buildXiaoyePage(
        styleTheme,
        selectedDate,
        selectedXiaoyeMode,
        remoteData,
      );
    return buildMemoryPage(styleTheme, selectedDate, selectedMode, remoteData);
  }, [
    styleTheme,
    timelineStyleTheme,
    selectedDate,
    selectedMode,
    selectedXiaoyeMode,
    activeSection,
    selectedThreadId,
    remoteConversationsState,
    remoteTimelineStateValue,
    remoteDiaryEntriesState,
    remoteDailySummaryEntriesState,
    remoteLetterEntriesState,
    remoteStaticModeEntriesState,
    remoteXiaoyeEntriesState,
    remoteReminderHistoryEntriesState,
    remoteDateIndexState,
    remoteSearchCacheState,
  ]);

  const handleSwipeDate = (offset) => {
    setHighlightResult(null);
    setSelectedDate((current) => shiftDate(current, offset));
  };
  const handleSelectDate = (dateText) => {
    setHighlightResult(null);
    setSelectedDate(dateText);
  };
  const handleSelectMonth = (month) => {
    setHighlightResult(null);
    setSelectedDate((current) => changeDateMonth(current, month));
  };

  return (
    <div
      className="flex min-h-screen items-start justify-center text-stone-700 sm:px-3 sm:py-5"
      style={{
        background:
          activeSection === "Timeline"
            ? "#d8d4cb"
            : selectedStyleId === "plant"
              ? "#eef0e8"
              : "#d8d4cb",
      }}
    >
      <AppScrollbarStyle />
      <div className="pointer-events-none fixed inset-0 opacity-[0.24] [background-image:radial-gradient(#6f6a60_0.55px,transparent_0.55px)] [background-size:8px_8px]" />
      <main
        className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden border-x bg-[#eeeae1] px-4 pt-[calc(16px+env(safe-area-inset-top))] sm:h-[852px] sm:w-[393px] sm:border sm:pt-4"
        style={{ borderColor: page.line }}
      >
        <div className="diary-scroll flex-1 overflow-y-auto overflow-x-hidden pb-4">
          <header
            className="mb-4 border-b pb-3"
            style={{ borderBottomColor: page.line }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-black/40">
                  interactive journal archive
                </div>
                <h1 className="mt-1 font-serif text-4xl tracking-[0.16em] text-black/75">
                  {activeSection === "Conversation"
                    ? "对话"
                    : activeSection === "Timeline"
                      ? "时间轴"
                      : page.modeTitle}
                </h1>
                <div className="mt-2 font-mono text-[10px] tracking-[0.16em] text-black/45">
                  NO RADIUS · PAPER · INS
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <DiarySearchBox
                  page={page}
                  selectedDate={selectedDate}
                  onSearchQueryChange={setSearchQuery}
                  searchRemoteData={remoteData}
                  searchDataVersion={searchDataVersion}
                  onSelectResult={(result) => {
                    if (result.mode === "Conversation") {
                      setActiveSection("Conversation");
                      if (result.threadId) handleSelectThread(result.threadId);
                    } else if (result.mode === "Timeline") {
                      setActiveSection("Timeline");
                      setTimelineView("line");
                    } else if (result.mode === "Xiaoye") {
                      setActiveSection("Xiaoye");
                      if (result.xiaoyeMode) {
                        setSelectedXiaoyeMode(result.xiaoyeMode);
                      }
                    } else {
                      setActiveSection("Archive");
                      setSelectedMode(result.mode);
                    }
                    if (result.date) setSelectedDate(result.date);
                    setHighlightResult(result);
                  }}
                />
                {activeSection === "Conversation" ? (
                  <ThreadSwitch
                    page={page}
                    selectedThreadId={selectedThreadId}
                    onSelectThread={handleSelectThread}
                    threadIds={availableThreadIds}
                  />
                ) : activeSection === "Archive" ? (
                  <TopModeSwitch
                    page={page}
                    selectedMode={selectedMode}
                    onSelectMode={setSelectedMode}
                  />
                ) : activeSection === "Xiaoye" ? (
                  <XiaoyeModeSwitch
                    page={page}
                    selectedXiaoyeMode={selectedXiaoyeMode}
                    onSelectXiaoyeMode={setSelectedXiaoyeMode}
                  />
                ) : null}
              </div>
            </div>
          </header>
          {activeSection === "Timeline" ? (
            <TimelineModeSwitch
              page={page}
              selectedView={timelineView}
              onSelectView={setTimelineView}
            />
          ) : (
            <ChapterTabs
              page={page}
              selectedStyleId={selectedStyleId}
              setSelectedStyleId={setSelectedStyleId}
            />
          )}
          <div className="mt-5 pb-8">
            <SwipeDateArea onSwipeDate={handleSwipeDate}>
              <AnimatePresence mode="wait">
                {activeSection === "Conversation" ? (
                  <ConversationPage
                    page={page}
                    selectedThreadId={selectedThreadId}
                    highlightResult={highlightResult}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                  />
                ) : activeSection === "Timeline" ? (
                  <TimelinePage
                    page={page}
                    timelineView={timelineView}
                    statsPeriod={statsPeriod}
                    highlightResult={highlightResult}
                    onSelectStatsPeriod={setStatsPeriod}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                  />
                ) : activeSection === "Xiaoye" ? (
                  <XiaoyePage
                    page={page}
                    highlightResult={highlightResult}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                  />
                ) : (
                  <DiaryPage
                    page={page}
                    highlightResult={highlightResult}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                    onOpenShare={() => setDiaryShareOpen(true)}
                  />
                )}
              </AnimatePresence>
            </SwipeDateArea>
          </div>
        </div>
        <BottomNav
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          page={page}
        />
        <AnimatePresence>
          {diaryShareOpen &&
            activeSection === "Archive" &&
            (page.mode === "Diary" || page.mode === "Letters") && (
            <DiaryShareModal page={page} onClose={() => setDiaryShareOpen(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {datePickerOpen && (
            <DatePickerModal
              page={page}
              onClose={() => setDatePickerOpen(false)}
              onSelectDate={handleSelectDate}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}



