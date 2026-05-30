import { pageModeMeta, xiaoyeModeMeta, xiaoyeModes } from "../config/pageModes";
import { emptyRemoteData } from "../data/emptyRemoteData";
import { conversationEntries } from "../data/mockEntries";
import type { RemoteData } from "../types/api";
import type { ConversationRecord } from "../types/conversation";
import type { DatedMemoryEntries } from "../types/memory";
import type { SearchFilters, SearchResultState } from "../types/search";
import { getTodayDateText, toDotDate } from "./date";
import {
  getConversationDisplayText,
  getConversationQuoteText,
  shouldHideConversationRecord,
} from "./conversation";
import {
  getConversationRecordsForDate,
  getConversationThreadIdsForDate,
} from "./conversationPageData";
import {
  getDatedEntriesSource,
  getStaticEntryForMode,
} from "./memoryPageData";
import {
  getReminderDueAt,
  getReminderHistorySource,
} from "./reminderPageData";
import { getZonedDateText } from "./timeline";
import {
  getTimelineCategoryMeta,
  getTimelineStateSource,
} from "./timelinePageData";
import {
  buildSearchFields,
  countNormalizedSearchOccurrences,
  findMatchedSnippet,
  matchesSearchFilters,
  normalizeSearchText,
  sortSearchResults,
} from "./search";

const env = (import.meta as { env?: Record<string, unknown> }).env;
const ENABLE_SEARCH_PERF_LOG = false;

type ConversationSearchDocument = {
  date: string;
  threadId: string;
  record: ConversationRecord;
  displayText: string;
  quoteText: string;
  attachmentsText: string;
  stickersText: string;
  filesText: string;
  normalizedHaystack: string;
};

type ConversationSearchDocumentCacheEntry = {
  documents: ConversationSearchDocument[];
  datesCount: number;
  threadIdsCount: number;
  recordsCount: number;
  visibleRecordsCount: number;
};

type ConversationSearchDocumentCacheBucket = {
  all?: ConversationSearchDocumentCacheEntry;
  byThread: Map<string, ConversationSearchDocumentCacheEntry>;
};

type ConversationSearchDocumentResult = ConversationSearchDocumentCacheEntry & {
  cacheHit: boolean;
  getThreadIdsMs: number;
  getRecordsMs: number;
  shouldHideMs: number;
  displayTextMs: number;
  quoteTextMs: number;
  mediaTextMs: number;
  precheckNormalizeMs: number;
};

const conversationSearchDocumentCache = new WeakMap<
  object,
  ConversationSearchDocumentCacheBucket
>();

function getConversationCacheBucket(
  remoteData: RemoteData = emptyRemoteData,
): ConversationSearchDocumentCacheBucket {
  const cacheKey = remoteData as object;
  const cached = conversationSearchDocumentCache.get(cacheKey);

  if (cached) return cached;

  const nextBucket: ConversationSearchDocumentCacheBucket = {
    all: undefined,
    byThread: new Map(),
  };
  conversationSearchDocumentCache.set(cacheKey, nextBucket);
  return nextBucket;
}

