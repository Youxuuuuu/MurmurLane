import type {
  ConversationMomentsResponse,
  ConversationProfilesResponse,
  ConversationsResponse,
  DateIndexResponse,
  FetchConversationsOptions,
  FetchTimelineOptions,
  MemoryApiResponse,
  ReminderHistoryApiResponse,
  TimelineApiResponse,
} from "../types/api";
import type { ConversationRecord } from "../types/conversation";
import type { MemoryMode } from "../types/memory";
import type { TimelineState } from "../types/timeline";
import { staticModeApiMap } from "../config/contentSources";
import { xiaoyeModeMeta } from "../config/pageModes";
import { toDotDate } from "../lib/date";
import type { ContentChangeEvent } from "./liveUpdateCoordinator";
import type {
  ContentSyncSource,
  ContentSyncStore,
} from "./sourceSnapshotStore";

export interface ContentSyncDataPort {
  fetchConversations(
    date: string,
    options?: FetchConversationsOptions,
  ): Promise<ConversationsResponse>;
  fetchConversationMoments(days?: number): Promise<ConversationMomentsResponse>;
  fetchConversationProfiles(): Promise<ConversationProfilesResponse>;
  fetchDateIndex(): Promise<DateIndexResponse>;
  fetchMemoryDailySummary(date: string): Promise<MemoryApiResponse>;
  fetchMemoryDiary(date: string): Promise<MemoryApiResponse>;
  fetchMemoryLetters(date: string): Promise<MemoryApiResponse>;
  fetchMemoryStatic(mode: string): Promise<MemoryApiResponse>;
  fetchReminderHistory(): Promise<ReminderHistoryApiResponse>;
  fetchTimeline(options?: FetchTimelineOptions): Promise<TimelineApiResponse>;
  fetchXiaoyeStatic(mode: string): Promise<MemoryApiResponse>;
}

export type DatedMemorySource = "diary" | "dailySummary" | "letters";

export interface ContentSyncService {
  bootstrap(): Promise<void>;
  loadIndexedSearchSources(): Promise<
    readonly ContentSyncConversationBatch[]
  >;
  loadLatestConversationDates(): Promise<
    readonly ContentSyncConversationBatch[]
  >;
  loadConversations(
    date: string,
    options?: FetchConversationsOptions,
  ): Promise<ConversationRecord[] | null>;
  loadDateIndex(): Promise<DateIndexResponse | null>;
  loadDatedMemory(
    source: DatedMemorySource,
    date: string,
  ): Promise<MemoryApiResponse | null>;
  loadTimeline(options?: FetchTimelineOptions): Promise<Record<string, unknown> | null>;
  loadStaticMemory(
    workspaceMode: MemoryMode,
    apiMode: string,
  ): Promise<MemoryApiResponse | null>;
  loadXiaoye(
    workspaceMode: string,
    apiMode: string,
  ): Promise<MemoryApiResponse | null>;
  loadReminders(): Promise<ReminderHistoryApiResponse | null>;
  loadMoments(days?: number): Promise<ConversationMomentsResponse | null>;
  loadProfiles(): Promise<ConversationProfilesResponse | null>;
  refreshEvents(
    events: readonly ContentChangeEvent[],
    currentDate: string,
  ): Promise<ContentSyncRefreshResult>;
}

export interface ContentSyncRefreshResult {
  readonly conversations: readonly ContentSyncConversationBatch[];
  readonly moments: ConversationMomentsResponse | null;
}

export interface ContentSyncConversationBatch {
  readonly date: string;
  readonly records: readonly ConversationRecord[];
}

function normalizeTimelineResponse(
  response: TimelineApiResponse,
): Record<string, unknown> {
  if (!response || response.found === false || typeof response !== "object") {
    return {};
  }

  const facts = "facts" in response && response.facts
    ? response.facts
    : response;
  return {
    ...Object.fromEntries(
      Object.entries(facts)
        .filter(([, value]) => {
          return Boolean(
            value &&
              typeof value === "object" &&
              "events" in value,
          );
        })
        .map(([key, value]) => [toDotDate(key), value]),
    ),
    ...("taxonomy" in response && response.taxonomy
      ? { taxonomy: response.taxonomy }
      : {}),
    ...("version" in response && response.version != null
      ? { version: response.version }
      : {}),
    ...("timezone" in response && response.timezone
      ? { timezone: response.timezone }
      : {}),
    ...("proposals" in response && Array.isArray(response.proposals)
      ? { proposals: response.proposals }
      : {}),
  };
}

