// @ts-nocheck
import React, { useEffect,useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toPng } from "html-to-image";
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
  toHyphenDate,
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
function HighlightText({ text, query, color = "#c28a4a" }) {
  const value = String(text ?? "");
  const cleanQuery = String(query ?? "").trim();
  if (!cleanQuery) return <>{value}</>;
  const lowerValue = value.toLowerCase();
  const lowerQuery = cleanQuery.toLowerCase();
  const parts = [];
  let cursor = 0;
  let index = lowerValue.indexOf(lowerQuery);
  while (index >= 0) {
    if (index > cursor)
      parts.push({ text: value.slice(cursor, index), hit: false });
    parts.push({
      text: value.slice(index, index + cleanQuery.length),
      hit: true,
    });
    cursor = index + cleanQuery.length;
    index = lowerValue.indexOf(lowerQuery, cursor);
  }
  if (cursor < value.length)
    parts.push({ text: value.slice(cursor), hit: false });
  if (!parts.some((part) => part.hit)) return <>{value}</>;
  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <mark
            key={index}
            className="px-0.5"
            style={{ background: `${color}26`, color }}
          >
            {part.text}
          </mark>
      ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
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

function AppScrollbarStyle() {
  return (
   <style>{`.diary-scroll,.search-scroll,.share-scroll{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;scroll-behavior:smooth}.year-picker-scroll{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;scroll-behavior:auto}#conversation-message-scroll{scroll-behavior:auto}.diary-scroll::-webkit-scrollbar,.search-scroll::-webkit-scrollbar,.share-scroll::-webkit-scrollbar,.year-picker-scroll::-webkit-scrollbar{width:0;height:0;display:none}`}</style>
  );
}
function PaperTexture({ mode = "grain" }) {
  const opacity =
    mode === "light"
      ? "opacity-[0.18]"
      : mode === "blank"
        ? "opacity-[0.12]"
        : mode === "grain"
          ? "opacity-[0.24]"
          : "opacity-[0.32]";
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${opacity} mix-blend-multiply`}
    >
      <div className="absolute inset-0 [background-image:radial-gradient(#8d8576_0.45px,transparent_0.45px)] [background-size:7px_7px]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.32),rgba(0,0,0,.025),rgba(255,255,255,.28))]" />
    </div>
  );
}
function TinyIcon({ color = "currentColor" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-12 w-12"
      fill="none"
      style={{ color }}
    >
      <path
        d="M17 48c22-6 31-21 31-36C31 13 17 25 17 48Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M18 48c7-10 16-19 30-36"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
function DiarySearchBox({
  page,
  selectedDate,
  onSelectResult,
  onSearchQueryChange,
  searchRemoteData,
  searchDataVersion,
}) {
  const [inputQuery, setInputQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [searchFilterOpen, setSearchFilterOpen] = useState(false);
  const [searchModeFilter, setSearchModeFilter] = useState("All");
  const [searchTimeFilter, setSearchTimeFilter] = useState("All");
  const debouncedQuery = useDebouncedValue(inputQuery, 300);
  const searchBoxRef = useRef(null);
  useEffect(() => {
  const handlePointerDown = (event) => {
    if (!searchBoxRef.current) return;

    if (!searchBoxRef.current.contains(event.target)) {
      setFocused(false);
      setSearchFilterOpen(false);
    }
  };

  document.addEventListener("pointerdown", handlePointerDown);

  return () => {
    document.removeEventListener("pointerdown", handlePointerDown);
  };
  }, []);
  const searchState = useMemo(
    () =>
      buildSearchResultState(debouncedQuery, searchRemoteData, {
        modeFilter: searchModeFilter,
        timeFilter: searchTimeFilter,
        selectedDate,
        limit: 50,
      }),
    [
      debouncedQuery,
      searchModeFilter,
      searchTimeFilter,
      selectedDate,
      searchDataVersion,
    ],
  );
  const results = searchState.results;
  const showResultPanel = focused && inputQuery.trim().length > 0;
  const showPanel = searchFilterOpen || showResultPanel;
  const pendingSearch =
    inputQuery.trim().length > 0 &&
    normalizeSearchText(inputQuery) !== normalizeSearchText(debouncedQuery);

  useEffect(() => {
    onSearchQueryChange(debouncedQuery);
  }, [debouncedQuery, onSearchQueryChange]);

  return (
      <div ref={searchBoxRef} className="relative z-50 w-[174px] font-mono">
      <div className="flex items-stretch gap-1">
        <button
          className="shrink-0 border bg-white/30 px-2 text-[8px] uppercase tracking-[0.12em] text-black/55 transition hover:bg-white/45"
          style={{ borderColor: page.line }}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setSearchFilterOpen((current) => !current);
            setFocused(true);
          }}
        >
          筛选
        </button>
        <input
          className="min-w-0 flex-1 border bg-white/25 px-2.5 py-2 text-[9px] uppercase leading-none tracking-[0.08em] text-black/55 outline-none placeholder:text-black/28"
          style={{ borderColor: page.line }}
          value={inputQuery}
          placeholder="SEARCH"
          onChange={(event) => {
            setInputQuery(event.target.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
        />
      </div>
      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="absolute right-0 top-[calc(100%+6px)] w-[236px] max-w-[calc(100vw-32px)] border bg-[#f4f0e8] p-2"
            style={{ borderColor: page.line }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <PaperTexture mode={page.texture} />
            <div className="relative">
              {searchFilterOpen ? (
                <div className="space-y-3 pb-2">
                  <div>
                    <div
                      className="text-[8px] uppercase tracking-[0.12em]"
                      style={{ color: page.color }}
                    >
                      页面类型
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {searchModeOptions.map((option) => {
                        const active = option.value === searchModeFilter;

                        return (
                          <button
                            key={option.value}
                            className="border px-2 py-1 text-[8px] leading-none tracking-[0.08em] transition"
                            style={{
                              borderColor: active ? page.color : page.line,
                              color: active ? page.color : "rgba(0,0,0,0.5)",
                              background: active ? `${page.color}10` : "transparent",
                            }}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setSearchModeFilter(option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-[8px] uppercase tracking-[0.12em]"
                      style={{ color: page.color }}
                    >
                      时间筛选
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {searchTimeOptions.map((option) => {
                        const active = option.value === searchTimeFilter;

                        return (
                          <button
                            key={option.value}
                            className="border px-2 py-1 text-[8px] leading-none tracking-[0.08em] transition"
                            style={{
                              borderColor: active ? page.color : page.line,
                              color: active ? page.color : "rgba(0,0,0,0.5)",
                              background: active ? `${page.color}10` : "transparent",
                            }}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setSearchTimeFilter(option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
              {searchFilterOpen && showResultPanel ? (
                <div
                  className="mb-2 h-px"
                  style={{ background: `${page.line}` }}
                />
              ) : null}
              {showResultPanel ? (
                pendingSearch ? (
                  <div className="px-2 py-3 text-[10px] text-black/38">
                    正在整理搜索范围…
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 px-1 text-[9px] text-black/48">
                      <span className="font-mono uppercase tracking-[0.08em]">
                        “{debouncedQuery.trim()}”
                      </span>{" "}
                      出现 {searchState.totalOccurrences} 次
                    </div>
                    <div className="search-scroll relative max-h-[230px] overflow-y-auto space-y-1.5 pr-0">
                      {results.length ? (
                        results.map((result) => (
                          <button
                            key={`${result.mode}-${result.date}-${result.targetId}`}
                            className="w-full border px-2 py-2 text-left"
                            style={{ borderColor: page.line }}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              onSelectResult(result);
                              setInputQuery("");
                              onSearchQueryChange("");
                              setFocused(false);
                              setSearchFilterOpen(false);
                            }}
                          >
                            <div
                              className="text-[9px] tracking-[0.12em]"
                              style={{ color: page.color }}
                            >
                              {result.label}
                            </div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-black/35">
                              {result.fieldLabel}
                            </div>
                            <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-black/38">
                              <HighlightText
                                text={result.excerpt}
                                query={result.query}
                                color={page.color}
                              />
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-3 text-[10px] text-black/38">
                          没有搜到内容碎片
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function ThreadSwitch({ page, selectedThreadId, onSelectThread, threadIds }) {
  const [open, setOpen] = useState(false);
  const shortId = `${selectedThreadId.slice(0, 8)}…${selectedThreadId.slice(-4)}`;
  return (
    <div className="relative z-40 w-[132px] font-mono">
      <button
        className="flex w-full items-center justify-between border px-2.5 py-2 text-[8px] uppercase leading-none tracking-[0.04em]"
        style={{
          color: page.color,
          borderColor: page.color,
          background: page.pale,
        }}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{shortId}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+6px)] w-[210px] border bg-[#f4f0e8] p-1"
            style={{ borderColor: page.line }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {threadIds.map((threadId) => (
              <button
                key={threadId}
                className="w-full px-2 py-2 text-left text-[8px] leading-4"
                style={{
                  color:
                    threadId === selectedThreadId
                      ? page.color
                      : "rgba(0,0,0,.46)",
                  background:
                    threadId === selectedThreadId ? page.pale : "transparent",
                }}
                type="button"
                onClick={() => {
                  onSelectThread(threadId);
                  setOpen(false);
                }}
              >
                {threadId}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function TopModeSwitch({ page, selectedMode, onSelectMode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-40 mt-1 w-[132px] font-mono">
      <button
        className="flex w-full items-center justify-between border px-2.5 py-2 text-[9px] uppercase leading-none tracking-[0.1em]"
        style={{
          color: page.color,
          borderColor: page.color,
          background: page.pale,
        }}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selectedMode}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+6px)] w-full border bg-[#f4f0e8] p-1"
            style={{ borderColor: page.line }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {pageModes.map((mode) => (
              <button
                key={mode}
                className="flex w-full items-center justify-between px-2 py-2 text-left text-[9px] uppercase leading-none"
                style={{
                  color: selectedMode === mode ? page.color : "rgba(0,0,0,.46)",
                  background: selectedMode === mode ? page.pale : "transparent",
                }}
                type="button"
                onClick={() => {
                  onSelectMode(mode);
                  setOpen(false);
                }}
              >
                <span>{mode}</span>
                <span>{selectedMode === mode ? "●" : ""}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function XiaoyeModeSwitch({ page, selectedXiaoyeMode, onSelectXiaoyeMode }) {
  const [open, setOpen] = useState(false);
  const selectedMeta =
    xiaoyeModeMeta[selectedXiaoyeMode] ?? xiaoyeModeMeta.Ins;

  return (
    <div className="relative z-40 mt-1 w-[132px] font-mono">
      <button
        className="flex w-full items-center justify-between border px-2.5 py-2 text-[9px] uppercase leading-none tracking-[0.1em]"
        style={{
          color: page.color,
          borderColor: page.color,
          background: page.pale,
        }}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selectedMeta.title}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+6px)] w-full border bg-[#f4f0e8] p-1"
            style={{ borderColor: page.line }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {xiaoyeModes.map((mode) => {
              const modeMeta = xiaoyeModeMeta[mode];

              return (
                <button
                  key={mode}
                  className="flex w-full items-center justify-between px-2 py-2 text-left text-[9px] uppercase leading-none"
                  style={{
                    color:
                      selectedXiaoyeMode === mode
                        ? page.color
                        : "rgba(0,0,0,.46)",
                    background:
                      selectedXiaoyeMode === mode
                        ? page.pale
                        : "transparent",
                  }}
                  type="button"
                  onClick={() => {
                    onSelectXiaoyeMode(mode);
                    setOpen(false);
                  }}
                >
                  <span>{modeMeta.title}</span>
                  <span>{selectedXiaoyeMode === mode ? "●" : ""}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function ChapterTabs({ page, selectedStyleId, setSelectedStyleId }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-3 gap-y-1 border-y py-2 text-[10px] tracking-[0.12em] text-stone-500"
      style={{ borderColor: page.line }}
    >
      {styleThemes.map((item) => (
        <button
          key={item.id}
          onClick={() => setSelectedStyleId(item.id)}
          className="flex items-center justify-between py-1.5 text-left"
          style={{
            color: selectedStyleId === item.id ? page.color : undefined,
          }}
          type="button"
        >
          <span className="font-medium uppercase">{item.label}</span>
          <span className="font-mono text-[10px]">
            {selectedStyleId === item.id ? "●" : "○"}
          </span>
        </button>
      ))}
    </div>
  );
}
function CalendarStrip({ page, onOpenDatePicker, onMonthSelect }) {
  const months = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );
  return (
    <div
      className="mb-5 border-b pb-2 font-mono text-black/65"
      style={{ borderBottomColor: page.color }}
    >
      <div className="mb-2">
        <div className="text-[9px] uppercase leading-none tracking-[0.08em] text-black/38">
          current date
        </div>
        <button
          className="mt-1 text-[20px] leading-none tracking-[0.06em]"
          style={{ color: page.color }}
          type="button"
          onClick={onOpenDatePicker}
        >
          {page.month}/{page.day}
        </button>
      </div>
      <div className="grid grid-cols-12 gap-0 text-[9px] leading-none tracking-[0.01em]">
        {months.map((month) => (
          <button
            key={month}
            className="flex min-w-0 items-center justify-center"
            style={{
              color: month === page.month ? page.color : "rgba(0,0,0,.38)",
            }}
            type="button"
            onClick={() => onMonthSelect(month)}
          >
            {month === page.month ? `(${month})` : month}
          </button>
        ))}
      </div>
    </div>
  );
}
function DatePickerModal({ page, onClose, onSelectDate }) {
  const parts = getDateParts(page.date);
  const [view, setView] = useState(() => ({
    year: Number(parts.year),
    month: Number(parts.month),
  }));
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const yearPickerRef = useRef(null);
  const activeYearRef = useRef(null);
  const days = getDaysInMonth(view.year, view.month);
  const blanks = Array.from(
    { length: getFirstWeekday(view.year, view.month) },
    (_, index) => `blank-${index}`,
  );
  const yearOptions = useMemo(
    () => Array.from({ length: 41 }, (_, index) => view.year - 20 + index),
    [view.year],
  );

  useLayoutEffect(() => {
    if (!isYearPickerOpen) return;

    const yearPicker = yearPickerRef.current;
    const activeYear = activeYearRef.current;

    if (!yearPicker || !activeYear) return;

    yearPicker.scrollTop =
      activeYear.offsetTop -
      yearPicker.clientHeight / 2 +
      activeYear.clientHeight / 2;
  }, [isYearPickerOpen, view.year]);

  const moveMonth = (offset) => {
    setView((current) => shiftMonth(current.year, current.month, offset));
  };
  const handleClose = () => {
    setIsYearPickerOpen(false);
    onClose();
  };

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end bg-black/18 px-4 pb-[calc(18px+env(safe-area-inset-bottom))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        className="absolute inset-0"
        type="button"
        aria-label="关闭日期选择"
        onClick={handleClose}
      />
      <motion.section
        className="relative w-full border bg-[#f3efe6] p-5 text-black/70"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        style={{ borderColor: page.line }}
      >
        <PaperTexture mode={page.texture} />
        <div
          className="relative mb-4 flex items-start justify-between border-b pb-3"
          style={{ borderBottomColor: page.color }}
        >
          <div className="relative">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-black/38">
              select date
            </div>
            <div
              className="mt-1 flex items-center gap-1 font-serif text-[28px] leading-none tracking-[0.08em]"
              style={{ color: page.color }}
            >
              <button
                className="p-0 font-serif text-[28px] leading-none tracking-[0.08em]"
                style={{
                  background: "transparent",
                  border: "none",
                  color: page.color,
                }}
                type="button"
                onClick={() => setIsYearPickerOpen((current) => !current)}
              >
                {view.year}
              </button>
              <span>.{pad2(view.month)}</span>
            </div>
            <AnimatePresence>
              {isYearPickerOpen && (
                <motion.div
                  ref={yearPickerRef}
                  className="year-picker-scroll absolute left-1/2 top-[52px] z-20 max-h-[168px] w-[124px] -translate-x-1/2 overflow-y-auto border p-2 shadow-[0_10px_24px_rgba(120,90,70,.12)]"
                  style={{
                    borderColor: `${page.color}38`,
                    background: "rgba(255,252,246,.96)",
                    borderRadius: 14,
                    scrollBehavior: "auto",
                  }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {yearOptions.map((year) => {
                    const active = year === view.year;

                    return (
                      <button
                        key={year}
                        ref={active ? activeYearRef : null}
                        className="flex min-h-8 w-full items-center justify-between px-2 text-[12px] leading-none"
                        style={{
                          color: active ? page.color : "#76685f",
                          background: active
                            ? `${page.color}18`
                            : "transparent",
                          borderRadius: 10,
                        }}
                        type="button"
                        onClick={() => {
                          setView((current) => ({
                            ...current,
                            year,
                          }));
                          setIsYearPickerOpen(false);
                        }}
                      >
                        <span>{year}</span>
                        <span>{active ? "✓" : ""}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/45"
            type="button"
            onClick={handleClose}
          >
            close
          </button>
        </div>
        <div className="relative mb-4 flex items-center justify-between font-mono text-[11px] tracking-[0.16em] text-black/50">
          <button
            className="px-1 py-2"
            type="button"
            onClick={() => moveMonth(-1)}
          >
            ← prev
          </button>
          <div>{pad2(view.month)} / 12</div>
          <button
            className="px-1 py-2"
            type="button"
            onClick={() => moveMonth(1)}
          >
            next →
          </button>
        </div>
        <div className="relative grid grid-cols-7 gap-y-3 pb-2 text-center font-mono">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((label) => (
            <div key={label} className="text-[8px] text-black/32">
              {label}
            </div>
          ))}
          {blanks.map((item) => (
            <div key={item} className="h-9" />
          ))}
          {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
            const dateText = formatDiaryDate(view.year, view.month, day);
            const selected = dateText === page.date;
            const marked = hasCalendarMarkForPage(page, dateText, undefined, {
              hasConversationForDate,
              hasRemoteDateIndexMark,
              getTimelineDay,
            });
            return (
              <button
                key={dateText}
                className="relative mx-auto flex h-9 w-9 items-center justify-center text-[12px]"
                style={{
                  color: selected
                    ? "#fff"
                    : marked
                      ? page.color
                      : "rgba(0,0,0,.48)",
                  background: selected ? page.color : "transparent",
                  border:
                    marked && !selected
                      ? `1px solid ${page.color}`
                      : "1px solid transparent",
                }}
                type="button"
                onClick={() => {
                  onSelectDate(dateText);
                  onClose();
                }}
              >
                {pad2(day)}
                {marked && !selected && (
                  <span
                    className="absolute -bottom-1 h-1 w-1 rounded-full"
                    style={{ background: page.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.section>
    </motion.div>
  );
}

function PageBottomMark({ page }) {
  return (
    <>
      <div className="absolute bottom-5 left-1 font-mono text-[10px] tracking-[0.1em] text-black/40">
        {page.date}
      </div>
      <div className="absolute bottom-12 right-1 scale-75 opacity-70">
        <TinyIcon color={page.color} />
      </div>
    </>
  );
}

function getMemoryContentKind(mode) {
  if (mode === "Diary" || mode === "Letters") return "prose";
  if (mode === "Openloops") return "checklist";
  if (mode === "Project") return "project";
  if (
    mode === "DailySummary" ||
    mode === "Letters" ||
    mode === "Facts" ||
    mode === "Preference" ||
    mode === "Patterns"
  )
    return "grouped";
  return "dated-list";
}

function getMemoryItemDate(text) {
  const value = String(text ?? "");
  const match = value.match(/[0-9]{4}-[0-9]{2}-[0-9]{2}/);
  return match?.[0] ?? "";
}

function stripMemoryItemDate(text) {
  const value = String(text ?? "");
  const dateText = getMemoryItemDate(value);
  if (!dateText || !value.startsWith(dateText)) return value;
  return value.slice(dateText.length).replace(/^[:： ]+/, "");
}

function MemoryContent({ page, highlightResult }) {
  const kind = getMemoryContentKind(page.mode);

  if (kind === "prose") {
    return <DiaryProseContent page={page} highlightResult={highlightResult} />;
  }

  if (kind === "summary") {
    return <SummaryMemoryContent page={page} highlightResult={highlightResult} />;
  }

  if (kind === "checklist") {
    return <ChecklistMemoryContent page={page} highlightResult={highlightResult} />;
  }

 if (
  page.mode === "Preference" ||
  page.mode === "Facts" ||
  page.mode === "Patterns"
) {
  return (
    <ContinuousStaticMemoryContent
      page={page}
      highlightResult={highlightResult}
    />
  );
}

  if (kind === "grouped") {
    return <GroupedMemoryContent page={page} highlightResult={highlightResult} />;
  }

  if (kind === "project") {
    return <ProjectMemoryContent page={page} highlightResult={highlightResult} />;
  }

  return <DatedMemoryContent page={page} highlightResult={highlightResult} />;
}

function DiaryProseContent({ page, highlightResult }) {
  return (
    <div className="space-y-6">
      {page.sections.map((item, index) => {
        const targetId = `${page.mode}-${page.dateBased ? page.date : "static"}-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="transition"
            style={{ background: active ? `${page.color}12` : "transparent" }}
          >
            {index > 0 && (
              <div
                className="mb-6 h-px w-16"
                style={{ background: page.line }}
              />
            )}
            {item.title && (
              <h3
                className="mb-2 font-serif text-[15px] leading-[1.32]"
                style={{ color: active ? page.color : "rgba(0,0,0,.78)" }}
              >
                <HighlightText
                  text={item.title}
                  query={active ? highlightResult?.query : ""}
                  color={page.color}
                />
              </h3>
            )}
            <p className="whitespace-pre-line text-[12px] leading-[2.05] tracking-[0.02em] text-black/66">
              <HighlightText
                text={item.text}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </p>
          </section>
        );
      })}
    </div>
  );
}