function buildConversationSearchDocumentEntry(
  remoteData: RemoteData = emptyRemoteData,
  {
    conversationThreadScope = "all",
    conversationThreadId = null,
    perfEnabled = false,
  }: {
    conversationThreadScope?: "all" | "current";
    conversationThreadId?: string | null;
    perfEnabled?: boolean;
  } = {},
): ConversationSearchDocumentResult {
  const allConversationDates = Array.from(
    new Set([
      ...Object.keys(conversationEntries),
      ...Object.keys(remoteData.conversationEntries),
      ...Object.keys(remoteData.searchCache.conversations),
    ]),
  );
  const nextDocuments: ConversationSearchDocument[] = [];
  let threadIdsCount = 0;
  let recordsCount = 0;
  let visibleRecordsCount = 0;
  let getThreadIdsMs = 0;
  let getRecordsMs = 0;
  let shouldHideMs = 0;
  let displayTextMs = 0;
  let quoteTextMs = 0;
  let mediaTextMs = 0;
  let precheckNormalizeMs = 0;
  const useCurrentThreadOnly =
    conversationThreadScope === "current" && Boolean(conversationThreadId);

  allConversationDates.forEach((date) => {
    const threadIds = useCurrentThreadOnly
      ? [conversationThreadId as string]
      : (() => {
          const getThreadIdsStart = perfEnabled ? performance.now() : 0;
          const nextThreadIds = getConversationThreadIdsForDate(date, remoteData);
          if (perfEnabled) {
            getThreadIdsMs += performance.now() - getThreadIdsStart;
          }
          return nextThreadIds;
        })();
    threadIdsCount += threadIds.length;

    threadIds.forEach((threadId) => {
      const getRecordsStart = perfEnabled ? performance.now() : 0;
      const records = getConversationRecordsForDate(date, threadId, remoteData);
      if (perfEnabled) {
        getRecordsMs += performance.now() - getRecordsStart;
      }
      recordsCount += records.length;

      records.forEach((record) => {
        const shouldHideStart = perfEnabled ? performance.now() : 0;
        const hidden = shouldHideConversationRecord(record);
        if (perfEnabled) {
          shouldHideMs += performance.now() - shouldHideStart;
        }
        if (hidden) return;

        visibleRecordsCount += 1;

        const displayTextStart = perfEnabled ? performance.now() : 0;
        const displayText = getConversationDisplayText(record);
        if (perfEnabled) {
          displayTextMs += performance.now() - displayTextStart;
        }

        const quoteTextStart = perfEnabled ? performance.now() : 0;
        const quoteText = getConversationQuoteText(record);
        if (perfEnabled) {
          quoteTextMs += performance.now() - quoteTextStart;
        }

        const mediaTextStart = perfEnabled ? performance.now() : 0;
        const attachmentsText = (record.meta?.attachments ?? [])
          .map(
            (item) =>
              item.label || item.fileName || item.relativePath || "",
          )
          .join(" ");
        const stickersText = (record.meta?.stickers ?? [])
          .map(
            (item) =>
              item.label ||
              item.fileName ||
              item.stickerId ||
              item.relativePath ||
              "",
          )
          .join(" ");
        const filesText = (record.meta?.files ?? [])
          .map(
            (item) =>
              item.label || item.fileName || item.relativePath || "",
          )
          .join(" ");
        if (perfEnabled) {
          mediaTextMs += performance.now() - mediaTextStart;
        }

        const precheckNormalizeStart = perfEnabled ? performance.now() : 0;
        const normalizedHaystack = [
          date,
          displayText,
          quoteText,
          record.meta?.toolName,
          record.meta?.displayPath || record.meta?.path,
          record.meta?.pattern,
          attachmentsText,
          stickersText,
          filesText,
          threadId,
        ]
          .map((part) => normalizeSearchText(part))
          .join("");
        if (perfEnabled) {
          precheckNormalizeMs += performance.now() - precheckNormalizeStart;
        }

        nextDocuments.push({
          date,
          threadId,
          record,
          displayText,
          quoteText,
          attachmentsText,
          stickersText,
          filesText,
          normalizedHaystack,
        });
      });
    });
  });

  const cacheEntry = {
    documents: nextDocuments,
    datesCount: allConversationDates.length,
    threadIdsCount,
    recordsCount,
    visibleRecordsCount,
  };

  return {
    ...cacheEntry,
    cacheHit: false,
    getThreadIdsMs,
    getRecordsMs,
    shouldHideMs,
    displayTextMs,
    quoteTextMs,
    mediaTextMs,
    precheckNormalizeMs,
  };
}

