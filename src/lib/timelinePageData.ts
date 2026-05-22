import { timelineState } from "../data/mockTimeline";
import type { RemoteData } from "../types/api";
import type { TimelineDay, TimelineEvent, TimelineState } from "../types/timeline";
import { getDateParts, toDotDate, toHyphenDate } from "./date";

const emptyRemoteData: RemoteData = {
  conversationEntries: {},
  timelineState: {},
  diaryEntries: {},
  dailySummaryEntries: {},
  letterEntries: {},
  staticModeEntries: {},
  xiaoyeEntries: {},
  reminderHistoryEntries: [],
  dateIndex: null,
  searchCache: {
    conversations: {},
    diary: {},
    dailySummary: {},
    letters: {},
    timeline: {},
  },
};

export const timelineCategories = {
  life: {
    label: "Life",
    color: "#c28a4a",
    pale: "rgba(248,237,222,.72)",
  },
  work: {
    label: "Work",
    color: "#7f6aa3",
    pale: "rgba(237,232,244,.72)",
  },
  study: {
    label: "Study",
    color: "#9aa957",
    pale: "rgba(241,243,223,.72)",
  },
  exercise: {
    label: "Exercise",
    color: "#8a9f5a",
    pale: "rgba(238,244,225,.72)",
  },
  entertainment: {
    label: "Entertainment",
    color: "#6fa7b4",
    pale: "rgba(230,243,245,.72)",
  },
  health: {
    label: "Health",
    color: "#b44f58",
    pale: "rgba(245,228,230,.72)",
  },
  social: {
    label: "Social",
    color: "#d47a92",
    pale: "rgba(247,231,236,.72)",
  },
  care: {
    label: "Care",
    color: "#5f8fb0",
    pale: "rgba(231,240,247,.72)",
  },
  travel: {
    label: "Travel",
    color: "#63739d",
    pale: "rgba(231,235,243,.72)",
  },
  rest: {
    label: "Rest",
    color: "#7fa66f",
    pale: "rgba(232,245,226,.72)",
  },
};

const timelineCategoryAliasMap = {
  daily: "life",
  food: "life",
  relationship: "social",
  commute: "travel",
  read: "study",
};

const timelineSubcategoryAliasMap = {
  "daily.meals": "life.meal",
  "daily.meal": "life.meal",
  "daily.hygiene": "life.hygiene",
  "daily.commute": "travel.commute",
  "daily.home": "life.other",

  "food.lunch": "life.meal",
  "food.beverage": "life.meal",
  "food.snack": "life.meal",

  "relationship.connection": "social.chat",
  "relationship.intimacy": "social.chat",
  "relationship.family": "social.family",

  "commute.home": "travel.commute",

  "work.design": "work.other",
  "work.chat": "work.communication",
  "work.off": "work.other",

  "life.computer": "life.other",
  "life.rest": "rest.idle",
  "life.scenery": "rest.idle",

  "rest.down": "rest.idle",
  "rest.home": "rest.idle",
  "rest.hygiene": "life.hygiene",
  "rest.recovery": "health.rest",

  "social.friend": "social.other",
  "travel.trip": "travel.other",
  "entertainment.sticker": "entertainment.other",
};

const timelineSubcategoryLabels = {
  "life.meal": "Meals",
  "life.hygiene": "Hygiene",
  "life.chores": "Chores",
  "life.shopping": "Shopping",
  "life.errand": "Errands",
  "life.other": "Other Life",

  "work.coding": "Coding",
  "work.meeting": "Meetings",
  "work.writing": "Writing",
  "work.communication": "Communication",
  "work.other": "Other Work",

  "study.reading": "Reading",
  "study.course": "Courses",
  "study.practice": "Practice",
  "study.review": "Review",
  "study.other": "Other Study",

  "exercise.walk": "Walks",
  "exercise.workout": "Workouts",
  "exercise.stretch": "Stretching",
  "exercise.other": "Other Exercise",

  "entertainment.video": "Video",
  "entertainment.game": "Games",
  "entertainment.social_media": "Social Media",
  "entertainment.music": "Music",
  "entertainment.other": "Other Entertainment",

  "health.rest": "Recovery",
  "health.medication": "Medication",
  "health.pain": "Symptom Care",
  "health.hospital": "Medical Visit",
  "health.other": "Other Health",

  "social.chat": "Chat",
  "social.call": "Calls",
  "social.family": "Family Time",
  "social.other": "Other Social",

  "care.pet": "Pet Care",
  "care.household": "Household Care",
  "care.self": "Self Care",
  "care.other": "Other Care",

  "travel.commute": "Commute",
  "travel.transit": "Transit",
  "travel.other": "Other Travel",

  "rest.sleep": "Sleep",
  "rest.nap": "Nap",
  "rest.idle": "Idle Time",
  "rest.other": "Other Rest",
};

const timelineEventNodeLabels = {
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

export function getTimelineStateSource(
  remoteData: RemoteData = emptyRemoteData,
): TimelineState {
  return {
    ...timelineState,
    ...remoteData.searchCache.timeline,
    ...remoteData.timelineState,
  };
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

export function normalizeTimelineEventCategory(event: TimelineEvent) {
  const originalCategoryId = String(event?.categoryId || "").trim();
  const originalSubcategoryId = String(event?.subcategoryId || "").trim();
  const eventNodeId = String(event?.eventNodeId || "").trim();

  const subcategoryId =
    timelineSubcategoryAliasMap[originalSubcategoryId] ||
    originalSubcategoryId;
  const categoryFromSubcategory = subcategoryId.includes(".")
    ? subcategoryId.split(".")[0]
    : "";
  const aliasedCategoryId =
    timelineCategoryAliasMap[originalCategoryId] || originalCategoryId;
  const categoryId = timelineCategories[categoryFromSubcategory]
    ? categoryFromSubcategory
    : timelineCategories[aliasedCategoryId]
      ? aliasedCategoryId
      : "life";
  const normalizedSubcategoryId = subcategoryId || `${categoryId}.other`;

  return {
    ...event,
    categoryId,
    subcategoryId: normalizedSubcategoryId,
    eventNodeId,
    originalCategoryId,
    originalSubcategoryId,
  };
}

export function getTimelineCategoryMeta(event: TimelineEvent) {
  const normalizedEvent = normalizeTimelineEventCategory(event);
  const category =
    timelineCategories[normalizedEvent.categoryId] || timelineCategories.life;

  return {
    normalizedEvent,
    category,
    categoryLabel: category.label,
    subcategoryLabel:
      timelineSubcategoryLabels[normalizedEvent.subcategoryId] ||
      normalizedEvent.subcategoryId ||
      "",
    eventNodeLabel:
      timelineEventNodeLabels[normalizedEvent.eventNodeId] ||
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
