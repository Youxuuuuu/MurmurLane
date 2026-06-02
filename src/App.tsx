// @ts-nocheck
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
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
import { xiaoyeModeMeta, xiaoyeModes } from "./config/pageModes";
import { styleThemes } from "./config/theme";
import {
  diaryEntries,
  letterEntries,
} from "./data/mockEntries";
import {
  changeDateMonth,
  getTodayDateText,
  shiftDate,
  toDotDate,
} from "./lib/date";
import { scrollHitIntoView } from "./lib/dom";
import {
  buildConversationPage,
  defaultConversationThreadId,
  getAllConversationThreadIds,
  getLatestConversationThreadId,
  groupConversationRecordsByThread,
} from "./lib/conversationPageData";
import {
  buildMemoryPage,
  buildXiaoyePage,
  getRemoteDatedEntriesSource,
  getRemoteEntryByDate,
} from "./lib/memoryPageData";
import { buildTimelinePage } from "./lib/timelinePageData";
import { DatePickerModal } from "./components/calendar/DatePickerModal";
import { DirectoryPage } from "./components/archive/DirectoryPage";
import { ConversationPage } from "./components/conversation/ConversationPage";
import { TimelinePage } from "./components/timeline/TimelinePage";
import { XiaoyePage } from "./components/xiaoye/XiaoyePage";
import { AppScrollbarStyle } from "./components/layout/AppScrollbarStyle";
import { BottomNav } from "./components/layout/BottomNav";
import { SwipeDateArea } from "./components/layout/SwipeDateArea";
import { DiarySearchBox } from "./components/search/DiarySearchBox";
import { SegmentSwitch } from "./components/controls/SegmentSwitch";
import { ThreadSwitch } from "./components/controls/ThreadSwitch";
import { ThemeIconButton } from "./components/controls/ThemeIconButton";
import { TimelineModeSwitch } from "./components/controls/TimelineModeSwitch";
import { validateAppData } from "./dev/validateAppData";

const ENABLE_APP_DEBUG_LOG = false;

if (import.meta.env.DEV && typeof console !== "undefined")
  console.assert(
    validateAppData(),
    "Prototype data and timeline layout should be valid.",
  );

const themeIconByStyleId = {
  plant: {
    viewBox: "0 0 1024 1024",
    path: "M450.56 128h61.44v768H450.56zM512 128h61.44v768h-61.44z",
  },
  tree: {
    viewBox: "0 0 1025 1024",
    path: "M450.56 128h61.44v768H450.56zM512 128h61.44v768h-61.44z",
  },
  cafe: {
    viewBox: "0 0 1024 1024",
    path: "M450.56 128h61.44v768H450.56zM512 128h61.44v768h-61.44z",
  },
  flower: {
    viewBox: "0 0 1024 1024",
    path: "M450.56 128h61.44v768H450.56zM512 128h61.44v768h-61.44z",
  },
};

