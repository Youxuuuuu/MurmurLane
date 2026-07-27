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
import { createBrowseDateFlow } from "./app/flows/browseDateFlow";
import {
  createContentSyncService,
  createContentSyncStore,
  createLiveUpdateCoordinator,
} from "./content-sync";
import type { LiveUpdateCoordinator } from "./content-sync";
import type { RemoteData } from "./types/api";
import type { ConversationThreadProfile } from "./lib/conversationProfiles";
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
  defaultConversationThreadId,
} from "./lib/conversationPageData";
import {
  buildMemoryPage,
  buildXiaoyePage,
  getRemoteDatedEntriesSource,
  getRemoteEntryByDate,
} from "./lib/memoryPageData";
import {
  createArchiveWorkspaceViewModelBuilder,
  useArchiveWorkspace,
} from "./workspaces/archive";
import {
  createTimelineWorkspaceViewModelBuilder,
  useTimelineWorkspace,
} from "./workspaces/timeline";
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
import { useConversationWorkspace } from "./workspaces/conversation/useConversationWorkspace";

const ENABLE_APP_DEBUG_LOG = false;
const searchDataVersions = new WeakMap<RemoteData, number>();
let nextSearchDataVersion = 1;

function getSearchDataVersion(source: RemoteData) {
  const current = searchDataVersions.get(source);
  if (current) return current;
  const version = nextSearchDataVersion++;
  searchDataVersions.set(source, version);
  return version;
}

