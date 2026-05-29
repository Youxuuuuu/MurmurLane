import { pageModeMeta, xiaoyeModeMeta, xiaoyeModes } from "../config/pageModes";
import { emptyRemoteData } from "../data/emptyRemoteData";
import { conversationEntries } from "../data/mockEntries";
import type { RemoteData } from "../types/api";
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

export function buildSearchResultState(
  query: unknown,
  remoteData: RemoteData = emptyRemoteData,
  {
    modeFilter = "All",
    timeFilter = "All",
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

  const appendSearchResult = ({
    mode,
    date = null,
    filterDate = null,
    timestamp = null,
    threadId = null,
    xiaoyeMode = null,
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

  const allConversationDates = Array.from(
    new Set([
      ...Object.keys(conversationEntries),
      ...Object.keys(remoteData.conversationEntries),
      ...Object.keys(remoteData.searchCache.conversations),
    ]),
  );
  allConversationDates.forEach((date) =>
    getConversationThreadIdsForDate(date, remoteData).forEach((threadId) =>
      getConversationRecordsForDate(date, threadId, remoteData)
        .filter((record) => !shouldHideConversationRecord(record))
        .forEach((record) => {
          const displayText = getConversationDisplayText(record);
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
          const fields = buildSearchFields([
            {
              label:
                record.type === "thinking"
                  ? "思考"
                  : record.type === "operation"
                    ? "操作"
                    : "消息",
              value: displayText,
            },
            { label: "引用", value: getConversationQuoteText(record) },
            { label: "工具", value: record.meta?.toolName },
            {
              label: "路径",
              value: record.meta?.displayPath || record.meta?.path,
            },
            { label: "模式", value: record.meta?.pattern },
            { label: "附件", value: attachmentsText },
            { label: "表情包", value: stickersText },
            { label: "文件名", value: filesText },
            { label: "线程", value: threadId },
          ]);
          appendSearchResult({
            mode: "Conversation",
            date,
            filterDate: date,
            timestamp: record.timestamp,
            threadId,
            targetId: record.id,
            title:
              displayText ||
              getConversationQuoteText(record) ||
              filesText ||
              attachmentsText ||
              stickersText ||
              "对话消息",
            label: `对话 · ${date}`,
            fields,
            haystackParts: [date, ...fields.map((field) => field.normalizedValue)],
          });
        }),
    ),
  );
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
  return {
    results: sortSearchResults(results).slice(0, limit),
    totalOccurrences,
  };
}

export function getAllSearchResults(
  query: unknown,
  remoteData: RemoteData = emptyRemoteData,
) {
  return buildSearchResultState(query, remoteData).results;
}
