// @ts-nocheck
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  fetchEditableMemoryDocument,
  fetchConversations,
  fetchConversationMoments,
  fetchDateIndex,
  fetchMemoryDailySummary,
  fetchMemoryDiary,
  fetchMemoryLetters,
  fetchMemoryStatic,
  fetchReminderHistory,
  fetchTimeline,
  toggleOpenLoopsChecklistItem as toggleOpenLoopsChecklistItemApi,
  fetchXiaoyeStatic,
  HAS_EDIT_TOKEN,
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
  buildConversationThreadPage,
  defaultConversationThreadId,
  getAllConversationThreadIds,
  getLatestConversationThreadId,
  getConversationThreadSummaries,
  groupConversationRecordsByThread,
} from "./lib/conversationPageData";
import {
  buildMemoryPage,
  buildXiaoyePage,
  getRemoteDatedEntriesSource,
  getRemoteEntryByDate,
} from "./lib/memoryPageData";
import {
  applyOpenLoopToggleToEntry,
  removeDateIndexDate,
  upsertDateIndexDate,
} from "./lib/editableMemory";
import { buildTimelinePage } from "./lib/timelinePageData";
import { DatePickerModal } from "./components/calendar/DatePickerModal";
import { DiaryShareModal } from "./components/archive/DiaryShareModal";
import { DirectoryPage } from "./components/archive/DirectoryPage";
import { ConversationPage } from "./components/conversation/ConversationPage";
import { ConversationListPage } from "./components/conversation/ConversationListPage";
import { ConversationHeader } from "./components/conversation/ConversationHeader";
import { ConversationPlaceholderPage } from "./components/conversation/ConversationPlaceholderPage";
import { ConversationSearchPage } from "./components/conversation/ConversationSearchPage";
import { ConversationGlobalSearchPage } from "./components/conversation/ConversationGlobalSearchPage";
import { ConversationSettingsModal } from "./components/conversation/ConversationSettingsModal";
import { TimelinePage } from "./components/timeline/TimelinePage";
import { XiaoyePage } from "./components/xiaoye/XiaoyePage";
import { AppShell } from "./components/layout/AppShell";
import { BottomNav } from "./components/layout/BottomNav";
import { SwipeDateArea } from "./components/layout/SwipeDateArea";
import { PageViewport } from "./components/layout/PageViewport";
import { DiarySearchBox } from "./components/search/DiarySearchBox";
import { SegmentSwitch } from "./components/controls/SegmentSwitch";
import { ThemeIconButton } from "./components/controls/ThemeIconButton";
import { TimelineModeSwitch } from "./components/controls/TimelineModeSwitch";
import { validateAppData } from "./dev/validateAppData";
import { useConversationProfiles } from "./lib/conversationProfiles";

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
  const [conversationView, setConversationView] = useState("list");
  const [conversationSettingsMode, setConversationSettingsMode] = useState(null);
  const [conversationPlaceholder, setConversationPlaceholder] = useState(null);
  const [conversationMoments, setConversationMoments] = useState([]);
  const [conversationDateLoading, setConversationDateLoading] = useState(false);
  const [conversationJumpDate, setConversationJumpDate] = useState(null);
  const [conversationFloatingDate, setConversationFloatingDate] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState(
    defaultConversationThreadId,
  );
  const [timelineView, setTimelineView] = useState("line");
  const [statsPeriod, setStatsPeriod] = useState("day");
  const [highlightResult, setHighlightResult] = useState(null);
  const [diaryShareOpen, setDiaryShareOpen] = useState(false);
  const [selectedShareText, setSelectedShareText] = useState("");
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
  const [editAccessState, setEditAccessState] = useState({
    ready: false,
    canWrite: false,
    message: "",
  });
  const threadSelectionTouchedRef = useRef(false);
  const searchPendingRef = useRef({
    conversations: new Set(),
    diary: new Set(),
    dailySummary: new Set(),
    letters: new Set(),
  });

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    let stableHeight = Math.max(
      window.innerHeight || 0,
      window.visualViewport?.height || 0,
    );
    const resetDocumentScroll = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const applyStableViewport = () => {
      const visualViewport = window.visualViewport;
      const currentLayoutHeight = window.innerHeight || 0;
      const currentVisualHeight = visualViewport?.height || 0;
      const currentVisualOffsetTop = visualViewport?.offsetTop || 0;
      const candidateHeight = Math.max(currentLayoutHeight, currentVisualHeight);
      const nextKeyboardInset = Math.max(
        0,
        stableHeight - currentVisualHeight - currentVisualOffsetTop,
      );
      const keyboardIsOpen = nextKeyboardInset > 80;

      if (!keyboardIsOpen || candidateHeight > stableHeight) {
        stableHeight = candidateHeight;
      }
      const keyboardInset = Math.max(
        0,
        stableHeight - currentVisualHeight - currentVisualOffsetTop,
      );

      document.documentElement.style.setProperty(
        "--app-stable-height",
        `${Math.round(stableHeight)}px`,
      );
      document.documentElement.style.setProperty(
        "--app-keyboard-inset",
        `${Math.round(keyboardInset)}px`,
      );
      document.documentElement.style.setProperty(
        "--app-keyboard-center-offset",
        `${Math.round(keyboardInset / 2)}px`,
      );

      window.requestAnimationFrame(resetDocumentScroll);
    };

    applyStableViewport();
    window.addEventListener("resize", applyStableViewport);
    window.addEventListener("blur", resetDocumentScroll);
    window.addEventListener("focusout", resetDocumentScroll);
    document.addEventListener("visibilitychange", resetDocumentScroll);
    window.visualViewport?.addEventListener("scroll", applyStableViewport);
    window.visualViewport?.addEventListener("resize", applyStableViewport);

    return () => {
      window.removeEventListener("resize", applyStableViewport);
      window.removeEventListener("blur", resetDocumentScroll);
      window.removeEventListener("focusout", resetDocumentScroll);
      document.removeEventListener("visibilitychange", resetDocumentScroll);
      window.visualViewport?.removeEventListener("scroll", applyStableViewport);
      window.visualViewport?.removeEventListener("resize", applyStableViewport);
    };
  }, []);

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
  const {
    userProfile,
    setUserProfile,
    threadProfiles,
    updateThreadProfile,
  } = useConversationProfiles(availableThreadIds);
  const conversationThreadSummaries = useMemo(
    () => getConversationThreadSummaries(availableThreadIds, remoteData),
    [availableThreadIds, remoteData],
  );
  const selectedThreadDates = useMemo(
    () =>
      (remoteDateIndexState?.conversationThreads?.[selectedThreadId] ?? [])
        .map(toDotDate)
        .sort(),
    [remoteDateIndexState, selectedThreadId],
  );
  const allConversationDates = useMemo(
    () =>
      (remoteDateIndexState?.conversations ?? []).map(toDotDate).sort(),
    [remoteDateIndexState],
  );
  const loadedSelectedThreadDates = useMemo(
    () =>
      selectedThreadDates.filter(
        (date) =>
          Boolean(remoteConversationsState[date]?.[selectedThreadId]) ||
          Boolean(remoteSearchCacheState.conversations[date]?.[selectedThreadId]),
      ),
    [
      selectedThreadDates,
      selectedThreadId,
      remoteConversationsState,
      remoteSearchCacheState.conversations,
    ],
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
        editStatusResult,
        ...staticAndXiaoyeResults
      ] =
        await Promise.allSettled([
          fetchTimeline(),
          fetchDateIndex(),
          fetchReminderHistory(),
          fetchEditableMemoryDocument({
            documentType: "static-memory-document",
            documentId: "preferences",
          }),
          ...staticRequests.map(([, mode]) => fetchMemoryStatic(mode)),
          ...xiaoyeRequests.map(([, mode]) => fetchXiaoyeStatic(mode)),
        ]);
      const staticResults = staticAndXiaoyeResults.slice(
        0,
        staticRequests.length,
      );
      const xiaoyeResults = staticAndXiaoyeResults.slice(staticRequests.length);

      if (cancelled) return;

      if (editStatusResult.status === "fulfilled") {
        const backendWriteEnabled = editStatusResult.value?.writeEnabled === true;
        const canWrite = backendWriteEnabled && HAS_EDIT_TOKEN;
        const message = canWrite
          ? ""
          : backendWriteEnabled && !HAS_EDIT_TOKEN
            ? "编辑已关闭：未配置前端编辑 token。"
            : !backendWriteEnabled && HAS_EDIT_TOKEN
              ? "编辑已关闭：服务端未配置编辑 token。"
              : "编辑已关闭：未配置编辑 token。";

        setEditAccessState({
          ready: true,
          canWrite,
          message,
        });
      } else {
        setEditAccessState({
          ready: true,
          canWrite: false,
          message: "编辑状态不可用。",
        });
      }

      if (
        timelineResult.status === "fulfilled" &&
        timelineResult.value &&
        timelineResult.value.found !== false &&
        typeof timelineResult.value === "object"
      ) {
        const timelineFacts = timelineResult.value.facts ?? timelineResult.value;
        const nextTimelineDates = Object.fromEntries(
          Object.entries(timelineFacts)
            .filter(([, value]) => value?.events)
            .map(([key, value]) => [toDotDate(key), value]),
        );
        const nextTimelineState = {
          ...nextTimelineDates,
          ...(timelineResult.value.taxonomy
            ? { taxonomy: timelineResult.value.taxonomy }
            : {}),
          ...(timelineResult.value.version != null
            ? { version: timelineResult.value.version }
            : {}),
          ...(timelineResult.value.timezone
            ? { timezone: timelineResult.value.timezone }
            : {}),
          ...(Array.isArray(timelineResult.value.proposals)
            ? { proposals: timelineResult.value.proposals }
            : {}),
        };
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
    let cancelled = false;

    fetchConversationMoments(3)
      .then((result) => {
        if (!cancelled) setConversationMoments(result.moments ?? []);
      })
      .catch(() => {
        if (!cancelled) setConversationMoments([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      activeSection !== "Conversation" ||
      conversationView !== "list" ||
      !remoteDateIndexState
    )
      return;

    const threadIndex = remoteDateIndexState.conversationThreads ?? {};
    const requestedDates = Object.values(threadIndex)
      .map((dates) => dates?.[dates.length - 1])
      .filter(Boolean);
    const dates = Array.from(new Set(requestedDates.map(toDotDate))).filter(
      (date) =>
        !remoteConversationsState[date] &&
        !remoteSearchCacheState.conversations[date] &&
        !searchPendingRef.current.conversations.has(date),
    );

    if (!dates.length) return;

    let cancelled = false;
    dates.forEach((date) => searchPendingRef.current.conversations.add(date));

    const loadThreadDates = async () => {
      const results = await Promise.allSettled(
        dates.map((date) => fetchConversations(date)),
      );
      if (cancelled) return;

      const conversations = {};
      results.forEach((result, index) => {
        const date = dates[index];
        searchPendingRef.current.conversations.delete(date);
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
          conversations[date] = result.value.length
            ? groupConversationRecordsByThread(result.value)
            : {};
        }
      });

      if (Object.keys(conversations).length) {
        setRemoteSearchCacheState((current) => ({
          ...current,
          conversations: { ...current.conversations, ...conversations },
        }));
      }
    };

    loadThreadDates();
    return () => {
      cancelled = true;
      dates.forEach((date) => searchPendingRef.current.conversations.delete(date));
    };
  }, [
    activeSection,
    conversationView,
    remoteDateIndexState,
    remoteConversationsState,
    remoteSearchCacheState.conversations,
  ]);

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

  const handleMemoryEntrySaved = (document, entry) => {
    if (!document || !entry) {
      return;
    }

    const dotDate = document.date ? toDotDate(document.date) : "";

    if (document.documentId === "diary") {
      setRemoteDiaryEntriesState((current) => ({
        ...current,
        [dotDate]: entry,
      }));
      setRemoteDateIndexState((current) =>
        current
          ? {
              ...current,
              diary: upsertDateIndexDate(current.diary, document.date),
            }
          : current,
      );
      return;
    }

    if (document.documentId === "daily-summary") {
      setRemoteDailySummaryEntriesState((current) => ({
        ...current,
        [dotDate]: entry,
      }));
      setRemoteDateIndexState((current) =>
        current
          ? {
              ...current,
              dailySummary: upsertDateIndexDate(
                current.dailySummary,
                document.date,
              ),
            }
          : current,
      );
      return;
    }

    if (document.documentId === "letters") {
      setRemoteLetterEntriesState((current) => ({
        ...current,
        [dotDate]: entry,
      }));
      setRemoteDateIndexState((current) =>
        current
          ? {
              ...current,
              letters: upsertDateIndexDate(current.letters, document.date),
            }
          : current,
      );
      return;
    }

    if (document.documentType === "xiaoye-memory-document") {
      const xiaoyeMode =
        document.documentId === "personality_anchor"
          ? "PersonalityAnchor"
          : "Ins";

      setRemoteXiaoyeEntriesState((current) => ({
        ...current,
        [xiaoyeMode]: entry,
      }));
      return;
    }

    const staticMode =
      document.documentId === "projects"
        ? "Project"
        : document.documentId === "preferences"
          ? "Preference"
          : document.documentId === "facts"
            ? "Facts"
            : document.documentId === "patterns"
              ? "Patterns"
              : "Openloops";

    setRemoteStaticModeEntriesState((current) => ({
      ...current,
      [staticMode]: entry,
    }));
  };

  const handleToggleOpenLoop = async (no, checked) => {
    const previousEntry = remoteStaticModeEntriesState.Openloops;

    if (previousEntry) {
      setRemoteStaticModeEntriesState((current) => ({
        ...current,
        Openloops: applyOpenLoopToggleToEntry(previousEntry, no, checked),
      }));
    }

    try {
      const result = await toggleOpenLoopsChecklistItemApi({
        no: String(no),
        checked,
      });

      if (result?.entry) {
        setRemoteStaticModeEntriesState((current) => ({
          ...current,
          Openloops: result.entry,
        }));
      }
    } catch (error) {
      if (previousEntry) {
        setRemoteStaticModeEntriesState((current) => ({
          ...current,
          Openloops: previousEntry,
        }));
      }

      throw error;
    }
  };

  const handleTimelineEventSaved = (date, event) => {
    if (!event) {
      return;
    }

    const dotDate = toDotDate(date);
    const replaceEvent = (currentTimelineState) => {
      const currentDay = currentTimelineState?.[dotDate] ?? {
        status: "draft",
        updatedAt: "",
        source: null,
        events: [],
      };
      const currentEvents = Array.isArray(currentDay.events)
        ? currentDay.events
        : [];
      const nextEvents = currentEvents.some((item) => item.id === event.id)
        ? currentEvents.map((item) => (item.id === event.id ? event : item))
        : [...currentEvents, event];

      return {
        ...currentTimelineState,
        [dotDate]: {
          ...currentDay,
          updatedAt: new Date().toISOString(),
          events: nextEvents,
        },
      };
    };

    setRemoteTimelineStateValue((current) => replaceEvent(current));
    setRemoteSearchCacheState((current) => ({
      ...current,
      timeline: replaceEvent(current.timeline),
    }));
    setRemoteDateIndexState((current) =>
      current
        ? {
            ...current,
            timeline: upsertDateIndexDate(
              current.timeline,
              dotDate.replace(/\./g, "-"),
            ),
          }
        : current,
    );
  };

  const handleTimelineEventDeleted = (date, eventId) => {
    const dotDate = toDotDate(date);
    const removeEvent = (currentTimelineState) => {
      const currentDay = currentTimelineState?.[dotDate];

      if (!currentDay || !Array.isArray(currentDay.events)) {
        return currentTimelineState;
      }

      const nextEvents = currentDay.events.filter((item) => item.id !== eventId);

      return {
        ...currentTimelineState,
        [dotDate]: {
          ...currentDay,
          updatedAt: new Date().toISOString(),
          events: nextEvents,
        },
      };
    };

    setRemoteTimelineStateValue((current) => removeEvent(current));
    setRemoteSearchCacheState((current) => ({
      ...current,
      timeline: removeEvent(current.timeline),
    }));
    setRemoteDateIndexState((current) => {
      if (!current) {
        return current;
      }

      const currentDay = remoteTimelineStateValue?.[dotDate];
      const currentEvents = Array.isArray(currentDay?.events) ? currentDay.events : [];
      const nextEventsCount = currentEvents.filter((item) => item.id !== eventId).length;

      return {
        ...current,
        timeline:
          nextEventsCount > 0
            ? current.timeline
            : removeDateIndexDate(current.timeline, dotDate.replace(/\./g, "-")),
      };
    });
  };

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
  const pageScrollMode = activeSection === "Timeline" ? "page" : "contained";
  const page = useMemo(() => {
    if (activeSection === "Conversation")
      return buildConversationThreadPage(styleTheme, selectedThreadId, remoteData);
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
    activeSection === "Timeline" ? (
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

  const handleSelectSection = (section) => {
    setActiveSection(section);
    setHighlightResult(null);
    setConversationPlaceholder(null);
    if (section === "Conversation") setConversationView("list");
  };

  const openConversationThread = (summary) => {
    handleSelectThread(summary.threadId);
    if (summary.latestDate) setSelectedDate(summary.latestDate);
    setConversationJumpDate(null);
    setConversationPlaceholder(null);
    setConversationView("chat");
  };

  const loadConversationThreadDate = async (
    dateText,
    threadId = selectedThreadId,
  ) => {
    const date = toDotDate(dateText);
    const alreadyLoaded =
      remoteConversationsState[date]?.[threadId] ||
      remoteSearchCacheState.conversations[date]?.[threadId];
    if (alreadyLoaded || conversationDateLoading) return;

    setConversationDateLoading(true);
    try {
      const records = await fetchConversations(date, {
        threadId,
      });
      const grouped = groupConversationRecordsByThread(records);
      setRemoteSearchCacheState((current) => ({
        ...current,
        conversations: {
          ...current.conversations,
          [date]: {
            ...(current.conversations[date] ?? {}),
            ...grouped,
          },
        },
      }));
    } finally {
      setConversationDateLoading(false);
    }
  };

  const handleLoadEarlierConversationDate = async () => {
    const earliestLoaded = loadedSelectedThreadDates[0];
    const earliestIndex = selectedThreadDates.indexOf(earliestLoaded);
    if (earliestIndex <= 0) return;
    await loadConversationThreadDate(selectedThreadDates[earliestIndex - 1]);
  };

  const handleSelectConversationDate = async (dateText) => {
    const date = toDotDate(dateText);
    setSelectedDate(date);
    setConversationJumpDate(date);
    await loadConversationThreadDate(date);
  };

  const handleSelectConversationSearchResult = async (record) => {
    const date = toDotDate(record?.conversationDate || record?.timestamp?.slice(0, 10));
    await loadConversationThreadDate(date);
    setSelectedDate(date);
    setConversationJumpDate(null);
    setHighlightResult({
      mode: "Conversation",
      threadId: selectedThreadId,
      date,
      targetId: record.id,
    });
    setConversationView("chat");
  };

  const handleSelectGlobalConversationSearchResult = async (record) => {
    const threadId = String(record?.threadId || "");
    if (!threadId) return;
    const date = toDotDate(
      record?.conversationDate || record?.timestamp?.slice(0, 10),
    );
    threadSelectionTouchedRef.current = true;
    setSelectedThreadId(threadId);
    await loadConversationThreadDate(date, threadId);
    setSelectedDate(date);
    setConversationJumpDate(null);
    setHighlightResult({
      mode: "Conversation",
      threadId,
      date,
      targetId: record.id,
    });
    setConversationPlaceholder(null);
    setConversationView("chat");
  };

  const hasEarlierConversationDate =
    loadedSelectedThreadDates.length > 0 &&
    selectedThreadDates.indexOf(loadedSelectedThreadDates[0]) > 0;

  const closeDiaryShare = () => {
    setDiaryShareOpen(false);
    setSelectedShareText("");
  };

  return (
    <AppShell
      edgeToEdge={activeSection === "Conversation"}
      viewport={
        <PageViewport
          viewportKey={`${activeSection}-${archiveSubject}-${timelineView}-${conversationView}-${conversationPlaceholder?.title || ""}`}
          scrollMode={pageScrollMode}
          header={
            activeSection === "Conversation" ? (
              conversationView === "chat" && !conversationPlaceholder ? (
                <ConversationHeader
                  userProfile={userProfile}
                  threadProfile={threadProfiles[selectedThreadId]}
                  onBack={() => setConversationView("list")}
                  onEditThread={() => setConversationSettingsMode("thread")}
                  onOpenSearch={() => setConversationView("search")}
                  floatingDate={conversationFloatingDate}
                  onOpenDatePicker={() => setDatePickerOpen(true)}
                />
              ) : null
            ) : (
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
                  {activeSection !== "Timeline" && (
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
                          setConversationView("chat");
                          if (result.threadId) handleSelectThread(result.threadId);
                        } else if (result.mode === "Timeline") {
                          setActiveSection("Timeline");
                          setTimelineView(result.timelineView || "line");
                        } else if (result.mode === "Xiaoye") {
                          setActiveSection("Archive");
                          setArchiveSubject("Xiaoye");
                          if (result.xiaoyeMode) setSelectedXiaoyeMode(result.xiaoyeMode);
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
            )
          }
        >
          {activeSection === "Conversation" ? (
            conversationPlaceholder ? (
              <ConversationPlaceholderPage
                title={conversationPlaceholder.title}
                description={conversationPlaceholder.description}
                onBack={() => setConversationPlaceholder(null)}
              />
            ) : conversationView === "list" ? (
              <ConversationListPage
                userProfile={userProfile}
                threadProfiles={threadProfiles}
                threadSummaries={conversationThreadSummaries}
                moments={conversationMoments}
                onBack={() => setActiveSection("Timeline")}
                onEditProfile={() => setConversationSettingsMode("user")}
                onOpenSearch={() => {
                  setConversationPlaceholder(null);
                  setConversationView("global-search");
                }}
                onOpenMenu={() =>
                  setConversationPlaceholder({
                    title: "对话设置",
                    description: "全局对话设置入口已经预留。",
                  })
                }
                onAddMoment={() =>
                  setConversationPlaceholder({
                    title: "上传瞬间",
                    description: "上传页将在后续设计；文件会统一保存到 D:\\study\\.cyberboss\\MLane\\moment\\yyyy\\mm\\dd\\。",
                  })
                }
                onOpenMoment={() =>
                  setConversationPlaceholder({
                    title: "瞬间",
                    description: "瞬间查看页将在后续设计。",
                  })
                }
                onSelectThread={openConversationThread}
              />
            ) : conversationView === "global-search" ? (
              <ConversationGlobalSearchPage
                page={page}
                conversationDates={allConversationDates}
                userProfile={userProfile}
                threadProfiles={threadProfiles}
                onBack={() => setConversationView("list")}
                onSelectResult={handleSelectGlobalConversationSearchResult}
              />
            ) : conversationView === "search" ? (
              <ConversationSearchPage
                page={page}
                threadId={selectedThreadId}
                threadDates={selectedThreadDates}
                userProfile={userProfile}
                threadProfile={threadProfiles[selectedThreadId]}
                onBack={() => setConversationView("chat")}
                onEditThread={() => setConversationSettingsMode("thread")}
                onSelectResult={handleSelectConversationSearchResult}
              />
            ) : (
              <ConversationPage
                page={page}
                selectedThreadId={selectedThreadId}
                highlightResult={highlightResult}
                userProfile={userProfile}
                threadProfile={threadProfiles[selectedThreadId]}
                onEditThread={() => setConversationSettingsMode("thread")}
                targetDate={conversationJumpDate}
                onTargetDateHandled={() => setConversationJumpDate(null)}
                onLoadEarlier={handleLoadEarlierConversationDate}
                hasEarlierDate={hasEarlierConversationDate}
                earlierDateLoading={conversationDateLoading}
                onFloatingDateChange={setConversationFloatingDate}
              />
            )
          ) : (
            <SwipeDateArea onSwipeDate={handleSwipeDate}>
              <AnimatePresence mode="wait">
                {activeSection === "Timeline" ? (
                  <TimelinePage
                    page={page}
                    timelineView={timelineView}
                    statsPeriod={statsPeriod}
                    highlightResult={highlightResult}
                    onSelectStatsPeriod={setStatsPeriod}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                    scrollHitIntoView={scrollHitIntoView}
                    onTimelineEventSaved={handleTimelineEventSaved}
                    onTimelineEventDeleted={handleTimelineEventDeleted}
                    canEdit={editAccessState.canWrite}
                    editHint={
                      editAccessState.ready ? editAccessState.message : ""
                    }
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
                    onMemoryEntrySaved={handleMemoryEntrySaved}
                    canEdit={editAccessState.canWrite}
                    editHint={
                      editAccessState.ready ? editAccessState.message : ""
                    }
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
                    onSelectedShareTextChange={setSelectedShareText}
                    scrollHitIntoView={scrollHitIntoView}
                    onMemoryEntrySaved={handleMemoryEntrySaved}
                    onToggleOpenLoop={
                      editAccessState.canWrite ? handleToggleOpenLoop : undefined
                    }
                    canEdit={editAccessState.canWrite}
                    editHint={
                      editAccessState.ready ? editAccessState.message : ""
                    }
                  />
                )}
              </AnimatePresence>
            </SwipeDateArea>
          )}
        </PageViewport>
      }
      bottomNavigation={
        activeSection === "Conversation" ? null : (
          <BottomNav
            activeSection={activeSection === "Xiaoye" ? "Archive" : activeSection}
            onSelectSection={handleSelectSection}
            page={page}
          />
        )
      }
      modalLayer={
        <AnimatePresence>
          {conversationSettingsMode === "user" && (
            <ConversationSettingsModal
              mode="user"
              profile={userProfile}
              onSave={setUserProfile}
              onClose={() => setConversationSettingsMode(null)}
            />
          )}
          {conversationSettingsMode === "thread" && threadProfiles[selectedThreadId] && (
            <ConversationSettingsModal
              mode="thread"
              profile={threadProfiles[selectedThreadId]}
              onSave={(profile) => updateThreadProfile(selectedThreadId, profile)}
              onClose={() => setConversationSettingsMode(null)}
            />
          )}
          {datePickerOpen && (
            <DatePickerModal
              page={
                activeSection === "Conversation"
                  ? { ...page, date: selectedDate }
                  : page
              }
              onClose={() => setDatePickerOpen(false)}
              onSelectDate={
                activeSection === "Conversation"
                  ? handleSelectConversationDate
                  : handleSelectDate
              }
              variant={
                activeSection === "Conversation" ? "conversation" : "archive"
              }
              markedDates={
                activeSection === "Conversation" ? selectedThreadDates : null
              }
            />
          )}
          {diaryShareOpen &&
            activeSection === "Archive" &&
            archiveSubject === "Me" &&
            (page.mode === "Diary" || page.mode === "Letters") && (
              <DiaryShareModal
                page={page}
                selectedText={selectedShareText}
                onClose={closeDiaryShare}
              />
            )}
        </AnimatePresence>
      }
    />
  );
}