function datedMemoryLoader(
  port: ContentSyncDataPort,
  source: DatedMemorySource,
) {
  if (source === "diary") return port.fetchMemoryDiary;
  if (source === "dailySummary") return port.fetchMemoryDailySummary;
  return port.fetchMemoryLetters;
}

function groupConversationRecordsByThread(
  records: readonly ConversationRecord[],
) {
  return records.reduce<Record<string, ConversationRecord[]>>(
    (grouped, record) => {
      const threadId = String(record.threadId || "");
      if (!threadId) return grouped;
      (grouped[threadId] ??= []).push(record);
      return grouped;
    },
    {},
  );
}

function datedMemoryField(source: DatedMemorySource) {
  if (source === "diary") return "diaryEntries" as const;
  if (source === "dailySummary") return "dailySummaryEntries" as const;
  return "letterEntries" as const;
}

function contentChangeIdentity(event: ContentChangeEvent) {
  return [
    event.type,
    event.date || "",
    event.mode || "",
    event.threadId || "",
  ].join(":");
}

export function createContentSyncService({
  store,
  port,
}: {
  readonly store: ContentSyncStore;
  readonly port: ContentSyncDataPort;
}): ContentSyncService {
  const fail = (
    identity: ReturnType<ContentSyncStore["begin"]>,
    error: unknown,
  ) => {
    store.fail(identity, error);
    return null;
  };

  const service: ContentSyncService = {
    async bootstrap() {
      await Promise.allSettled([
        service.loadTimeline(),
        service.loadDateIndex(),
        service.loadReminders(),
        ...Object.entries(staticModeApiMap).map(
          ([workspaceMode, apiMode]) =>
            service.loadStaticMemory(
              workspaceMode as MemoryMode,
              apiMode,
            ),
        ),
        ...Object.entries(xiaoyeModeMeta).map(
          ([workspaceMode, metadata]) =>
            service.loadXiaoye(workspaceMode, metadata.apiMode),
        ),
        service.loadProfiles(),
        service.loadMoments(3),
      ]);
    },
    async loadIndexedSearchSources() {
      const snapshot = store.getSnapshot();
      const dateIndex = snapshot.data.dateIndex;
      if (!dateIndex) return [];
      const conversationBatches: ContentSyncConversationBatch[] = [];
      const tasks: Array<() => Promise<void>> = [
        ...(dateIndex.conversations ?? [])
          .map(toDotDate)
          .filter(
            (date) =>
              !snapshot.data.conversationEntries[date] &&
              !snapshot.data.searchCache.conversations[date],
          )
          .map((date) => async () => {
            const records = await service.loadConversations(date);
            if (records) conversationBatches.push({ date, records });
          }),
        ...(dateIndex.diary ?? [])
          .map(toDotDate)
          .filter(
            (date) =>
              !snapshot.data.diaryEntries[date] &&
              !snapshot.data.searchCache.diary[date] &&
              !snapshot.negativeCache.diary[date],
          )
          .map((date) => async () => {
            await service.loadDatedMemory("diary", date);
          }),
        ...(dateIndex.dailySummary ?? [])
          .map(toDotDate)
          .filter(
            (date) =>
              !snapshot.data.dailySummaryEntries[date] &&
              !snapshot.data.searchCache.dailySummary[date] &&
              !snapshot.negativeCache.dailySummary[date],
          )
          .map((date) => async () => {
            await service.loadDatedMemory("dailySummary", date);
          }),
        ...(dateIndex.letters ?? [])
          .map(toDotDate)
          .filter(
            (date) =>
              !snapshot.data.letterEntries[date] &&
              !snapshot.data.searchCache.letters[date] &&
              !snapshot.negativeCache.letters[date],
          )
          .map((date) => async () => {
            await service.loadDatedMemory("letters", date);
          }),
      ];
      let cursor = 0;
      const runTask = async () => {
        while (cursor < tasks.length) {
          const task = tasks[cursor];
          cursor += 1;
          await task();
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(4, tasks.length) },
          () => runTask(),
        ),
      );
      return conversationBatches;
    },
    async loadLatestConversationDates() {
      const snapshot = store.getSnapshot();
      const threadIndex =
        snapshot.data.dateIndex?.conversationThreads ?? {};
      const dates = Array.from(
        new Set(
          Object.values(threadIndex)
            .map((threadDates) => threadDates[threadDates.length - 1])
            .filter((date): date is string => Boolean(date))
            .map(toDotDate),
        ),
      ).filter(
        (date) =>
          !snapshot.data.conversationEntries[date] &&
          !snapshot.data.searchCache.conversations[date],
      );
      const batches: ContentSyncConversationBatch[] = [];
      await Promise.all(
        dates.map(async (date: string) => {
          const records = await service.loadConversations(date);
          if (records) batches.push({ date, records });
        }),
      );
      return batches;
    },
    async loadConversations(
      date: string,
      options: FetchConversationsOptions = {},
    ) {
      const dotDate = toDotDate(date);
      const key = options.threadId
        ? `${dotDate}:${options.threadId}`
        : dotDate;
      const identity = store.begin("conversation", key);
      try {
        const records = await port.fetchConversations(dotDate, options);
        const grouped = records.length
          ? groupConversationRecordsByThread(records)
          : {};
        const committed = store.commit(identity, (current) => ({
          ...current,
          conversationEntries: {
            ...current.conversationEntries,
            [dotDate]: options.threadId
              ? {
                  ...(current.conversationEntries[dotDate] ?? {}),
                  ...grouped,
                }
              : grouped,
          },
          searchCache: {
            ...current.searchCache,
            conversations: {
              ...current.searchCache.conversations,
              [dotDate]: options.threadId
                ? {
                    ...(current.searchCache.conversations[dotDate] ?? {}),
                    ...grouped,
                  }
                : grouped,
            },
          },
        }));
        return committed ? records : null;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async loadDateIndex() {
      const identity = store.begin("dateIndex", "global");
      try {
        const dateIndex = await port.fetchDateIndex();
        return store.commit(identity, (current) => ({
          ...current,
          dateIndex,
        }))
          ? dateIndex
          : null;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async loadDatedMemory(
      source: DatedMemorySource,
      date: string,
    ) {
      const dotDate = toDotDate(date);
      const identity = store.begin(source, dotDate);
      try {
        const result = await datedMemoryLoader(port, source)(dotDate);
        if (!store.isCurrent(identity)) return null;
        if (result.found && result.entry) {
          const field = datedMemoryField(source);
          const committed = store.commit(identity, (current) => ({
            ...current,
            [field]: {
              ...current[field],
              [dotDate]: result.entry,
            },
            searchCache: {
              ...current.searchCache,
              [source]: {
                ...current.searchCache[source],
                [dotDate]: result.entry,
              },
            },
          }));
          if (committed) {
            store.updateNegativeCache(
              source,
              `${dotDate}:present`,
              (current) => {
                const bucket = { ...current[source] };
                delete bucket[dotDate];
                return {
                  ...current,
                  [source]: Object.freeze(bucket),
                };
              },
            );
          }
          return result;
        }
        store.commitMissingSource(identity, {
          bucket: source,
          key: dotDate,
        });
        store.update(source, dotDate, (current) => {
          const field = datedMemoryField(source);
          const nextEntries = { ...current[field] };
          delete nextEntries[dotDate];
          return { ...current, [field]: nextEntries };
        });
        return result;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async loadTimeline(options: FetchTimelineOptions = {}) {
      const key = options.date || options.month || "global";
      const identity = store.begin("timeline", key);
      try {
        const timelineState = normalizeTimelineResponse(
          await port.fetchTimeline(options),
        ) as TimelineState;
        return store.commit(identity, (current) => ({
          ...current,
          timelineState,
          searchCache: {
            ...current.searchCache,
            timeline: timelineState,
          },
        }))
          ? timelineState
          : null;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async loadStaticMemory(
      workspaceMode: MemoryMode,
      apiMode: string,
    ) {
      const identity = store.begin("staticMemory", apiMode);
      try {
        const result = await port.fetchMemoryStatic(apiMode);
        store.commit(identity, (current) => {
          const next = { ...current.staticModeEntries };
          if (result.found && result.entry) next[workspaceMode] = result.entry;
          else delete next[workspaceMode];
          return { ...current, staticModeEntries: next };
        });
        return result;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async loadXiaoye(workspaceMode: string, apiMode: string) {
      const identity = store.begin("xiaoye", apiMode);
      try {
        const result = await port.fetchXiaoyeStatic(apiMode);
        store.commit(identity, (current) => {
          const next = { ...current.xiaoyeEntries };
          if (result.found && result.entry) next[workspaceMode] = result.entry;
          else delete next[workspaceMode];
          return { ...current, xiaoyeEntries: next };
        });
        return result;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async loadReminders() {
      const identity = store.begin("reminders", "global");
      try {
        const result = await port.fetchReminderHistory();
        store.commit(identity, (current) => ({
          ...current,
          reminderHistoryEntries: Array.isArray(result.entries)
            ? result.entries
            : [],
        }));
        return result;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async loadMoments(days = 3) {
      const identity = store.begin("moments", String(days));
      try {
        const result = await port.fetchConversationMoments(days);
        return store.commit(identity, (current) => ({
          ...current,
          conversationMoments: result.moments ?? [],
        }))
          ? result
          : null;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async loadProfiles() {
      const identity = store.begin("profiles", "global");
      try {
        const result = await port.fetchConversationProfiles();
        return store.commit(identity, (current) => ({
          ...current,
          conversationProfiles: result,
        }))
          ? result
          : null;
      } catch (error) {
        return fail(identity, error);
      }
    },
    async refreshEvents(events, currentDate) {
      const uniqueEvents = Array.from(
        new Map(
          events.map((event) => [
            contentChangeIdentity(event),
            event,
          ]),
        ).values(),
      );
      const hasResync = uniqueEvents.some(
        (event) => event.type === "resync",
      );
      const resyncDateIndex = hasResync
        ? await service.loadDateIndex()
        : null;
      const resyncConversationDates = resyncDateIndex
        ? Array.from(
            new Set([
              toDotDate(currentDate),
              ...Object.values(
                resyncDateIndex.conversationThreads ?? {},
              )
                .map((dates) => dates[dates.length - 1])
                .filter((date): date is string => Boolean(date))
                .map(toDotDate),
            ]),
          )
        : [toDotDate(currentDate)];
      const expandedEvents = hasResync
        ? [
            ...resyncConversationDates.map((date) => ({
              type: "conversations" as const,
              date,
            })),
            { type: "diary" as const, date: currentDate },
            { type: "dailySummary" as const, date: currentDate },
            { type: "letters" as const, date: currentDate },
            { type: "timeline" as const },
            { type: "reminders" as const },
            { type: "profiles" as const },
            { type: "moments" as const },
            ...Object.values(staticModeApiMap).map((mode) => ({
              type: "staticMemory" as const,
              mode,
            })),
            ...Object.entries(xiaoyeModeMeta).map(([mode, metadata]) => ({
              type: "xiaoye" as const,
              mode: metadata.apiMode,
            })),
            ...uniqueEvents.filter(
              (event) => event.type !== "resync",
            ),
          ]
        : uniqueEvents;
      const deduplicatedEvents = Array.from(
        new Map(
          expandedEvents.map((event) => [
            contentChangeIdentity(event),
            event,
          ]),
        ).values(),
      );
      const conversationUpdates: Array<{
        date: string;
        records: readonly ConversationRecord[];
      }> = [];
      let moments: ConversationMomentsResponse | null = null;

      await Promise.all(
        deduplicatedEvents.map(async (event) => {
          if (event.type === "conversations" && event.date) {
            const date = toDotDate(event.date);
            const records = await service.loadConversations(date);
            if (records) {
              conversationUpdates.push({ date, records });
            }
            return;
          }
          if (
            (event.type === "diary" ||
              event.type === "dailySummary" ||
              event.type === "letters") &&
            event.date
          ) {
            await service.loadDatedMemory(event.type, event.date);
            return;
          }
          if (event.type === "timeline") {
            await service.loadTimeline();
            return;
          }
          if (event.type === "staticMemory" && event.mode) {
            const normalizedMode =
              event.mode === "patterrns" ? "patterns" : event.mode;
            const modeEntry = Object.entries(staticModeApiMap).find(
              ([, apiMode]) => apiMode === normalizedMode,
            );
            if (modeEntry) {
              await service.loadStaticMemory(
                modeEntry[0] as MemoryMode,
                normalizedMode,
              );
            }
            return;
          }
          if (event.type === "xiaoye" && event.mode) {
            const workspaceModeEntry = Object.entries(
              xiaoyeModeMeta,
            ).find(([, metadata]) => metadata.apiMode === event.mode);
            if (workspaceModeEntry) {
              await service.loadXiaoye(
                workspaceModeEntry[0],
                event.mode,
              );
            }
            return;
          }
          if (event.type === "reminders") {
            await service.loadReminders();
            return;
          }
          if (event.type === "profiles") {
            await service.loadProfiles();
            return;
          }
          if (event.type === "moments") {
            moments = await service.loadMoments(3);
          }
        }),
      );

      if (
        !resyncDateIndex &&
        deduplicatedEvents.some((event) =>
          [
            "conversations",
            "diary",
            "dailySummary",
            "letters",
            "timeline",
          ].includes(event.type),
        )
      ) {
        await service.loadDateIndex();
      }

      return Object.freeze({
        conversations: conversationUpdates,
        moments,
      });
    },
  };
  return Object.freeze(service);
}