function SummaryMemoryContent({ page, highlightResult }) {
  return (
    <div className="space-y-3">
      {page.sections.map((item) => {
        const targetId = `${page.mode}-${page.date}-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="border bg-white/32 px-3 py-3 transition"
            style={{
              borderColor: active ? page.color : page.line,
              background: active ? `${page.color}12` : "rgba(255,255,255,.28)",
            }}
          >
            <h3
              className="font-serif text-[14px] leading-5"
              style={{ color: page.color }}
            >
              <HighlightText
                text={item.title}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </h3>
            <p className="mt-2 text-[11px] leading-[1.75] text-black/60">
              <HighlightText
                text={item.text}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </p>
          </section>
        );
      })}
    </div>
  );
}

function ChecklistMemoryContent({ page, highlightResult }) {
  return (
    <div className="space-y-3">
      {page.sections.map((item) => {
        const targetId = `${page.mode}-static-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        const checked = Boolean(item.checked);
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="flex gap-3 pb-1 transition"
            style={{
              background: active ? `${page.color}10` : "transparent",
            }}
          >
            <span
              className="mt-[6px] h-2 w-2 shrink-0 rounded-full border"
              style={{
                background: checked ? page.color : "transparent",
                borderColor: page.color,
                opacity: checked ? 0.42 : 0.72,
              }}
            />
            <p
              className={`min-w-0 flex-1 text-[11px] leading-[1.75] ${checked ? "text-black/34" : "text-black/56"}`}
            >
              <span
                className={`font-serif text-[12px] font-semibold ${checked ? "text-black/38 line-through decoration-black/20" : "text-black/68"}`}
              >
                <HighlightText
                  text={item.title}
                  query={active ? highlightResult?.query : ""}
                  color={page.color}
                />
              </span>
              {item.text && (
                <>
                  <span className="px-1.5 text-black/30">—</span>
                  <HighlightText
                    text={item.text}
                    query={active ? highlightResult?.query : ""}
                    color={page.color}
                  />
                </>
              )}
            </p>
          </section>
        );
      })}
    </div>
  );
}
function groupContinuousStaticSections(sections) {
  return sections.reduce((groups, item) => {
    const groupName = String(item.group ?? "").trim();

    let group = groups.find((entry) => entry.name === groupName);

    if (!group) {
      group = {
        name: groupName,
        items: [],
      };
      groups.push(group);
    }

    group.items.push(item);
    return groups;
  }, []);
}
function getContinuousStaticDisplayText(item) {
  const date = String(item.date ?? "").trim();
  const title = String(item.title ?? "").trim();
  const text = String(item.text ?? "").trim();
  const group = String(item.group ?? "").trim();

  let body = text;

  if (title && title !== group && title !== text) {
    body = body ? `${title}：${body}` : title;
  }

  if (date) {
    return body ? `${date}：${body}` : date;
  }

  return body;
}
function ContinuousStaticMemoryContent({ page, highlightResult }) {
  const groups = groupContinuousStaticSections(page.sections);

  return (
    <div className="space-y-8">
      {groups.map((group, groupIndex) => (
        <section
          key={group.name || `group-${groupIndex}`}
          className="relative pl-4"
        >
          {group.name && (
            <>
              <span
                className="absolute left-0 top-[7px] h-px w-2"
                style={{ background: page.color, opacity: 0.7 }}
              />

              <h3
                className="font-serif text-[15px] leading-5"
                style={{ color: page.color }}
              >
                {group.name}
              </h3>
            </>
          )}

          <div className={group.name ? "mt-3 space-y-2.5" : "space-y-2.5"}>
            {group.items.map((item) => {
              const targetId = `${page.mode}-static-${item.no}`;
              const active = highlightResult?.targetId === targetId;

              return (
                <p
                  id={`hit-${targetId}`}
                  key={item.no}
                  className="flex gap-2 text-[11px] leading-[1.9] text-black/56 transition"
                  style={{
                    background: active ? `${page.color}10` : "transparent",
                  }}
                >
                  <span
                    className="mt-[9px] h-1 w-1 shrink-0 rounded-full"
                    style={{ background: page.color, opacity: 0.55 }}
                  />

                  <span className="min-w-0 flex-1">
                    <HighlightText
                      text={getContinuousStaticDisplayText(item)}
                      query={active ? highlightResult?.query : ""}
                      color={page.color}
                    />
                  </span>
                </p>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
function GroupedMemoryContent({ page, highlightResult }) {
  return (
    <div className="space-y-4">
      {page.sections.map((item) => {
        const targetId = `${page.mode}-${page.dateBased ? page.date : "static"}-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="relative pl-4 transition"
            style={{ background: active ? `${page.color}10` : "transparent" }}
          >
            <span
              className="absolute left-0 top-[7px] h-px w-2"
              style={{ background: page.color, opacity: 0.7 }}
            />
            <h3
              className="font-serif text-[14px] leading-5"
              style={{ color: page.color }}
            >
              <HighlightText
                text={item.title}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </h3>
            <p className="mt-2 text-[11px] leading-[1.78] text-black/56">
              <HighlightText
                text={item.text}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </p>
          </section>
        );
      })}
    </div>
  );
}

function ProjectMemoryContent({ page, highlightResult }) {
  return (
    <div className="relative space-y-5 pl-4">
      <div
        className="absolute bottom-1 left-[4px] top-1 w-px"
        style={{ background: page.line }}
      />
      {page.sections.map((item) => {
        const targetId = `${page.mode}-static-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        const dateText =
          item.date || getMemoryItemDate(item.text) || getMemoryItemDate(item.title);
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="relative pl-4 transition"
            style={{ background: active ? `${page.color}10` : "transparent" }}
          >
            <span
              className="absolute -left-[16px] top-[6px] h-2 w-2 rounded-full border bg-[#f7f5ee]"
              style={{ borderColor: page.color }}
            />
            <div className="mb-1 flex items-center gap-2">
              <span
                className="font-mono text-[8px] uppercase tracking-[0.12em]"
                style={{ color: page.color }}
              >
                {dateText || `step ${pad2(item.no)}`}
              </span>
              <span
                className="h-px flex-1"
                style={{ background: page.line }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-[1.78] text-black/56">
              <HighlightText
                text={stripMemoryItemDate(item.text)}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </p>
          </section>
        );
      })}
    </div>
  );
}

function DatedMemoryContent({ page, highlightResult }) {
  return (
    <div className="space-y-4">
      {page.sections.map((item) => {
        const targetId = `${page.mode}-static-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        const dateText =
          getMemoryItemDate(item.text) || getMemoryItemDate(item.title);
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="grid grid-cols-[58px_1fr] gap-3 transition"
            style={{ background: active ? `${page.color}10` : "transparent" }}
          >
            <div className="pt-[2px] font-mono text-[8px] leading-4 tracking-[0.08em] text-black/34">
              {dateText || `NO.${pad2(item.no)}`}
            </div>
            <div className="min-w-0 border-b pb-3 last:border-b-0" style={{ borderBottomColor: page.line }}>
              <h3 className="font-serif text-[13px] leading-5 text-black/70">
                <HighlightText
                  text={stripMemoryItemDate(item.title)}
                  query={active ? highlightResult?.query : ""}
                  color={page.color}
                />
              </h3>
              <p className="mt-1 text-[11px] leading-[1.7] text-black/54">
                <HighlightText
                  text={stripMemoryItemDate(item.text)}
                  query={active ? highlightResult?.query : ""}
                  color={page.color}
                />
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function getDiaryShareExcerpt(page) {
  const lineBreak = String.fromCharCode(10);
  const dividerBreak = `${lineBreak}---${lineBreak}`;
  const text = page.sections
    .map((item) => item.text)
    .filter(Boolean)
    .join(lineBreak);
  const firstBlock = text.split(dividerBreak)[0]?.trim() || page.excerpt || "";
  return firstBlock.length > 170
    ? `${firstBlock.slice(0, 170).trim()}...`
    : firstBlock;
}

function getDiaryShareLongText(page) {
  const lineBreak = String.fromCharCode(10);
  const text = page.sections
    .map((item) => item.text)
    .filter(Boolean)
    .join(lineBreak);
  return text.length > 760 ? `${text.slice(0, 760).trim()}...` : text;
}

function DiaryShareText({ text, className }) {
  const lineBreak = String.fromCharCode(10);
  const paragraphs = String(text ?? "")
    .split(lineBreak)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 8)}`} className="mb-2 last:mb-0">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

const shareTemplateBackgrounds = {
  tag: "#fbf6ea",
  rain: "#edf3f1",
  paper: "#f4eee4",
};

function getShareExportFileName(page, template) {
  const mode = page.mode === "Letters" ? "letters" : "diary";
  const dateText = toHyphenDate(page.date);
  return `murmur-lane-${mode}-${dateText}-${template}.png`;
}

function getShareButtonLabel(saveStatus) {
  if (saveStatus === "saving") return "saving...";
  if (saveStatus === "saved") return "saved";
  if (saveStatus === "error") return "retry";
  return "save image";
}

function downloadShareImage(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function createShareImageFile(dataUrl, fileName) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: "image/png" });
}

function DiaryShareModal({ page, onClose }) {
  const shareCardRef = useRef(null);
  const [shareTemplate, setShareTemplate] = useState("tag");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const excerpt = getDiaryShareExcerpt(page);
  const longText = getDiaryShareLongText(page);
  const shareBackgroundColor =
    shareTemplateBackgrounds[shareTemplate] ?? shareTemplateBackgrounds.tag;

  const handleSaveImage = async () => {
    if (!shareCardRef.current) return;
    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const pixelRatio =
        window.devicePixelRatio >= 3
          ? 3
          : window.devicePixelRatio >= 2
            ? 2
            : 2;
      const dataUrl = await toPng(shareCardRef.current, {
        pixelRatio,
        cacheBust: true,
        backgroundColor: shareBackgroundColor,
      });
      const fileName = getShareExportFileName(page, shareTemplate);

      if (navigator.share && navigator.canShare) {
        const file = await createShareImageFile(dataUrl, fileName);
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: page.title,
          });
          setSaveStatus("saved");
          return;
        }
      }

      downloadShareImage(dataUrl, fileName);
      setSaveStatus("saved");
    } catch (error) {
      if (error?.name === "AbortError") {
        setSaveStatus("idle");
        return;
      }
      console.error("Failed to export share image", error);
      setSaveStatus("error");
      setSaveMessage("保存失败，请稍后再试");
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/24 px-5 py-[calc(20px+env(safe-area-inset-top))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        className="absolute inset-0"
        type="button"
        aria-label="关闭分享预览"
        onClick={onClose}
      />
      <motion.section
        className="share-scroll relative max-h-[82dvh] w-full max-w-[342px] overflow-y-auto border bg-[#f3eee4] p-4 shadow-[0_24px_80px_rgba(64,44,26,.22)]"
        initial={{ y: 14, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.97 }}
        style={{ borderColor: page.line }}
      >
        <PaperTexture mode="warm" />
        <div className="relative mb-3 flex items-center justify-between">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-black/38">
            share diary
          </div>
          <button
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/45"
            type="button"
            onClick={onClose}
          >
            close
          </button>
        </div>
        <div className="relative mb-3 grid grid-cols-3 gap-1 font-mono text-[9px] uppercase tracking-[0.12em]">
          {[
            { id: "tag", label: "摘要" },
            { id: "rain", label: "雨滴" },
            { id: "paper", label: "旧纸" },
          ].map((item) => (
            <button
              key={item.id}
              className="px-2 py-2"
              type="button"
              style={{
                color:
                  shareTemplate === item.id ? page.color : "rgba(0,0,0,.42)",
                background:
                  shareTemplate === item.id ? page.pale : "transparent",
              }}
              onClick={() => {
                setShareTemplate(item.id);
                setSaveStatus("idle");
                setSaveMessage("");
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div ref={shareCardRef}>
          {shareTemplate === "tag" ? (
            <div className="relative mx-auto w-[286px] bg-[#fbf6ea] px-7 pb-8 pt-10 text-center shadow-[0_16px_42px_rgba(96,69,38,.10)]">
              <PaperTexture mode="warm" />
              <div className="absolute left-1/2 top-3 h-4 w-4 -translate-x-1/2 rounded-full bg-[#f3eee4] shadow-inner" />
              <div className="absolute left-1/2 top-1 h-px w-24 -translate-x-1/2 rotate-[-8deg] bg-[#9b8064]/45" />
              <div className="absolute left-1/2 top-1 h-px w-24 -translate-x-1/2 rotate-[8deg] bg-[#9b8064]/40" />
              <div className="relative mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-black/38">
                {page.date} · diary archive
              </div>
              <h3
                className="relative mt-6 font-serif text-[24px] leading-[1.25] tracking-[0.08em]"
                style={{ color: page.color }}
              >
                {page.title}
              </h3>
              <DiaryShareText
                text={excerpt}
                className="relative mt-4 text-left font-serif text-[13px] leading-[1.72] tracking-[0.02em] text-black/62"
              />
              <div
                className="relative mt-5 font-serif text-[18px] leading-none"
                style={{ color: page.color }}
              >
                ✦
              </div>
              <div className="relative mt-4 font-mono text-[8px] uppercase tracking-[0.18em] text-black/34">
                from memory carrier
              </div>
            </div>
          ) : shareTemplate === "rain" ? (
            <div className="relative mx-auto w-[286px] overflow-hidden bg-[#edf3f1] px-7 pb-9 pt-8 text-left shadow-[0_16px_42px_rgba(71,91,86,.12)]">
              <PaperTexture mode="light" />
              <div className="pointer-events-none absolute inset-0 opacity-35">
                {Array.from({ length: 20 }, (_, index) => (
                  <span
                    key={index}
                    className="absolute font-serif text-[13px] leading-none text-[#7faab0]"
                    style={{
                      left: `${7 + ((index * 17) % 84)}%`,
                      top: `${5 + ((index * 23) % 88)}%`,
                      transform: `rotate(${index % 2 === 0 ? -16 : 14}deg)`,
                    }}
                  >
                    ꧞
                  </span>
                ))}
              </div>
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-black/38">
                    rain diary
                  </div>
                  <div className="mt-1 font-mono text-[9px] tracking-[0.16em] text-black/34">
                    {page.date}
                  </div>
                </div>
                <div className="font-serif text-[16px] leading-none text-[#7faab0]">
                  ♡
                </div>
              </div>
              <h3 className="relative mt-5 font-serif text-[23px] leading-[1.22] tracking-[0.06em] text-[#5f7773]">
                {page.title}
              </h3>
              <DiaryShareText
                text={longText}
                className="relative mt-4 font-serif text-[11px] leading-[1.62] tracking-[0.02em] text-black/62"
              />
              <div className="relative mt-5 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-black/34">
                <span className="h-px flex-1 bg-[#9bbdb9]/45" />
                <span>rain marks / soft archive</span>
                <span className="h-px flex-1 bg-[#9bbdb9]/45" />
              </div>
            </div>
          ) : (
            <div className="relative mx-auto w-[286px] overflow-hidden bg-[#f4eee4] px-7 pb-9 pt-8 text-left shadow-[0_16px_42px_rgba(84,65,45,.10)]">
              <PaperTexture mode="warm" />

              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/36">
                    {page.date}
                  </div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-black/28">
                    handwritten archive
                  </div>
                </div>
                <div className="font-serif text-[17px] leading-none text-[#8a745f]">
                  ✎
                </div>
              </div>
              <h3 className="relative mt-5 font-serif text-[25px] leading-[1.22] tracking-[0.04em] text-[#705b49]">
                {page.title}
              </h3>
              <DiaryShareText
                text={longText}
                className="relative mt-4 font-serif text-[12px] leading-[1.66] tracking-[0.02em] text-black/62"
              />
              <div className="relative mt-5 flex items-center justify-between gap-3">
                <span className="font-serif text-[15px] text-[#8a745f]">✧</span>
                <span className="h-px flex-1 bg-[#b9a58d]/45" />
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-black/34">
                  memory note
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
          <button
            className="border px-3 py-2"
            type="button"
            disabled={saveStatus === "saving"}
            style={{
              borderColor: page.color,
              color: page.color,
              background: page.pale,
            }}
            onClick={handleSaveImage}
          >
            {getShareButtonLabel(saveStatus)}
          </button>
          <button
            className="border px-3 py-2 text-black/45"
            type="button"
            style={{ borderColor: page.line }}
            onClick={onClose}
          >
            cancel
          </button>
        </div>
        {saveMessage && (
          <div className="relative mt-3 text-center font-serif text-[11px] text-black/45">
            {saveMessage}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}

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

function TimelineModeSwitch({ page, selectedView, onSelectView }) {
  const items = [
    { id: "line", label: "时间轴" },
    { id: "stats", label: "统计" },
    { id: "reminders", label: "提醒" },
  ];
  return (
    <div className="mb-3 grid grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-[0.1em]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="border px-3 py-2"
          style={{
            color: selectedView === item.id ? page.color : "rgba(0,0,0,.45)",
            borderColor: selectedView === item.id ? page.color : page.line,
            background:
              selectedView === item.id ? page.pale : "rgba(255,255,255,.18)",
          }}
          onClick={() => onSelectView(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
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

function SwipeDateArea({ children, onSwipeDate }) {
  const gestureRef = useRef(null);

  return (
    <div
      style={{ touchAction: "pan-y" }}
      onPointerDown={(event) => {
        gestureRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
        };
      }}
      onPointerUp={(event) => {
        if (
          !gestureRef.current ||
          gestureRef.current.pointerId !== event.pointerId
        ) {
          return;
        }

        const offsetX = event.clientX - gestureRef.current.startX;
        const offsetY = event.clientY - gestureRef.current.startY;
        gestureRef.current = null;

        if (
          Math.abs(offsetX) > 88 &&
          Math.abs(offsetX) > Math.abs(offsetY)
        ) {
          onSwipeDate(offsetX > 0 ? -1 : 1);
        }
      }}
      onPointerCancel={() => {
        gestureRef.current = null;
      }}
    >
      {children}
    </div>
  );
}

function BottomNav({ activeSection, onSelectSection, page }) {
  const items = [
    { id: "Conversation", label: "对话" },
    { id: "Timeline", label: "时间轴" },
    { id: "Archive", label: "回忆" },
    { id: "Xiaoye", label: "小叶" },
  ];
  return (
    <nav
      className="z-30 shrink-0 border-t bg-[#eeeae1]/95 px-3 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur"
      style={{ borderColor: page.line }}
    >
      <div className="grid grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="border px-2 py-2"
            style={{
              color: activeSection === item.id ? page.color : "rgba(0,0,0,.45)",
              borderColor: activeSection === item.id ? page.color : page.line,
              background: activeSection === item.id ? page.pale : "transparent",
            }}
            onClick={() => onSelectSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
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



