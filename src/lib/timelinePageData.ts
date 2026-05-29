import { emptyRemoteData } from "../data/emptyRemoteData";
import { timelineState } from "../data/mockTimeline";
import { monthColors, monthPales } from "../config/theme";
import type { RemoteData } from "../types/api";
import type { TimelineDay, TimelineEvent, TimelineState } from "../types/timeline";
import { buildContentPath, getDateParts, toDotDate, toHyphenDate } from "./date";

export const timelineCategories = {
  life: {
    label: "Life",
    color: "#c18b5a",
    pale: "rgba(248,239,228,.74)",
  },
  rest: {
    label: "Rest",
    color: "#7ea47c",
    pale: "rgba(232,244,232,.74)",
  },
  foodie: {
    label: "Foodie",
    color: "#ce7447",
    pale: "rgba(249,234,225,.74)",
  },
  wash: {
    label: "Wash",
    color: "#5d9cb6",
    pale: "rgba(229,242,247,.74)",
  },
  clean: {
    label: "Clean",
    color: "#6b9b86",
    pale: "rgba(231,243,238,.74)",
  },
  care: {
    label: "Care",
    color: "#6f8fb5",
    pale: "rgba(232,239,247,.74)",
  },
  joy: {
    label: "Joy",
    color: "#cf739d",
    pale: "rgba(248,232,239,.74)",
  },
  social: {
    label: "Social",
    color: "#d37b88",
    pale: "rgba(247,232,235,.74)",
  },
  study: {
    label: "Study",
    color: "#99a755",
    pale: "rgba(241,244,223,.74)",
  },
  work: {
    label: "Work",
    color: "#8b6e9f",
    pale: "rgba(239,233,245,.74)",
  },
  pkm: {
    label: "PKM",
    color: "#6577be",
    pale: "rgba(233,237,249,.74)",
  },
  exercise: {
    label: "Exercise",
    color: "#85a35a",
    pale: "rgba(236,244,225,.74)",
  },
  travel: {
    label: "Travel",
    color: "#6585a8",
    pale: "rgba(232,238,246,.74)",
  },
  traffic: {
    label: "Traffic",
    color: "#7c84a0",
    pale: "rgba(235,237,244,.74)",
  },
  merch: {
    label: "Merch",
    color: "#b78363",
    pale: "rgba(246,237,231,.74)",
  },
  health: {
    label: "Health",
    color: "#b75a64",
    pale: "rgba(246,229,232,.74)",
  },
};

const timelineCategoryAliasMap = {
  daily: "life",
  food: "foodie",
  relationship: "social",
  commute: "traffic",
  read: "study",
  entertainment: "joy",
};

const timelineSubcategoryAliasMap = {
  "daily.meals": "foodie.other",
  "daily.meal": "foodie.other",
  "daily.hygiene": "wash.washup",
  "daily.commute": "traffic.commute",
  "daily.home": "life.other",

  "food.lunch": "foodie.other",
  "food.beverage": "foodie.other",
  "food.snack": "foodie.other",

  "relationship.connection": "social.chat",
  "relationship.intimacy": "social.chat",
  "relationship.family": "social.family",

  "commute.home": "traffic.commute",

  "work.design": "pkm.ui_design",
  "work.chat": "work.communication",
  "work.off": "work.other",
  "work.writing": "pkm.memory",

  "life.computer": "life.other",
  "life.meal": "foodie.other",
  "life.hygiene": "wash.washup",
  "life.chores": "clean.room",
  "life.rest": "rest.idle",
  "life.scenery": "rest.idle",

  "rest.down": "rest.idle",
  "rest.home": "rest.idle",
  "rest.hygiene": "wash.washup",
  "rest.recovery": "health.rest",

  "social.friend": "social.other",
  "travel.commute": "traffic.commute",
  "travel.trip": "travel.other",
  "entertainment.sticker": "joy.other",
};