function resolveStateAction(
  action: string | ((current: string) => string),
  current: string,
) {
  return typeof action === "function" ? action(current) : action;
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
  const styleTheme = useMemo(
    () =>
      styleThemes.find((item) => item.id === selectedStyleId) ??
      styleThemes[0],
    [selectedStyleId],
  );
  const timelineStyleTheme = useMemo(
    () =>
      styleThemes.find((item) => item.id === "cafe") ??
      styleThemes[0],
    [],
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [appNavigation] = useState(() =>
    createAppNavigation("conversation"),
  );
  const navigationSnapshot = useSyncExternalStore(
    appNavigation.subscribe,
    appNavigation.getSnapshot,
  );
  const conversationNavigation = useMemo(
    () =>
      navigationSnapshot.workspace === "conversation"
        ? {
            revision: navigationSnapshot.revision,
            target: navigationSnapshot.target,
            acknowledge: (revision) =>
              appNavigation.acknowledgeTarget(
                "conversation",
                revision,
              ),
          }
        : null,
    [appNavigation, navigationSnapshot],
  );
  const timelineNavigation = useMemo(
    () =>
      navigationSnapshot.workspace === "timeline"
        ? {
            revision: navigationSnapshot.revision,
            target: navigationSnapshot.target,
            acknowledge: (revision) =>
              appNavigation.acknowledgeTarget(
                "timeline",
                revision,
              ),
          }
        : null,
    [appNavigation, navigationSnapshot],
  );
  const archiveNavigation = useMemo(
    () =>
      navigationSnapshot.workspace === "archive"
        ? {
            revision: navigationSnapshot.revision,
            target: navigationSnapshot.target,
            acknowledge: (revision) =>
              appNavigation.acknowledgeTarget(
                "archive",
                revision,
              ),
          }
        : null,
    [appNavigation, navigationSnapshot],
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
  const [conversationFloatingDate, setConversationFloatingDate] = useState("");
  const [diaryShareOpen, setDiaryShareOpen] = useState(false);
  const [selectedShareText, setSelectedShareText] = useState("");
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
  } = contentSyncSnapshot.data;
  const remoteData = contentSyncSnapshot.data;
  const timelinePort = useMemo(
    () => ({
      fetchEvent:
        dependencies.murmurLaneData.fetchTimelineEvent,
      patchEvent:
        dependencies.murmurLaneData.patchTimelineEvent,
      deleteEvent:
        dependencies.murmurLaneData.deleteTimelineEvent,
    }),
    [dependencies.murmurLaneData],
  );
  const archivePort = useMemo(
    () => ({
      loadDocument:
        dependencies.murmurLaneData.fetchEditableMemoryDocument,
      saveDocument:
        dependencies.murmurLaneData.saveEditableMemoryDocument,
      toggleOpenLoop:
        dependencies.murmurLaneData.toggleOpenLoopsChecklistItem,
    }),
    [dependencies.murmurLaneData],
  );
  const timelineSync = useMemo(
    () => ({
      async refresh(date) {
        await Promise.all([
          contentSync.loadTimeline({ date }),
          contentSync.loadDateIndex(),
        ]);
      },
    }),
    [contentSync],
  );
  const archiveSync = useMemo(
    () => ({
      refreshDated: (source, date) =>
        contentSync.loadDatedMemory(source, date),
      refreshStatic: (workspaceMode, apiMode) =>
        contentSync.loadStaticMemory(workspaceMode, apiMode),
      refreshXiaoye: (workspaceMode, apiMode) =>
        contentSync.loadXiaoye(workspaceMode, apiMode),
      refreshDateIndex: () => contentSync.loadDateIndex(),
    }),
    [contentSync],
  );
  const timelineWorkspace = useTimelineWorkspace({
    initialDate: getTodayDateText(),
    remoteData,
    sourceRevision:
      contentSyncSnapshot.sources.timeline?.revision ?? 0,
    theme: timelineStyleTheme,
    buildPage: buildTimelineWorkspaceViewModel,
    port: timelinePort,
    sync: timelineSync,
    navigation: timelineNavigation,
  });
  const archiveWorkspace = useArchiveWorkspace({
    initialDate: getTodayDateText(),
    remoteData,
    sourceRevision: contentSyncSnapshot.revision,
    theme: styleTheme,
    buildPage: buildArchiveWorkspaceViewModel,
    port: archivePort,
    sync: archiveSync,
    navigation: archiveNavigation,
  });
  const timelineViewModel = timelineWorkspace.viewModel;
  const timelineCommands = timelineWorkspace.commands;
  const archiveViewModel = archiveWorkspace.viewModel;
  const archiveCommands = archiveWorkspace.commands;
  const browseDateFlow = useMemo(
    () =>
      createBrowseDateFlow({
        timeline: {
          openDate: timelineCommands.openDate,
        },
        archive: {
          openDate: archiveCommands.openDate,
        },
      }),
    [archiveCommands.openDate, timelineCommands.openDate],
  );
  const timelineView = timelineViewModel.view;
  const statsPeriod = timelineViewModel.statsPeriod;
  const archiveSubject = archiveViewModel.subject;
  const selectedMode = archiveViewModel.mode;
  const selectedXiaoyeMode = archiveViewModel.xiaoyeMode;
  const selectedDate =
    activeSection === "Timeline"
      ? timelineViewModel.date
      : archiveViewModel.date;
  const setSelectedDate = useCallback(
    (action) => {
      const current =
        activeSection === "Timeline"
          ? timelineViewModel.date
          : archiveViewModel.date;
      const nextDate = resolveStateAction(action, current);
      browseDateFlow.openDate(nextDate);
    },
    [
      activeSection,
      archiveViewModel.date,
      browseDateFlow,
      timelineViewModel.date,
    ],
  );
  const setTimelineView = timelineCommands.selectView;
  const setStatsPeriod = timelineCommands.selectStatsPeriod;
  const setArchiveSubject = archiveCommands.selectSubject;
  const setSelectedMode = archiveCommands.selectMode;
  const setSelectedXiaoyeMode =
    archiveCommands.selectXiaoyeMode;
  const conversationProfileCommands = useMemo(
    () => ({
      saveUserProfile:
        dependencies.murmurLaneData.saveConversationUserProfile,
      saveThreadProfile:
        dependencies.murmurLaneData.saveConversationThreadProfile,
    }),
    [dependencies.murmurLaneData],
  );
  const loadConversationRecords = useCallback(
    (date, options) =>
      contentSync.loadConversations(date, options),
    [contentSync],
  );
  const conversationWorkspace = useConversationWorkspace({
    webChat: dependencies.webChat,
    active: activeSection === "Conversation",
    initialThreadId: defaultConversationThreadId,
    initialDate: getTodayDateText(),
    profileCommands: conversationProfileCommands,
    loadConversationRecords,
    navigation: conversationNavigation,
    remoteData,
    styleTheme,
  });
  const conversationViewModel = conversationWorkspace.viewModel;
  const conversationCommands = conversationWorkspace.commands;
  const selectedThreadId = conversationViewModel.selectedThreadId;
  const conversationCalendarDate = conversationViewModel.calendarDate;
  const conversationView = conversationViewModel.pageMode;
  const conversationSettingsMode = conversationViewModel.settingsMode;
  const conversationPlaceholder = conversationViewModel.placeholder;
  const conversationJumpDate = conversationViewModel.jumpDate;
  const conversationUnreadCounts = conversationViewModel.unreadCounts;
  const messageNotificationQueue =
    conversationViewModel.notificationQueue;
  const conversationDateLoading =
    conversationViewModel.dateLoading;
  const userProfile = conversationViewModel.userProfile;
  const effectiveThreadProfiles =
    conversationViewModel.threadProfiles;
  const profileThreadIds = conversationViewModel.threadIds;
  const conversationThreadSummaries =
    conversationViewModel.threadSummaries;
  const selectedThreadDates =
    conversationViewModel.selectedThreadDates;
  const allConversationDates =
    conversationViewModel.allConversationDates;
  const earlierConversationDateToLoad =
    conversationViewModel.earlierDateToLoad;
  const laterConversationDateToLoad =
    conversationViewModel.laterDateToLoad;
  const webChatViewModel = conversationViewModel;
  const webChatCommands = conversationCommands;
  const setConversationView = conversationCommands.setPageMode;
  const setConversationSettingsMode =
    conversationCommands.setSettingsMode;
  const setConversationProfilePreview =
    conversationCommands.setProfilePreview;
  const setConversationPlaceholder =
    conversationCommands.setPlaceholder;
  const setConversationJumpDate = conversationCommands.setJumpDate;
  const setConversationCalendarDate = useCallback(
    (date) => conversationCommands.openDate(date),
    [conversationCommands.openDate],
  );
  const handleSelectThread = conversationCommands.selectThread;
  const openNewConversationThread = conversationCommands.openNewThread;
  const setUserProfile = conversationCommands.saveUserProfile;
  const updateThreadProfile =
    conversationCommands.updateThreadProfile;
  const dismissMessageNotification =
    conversationCommands.dismissNotification;
  const [searchQuery, setSearchQuery] = useState("");
  const remoteError = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(contentSyncSnapshot.sources)
          .filter(([, metadata]) => metadata.error != null)
          .map(([source, metadata]) => [
            source,
            metadata.error instanceof Error
              ? metadata.error.message
              : "内容同步失败",
          ]),
      ),
    [contentSyncSnapshot.sources],
  );
  const [editAccessState, setEditAccessState] = useState({
    ready: false,
    canWrite: false,
    message: "",
  });

  const selectedDateRef = useRef(selectedDate);
  const liveSearchActiveRef = useRef(false);
  const liveUpdateCoordinatorRef =
    useRef<LiveUpdateCoordinator | null>(null);
  selectedDateRef.current = selectedDate;
  liveSearchActiveRef.current =
    Boolean(String(searchQuery ?? "").trim()) ||
    conversationView === "search" ||
    conversationView === "global-search";

  const refreshLiveEvents = useCallback(async (events) => {
    const refreshResult = await contentSync.refreshEvents(
      events,
      selectedDateRef.current,
    );
    conversationCommands.observeCanonicalBatches(
      refreshResult.conversations,
      "background-refresh",
    );
  }, [contentSync, conversationCommands.observeCanonicalBatches]);

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

  const conversationMediaUrls = useMemo(
    () => ({
      resolveLocalFile:
        dependencies.murmurLaneData.resolveFileUrl,
      resolveWebChatAsset:
        dependencies.webChat.resolveAssetUrl,
    }),
    [dependencies],
  );

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
        profileThreadIds,
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
    profileThreadIds,
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
      conversationCommands.observeCanonicalBatches(
        Array.isArray(conversations)
          ? [{ date: dotDate, records: conversations }]
          : [],
        "baseline",
      );
    };

    loadDatedData();

    return () => {
      cancelled = true;
    };
  }, [
    contentSync,
    conversationCommands.observeCanonicalBatches,
    selectedDate,
  ]);

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
      conversationCommands.observeCanonicalBatches(
        batches,
        "cache-fill",
      );
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
    conversationCommands.observeCanonicalBatches,
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
      conversationCommands.observeCanonicalBatches(
        batches,
        "cache-fill",
      );
    };

    void loadSearchData();

    return () => {
      cancelled = true;
    };
  }, [
    searchQuery,
    remoteDateIndexState,
    contentSync,
    conversationCommands.observeCanonicalBatches,
  ]);

  const searchRemoteData =
    activeSection === "Timeline"
      ? timelineViewModel.effectiveRemoteData
      : archiveViewModel.effectiveRemoteData;
  const searchDataVersion =
    getSearchDataVersion(searchRemoteData);

  const archiveShowsXiaoye =
    activeSection === "Archive" && archiveSubject === "Xiaoye";
  const pageScrollMode = activeSection === "Timeline" ? "page" : "contained";
  const page = useMemo(() => {
    if (activeSection === "Conversation")
      return conversationViewModel.page;
    if (activeSection === "Timeline")
      return timelineViewModel.page;
    return archiveViewModel.page;
  }, [
    activeSection,
    archiveViewModel.page,
    conversationViewModel.page,
    timelineViewModel.page,
  ]);

  const handleSwipeDate = (offset) => {
    setSelectedDate((current) => shiftDate(current, offset));
  };
  const handleSelectDate = (dateText) => {
    setSelectedDate(dateText);
  };
  const handleSelectMonth = (month) => {
    setSelectedDate((current) => changeDateMonth(current, month));
  };
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
  };

  const openConversationThread = (summary) => {
    conversationCommands.openThread(
      summary.threadId,
      summary.latestDate,
    );
  };

  const handleOpenMessageNotification = (notification) => {
    appNavigation.requestNavigation({
      workspace: "conversation",
      target: {
        threadId: notification.threadId,
        date: notification.date,
      },
    });
  };

  const loadConversationThreadDate = useCallback(async (
    dateText,
    threadId = selectedThreadId,
  ) =>
    conversationCommands.loadThreadDate(
      toDotDate(dateText),
      threadId,
    ), [
    conversationCommands,
    selectedThreadId,
  ]);

  const handleLoadEarlierConversationDate = useCallback(async () => {
    if (!earlierConversationDateToLoad) {
      return false;
    }
    return loadConversationThreadDate(earlierConversationDateToLoad);
  }, [earlierConversationDateToLoad, loadConversationThreadDate]);

  const handleLoadLaterConversationDate = useCallback(async () => {
    if (!laterConversationDateToLoad) {
      return false;
    }
    return loadConversationThreadDate(laterConversationDateToLoad);
  }, [laterConversationDateToLoad, loadConversationThreadDate]);

  const handleSelectConversationDate = async (dateText) => {
    const date = toDotDate(dateText);
    await loadConversationThreadDate(date);
    setConversationCalendarDate(date);
    setConversationJumpDate(date);
  };

  const handleSelectConversationSearchResult = async (record) => {
    const date = toDotDate(record?.conversationDate || record?.timestamp?.slice(0, 10));
    await conversationCommands.openSearchResult({
      threadId: selectedThreadId,
      date,
      messageId: record.id,
    });
  };

  const handleSelectGlobalConversationSearchResult = async (record) => {
    const threadId = String(record?.threadId || "");
    if (!threadId) return;
    const date = toDotDate(
      record?.conversationDate || record?.timestamp?.slice(0, 10),
    );
    appNavigation.requestNavigation({
      workspace: "conversation",
      target: {
        threadId,
        date,
        messageId: record.id,
      },
    });
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
                      searchRemoteData={searchRemoteData}
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
                              query: result.query,
                            },
                          });
                        } else if (result.mode === "Timeline") {
                          appNavigation.requestNavigation({
                            workspace: "timeline",
                            target: {
                              date: result.date,
                              eventId: result.targetId,
                              view: result.timelineView,
                              query: result.query,
                            },
                          });
                          browseDateFlow.openDate(result.date);
                        } else if (result.mode === "Xiaoye") {
                          appNavigation.requestNavigation({
                            workspace: "archive",
                            target: {
                              subject: "Xiaoye",
                              date: result.date,
                              documentId: result.targetId,
                              xiaoyeMode: result.xiaoyeMode,
                              query: result.query,
                            },
                          });
                          browseDateFlow.openDate(result.date);
                        } else {
                          appNavigation.requestNavigation({
                            workspace: "archive",
                            target: {
                              subject: "Me",
                              date: result.date,
                              documentId: result.targetId,
                              mode: result.mode,
                              query: result.query,
                            },
                          });
                          browseDateFlow.openDate(result.date);
                        }
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
                highlightResult={
                  conversationViewModel.navigationTarget
                }
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
                transcript={conversationViewModel.transcript}
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
                    highlightResult={
                      timelineViewModel.navigationTarget
                    }
                    onSelectStatsPeriod={setStatsPeriod}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                    scrollHitIntoView={scrollHitIntoView}
                    canEdit={editAccessState.canWrite}
                    editHint={
                      editAccessState.ready ? editAccessState.message : ""
                    }
                    commands={{
                      fetchEvent:
                        timelineCommands.fetchEvent,
                      patchEvent:
                        timelineCommands.saveEvent,
                      deleteEvent:
                        timelineCommands.deleteEvent,
                    }}
                  />
                ) : archiveShowsXiaoye ? (
                  <XiaoyePage
                    page={page}
                    highlightResult={
                      archiveViewModel.navigationTarget
                    }
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                    onSelectXiaoyeMode={setSelectedXiaoyeMode}
                    selectedXiaoyeMode={selectedXiaoyeMode}
                    scrollHitIntoView={scrollHitIntoView}
                    canEdit={editAccessState.canWrite}
                    editHint={
                      editAccessState.ready ? editAccessState.message : ""
                    }
                    onLoadEditableDocument={
                      archiveCommands.loadDocument
                    }
                    onSaveEditableDocument={
                      archiveCommands.saveDocument
                    }
                  />
                ) : (
                  <DirectoryPage
                    page={page}
                    highlightResult={
                      archiveViewModel.navigationTarget
                    }
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onMonthSelect={handleSelectMonth}
                    onOpenShare={() => setDiaryShareOpen(true)}
                    onSelectMode={setSelectedMode}
                    selectedMode={selectedMode}
                    onSelectedShareTextChange={setSelectedShareText}
                    scrollHitIntoView={scrollHitIntoView}
                    onToggleOpenLoop={
                      editAccessState.canWrite
                        ? archiveCommands.toggleOpenLoop
                        : undefined
                    }
                    canEdit={editAccessState.canWrite}
                    editHint={
                      editAccessState.ready ? editAccessState.message : ""
                    }
                    onLoadEditableDocument={
                      archiveCommands.loadDocument
                    }
                    onSaveEditableDocument={
                      archiveCommands.saveDocument
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
            activeSection={activeSection}
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
                  onPreview={(
                    profile: ConversationThreadProfile,
                  ) =>
                    setConversationProfilePreview({
                      threadId: selectedThreadId,
                      profile,
                    })
                  }
                  onSave={async (
                    profile: ConversationThreadProfile,
                  ) => {
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



