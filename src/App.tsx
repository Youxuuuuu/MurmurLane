// @ts-nocheck
import { useEffect,useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { pageModes, xiaoyeModeMeta, xiaoyeModes } from "./config/pageModes";
import { styleThemes } from "./config/theme";
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
  getDateParts,
  getTodayDateText,
  shiftDate,
  toDotDate,
} from "./lib/date";
import {
  shouldHideConversationRecord,
} from "./lib/conversation";
import {
  buildConversationPage,
  defaultConversationThreadId,
  getAllConversationThreadIds,
  getLatestConversationThreadId,
  groupConversationRecordsByThread,
  hasConversationForDate,
} from "./lib/conversationPageData";
import {
  buildMemoryPage,
  buildXiaoyePage,
  getRemoteDatedEntriesSource,
  getRemoteEntryByDate,
  hasDatedEntry,
} from "./lib/memoryPageData";
import {
  buildTimelinePage,
  getTimelineDay,
  getTimelineStateSource,
  normalizeTimelineEventCategory,
  timelineCategories,
} from "./lib/timelinePageData";
import {
  MIN_TIMELINE_EVENT_HEIGHT,
  getEventDurationMinutes,
  getTimelineEventHeight,
  getTimelineRange,
  minutesToClock,
  toMinutes,
} from "./lib/timeline";
import {
  normalizeSearchText,
} from "./lib/search";
import { buildSearchResultState } from "./lib/searchPageData";
import { PaperTexture } from "./components/common/PaperTexture";
import { TinyIcon } from "./components/common/TinyIcon";
import { CalendarStrip } from "./components/calendar/CalendarStrip";
import { DatePickerModal } from "./components/calendar/DatePickerModal";
import { DirectoryPage } from "./components/archive/DirectoryPage";
import { ChatBubble } from "./components/conversation/ChatBubble";
import { ConversationEmptyState } from "./components/conversation/ConversationEmptyState";
import { TimelineDayView } from "./components/timeline/TimelineDayView";
import { TimelineReminderView } from "./components/timeline/TimelineReminderView";
import { TimelineStatsView } from "./components/timeline/TimelineStatsView";
import { XiaoyePage } from "./components/xiaoye/XiaoyePage";
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
        <ConversationEmptyState />
      )}
    </motion.section>
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
          <TimelineDayView
            page={page}
            highlightResult={highlightResult}
            scrollHitIntoView={scrollHitIntoView}
          />
        ) : timelineView === "stats" ? (
          <TimelineStatsView
            page={page}
            period={statsPeriod}
            onSelectPeriod={onSelectStatsPeriod}
            aggregateTimelineEvents={aggregateTimelineEvents}
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
  const isValidDotDate = (value) =>
    /^\d{4}\.\d{2}\.\d{2}$/.test(String(value ?? ""));

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
                      setTimelineView(result.timelineView || "line");
                    } else if (result.mode === "Xiaoye") {
                      setActiveSection("Xiaoye");
                      if (result.xiaoyeMode) {
                        setSelectedXiaoyeMode(result.xiaoyeMode);
                      }
                    } else {
                      setActiveSection("Archive");
                      setSelectedMode(result.mode);
                    }
                    if (isValidDotDate(result.date)) setSelectedDate(result.date);
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
                    scrollHitIntoView={scrollHitIntoView}
                  />
                ) : (
                  <DirectoryPage
                    page={page}
                    highlightResult={highlightResult}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                    onOpenShare={() => setDiaryShareOpen(true)}
                    diaryShareOpen={
                      diaryShareOpen && activeSection === "Archive"
                    }
                    onCloseShare={() => setDiaryShareOpen(false)}
                    scrollHitIntoView={scrollHitIntoView}
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