const fallbackTimelineSubcategoryLabels = {
  "life.shopping": "Shopping",
  "life.errand": "Errands",
  "life.other": "Other Life",

  "rest.sleep": "Sleep",
  "rest.nap": "Nap",
  "rest.idle": "Idle Time",
  "rest.other": "Other Rest",

  "foodie.other": "Meals",

  "wash.washup": "Wash-up",
  "wash.other": "Other Wash",

  "clean.room": "Room Cleanup",
  "clean.other": "Other Clean",

  "joy.video": "Video",
  "joy.game": "Games",
  "joy.social_media": "Social Media",
  "joy.music": "Music",
  "joy.other": "Other Joy",

  "social.chat": "Chat",
  "social.call": "Calls",
  "social.family": "Family Time",
  "social.other": "Other Social",

  "work.coding": "Coding",
  "work.meeting": "Meetings",
  "work.communication": "Communication",
  "work.other": "Other Work",

  "pkm.ui_design": "UI Design",
  "pkm.memory": "Memory",
  "pkm.other": "Other PKM",

  "study.reading": "Reading",
  "study.course": "Courses",
  "study.practice": "Practice",
  "study.review": "Review",
  "study.other": "Other Study",

  "exercise.walk": "Walks",
  "exercise.workout": "Workouts",
  "exercise.stretch": "Stretching",
  "exercise.other": "Other Exercise",

  "health.rest": "Recovery",
  "health.medication": "Medication",
  "health.pain": "Symptom Care",
  "health.hospital": "Medical Visit",
  "health.other": "Other Health",

  "care.pet": "Pet Care",
  "care.household": "Household Care",
  "care.self": "Self Care",
  "care.other": "Other Care",

  "travel.transit": "Transit",
  "travel.other": "Other Travel",

  "traffic.commute": "Commute",
  "traffic.other": "Other Traffic",

  "merch.shopping": "Shopping",
  "merch.other": "Other Merch",
};

const fallbackTimelineEventNodeLabels = {
  "evt.breakfast": "Breakfast",
  "evt.lunch": "Lunch",
  "evt.dinner": "Dinner",
  "evt.shower": "Shower",
  "evt.cleanup": "Cleanup",
  "evt.commute": "Commute",
  "evt.focus_coding": "Focused Coding",
  "evt.meeting": "Meeting",
  "evt.reading": "Reading",
  "evt.learning": "Course Study",
  "evt.walk": "Walk",
  "evt.workout": "Workout",
  "evt.watch_show": "Watch a Show",
  "evt.short_video": "Short Video Scroll",
  "evt.phone_scroll": "Phone Scroll",
  "evt.headache_rest": "Headache Recovery",
  "evt.medication": "Medication",
  "evt.hospital_visit": "Medical Visit",
  "evt.chatting": "Chat",
  "evt.sleep": "Sleep",
  "evt.nap": "Nap",
};

type TimelineLabelMaps = {
  subcategoryLabels: Record<string, string>;
  eventNodeLabels: Record<string, string>;
};

type TimelineTaxonomyIds = {
  categoryIds: Set<string>;
  subcategoryIds: Set<string>;
};

type TimelineSourceRecord = Record<string, unknown>;

type TimelineTaxonomyMode = "categories" | "eventNodes";

const taxonomyLabelCache = new WeakMap<object, TimelineLabelMaps>();
const taxonomyIdCache = new WeakMap<object, TimelineTaxonomyIds>();

const taxonomyNodeIdKeys = [
  "id",
  "key",
  "slug",
  "code",
  "categoryId",
  "subcategoryId",
  "eventNodeId",
];

const taxonomyNodeLabelKeys = ["label", "name", "title"];

const taxonomyCollectionKeys = new Set([
  "categories",
  "subcategories",
  "children",
  "eventNodes",
  "nodes",
  "items",
]);