function getConversationSearchDocuments(
  remoteData: RemoteData = emptyRemoteData,
  {
    conversationThreadScope = "all",
    conversationThreadId = null,
    perfEnabled = false,
  }: {
    conversationThreadScope?: "all" | "current";
    conversationThreadId?: string | null;
    perfEnabled?: boolean;
  } = {},
): ConversationSearchDocumentResult {
  const bucket = getConversationCacheBucket(remoteData);
  const useCurrentThreadOnly =
    conversationThreadScope === "current" && Boolean(conversationThreadId);

  if (useCurrentThreadOnly) {
    const cached = bucket.byThread.get(conversationThreadId as string);
    if (cached) {
      return {
        ...cached,
        cacheHit: true,
        getThreadIdsMs: 0,
        getRecordsMs: 0,
        shouldHideMs: 0,
        displayTextMs: 0,
        quoteTextMs: 0,
        mediaTextMs: 0,
        precheckNormalizeMs: 0,
      };
    }

    const nextEntry = buildConversationSearchDocumentEntry(remoteData, {
      conversationThreadScope,
      conversationThreadId,
      perfEnabled,
    });
    bucket.byThread.set(conversationThreadId as string, {
      documents: nextEntry.documents,
      datesCount: nextEntry.datesCount,
      threadIdsCount: nextEntry.threadIdsCount,
      recordsCount: nextEntry.recordsCount,
      visibleRecordsCount: nextEntry.visibleRecordsCount,
    });
    return nextEntry;
  }

  if (bucket.all) {
    return {
      ...bucket.all,
      cacheHit: true,
      getThreadIdsMs: 0,
      getRecordsMs: 0,
      shouldHideMs: 0,
      displayTextMs: 0,
      quoteTextMs: 0,
      mediaTextMs: 0,
      precheckNormalizeMs: 0,
    };
  }

  const nextEntry = buildConversationSearchDocumentEntry(remoteData, {
    conversationThreadScope: "all",
    conversationThreadId: null,
    perfEnabled,
  });
  bucket.all = {
    documents: nextEntry.documents,
    datesCount: nextEntry.datesCount,
    threadIdsCount: nextEntry.threadIdsCount,
    recordsCount: nextEntry.recordsCount,
    visibleRecordsCount: nextEntry.visibleRecordsCount,
  };
  return nextEntry;
}

