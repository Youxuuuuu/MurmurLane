// @ts-nocheck
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import type { AppDependencies } from "./app/composition/appDependencies";
import { createAppNavigation } from "./app/navigation/appNavigation";
import {
  createContentSyncService,
  createContentSyncStore,
  createLiveUpdateCoordinator,
} from "./content-sync";
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
import { useStableViewport } from "./lib/useStableViewport";
import {
  buildConversationThreadPage,
  defaultConversationThreadId,
  getAdjacentConversationDateToLoad,
  getAllConversationThreadIds,
  getContiguousLoadedConversationDates,
  getLatestConversationThreadId,
  getConversationThreadSummaries,
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
import { createArchiveWorkspaceViewModelBuilder } from "./workspaces/archive";
import { createTimelineWorkspaceViewModelBuilder } from "./workspaces/timeline";
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
import { MessageNotificationBanner } from "./components/conversation/MessageNotificationBanner";
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
import {
  createDefaultThreadProfile,
  useConversationProfiles,
} from "./lib/conversationProfiles";
import { useConversationWorkspace } from "./workspaces/conversation/useConversationWorkspace";
import {
  getConversationDisplayText,
  getConversationVisualKind,
  shouldHideConversationRecord,
} from "./lib/conversation";
import { getConversationRenderId } from "./lib/conversationIdentity";

const ENABLE_APP_DEBUG_LOG = false;
const searchDataVersions = new WeakMap();
let nextSearchDataVersion = 1;

function getSearchDataVersion(source) {
  const current = searchDataVersions.get(source);
  if (current) return current;
  const version = nextSearchDataVersion++;
  searchDataVersions.set(source, version);
  return version;
}

function resolveStateAction(action, current) {
  return typeof action === "function" ? action(current) : action;
}

function getLiveConversationRecordKey(date, threadId, record) {
  return `${toDotDate(date)}:${getConversationRenderId(record, threadId)}`;
}

function rememberConversationRecords(knownSet, date, records = []) {
  records.forEach((record, index) => {
    const threadId = String(record?.threadId || "");
    if (!threadId) return;
    knownSet.add(getLiveConversationRecordKey(date, threadId, record, index));
  });
}

function getLiveMessagePreview(record) {
  const text = String(getConversationDisplayText(record) || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (text) return text;

  const labels = {
    image: "[图片]",
    sticker: "[表情]",
    file: "[文件]",
    voice: "[语音]",
    music: "[音乐]",
  };
  return labels[getConversationVisualKind(record)] || "[新消息]";
}

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
const buildTimelineWorkspaceViewModel =
  createTimelineWorkspaceViewModelBuilder(buildTimelinePage);
const buildArchiveWorkspaceViewModel =
  createArchiveWorkspaceViewModelBuilder(
    buildMemoryPage,
    buildXiaoyePage,
  );

export default function InsDiaryPrototype({
  dependencies,
}: {
  dependencies: AppDependencies;
}) {
  const {
    fetchEditableMemoryDocument,
    hasEditCredential,
    subscribeToLiveUpdates,
    toggleOpenLoopsChecklistItem:
      toggleOpenLoopsChecklistItemApi,
  } = dependencies.murmurLaneData;
  useStableViewport();
  useEffect(() => {
    if (!dependencies.diagnostics.development || typeof console === "undefined") {
      return;
    }
    console.assert(
      validateAppData(),
      "Prototype data and timeline layout should be valid.",
    );
  }, [dependencies.diagnostics.development]);
  const [selectedStyleId, setSelectedStyleId] = useState("cafe");
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateText());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState("Diary");
  const [appNavigation] = useState(() =>
    createAppNavigation("conversation"),
  );
  const navigationSnapshot = useSyncExternalStore(
    appNavigation.subscribe,
    appNavigation.getSnapshot,
  );
  const activeSection =
    navigationSnapshot.workspace === "conversation"
      ? "Conversation"
      : navigationSnapshot.workspace === "timeline"
        ? "Timeline"
        : "Archive";
  const activateSection = useCallback(
    (section) => {
      appNavigation.activate(
        section === "Conversation"
          ? "conversation"
          : section === "Timeline"
            ? "timeline"
            : "archive",
      );
    },
    [appNavigation],
  );
  const [conversationView, setConversationView] = useState("list");
  const [conversationSettingsMode, setConversationSettingsMode] = useState(null);
  const [conversationProfilePreview, setConversationProfilePreview] = useState(null);
  const [conversationPlaceholder, setConversationPlaceholder] = useState(null);
  const [conversationDateLoading, setConversationDateLoading] = useState(false);
  const [conversationJumpDate, setConversationJumpDate] = useState(null);
  const [conversationCalendarDate, setConversationCalendarDate] = useState(
    () => getTodayDateText(),
  );
  const [conversationFloatingDate, setConversationFloatingDate] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState(
    defaultConversationThreadId,
  );
  const [webThreadIds, setWebThreadIds] = useState<string[]>([]);
  const [webThreadProfileOverrides, setWebThreadProfileOverrides] = useState({});
  const [timelineView, setTimelineView] = useState("line");
  const [statsPeriod, setStatsPeriod] = useState("day");
  const [highlightResult, setHighlightResult] = useState(null);
  const [diaryShareOpen, setDiaryShareOpen] = useState(false);
  const [selectedShareText, setSelectedShareText] = useState("");
  const [archiveSubject, setArchiveSubject] = useState("Me");
  const [selectedXiaoyeMode, setSelectedXiaoyeMode] = useState("Ins");
  const [contentSyncStore] = useState(() => createContentSyncStore());
  const contentSync = useMemo(
    () =>
      createContentSyncService({
        store: contentSyncStore,
        port: dependencies.murmurLaneData,
      }),
    [contentSyncStore, dependencies.murmurLaneData],
  );
  const contentSyncSnapshot = useSyncExternalStore(
    contentSyncStore.subscribe,
    contentSyncStore.getSnapshot,
  );
  const {
    conversationEntries: remoteConversationsState,
    conversationMoments,
    timelineState: remoteTimelineStateValue,
    diaryEntries: remoteDiaryEntriesState,
    dailySummaryEntries: remoteDailySummaryEntriesState,
    letterEntries: remoteLetterEntriesState,
    staticModeEntries: remoteStaticModeEntriesState,
    xiaoyeEntries: remoteXiaoyeEntriesState,
    reminderHistoryEntries: remoteReminderHistoryEntriesState,
    dateIndex: remoteDateIndexState,
    searchCache: remoteSearchCacheState,
  } = contentSyncSnapshot.data;
  const updateContentSyncField = useCallback(
    (source, field, action, key = "global") => {
      contentSyncStore.update(source, key, (current) => ({
        ...current,
        [field]: resolveStateAction(action, current[field]),
      }));
    },
    [contentSyncStore],
  );
  const setRemoteTimelineStateValue = useCallback(
    (action) =>
      updateContentSyncField("timeline", "timelineState", action),
    [updateContentSyncField],
  );
  const setRemoteDiaryEntriesState = useCallback(
    (action) =>
      updateContentSyncField("diary", "diaryEntries", action),
    [updateContentSyncField],
  );
  const setRemoteDailySummaryEntriesState = useCallback(
    (action) =>
      updateContentSyncField(
        "dailySummary",
        "dailySummaryEntries",
        action,
      ),
    [updateContentSyncField],
  );
  const setRemoteLetterEntriesState = useCallback(
    (action) =>
      updateContentSyncField("letters", "letterEntries", action),
    [updateContentSyncField],
  );
  const setRemoteStaticModeEntriesState = useCallback(
    (action) =>
      updateContentSyncField(
        "staticMemory",
        "staticModeEntries",
        action,
      ),
    [updateContentSyncField],
  );
  const setRemoteXiaoyeEntriesState = useCallback(
    (action) =>
      updateContentSyncField("xiaoye", "xiaoyeEntries", action),
    [updateContentSyncField],
  );
  const setRemoteDateIndexState = useCallback(
    (action) =>
      updateContentSyncField("dateIndex", "dateIndex", action),
    [updateContentSyncField],
  );
  const setRemoteSearchCacheState = useCallback(
    (action) =>
      updateContentSyncField(
        "conversation",
        "searchCache",
        action,
        "search-cache",
      ),
    [updateContentSyncField],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const remoteError = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(contentSyncSnapshot.sources)
          .filter(([, metadata]) => metadata.error != null)
          .map(([source, metadata]) => [
            source,
            String(metadata.error?.message || metadata.error),
          ]),
      ),
    [contentSyncSnapshot.sources],
  );
  const [editAccessState, setEditAccessState] = useState({
    ready: false,
    canWrite: false,
    message: "",
  });
  const [conversationUnreadCounts, setConversationUnreadCounts] = useState({});
  const [messageNotificationQueue, setMessageNotificationQueue] = useState([]);

  useEffect(() => {
    if (!highlightResult) return;
    const activeHighlight = highlightResult;
    const timer = window.setTimeout(() => {
      setHighlightResult((current) =>
        current === activeHighlight ? null : current,
      );
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [highlightResult]);
  const threadSelectionTouchedRef = useRef(false);
  const selectedDateRef = useRef(selectedDate);
  const activeSectionRef = useRef(activeSection);
  const conversationViewRef = useRef(conversationView);
  const selectedThreadIdRef = useRef(selectedThreadId);
  const threadProfilesRef = useRef({});
  const knownConversationRecordIdsRef = useRef(new Set());
  const loadedConversationDatesRef = useRef(new Set());
  const conversationDateLoadingRef = useRef(new Set());
  const conversationEarlierLoadInFlightRef = useRef(false);
  const conversationLaterLoadInFlightRef = useRef(false);
  const conversationBaselineReadyRef = useRef(false);
  const initialLiveRefreshCompleteRef = useRef(false);
  const liveSearchActiveRef = useRef(false);
  const liveUpdateCoordinatorRef = useRef(null);
  const dismissMessageNotification = useCallback(() => {
    setMessageNotificationQueue((current) => current.slice(1));
  }, []);

  selectedDateRef.current = selectedDate;
  activeSectionRef.current = activeSection;
  conversationViewRef.current = conversationView;
  selectedThreadIdRef.current = selectedThreadId;
  liveSearchActiveRef.current =
    Boolean(String(searchQuery ?? "").trim()) ||
    conversationView === "search" ||
    conversationView === "global-search";

  const refreshLiveEvents = useCallback(async (events) => {
    const canNotifyConversationChanges =
      conversationBaselineReadyRef.current &&
      initialLiveRefreshCompleteRef.current;
    const registerIncomingMessages = (date, records, allowNotify = true) => {
      const dotDate = toDotDate(date);
      const incomingByThread = new Map();

      records.forEach((record, index) => {
        const threadId = String(record?.threadId || "");
        if (!threadId) return;
        const recordKey = getLiveConversationRecordKey(
          dotDate,
          threadId,
          record,
          index,
        );
        const alreadyKnown = knownConversationRecordIdsRef.current.has(recordKey);
        knownConversationRecordIdsRef.current.add(recordKey);

        const visualKind = getConversationVisualKind(record);
        const incoming =
          !alreadyKnown &&
          (record?.type === "assistant" || record?.role === "assistant") &&
          !shouldHideConversationRecord(record) &&
          !["thinking", "operation", "hidden"].includes(visualKind);
        if (!incoming) return;

        const items = incomingByThread.get(threadId) || [];
        items.push(record);
        incomingByThread.set(threadId, items);
      });

      if (!canNotifyConversationChanges || !allowNotify || !incomingByThread.size) return;

      incomingByThread.forEach((incomingRecords, threadId) => {
        const viewingThread =
          activeSectionRef.current === "Conversation" &&
          conversationViewRef.current === "chat" &&
          selectedThreadIdRef.current === threadId;
        if (viewingThread) return;

        const incomingCount = incomingRecords.length;
        const latestRecord = incomingRecords[incomingRecords.length - 1];
        setConversationUnreadCounts((current) => ({
          ...current,
          [threadId]: Number(current[threadId] || 0) + incomingCount,
        }));

        if (activeSectionRef.current === "Conversation") return;

        const profile = threadProfilesRef.current[threadId] || {};
        setMessageNotificationQueue((current) => {
          const existingIndex = current.findIndex(
            (item) => item.threadId === threadId,
          );
          const nextNotification = {
            threadId,
            date: dotDate,
            name: profile.name || `对话 ${threadId.slice(0, 6)}`,
            avatar: profile.avatar || "",
            message: getLiveMessagePreview(latestRecord),
            count: incomingCount,
            version: Date.now(),
          };

          if (existingIndex < 0) return [...current, nextNotification];

          return current.map((item, index) =>
            index === existingIndex
              ? {
                  ...item,
                  ...nextNotification,
                  count: item.count + incomingCount,
                  version: item.version + 1,
                }
              : item,
          );
        });
      });
    };

    const refreshResult = await contentSync.refreshEvents(
      events,
      selectedDateRef.current,
    );
    refreshResult.conversations.forEach(({ date, records }) => {
      const dateWasLoaded = loadedConversationDatesRef.current.has(date);
      registerIncomingMessages(date, records, dateWasLoaded);
      loadedConversationDatesRef.current.add(date);
    });
    initialLiveRefreshCompleteRef.current = true;
  }, [contentSync]);

  useEffect(() => {
    const coordinator = createLiveUpdateCoordinator({
      subscribe: (onEvent) => {
        contentSyncStore.setConnectionStatus("connecting");
        const unsubscribe = subscribeToLiveUpdates(
          onEvent,
          (connected) =>
            contentSyncStore.setConnectionStatus(
              connected ? "connected" : "disconnected",
            ),
        );
        return () => {
          unsubscribe();
          contentSyncStore.setConnectionStatus("idle");
        };
      },
      refresh: refreshLiveEvents,
      schedule: (callback, delayMs) =>
        window.setTimeout(callback, delayMs),
      cancelSchedule: (timer) => window.clearTimeout(timer),
      isRefreshBlocked: () => liveSearchActiveRef.current,
    });
    liveUpdateCoordinatorRef.current = coordinator;

    const handleVisibilityChange = () => {
      coordinator.setVisible(!document.hidden);
    };

    coordinator.setVisible(!document.hidden);
    coordinator.start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      coordinator.stop();
      if (liveUpdateCoordinatorRef.current === coordinator) {
        liveUpdateCoordinatorRef.current = null;
      }
    };
  }, [
    contentSyncStore,
    refreshLiveEvents,
    subscribeToLiveUpdates,
  ]);

  useEffect(() => {
    if (liveSearchActiveRef.current || document.hidden) return;
    const timer = window.setTimeout(() => {
      if (liveSearchActiveRef.current || document.hidden) return;
      liveUpdateCoordinatorRef.current?.flushPending();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery, conversationView]);

  const remoteData = contentSyncSnapshot.data;

  const availableThreadIds = useMemo(
    () => getAllConversationThreadIds(remoteData),
    [remoteData],
  );
  const profileThreadIds = useMemo(
    () => Array.from(new Set([...availableThreadIds, ...webThreadIds])),
    [availableThreadIds, webThreadIds],
  );
  const {
    userProfile,
    setUserProfile,
    threadProfiles,
    updateThreadProfile,
  } = useConversationProfiles(
    profileThreadIds,
    contentSyncSnapshot.data.conversationProfiles,
    {
      saveUserProfile:
        dependencies.murmurLaneData.saveConversationUserProfile,
      saveThreadProfile:
        dependencies.murmurLaneData.saveConversationThreadProfile,
    },
  );
  const effectiveThreadProfiles = useMemo(
    () => ({
      ...threadProfiles,
      ...webThreadProfileOverrides,
      ...(conversationProfilePreview?.threadId
        ? { [conversationProfilePreview.threadId]: conversationProfilePreview.profile }
        : {}),
    }),
    [threadProfiles, webThreadProfileOverrides, conversationProfilePreview],
  );
  threadProfilesRef.current = effectiveThreadProfiles;

  useEffect(() => {
    const rememberEntries = (entries) => {
      Object.entries(entries ?? {}).forEach(([date, threads]) => {
        loadedConversationDatesRef.current.add(toDotDate(date));
        Object.entries(threads ?? {}).forEach(([threadId, records]) => {
          rememberConversationRecords(knownConversationRecordIdsRef.current, date, records ?? []);
        });
      });
    };

    rememberEntries(remoteConversationsState);
    rememberEntries(remoteSearchCacheState.conversations);
  }, [remoteConversationsState, remoteSearchCacheState.conversations]);

  useEffect(() => {
    if (activeSection === "Conversation") {
      setMessageNotificationQueue([]);
    }
  }, [activeSection]);
  const conversationThreadSummaries = useMemo(
    () => getConversationThreadSummaries(profileThreadIds, remoteData),
    [profileThreadIds, remoteData],
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
    () => getContiguousLoadedConversationDates(
      selectedThreadId,
      remoteData,
      conversationCalendarDate,
    ),
    [
      conversationCalendarDate,
      selectedThreadId,
      remoteData,
    ],
  );
  const earlierConversationDateToLoad = useMemo(
    () => getAdjacentConversationDateToLoad(
      selectedThreadDates,
      loadedSelectedThreadDates,
      "earlier",
    ),
    [loadedSelectedThreadDates, selectedThreadDates],
  );
  const laterConversationDateToLoad = useMemo(
    () => getAdjacentConversationDateToLoad(
      selectedThreadDates,
      loadedSelectedThreadDates,
      "later",
    ),
    [loadedSelectedThreadDates, selectedThreadDates],
  );
  const latestConversationThreadId = useMemo(
    () => getLatestConversationThreadId(remoteData),
    [remoteData],
  );

  useEffect(() => {
    if (String(selectedThreadId).startsWith("draft-")) return;
    if (!profileThreadIds.length) return;

    if (!profileThreadIds.includes(selectedThreadId)) {
      setSelectedThreadId(latestConversationThreadId ?? profileThreadIds[0]);
      return;
    }

    if (
      !threadSelectionTouchedRef.current &&
      latestConversationThreadId &&
      latestConversationThreadId !== selectedThreadId
    ) {
      setSelectedThreadId(latestConversationThreadId);
    }
  }, [profileThreadIds, latestConversationThreadId, selectedThreadId]);

  const handleSelectThread = (threadId) => {
    threadSelectionTouchedRef.current = true;
    setSelectedThreadId(threadId);
    setConversationUnreadCounts((current) => {
      if (!current[threadId]) return current;
      return { ...current, [threadId]: 0 };
    });
    setMessageNotificationQueue((current) =>
      current.filter((item) => item.threadId !== threadId),
    );
  };

  const handleWebThreadCreated = useCallback(({ draftThreadId, threadId }) => {
    if (!threadId) return;
    const draftProfile = threadProfilesRef.current[draftThreadId] || createDefaultThreadProfile(threadId, 0);
    setWebThreadProfileOverrides((current) => {
      const next = { ...current, [threadId]: draftProfile };
      if (draftThreadId && draftThreadId !== threadId) delete next[draftThreadId];
      return next;
    });
    setWebThreadIds((current) => Array.from(new Set([
      ...current.filter((item) => item !== draftThreadId),
      threadId,
    ])));
    threadSelectionTouchedRef.current = true;
    setSelectedThreadId(threadId);
    setConversationCalendarDate(getTodayDateText());
    setConversationJumpDate(null);
    setConversationView("chat");
  }, []);

  const conversationWorkspace = useConversationWorkspace({
    webChat: dependencies.webChat,
    enabled: activeSection === "Conversation" && conversationView === "chat" && !conversationPlaceholder,
    threadId: selectedThreadId,
    onThreadCreated: handleWebThreadCreated,
  });
  const webChatViewModel = conversationWorkspace.viewModel;
  const webChatCommands = conversationWorkspace.commands;
  const conversationMediaUrls = useMemo(
    () => ({
      resolveLocalFile:
        dependencies.murmurLaneData.resolveFileUrl,
      resolveWebChatAsset:
        dependencies.webChat.resolveAssetUrl,
    }),
    [dependencies],
  );

  const openNewConversationThread = useCallback(() => {
    const draftThreadId = `draft-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
    const profile = {
      ...createDefaultThreadProfile(draftThreadId, 0),
      name: "新聊天",
      handle: "@new-chat",
      signature: "从网页开始的聊天",
    };
    setWebThreadProfileOverrides((current) => ({ ...current, [draftThreadId]: profile }));
    setWebThreadIds((current) => Array.from(new Set([...current, draftThreadId])));
    threadSelectionTouchedRef.current = true;
    setSelectedThreadId(draftThreadId);
    setConversationCalendarDate(getTodayDateText());
    setConversationJumpDate(null);
    setConversationPlaceholder(null);
    setConversationView("chat");
  }, []);
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

    if (dependencies.diagnostics.development && ENABLE_APP_DEBUG_LOG) {
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
    dependencies.diagnostics.development,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadBootstrapData = async () => {
      const [, editStatusResult] = await Promise.allSettled([
        contentSync.bootstrap(),
        fetchEditableMemoryDocument({
          documentType: "static-memory-document",
          documentId: "preferences",
        }),
      ]);

      if (cancelled) return;

      if (editStatusResult.status === "fulfilled") {
        const backendWriteEnabled = editStatusResult.value?.writeEnabled === true;
        const canWrite =
          backendWriteEnabled && hasEditCredential;
        const message = canWrite
          ? ""
          : backendWriteEnabled && !hasEditCredential
            ? "编辑已关闭：未配置前端编辑 token。"
            : !backendWriteEnabled && hasEditCredential
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
    };

    loadBootstrapData();

    return () => {
      cancelled = true;
    };
  }, [
    contentSync,
    fetchEditableMemoryDocument,
    hasEditCredential,
  ]);

  useEffect(() => {
    let cancelled = false;
    const dotDate = toDotDate(selectedDate);

    const loadDatedData = async () => {
      const [
        conversations,
      ] = await Promise.all([
        contentSync.loadConversations(dotDate),
        contentSync.loadDatedMemory("diary", dotDate),
        contentSync.loadDatedMemory("dailySummary", dotDate),
        contentSync.loadDatedMemory("letters", dotDate),
      ]);

      if (cancelled) return;
      if (Array.isArray(conversations)) {
        loadedConversationDatesRef.current.add(dotDate);
        rememberConversationRecords(
          knownConversationRecordIdsRef.current,
          dotDate,
          conversations,
        );
      }
      conversationBaselineReadyRef.current = true;
    };

    loadDatedData();

    return () => {
      cancelled = true;
    };
  }, [contentSync, selectedDate]);

  useEffect(() => {
    void contentSync.loadMoments(3);
  }, [contentSync]);

  useEffect(() => {
    if (
      activeSection !== "Conversation" ||
      conversationView !== "list" ||
      !remoteDateIndexState
    )
      return;

    let cancelled = false;

    const loadThreadDates = async () => {
      const batches = await contentSync.loadLatestConversationDates();
      if (cancelled) return;
      batches.forEach(({ date, records }) => {
        loadedConversationDatesRef.current.add(toDotDate(date));
        rememberConversationRecords(
          knownConversationRecordIdsRef.current,
          date,
          records,
        );
      });
    };

    void loadThreadDates();
    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    conversationView,
    remoteDateIndexState,
    contentSync,
  ]);

  useEffect(() => {
    const normalizedQuery = String(searchQuery ?? "").trim();

    if (!normalizedQuery || !remoteDateIndexState) {
      return;
    }

    let cancelled = false;

    const loadSearchData = async () => {
      const batches = await contentSync.loadIndexedSearchSources();
      if (cancelled) return;
      batches.forEach(({ date, records }) => {
        loadedConversationDatesRef.current.add(toDotDate(date));
        rememberConversationRecords(
          knownConversationRecordIdsRef.current,
          date,
          records,
        );
      });
    };

    void loadSearchData();

    return () => {
      cancelled = true;
    };
  }, [
    searchQuery,
    remoteDateIndexState,
    contentSync,
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

  const searchDataVersion = getSearchDataVersion(remoteData);

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
      return buildConversationThreadPage(
        styleTheme,
        selectedThreadId,
        remoteData,
        conversationCalendarDate,
      );
    if (activeSection === "Timeline")
      return buildTimelineWorkspaceViewModel(
        timelineStyleTheme,
        selectedDate,
        remoteData,
      );
    return buildArchiveWorkspaceViewModel({
      theme: styleTheme,
      date: selectedDate,
      mode: selectedMode,
      subject: archiveShowsXiaoye ? "Xiaoye" : "Me",
      xiaoyeMode: selectedXiaoyeMode,
      remoteData,
    });
  }, [
    styleTheme,
    timelineStyleTheme,
    selectedDate,
    selectedMode,
    selectedXiaoyeMode,
    activeSection,
    archiveSubject,
    conversationCalendarDate,
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
    activateSection(section);
    setHighlightResult(null);
    setConversationPlaceholder(null);
    if (section === "Conversation") setConversationView("list");
  };

  const openConversationThread = (summary) => {
    handleSelectThread(summary.threadId);
    const indexedDates = (remoteDateIndexState?.conversationThreads?.[summary.threadId] ?? [])
      .map(toDotDate)
      .sort();
    const latestDate = indexedDates[indexedDates.length - 1] || toDotDate(summary.latestDate || "");
    if (latestDate) {
      setConversationCalendarDate(latestDate);
      void loadConversationThreadDate(latestDate, summary.threadId);
    }
    // 打开线程时应落在最新消息；只有明确的日期或搜索跳转
    // 才定位到目标日期的第一条消息。
    setConversationJumpDate(null);
    setConversationPlaceholder(null);
    setConversationView("chat");
  };

  const handleOpenMessageNotification = (notification) => {
    appNavigation.requestNavigation({
      workspace: "conversation",
      target: {
        threadId: notification.threadId,
        date: notification.date,
      },
    });
    handleSelectThread(notification.threadId);
    if (notification.date) {
      setConversationCalendarDate(notification.date);
      void loadConversationThreadDate(notification.date, notification.threadId);
    }
    setConversationJumpDate(null);
    setConversationPlaceholder(null);
    setConversationView("chat");
  };

  const loadConversationThreadDate = useCallback(async (
    dateText,
    threadId = selectedThreadId,
  ) => {
    const date = toDotDate(dateText);
    const loadingKey = `${date}:${threadId}`;
    const alreadyLoaded =
      remoteConversationsState[date]?.[threadId] ||
      remoteSearchCacheState.conversations[date]?.[threadId];
    if (alreadyLoaded || conversationDateLoadingRef.current.has(loadingKey)) {
      return false;
    }

    conversationDateLoadingRef.current.add(loadingKey);
    setConversationDateLoading(true);
    try {
      const records = await contentSync.loadConversations(date, {
        threadId,
      });
      if (!records) return false;
      loadedConversationDatesRef.current.add(date);
      rememberConversationRecords(
        knownConversationRecordIdsRef.current,
        date,
        records,
      );
      return records.some(
        (record) => String(record?.threadId || "") === threadId,
      );
    } finally {
      conversationDateLoadingRef.current.delete(loadingKey);
      setConversationDateLoading(conversationDateLoadingRef.current.size > 0);
    }
  }, [
    remoteConversationsState,
    remoteSearchCacheState.conversations,
    selectedThreadId,
    contentSync,
  ]);

  const handleLoadEarlierConversationDate = useCallback(async () => {
    if (
      conversationEarlierLoadInFlightRef.current
      || !earlierConversationDateToLoad
    ) {
      return false;
    }
    conversationEarlierLoadInFlightRef.current = true;
    try {
      return await loadConversationThreadDate(earlierConversationDateToLoad);
    } finally {
      conversationEarlierLoadInFlightRef.current = false;
    }
  }, [earlierConversationDateToLoad, loadConversationThreadDate]);

  const handleLoadLaterConversationDate = useCallback(async () => {
    if (
      conversationLaterLoadInFlightRef.current
      || !laterConversationDateToLoad
    ) {
      return false;
    }
    conversationLaterLoadInFlightRef.current = true;
    try {
      return await loadConversationThreadDate(laterConversationDateToLoad);
    } finally {
      conversationLaterLoadInFlightRef.current = false;
    }
  }, [laterConversationDateToLoad, loadConversationThreadDate]);

  const handleSelectConversationDate = async (dateText) => {
    const date = toDotDate(dateText);
    await loadConversationThreadDate(date);
    setConversationCalendarDate(date);
    setConversationJumpDate(date);
  };

  const handleSelectConversationSearchResult = async (record) => {
    const date = toDotDate(record?.conversationDate || record?.timestamp?.slice(0, 10));
    handleSelectThread(selectedThreadId);
    await loadConversationThreadDate(date);
    setConversationCalendarDate(date);
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
    handleSelectThread(threadId);
    await loadConversationThreadDate(date, threadId);
    setConversationCalendarDate(date);
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

  const hasEarlierConversationDate = Boolean(earlierConversationDateToLoad);
  const hasLaterConversationDate = Boolean(laterConversationDateToLoad);

  const handleOpenConversationDatePicker = useCallback(
    () => setDatePickerOpen(true),
    [],
  );
  const handleEditSelectedConversationThread = useCallback(
    () => setConversationSettingsMode("thread"),
    [],
  );
  const handleConversationTargetDateHandled = useCallback(
    () => setConversationJumpDate(null),
    [],
  );

  const closeDiaryShare = () => {
    setDiaryShareOpen(false);
    setSelectedShareText("");
  };

  return (
    <MotionConfig reducedMotion="user">
      <AppShell
      edgeToEdge={activeSection === "Conversation"}
      viewport={
        <PageViewport
          viewportKey={`${activeSection}-${archiveSubject}-${timelineView}-${conversationView}-${conversationPlaceholder?.title || ""}`}
          scrollMode={pageScrollMode}
          contentClassName={activeSection === "Conversation" ? "mt-0" : "mt-1"}
          header={
            activeSection === "Conversation" ? (
              conversationView === "chat" && !conversationPlaceholder ? (
                <ConversationHeader
                  userProfile={userProfile}
                  threadProfile={effectiveThreadProfiles[selectedThreadId]}
                  onBack={() => setConversationView("list")}
                  onEditThread={handleEditSelectedConversationThread}
                  onOpenSearch={() => setConversationView("search")}
                  isTyping={webChatViewModel.status?.status === "running" || webChatViewModel.status?.status === "streaming"}
                  floatingDate={conversationFloatingDate}
                  onOpenDatePicker={handleOpenConversationDatePicker}
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
                      workspaceScope={
                        activeSection === "Timeline"
                          ? "timeline"
                          : "archive"
                      }
                      onSelectResult={(result) => {
                        if (result.mode === "Conversation") {
                          appNavigation.requestNavigation({
                            workspace: "conversation",
                            target: {
                              threadId: result.threadId,
                              date: result.date,
                              messageId: result.targetId,
                            },
                          });
                          setConversationView("chat");
                          if (result.threadId) handleSelectThread(result.threadId);
                        } else if (result.mode === "Timeline") {
                          appNavigation.requestNavigation({
                            workspace: "timeline",
                            target: {
                              date: result.date,
                              eventId: result.targetId,
                              view: result.timelineView,
                            },
                          });
                          setTimelineView(result.timelineView || "line");
                        } else if (result.mode === "Xiaoye") {
                          appNavigation.requestNavigation({
                            workspace: "archive",
                            target: {
                              subject: "Xiaoye",
                              date: result.date,
                              documentId: result.targetId,
                            },
                          });
                          setArchiveSubject("Xiaoye");
                          if (result.xiaoyeMode) setSelectedXiaoyeMode(result.xiaoyeMode);
                        } else {
                          appNavigation.requestNavigation({
                            workspace: "archive",
                            target: {
                              subject: "Me",
                              date: result.date,
                              documentId: result.targetId,
                            },
                          });
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
                threadProfiles={effectiveThreadProfiles}
                threadSummaries={conversationThreadSummaries}
                unreadCounts={conversationUnreadCounts}
                moments={conversationMoments}
                onBack={() => activateSection("Timeline")}
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
                onCreateThread={openNewConversationThread}
                onOpenMoment={() =>
                  setConversationPlaceholder({
                    title: "瞬间",
                    description: "瞬间查看页将在后续设计。",
                  })
                }
                onSelectThread={openConversationThread}
                onUpdateThreadProfile={updateThreadProfile}
                onUpdateUserProfile={setUserProfile}
              />
            ) : conversationView === "global-search" ? (
              <ConversationGlobalSearchPage
                page={page}
                conversationDates={allConversationDates}
                userProfile={userProfile}
                threadProfiles={effectiveThreadProfiles}
                onBack={() => setConversationView("list")}
                onSelectResult={handleSelectGlobalConversationSearchResult}
                searchConversations={
                  dependencies.murmurLaneData.searchConversation
                }
                mediaUrls={conversationMediaUrls}
              />
            ) : conversationView === "search" ? (
              <ConversationSearchPage
                page={page}
                threadId={selectedThreadId}
                threadDates={selectedThreadDates}
                userProfile={userProfile}
                threadProfile={effectiveThreadProfiles[selectedThreadId]}
                onBack={() => setConversationView("chat")}
                onEditThread={handleEditSelectedConversationThread}
                onSelectResult={handleSelectConversationSearchResult}
                searchConversations={
                  dependencies.murmurLaneData.searchConversation
                }
                mediaUrls={conversationMediaUrls}
              />
            ) : (
              <ConversationPage
                page={page}
                selectedThreadId={selectedThreadId}
                highlightResult={highlightResult}
                userProfile={userProfile}
                threadProfile={effectiveThreadProfiles[selectedThreadId]}
                onEditThread={handleEditSelectedConversationThread}
                targetDate={conversationJumpDate}
                onTargetDateHandled={handleConversationTargetDateHandled}
                onLoadEarlier={handleLoadEarlierConversationDate}
                hasEarlierDate={hasEarlierConversationDate}
                onLoadLater={handleLoadLaterConversationDate}
                hasLaterDate={hasLaterConversationDate}
                earlierDateLoading={conversationDateLoading}
                laterDateLoading={conversationDateLoading}
                onFloatingDateChange={setConversationFloatingDate}
                liveMessages={webChatViewModel.messages}
                webChatViewModel={webChatViewModel}
                webChatCommands={webChatCommands}
                loadStickers={
                  dependencies.murmurLaneData.fetchStickerAssets
                }
                mediaUrls={conversationMediaUrls}
                diagnosticsEnabled={
                  dependencies.diagnostics.development
                }
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
                    commands={{
                      fetchEvent:
                        dependencies.murmurLaneData.fetchTimelineEvent,
                      patchEvent:
                        dependencies.murmurLaneData.patchTimelineEvent,
                      deleteEvent:
                        dependencies.murmurLaneData.deleteTimelineEvent,
                    }}
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
                    onLoadEditableDocument={
                      dependencies.murmurLaneData.fetchEditableMemoryDocument
                    }
                    onSaveEditableDocument={
                      dependencies.murmurLaneData.saveEditableMemoryDocument
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
                    onLoadEditableDocument={
                      dependencies.murmurLaneData.fetchEditableMemoryDocument
                    }
                    onSaveEditableDocument={
                      dependencies.murmurLaneData.saveEditableMemoryDocument
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
        <>
          <MessageNotificationBanner
            notification={
              activeSection === "Conversation"
                ? null
                : messageNotificationQueue[0] ?? null
            }
            onOpen={handleOpenMessageNotification}
            onDismiss={dismissMessageNotification}
          />
          <AnimatePresence>
            {conversationSettingsMode === "user" && (
              <ConversationSettingsModal
                mode="user"
                profile={userProfile}
                onSave={setUserProfile}
                onClose={() => {
                  setConversationSettingsMode(null);
                  setConversationProfilePreview(null);
                }}
              />
            )}
            {conversationSettingsMode === "thread" &&
          effectiveThreadProfiles[selectedThreadId] && (
                <ConversationSettingsModal
                  mode="thread"
            profile={effectiveThreadProfiles[selectedThreadId]}
                  onPreview={(profile) =>
                    setConversationProfilePreview({
                      threadId: selectedThreadId,
                      profile,
                    })
                  }
                  onSave={async (profile) => {
                    const saved = await updateThreadProfile(
                      selectedThreadId,
                      profile,
                    );
                    const group = String(profile.group || "").trim();
                    if (group && !(userProfile.groups || []).includes(group)) {
                      await setUserProfile({
                        ...userProfile,
                        groups: [...(userProfile.groups || []), group],
                      });
                    }
                    return saved;
                  }}
                  onClose={() => {
                    setConversationSettingsMode(null);
                    setConversationProfilePreview(null);
                  }}
                />
              )}
          {datePickerOpen && (
            <DatePickerModal
              page={
                activeSection === "Conversation"
                  ? { ...page, date: conversationCalendarDate }
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
        </>
      }
      />
    </MotionConfig>
  );
}