const taxonomyChildKeysByMode: Record<TimelineTaxonomyMode, string[]> = {
  categories: ["subcategories", "children", "categories", "items"],
  eventNodes: ["children", "eventNodes", "nodes", "items"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTimelineDay(value: unknown): value is TimelineDay {
  return isRecord(value) && Array.isArray(value.events);
}

function getTimelineSourceRecord(
  remoteData: RemoteData = emptyRemoteData,
): TimelineSourceRecord {
  return {
    ...(timelineState as TimelineSourceRecord),
    ...(remoteData.searchCache.timeline as TimelineSourceRecord),
    ...(remoteData.timelineState as TimelineSourceRecord),
  };
}

function getTimelineTaxonomy(remoteData: RemoteData = emptyRemoteData) {
  const taxonomy = getTimelineSourceRecord(remoteData).taxonomy;
  return isRecord(taxonomy) ? taxonomy : null;
}

function getTaxonomyNodeId(node: Record<string, unknown>, fallbackKey = "") {
  for (const key of taxonomyNodeIdKeys) {
    const value = node[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return taxonomyCollectionKeys.has(fallbackKey) ? "" : fallbackKey.trim();
}

function getTaxonomyNodeLabel(node: Record<string, unknown>) {
  for (const key of taxonomyNodeLabelKeys) {
    const value = node[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function resolveTaxonomyPath(
  parentPath: string,
  nodeId: string,
  mode: TimelineTaxonomyMode,
) {
  if (!nodeId) return parentPath;
  if (nodeId.includes(".") || (mode === "eventNodes" && nodeId.startsWith("evt.")))
    return nodeId;
  return parentPath ? `${parentPath}.${nodeId}` : nodeId;
}

function registerTaxonomyLabel(
  labels: Record<string, string>,
  path: string,
  nodeId: string,
  label: string,
  mode: TimelineTaxonomyMode,
) {
  if (!label) return;
  if (path) labels[path] = label;
  if (mode !== "eventNodes") return;

  const rawIds = [nodeId, path.split(".").pop() ?? ""].filter(Boolean);
  rawIds.forEach((rawId) => {
    if (!rawId.includes(".")) {
      labels[rawId] ??= label;
      labels[`evt.${rawId}`] ??= label;
    }
  });
}

function collectTaxonomyLabels(
  input: unknown,
  labels: Record<string, string>,
  mode: TimelineTaxonomyMode,
  parentPath = "",
  fallbackKey = "",
) {
  if (typeof input === "string") {
    const path = resolveTaxonomyPath(parentPath, fallbackKey.trim(), mode);
    registerTaxonomyLabel(labels, path, fallbackKey.trim(), input.trim(), mode);
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item) =>
      collectTaxonomyLabels(item, labels, mode, parentPath),
    );
    return;
  }

  if (!isRecord(input)) return;

  const nodeId = getTaxonomyNodeId(input, fallbackKey);
  const currentPath = resolveTaxonomyPath(parentPath, nodeId, mode);
  registerTaxonomyLabel(
    labels,
    currentPath,
    nodeId,
    getTaxonomyNodeLabel(input),
    mode,
  );

  taxonomyChildKeysByMode[mode].forEach((childKey) => {
    if (childKey in input) {
      collectTaxonomyLabels(
        input[childKey],
        labels,
        mode,
        currentPath,
        childKey,
      );
    }
  });

  if (!nodeId && !getTaxonomyNodeLabel(input)) {
    Object.entries(input).forEach(([key, value]) => {
      collectTaxonomyLabels(value, labels, mode, parentPath, key);
    });
  }
}

function getTimelineLabelMaps(
  remoteData: RemoteData = emptyRemoteData,
): TimelineLabelMaps {
  const taxonomy = getTimelineTaxonomy(remoteData);
  if (!taxonomy) {
    return {
      subcategoryLabels: fallbackTimelineSubcategoryLabels,
      eventNodeLabels: fallbackTimelineEventNodeLabels,
    };
  }

  const cached = taxonomyLabelCache.get(taxonomy);
  if (cached) return cached;

  const maps: TimelineLabelMaps = {
    subcategoryLabels: { ...fallbackTimelineSubcategoryLabels },
    eventNodeLabels: { ...fallbackTimelineEventNodeLabels },
  };

  collectTaxonomyLabels(
    taxonomy.categories,
    maps.subcategoryLabels,
    "categories",
  );
  collectTaxonomyLabels(
    taxonomy.eventNodes,
    maps.eventNodeLabels,
    "eventNodes",
  );

  taxonomyLabelCache.set(taxonomy, maps);
  return maps;
}

function collectTaxonomyCategoryIds(
  input: unknown,
  ids: TimelineTaxonomyIds,
  isTopLevel = false,
  fallbackKey = "",
) {
  if (Array.isArray(input)) {
    input.forEach((item) =>
      collectTaxonomyCategoryIds(item, ids, isTopLevel, fallbackKey),
    );
    return;
  }

  if (!isRecord(input)) return;

  const nodeId = getTaxonomyNodeId(input, fallbackKey);
  if (nodeId) {
    if (isTopLevel && !nodeId.includes(".")) ids.categoryIds.add(nodeId);
    if (nodeId.includes(".")) ids.subcategoryIds.add(nodeId);
  }

  taxonomyChildKeysByMode.categories.forEach((childKey) => {
    if (childKey in input) {
      collectTaxonomyCategoryIds(input[childKey], ids, false, childKey);
    }
  });

  if (!nodeId && !getTaxonomyNodeLabel(input)) {
    Object.entries(input).forEach(([key, value]) => {
      collectTaxonomyCategoryIds(value, ids, isTopLevel, key);
    });
  }
}

function getTimelineTaxonomyIds(
  remoteData: RemoteData = emptyRemoteData,
): TimelineTaxonomyIds | null {
  const taxonomy = getTimelineTaxonomy(remoteData);
  if (!taxonomy) return null;

  const cached = taxonomyIdCache.get(taxonomy);
  if (cached) return cached;

  const ids: TimelineTaxonomyIds = {
    categoryIds: new Set(),
    subcategoryIds: new Set(),
  };
  collectTaxonomyCategoryIds(taxonomy.categories, ids, true);
  taxonomyIdCache.set(taxonomy, ids);
  return ids;
}

function applyTimelineCategoryAliasToPath(path: string) {
  if (!path.includes(".")) return path;
  const [root, ...rest] = path.split(".");
  const aliasedRoot =
    timelineCategoryAliasMap[root as keyof typeof timelineCategoryAliasMap];
  return aliasedRoot ? [aliasedRoot, ...rest].join(".") : path;
}

function isKnownTimelineCategoryId(
  categoryId: string,
  remoteData: RemoteData = emptyRemoteData,
) {
  if (!categoryId) return false;
  const taxonomyIds = getTimelineTaxonomyIds(remoteData);
  if (taxonomyIds) return taxonomyIds.categoryIds.has(categoryId);
  return Boolean(
    timelineCategories[categoryId as keyof typeof timelineCategories],
  );
}

function isKnownTimelineSubcategoryId(
  subcategoryId: string,
  remoteData: RemoteData = emptyRemoteData,
) {
  if (!subcategoryId) return false;
  const taxonomyIds = getTimelineTaxonomyIds(remoteData);
  if (taxonomyIds) return taxonomyIds.subcategoryIds.has(subcategoryId);
  return Boolean(
    fallbackTimelineSubcategoryLabels[
      subcategoryId as keyof typeof fallbackTimelineSubcategoryLabels
    ],
  );
}

export function getTimelineStateSource(
  remoteData: RemoteData = emptyRemoteData,
): TimelineState {
  return Object.fromEntries(
    Object.entries(getTimelineSourceRecord(remoteData)).filter(([, value]) =>
      isTimelineDay(value),
    ),
  ) as TimelineState;
}

export function getRemoteDateIndexKey(pageMode: string) {
  if (pageMode === "Conversation") return "conversations";
  if (pageMode === "Timeline") return "timeline";
  if (pageMode === "Diary") return "diary";
  if (pageMode === "DailySummary") return "dailySummary";
  if (pageMode === "Letters") return "letters";
  return null;
}

export function hasRemoteDateIndexMark(
  pageMode: string,
  dateText: string,
  remoteData: RemoteData = emptyRemoteData,
) {
  const key = getRemoteDateIndexKey(pageMode);
  if (!key || !remoteData.dateIndex) return null;
  return remoteData.dateIndex[key]?.includes(toHyphenDate(dateText)) ?? false;
}

export function getTimelineDay(
  dateText: string,
  remoteData: RemoteData = emptyRemoteData,
): TimelineDay {
  const source = getTimelineStateSource(remoteData);
  return (
    source[dateText] ??
    source[toHyphenDate(dateText)] ??
    source[toDotDate(dateText)] ?? {
      status: "empty",
      updatedAt: "",
      events: [],
    }
  );
}

export function normalizeTimelineEventCategory(
  event: TimelineEvent,
  remoteData: RemoteData = emptyRemoteData,
) {
  const originalCategoryId = String(event?.categoryId || "").trim();
  const originalSubcategoryId = String(event?.subcategoryId || "").trim();
  const eventNodeId = String(event?.eventNodeId || "").trim();
  const aliasedSubcategoryId =
    timelineSubcategoryAliasMap[
      originalSubcategoryId as keyof typeof timelineSubcategoryAliasMap
    ] || applyTimelineCategoryAliasToPath(originalSubcategoryId);
  const subcategoryId = isKnownTimelineSubcategoryId(
    originalSubcategoryId,
    remoteData,
  )
    ? originalSubcategoryId
    : aliasedSubcategoryId &&
        isKnownTimelineSubcategoryId(aliasedSubcategoryId, remoteData)
      ? aliasedSubcategoryId
      : originalSubcategoryId;

  const categoryFromSubcategory = subcategoryId.includes(".")
    ? subcategoryId.split(".")[0]
    : "";
  const aliasedCategoryId =
    timelineCategoryAliasMap[originalCategoryId as keyof typeof timelineCategoryAliasMap] ||
    originalCategoryId;
  const categoryId = isKnownTimelineCategoryId(categoryFromSubcategory, remoteData)
    ? categoryFromSubcategory
    : isKnownTimelineCategoryId(originalCategoryId, remoteData)
      ? originalCategoryId
      : isKnownTimelineCategoryId(aliasedCategoryId, remoteData)
        ? aliasedCategoryId
      : "life";
  const normalizedSubcategoryId = isKnownTimelineSubcategoryId(
    subcategoryId,
    remoteData,
  )
    ? subcategoryId
    : `${categoryId}.other`;

  return {
    ...event,
    categoryId,
    subcategoryId: normalizedSubcategoryId,
    eventNodeId,
    originalCategoryId,
    originalSubcategoryId,
  };
}

export function getTimelineCategoryMeta(
  event: TimelineEvent,
  remoteData: RemoteData = emptyRemoteData,
) {
  const normalizedEvent = normalizeTimelineEventCategory(event, remoteData);
  const category =
    timelineCategories[normalizedEvent.categoryId] || timelineCategories.life;
  const { subcategoryLabels, eventNodeLabels } = getTimelineLabelMaps(remoteData);

  return {
    normalizedEvent,
    category,
    categoryLabel: category.label,
    subcategoryLabel:
      subcategoryLabels[normalizedEvent.subcategoryId] ||
      normalizedEvent.subcategoryId ||
      "",
    eventNodeLabel:
      eventNodeLabels[normalizedEvent.eventNodeId] ||
      normalizedEvent.eventNodeId ||
      "",
  };
}

export function getTimelineEventsForPeriod(
  dateText: string,
  period: string,
  remoteData: RemoteData = emptyRemoteData,
): TimelineEvent[] {
  if (period === "day") return getTimelineDay(dateText, remoteData).events;
  const { year, month } = getDateParts(dateText);
  return Object.entries(getTimelineStateSource(remoteData))
    .filter(([key]) =>
      period === "month"
        ? toDotDate(key).startsWith(`${year}.${month}`)
        : toDotDate(key).startsWith(`${year}.`),
    )
    .flatMap(([, day]) => day.events);
}

export function buildTimelinePage(
  styleTheme: Record<string, unknown>,
  dateText: string,
  remoteData: RemoteData = emptyRemoteData,
) {
  const { month, day } = getDateParts(dateText);
  return {
    ...styleTheme,
    remoteData,
    mode: "Timeline",
    modeTitle: "时间轴",
    date: dateText,
    month,
    day,
    sourcePath: buildContentPath("Timeline", dateText),
    color: monthColors[month] ?? "#667064",
    pale: monthPales[month] ?? "#e9ebe4",
    hasEntry: getTimelineDay(dateText, remoteData).events.length > 0,
  };
}