export function buildSearchResultState(
  query: unknown,
  remoteData: RemoteData = emptyRemoteData,
  {
    modeFilter = "All",
    timeFilter = "All",
    conversationThreadScope = "all",
    conversationThreadId = null,
    selectedDate = getTodayDateText(),
    limit = 50,
  }: SearchFilters & { selectedDate?: string; limit?: number } = {},
): SearchResultState {
  const cleanQuery = String(query ?? "").trim();
  const normalizedQuery = normalizeSearchText(cleanQuery);

  if (!normalizedQuery) {
    return {
      results: [],
      totalOccurrences: 0,
    };
  }

  const results = [];
  let totalOccurrences = 0;
  const filters = { modeFilter, timeFilter };
  const perfEnabled =
    Boolean(env?.DEV) &&
    ENABLE_SEARCH_PERF_LOG &&
    Boolean(normalizedQuery);
  const perfMarks: Array<{
    name: string;
    durationMs: number;
    resultsLength: number;
    totalOccurrences: number;
  }> = [];

  const measureSearchBlock = (name: string, run: () => void) => {
    if (!perfEnabled) {
      run();
      return;
    }

    const start = performance.now();
    run();
    perfMarks.push({
      name,
      durationMs: Number((performance.now() - start).toFixed(1)),
      resultsLength: results.length,
      totalOccurrences,
    });
  };

  const appendSearchResult = ({
    mode,
    date = null,
    filterDate = null,
    timestamp = null,
    threadId = null,
    xiaoyeMode = null,
    timelineView = null,
    targetId,
    title,
    label,
    fields,
    haystackParts,
  }) => {
    const normalizedHaystack = haystackParts
      .map((part) => normalizeSearchText(part))
      .join("");

    if (!normalizedHaystack.includes(normalizedQuery)) return;

    const result = {
      mode,
      date,
      filterDate: filterDate ? toDotDate(filterDate) : null,
      timestamp,
      threadId,
      xiaoyeMode,
      timelineView,
      targetId,
      title,
      query: cleanQuery,
      label,
    };

    if (!matchesSearchFilters(result as any, filters, selectedDate)) return;

    const occurrences = countNormalizedSearchOccurrences(
      normalizedHaystack,
      normalizedQuery,
    );

    if (!occurrences) return;

    totalOccurrences += occurrences;

    const match = findMatchedSnippet(cleanQuery, fields, normalizedQuery);

    results.push({
      ...result,
      excerpt: match.snippet,
      fieldLabel: match.fieldLabel,
    });
  };

  measureSearchBlock("Conversation", () => {
    const conversationDocsResult = getConversationSearchDocuments(
      remoteData,
      {
        conversationThreadScope,
        conversationThreadId,
        perfEnabled,
      },
    );
    const conversationPerf = {
      datesCount: conversationDocsResult.datesCount,
      threadIdsCount: conversationDocsResult.threadIdsCount,
      recordsCount: conversationDocsResult.recordsCount,
      visibleRecordsCount: conversationDocsResult.visibleRecordsCount,
      conversationDocsCount: conversationDocsResult.documents.length,
      cacheHit: conversationDocsResult.cacheHit,
      precheckHitCount: 0,
      getThreadIdsMs: conversationDocsResult.getThreadIdsMs,
      getRecordsMs: conversationDocsResult.getRecordsMs,
      shouldHideMs: conversationDocsResult.shouldHideMs,
      displayTextMs: conversationDocsResult.displayTextMs,
      quoteTextMs: conversationDocsResult.quoteTextMs,
      mediaTextMs: conversationDocsResult.mediaTextMs,
      precheckNormalizeMs: conversationDocsResult.precheckNormalizeMs,
      buildFieldsMs: 0,
      appendMs: 0,
    };
    const conversationPerfEnabled = perfEnabled;
    const conversationStartTime = conversationPerfEnabled
      ? performance.now()
      : 0;

    conversationDocsResult.documents.forEach((doc) => {
      if (
        conversationThreadScope === "current" &&
        conversationThreadId &&
        doc.threadId !== conversationThreadId
      ) {
        return;
      }

      if (!doc.normalizedHaystack.includes(normalizedQuery)) return;

      conversationPerf.precheckHitCount += 1;

      const buildFieldsStart = conversationPerfEnabled
        ? performance.now()
        : 0;
      const fields = buildSearchFields([
        {
          label:
            doc.record.type === "thinking"
              ? "思考"
              : doc.record.type === "operation"
                ? "操作"
                : "消息",
          value: doc.displayText,
        },
        { label: "引用", value: doc.quoteText },
        { label: "工具", value: doc.record.meta?.toolName },
        {
          label: "路径",
          value: doc.record.meta?.displayPath || doc.record.meta?.path,
        },
        { label: "模式", value: doc.record.meta?.pattern },
        { label: "附件", value: doc.attachmentsText },
        { label: "表情包", value: doc.stickersText },
        { label: "文件名", value: doc.filesText },
        { label: "线程", value: doc.threadId },
      ]);
      if (conversationPerfEnabled) {
        conversationPerf.buildFieldsMs += performance.now() - buildFieldsStart;
      }

      const appendStart = conversationPerfEnabled ? performance.now() : 0;
      appendSearchResult({
        mode: "Conversation",
        date: doc.date,
        filterDate: doc.date,
        timestamp: doc.record.timestamp,
        threadId: doc.threadId,
        targetId: doc.record.id,
        title:
          doc.displayText ||
          doc.quoteText ||
          doc.filesText ||
          doc.attachmentsText ||
          doc.stickersText ||
          "对话消息",
        label: `对话 · ${doc.date}`,
        fields,
        haystackParts: [
          doc.date,
          ...fields.map((field) => field.normalizedValue),
        ],
      });
      if (conversationPerfEnabled) {
        conversationPerf.appendMs += performance.now() - appendStart;
      }
    });

    if (conversationPerfEnabled) {
      console.debug("[MurmurLane Search Perf] conversation detail", {
        query: cleanQuery,
        modeFilter,
        selectedDate,
        datesCount: conversationPerf.datesCount,
        threadIdsCount: conversationPerf.threadIdsCount,
        recordsCount: conversationPerf.recordsCount,
        visibleRecordsCount: conversationPerf.visibleRecordsCount,
        conversationDocsCount: conversationPerf.conversationDocsCount,
        cacheHit: conversationPerf.cacheHit,
        precheckHitCount: conversationPerf.precheckHitCount,
        getThreadIdsMs: Number(conversationPerf.getThreadIdsMs.toFixed(1)),
        getRecordsMs: Number(conversationPerf.getRecordsMs.toFixed(1)),
        shouldHideMs: Number(conversationPerf.shouldHideMs.toFixed(1)),
        displayTextMs: Number(conversationPerf.displayTextMs.toFixed(1)),
        quoteTextMs: Number(conversationPerf.quoteTextMs.toFixed(1)),
        mediaTextMs: Number(conversationPerf.mediaTextMs.toFixed(1)),
        precheckNormalizeMs: Number(
          conversationPerf.precheckNormalizeMs.toFixed(1),
        ),
        buildFieldsMs: Number(conversationPerf.buildFieldsMs.toFixed(1)),
        appendMs: Number(conversationPerf.appendMs.toFixed(1)),
        totalConversationMs: Number(
          (performance.now() - conversationStartTime).toFixed(1),
        ),
      });
    }
  });
  measureSearchBlock("Timeline", () => {
    Object.entries(getTimelineStateSource(remoteData)).forEach(([date, day]) =>
      day.events.forEach((event) => {
        const { categoryLabel, subcategoryLabel, eventNodeLabel } =
          getTimelineCategoryMeta(event, remoteData);
        const fields = buildSearchFields([
          { label: "事件标题", value: event.title },
          { label: "事件备注", value: event.note },
          {
            label: "分类",
            value:
              [categoryLabel, subcategoryLabel, eventNodeLabel]
                .filter(Boolean)
                .join(" · ") || event.categoryId,
          },
          { label: "标签", value: (event.tags ?? []).join(" ") },
        ]);
        appendSearchResult({
          mode: "Timeline",
          date: toDotDate(date),
          filterDate: toDotDate(date),
          timestamp: event.startAt,
          targetId: event.id,
          title: event.title,
          label: `时间轴 · ${toDotDate(date)}`,
          fields,
          haystackParts: [date, ...fields.map((field) => field.normalizedValue)],
        });
      }),
    );
  });
  measureSearchBlock("Reminders", () => {
    getReminderHistorySource(remoteData).forEach((entry) => {
      const dueAt = getReminderDueAt(entry);

      if (Number.isNaN(dueAt.getTime())) return;

      const dateText = getZonedDateText(dueAt);
      const dueAtText = dueAt.toISOString();
      const createdAtText = entry?.reminder?.createdAt ?? "";
      const archivedAtText = entry?.archivedAt ?? "";
      const reminderStatus = String(
        (entry as { status?: string } | null | undefined)?.status ?? "",
      ).trim();
      const fields = buildSearchFields([
        { label: "提醒", value: entry?.reminder?.text },
        { label: "状态", value: reminderStatus },
        { label: "来源", value: entry?.sourceFile },
      ]);
      appendSearchResult({
        mode: "Timeline",
        date: dateText,
        filterDate: dateText,
        timestamp: dueAtText || archivedAtText || createdAtText || null,
        timelineView: "reminders",
        targetId: entry?.reminder?.id || `reminder-${dateText}`,
        title: entry?.reminder?.text || "提醒",
        label: `提醒 · ${dateText}`,
        fields,
        haystackParts: [
          dateText,
          dueAtText,
          createdAtText,
          archivedAtText,
          reminderStatus,
          entry?.reminder?.text,
          entry?.sourceFile,
          ...fields.map((field) => field.normalizedValue),
        ],
      });
    });
  });
  measureSearchBlock("DatedMemory", () => {
    (
      [
        ["Diary", getDatedEntriesSource("Diary", remoteData)],
        ["DailySummary", getDatedEntriesSource("DailySummary", remoteData)],
        ["Letters", getDatedEntriesSource("Letters", remoteData)],
      ] as Array<[string, DatedMemoryEntries]>
    ).forEach(([mode, entries]) =>
      Object.entries(entries).forEach(([date, entry]) => {
        const baseFields = buildSearchFields([
          { label: "标题", value: entry.title },
          { label: "摘要", value: entry.excerpt },
        ]);
        const sectionFields = buildSearchFields(
          entry.sections.map((item) => ({
            label: item.title,
            value: `${item.title} ${item.text}`,
            sectionNo: item.no,
            sectionDate: item.date || date,
          })),
        );
        const fields = [...baseFields, ...sectionFields];
        const matchedSection = sectionFields.find((field) =>
          field.normalizedValue.includes(normalizedQuery),
        );
        appendSearchResult({
          mode,
          date,
          filterDate: matchedSection?.sectionDate || date,
          targetId: matchedSection
            ? `${mode}-${date}-${matchedSection.sectionNo}`
            : `${mode}-${date}-title`,
          title: entry.title,
          label: `${pageModeMeta[mode]?.title ?? mode} · ${date}`,
          fields,
          haystackParts: [date, ...fields.map((field) => field.normalizedValue)],
        });
      }),
    );
  });
  measureSearchBlock("StaticMemory", () => {
    Object.entries({
      Project: getStaticEntryForMode("Project", remoteData),
      Preference: getStaticEntryForMode("Preference", remoteData),
      Openloops: getStaticEntryForMode("Openloops", remoteData),
      Facts: getStaticEntryForMode("Facts", remoteData),
      Patterns: getStaticEntryForMode("Patterns", remoteData),
    }).forEach(([mode, entry]) => {
      const baseFields = buildSearchFields([
        { label: "标题", value: entry.title },
        { label: "摘要", value: entry.excerpt },
      ]);
      const sectionFields = buildSearchFields(
        entry.sections.map((item) => ({
          label: item.title,
          value: `${item.title} ${item.text}`,
          sectionNo: item.no,
          sectionDate: item.date || null,
        })),
      );
      const fields = [...baseFields, ...sectionFields];
      const matchedSection = sectionFields.find((field) =>
        field.normalizedValue.includes(normalizedQuery),
      );
      appendSearchResult({
        mode,
        date: null,
        filterDate: matchedSection?.sectionDate || null,
        targetId: matchedSection
          ? `${mode}-static-${matchedSection.sectionNo}`
          : `${mode}-static-title`,
        title: entry.title,
        label: pageModeMeta[mode]?.title ?? mode,
        fields,
        haystackParts: fields.map((field) => field.normalizedValue),
      });
    });
  });
  measureSearchBlock("Xiaoye", () => {
    xiaoyeModes.forEach((xiaoyeMode) => {
      const entry = remoteData.xiaoyeEntries[xiaoyeMode];

      if (!entry) return;

      const modeMeta = xiaoyeModeMeta[xiaoyeMode] ?? xiaoyeModeMeta.Ins;
      const baseFields = buildSearchFields([
        { label: "标题", value: entry.title },
        { label: "摘要", value: entry.excerpt },
      ]);
      const sectionFields = buildSearchFields(
        entry.sections.map((item) => ({
          label: item.group || item.title || modeMeta.title,
          value: `${item.group ?? ""} ${item.title ?? ""} ${item.text ?? ""}`,
          sectionNo: item.no,
          sectionDate: item.date || null,
        })),
      );
      const fields = [...baseFields, ...sectionFields];
      const matchedSection = sectionFields.find((field) =>
        field.normalizedValue.includes(normalizedQuery),
      );
      appendSearchResult({
        mode: "Xiaoye",
        xiaoyeMode,
        date: null,
        filterDate: matchedSection?.sectionDate || null,
        targetId: matchedSection
          ? `Xiaoye-static-${matchedSection.sectionNo}`
          : "Xiaoye-static-title",
        title: entry.title,
        label: `小叶 · ${modeMeta.title}`,
        fields,
        haystackParts: fields.map((field) => field.normalizedValue),
      });
    });
  });
  let sortedResults = results;
  measureSearchBlock("Sort", () => {
    sortedResults = sortSearchResults(results).slice(0, limit);
  });

  if (perfEnabled) {
    console.debug("[MurmurLane Search Perf] buildSearchResultState blocks", {
      query: cleanQuery,
      modeFilter,
      timeFilter,
      selectedDate,
      blocks: perfMarks,
      resultsLength: sortedResults.length,
      totalOccurrences,
    });
  }

  return {
    results: sortedResults,
    totalOccurrences,
  };
}

export function getAllSearchResults(
  query: unknown,
  remoteData: RemoteData = emptyRemoteData,
) {
  return buildSearchResultState(query, remoteData).results;
}