const archiveSubjectItems = [
  { id: "Me", label: "我" },
  { id: "Xiaoye", label: "小叶" },
];

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
  const [archiveSubject, setArchiveSubject] = useState("Me");
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
  const [remoteSearchMissingState, setRemoteSearchMissingState] = useState({
    diary: {},
    dailySummary: {},
    letters: {},
  });
  const [searchQuery, setSearchQuery] = useState("");
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

    if (import.meta.env.DEV && ENABLE_APP_DEBUG_LOG) {
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
    };

    loadDatedData();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    const normalizedQuery = String(searchQuery ?? "").trim();

    if (!normalizedQuery || !remoteDateIndexState) {
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
          remoteSearchMissingState.diary[date] ||
          searchPendingRef.current.diary.has(date),
      );
    const isDailySummaryDateCached = (date) =>
      Boolean(
        remoteDailySummaryEntriesState[date] ||
          remoteSearchCacheState.dailySummary[date] ||
          remoteSearchMissingState.dailySummary[date] ||
          searchPendingRef.current.dailySummary.has(date),
      );
    const isLettersDateCached = (date) =>
      Boolean(
        remoteLetterEntriesState[date] ||
          remoteSearchCacheState.letters[date] ||
          remoteSearchMissingState.letters[date] ||
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
      return;
    }

    const loadSearchData = async () => {
      const concurrency = 4;
      let cursor = 0;
      const pendingSearchCache = {
        conversations: {},
        diary: {},
        dailySummary: {},
        letters: {},
      };
      const pendingMissingCache = {
        diary: {},
        dailySummary: {},
        letters: {},
      };

      const runTask = async () => {
        while (!cancelled && cursor < tasks.length) {
          const task = tasks[cursor];
          cursor += 1;
          searchPendingRef.current[task.type].add(task.date);

          try {
            const result = await task.loader();
            if (cancelled) continue;

            if (task.type === "conversations") {
              if (Array.isArray(result)) {
                pendingSearchCache.conversations[task.date] = result.length
                  ? groupConversationRecordsByThread(result)
                  : {};
              }
            } else if (result?.found === true && result?.entry) {
              pendingSearchCache[task.type][task.date] = result.entry;
            } else if (result?.found === false) {
              pendingMissingCache[task.type][task.date] = true;
            }
          } catch (error) {
            if (import.meta.env.DEV && !cancelled) {
              console.debug(
                "[MurmurLane Debug] remote search task failed",
                task.type,
                task.date,
                error,
              );
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
        const hasPendingSearchCache =
          Object.keys(pendingSearchCache.conversations).length > 0 ||
          Object.keys(pendingSearchCache.diary).length > 0 ||
          Object.keys(pendingSearchCache.dailySummary).length > 0 ||
          Object.keys(pendingSearchCache.letters).length > 0;
        const hasPendingMissingCache =
          Object.keys(pendingMissingCache.diary).length > 0 ||
          Object.keys(pendingMissingCache.dailySummary).length > 0 ||
          Object.keys(pendingMissingCache.letters).length > 0;

        if (hasPendingSearchCache) {
          setRemoteSearchCacheState((current) => ({
            ...current,
            conversations: {
              ...current.conversations,
              ...pendingSearchCache.conversations,
            },
            diary: {
              ...current.diary,
              ...pendingSearchCache.diary,
            },
            dailySummary: {
              ...current.dailySummary,
              ...pendingSearchCache.dailySummary,
            },
            letters: {
              ...current.letters,
              ...pendingSearchCache.letters,
            },
          }));
        }
        if (hasPendingMissingCache) {
          setRemoteSearchMissingState((current) => ({
            ...current,
            diary: {
              ...current.diary,
              ...pendingMissingCache.diary,
            },
            dailySummary: {
              ...current.dailySummary,
              ...pendingMissingCache.dailySummary,
            },
            letters: {
              ...current.letters,
              ...pendingMissingCache.letters,
            },
          }));
        }
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
    remoteSearchMissingState,
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
  const archiveShowsXiaoye =
    activeSection === "Xiaoye" ||
    (activeSection === "Archive" && archiveSubject === "Xiaoye");
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
    if (archiveShowsXiaoye)
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
    archiveSubject,
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
  const topToolbarControl =
    activeSection === "Conversation" ? (
      <ThreadSwitch
        page={page}
        selectedThreadId={selectedThreadId}
        onSelectThread={handleSelectThread}
        threadIds={availableThreadIds}
      />
    ) : activeSection === "Timeline" ? (
      <TimelineModeSwitch
        page={page}
        selectedView={timelineView}
        onSelectView={setTimelineView}
        className="w-[210px]"
      />
    ) : (
      <SegmentSwitch
        page={page}
        items={archiveSubjectItems}
        selectedId={archiveSubject}
        onSelect={setArchiveSubject}
      />
    );

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
        className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden border-x bg-[#eeeae1] px-4 pt-[calc(12px+env(safe-area-inset-top))] sm:h-[852px] sm:w-[393px] sm:border sm:pt-3.5"
        style={{ borderColor: page.line }}
      >
        
        <div
          key={`${activeSection}-${archiveSubject}-${timelineView}`}
          className={`diary-scroll flex-1 overflow-x-hidden overscroll-contain pb-4 ${
            activeSection === "Conversation" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          <header
            className="sticky top-0 z-[80] mb-3 border-b bg-[#eeeae1]/95 pb-2 pt-1 backdrop-blur-[2px]"
            style={{ borderBottomColor: page.line }}
          >
            <div
              className={`grid items-center gap-1.5 ${
                activeSection === "Timeline"
                  ? "grid-cols-[minmax(0,1fr)_auto]"
                  : "grid-cols-[auto_minmax(0,1fr)_auto]"
              }`}
            >
              {activeSection !== "Timeline" &&(
              <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
                {styleThemes.map((item, index) => {
                  const icon = themeIconByStyleId[item.id];

                  return (
                    <ThemeIconButton
                      key={item.id}
                      label={`Theme ${index + 1}`}
                      viewBox={icon.viewBox}
                      path={icon.path}
                      selected={selectedStyleId === item.id}
                      accentColor={page.color}
                      onClick={() => setSelectedStyleId(item.id)}
                    />
                  );
                })}
              </div>
              )}
              <div
                className={`flex min-w-0 items-center overflow-visible ${
                  activeSection === "Timeline" ? "justify-start" : "justify-center"
                }`}
              >
                {topToolbarControl}
              </div>
              <div className="flex min-w-0 items-center justify-end">
                <DiarySearchBox
                  page={page}
                  selectedDate={selectedDate}
                  selectedThreadId={selectedThreadId}
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
                      setActiveSection("Archive");
                      setArchiveSubject("Xiaoye");
                      if (result.xiaoyeMode) {
                        setSelectedXiaoyeMode(result.xiaoyeMode);
                      }
                    } else {
                      setActiveSection("Archive");
                      setArchiveSubject("Me");
                      setSelectedMode(result.mode);
                    }
                    if (isValidDotDate(result.date)) setSelectedDate(result.date);
                    setHighlightResult(result);
                  }}
                />
              </div>
            </div>
          </header>
          
          <div className="mt-3 pb-8">
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
                    scrollHitIntoView={scrollHitIntoView}
                  />
                ) : archiveShowsXiaoye ? (
                  <XiaoyePage
                    page={page}
                    highlightResult={highlightResult}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                    onSelectXiaoyeMode={setSelectedXiaoyeMode}
                    selectedXiaoyeMode={selectedXiaoyeMode}
                    scrollHitIntoView={scrollHitIntoView}
                  />
                ) : (
                  <DirectoryPage
                    page={page}
                    highlightResult={highlightResult}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                    onOpenShare={() => setDiaryShareOpen(true)}
                    onSelectMode={setSelectedMode}
                    selectedMode={selectedMode}
                    diaryShareOpen={
                      diaryShareOpen &&
                      activeSection === "Archive" &&
                      archiveSubject === "Me"
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
          activeSection={
            activeSection === "Xiaoye" ? "Archive" : activeSection
          }
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



