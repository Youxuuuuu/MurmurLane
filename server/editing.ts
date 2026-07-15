import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  readTextFile,
  resolveDataPath,
} from "./fileLoaders.js";
import {
  parseDailySummaryMarkdown,
  parseDiaryOrLetterMarkdown,
  parseOpenLoopsMarkdown,
  parseStaticMemoryMarkdown,
} from "./parsers.js";
import type { MemoryEntry } from "./types.js";

export type EditableMemoryDocumentType =
  | "dated-memory-document"
  | "static-memory-document"
  | "xiaoye-memory-document";

export type DatedMemoryDocumentId = "diary" | "daily-summary" | "letters";
export type StaticMemoryDocumentId =
  | "projects"
  | "preferences"
  | "facts"
  | "patterns"
  | "open_loops";
export type XiaoyeMemoryDocumentId =
  | "weixin_instructions"
  | "personality_anchor";

type EditableMemoryDocumentId =
  | DatedMemoryDocumentId
  | StaticMemoryDocumentId
  | XiaoyeMemoryDocumentId;

type EditableMemoryDocumentSpec = {
  documentType: EditableMemoryDocumentType;
  documentId: EditableMemoryDocumentId;
  date?: string;
  filePath: string;
  parse: (content: string) => MemoryEntry;
};

export type EditableMemoryDocumentResult = {
  found: boolean;
  path: string;
  content: string;
  entry: MemoryEntry | null;
};

const editableFields = new Set([
  "startAt",
  "endAt",
  "title",
  "note",
  "categoryId",
  "subcategoryId",
  "eventNodeId",
  "tags",
  "confidence",
]);

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeMarkdownContent(content: string) {
  return String(content ?? "").replace(/\r\n/g, "\n");
}

function normalizeLineEndings(content: string) {
  return normalizeMarkdownContent(content).replace(/\n/g, "\r\n");
}

function trimStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => trimStringValue(item))
        .filter(Boolean),
    ),
  );
}

function normalizeConfidence(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid confidence. Expected a finite number.");
  }

  return value;
}

function assertEditableMemoryDocumentSpec(
  documentType: EditableMemoryDocumentType,
  documentId: EditableMemoryDocumentId,
  date?: string,
): EditableMemoryDocumentSpec {
  if (documentType === "dated-memory-document") {
    if (!isIsoDate(date)) {
      throw new Error("Missing or invalid date. Expected yyyy-mm-dd.");
    }

    if (documentId === "diary") {
      return {
        documentType,
        documentId,
        date,
        filePath: resolveDataPath("diary", `${date}.md`),
        parse: (content) =>
          parseDiaryOrLetterMarkdown(content, {
            fallbackTitle: date,
          }),
      };
    }

    if (documentId === "daily-summary") {
      return {
        documentType,
        documentId,
        date,
        filePath: resolveDataPath(
          "memory",
          "daily-summary",
          `daily-summary-${date}.md`,
        ),
        parse: parseDailySummaryMarkdown,
      };
    }

    if (documentId === "letters") {
      return {
        documentType,
        documentId,
        date,
        filePath: resolveDataPath("memory", "letters", `${date}.md`),
        parse: (content) =>
          parseDiaryOrLetterMarkdown(content, {
            fallbackTitle: "给小栩的信",
          }),
      };
    }
  }

  if (documentType === "static-memory-document") {
    if (documentId === "projects") {
      return {
        documentType,
        documentId,
        filePath: resolveDataPath("memory", "projects.md"),
        parse: (content) => parseStaticMemoryMarkdown("projects", content),
      };
    }

    if (documentId === "preferences") {
      return {
        documentType,
        documentId,
        filePath: resolveDataPath("memory", "preferences.md"),
        parse: (content) => parseStaticMemoryMarkdown("preferences", content),
      };
    }

    if (documentId === "facts") {
      return {
        documentType,
        documentId,
        filePath: resolveDataPath("memory", "facts.md"),
        parse: (content) => parseStaticMemoryMarkdown("facts", content),
      };
    }

    if (documentId === "patterns") {
      return {
        documentType,
        documentId,
        filePath: resolveDataPath("memory", "patterns.md"),
        parse: (content) => parseStaticMemoryMarkdown("patterns", content),
      };
    }

    if (documentId === "open_loops") {
      return {
        documentType,
        documentId,
        filePath: resolveDataPath("memory", "open_loops.md"),
        parse: parseOpenLoopsMarkdown,
      };
    }
  }

  if (documentType === "xiaoye-memory-document") {
    if (documentId === "weixin_instructions") {
      return {
        documentType,
        documentId,
        filePath: resolveDataPath("weixin-instructions.md"),
        parse: (content) =>
          parseStaticMemoryMarkdown("weixin_instructions", content),
      };
    }

    if (documentId === "personality_anchor") {
      return {
        documentType,
        documentId,
        filePath: resolveDataPath("personality-anchor.md"),
        parse: (content) =>
          parseStaticMemoryMarkdown("personality_anchor", content),
      };
    }
  }

  throw new Error("Unsupported editable document.");
}

async function writeWhitelistedFile(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, normalizeLineEndings(content), "utf8");
}

export function getEditableMemoryDocumentSpec(input: {
  documentType: EditableMemoryDocumentType;
  documentId: EditableMemoryDocumentId;
  date?: string;
}) {
  return assertEditableMemoryDocumentSpec(
    input.documentType,
    input.documentId,
    input.date,
  );
}

export async function readEditableMemoryDocument(input: {
  documentType: EditableMemoryDocumentType;
  documentId: EditableMemoryDocumentId;
  date?: string;
}): Promise<EditableMemoryDocumentResult> {
  const spec = getEditableMemoryDocumentSpec(input);
  const result = await readTextFile(spec.filePath);
  const content = result.content ?? "";

  return {
    found: result.found,
    path: spec.filePath,
    content,
    entry: result.found ? spec.parse(content) : null,
  };
}

export async function writeEditableMemoryDocument(input: {
  documentType: EditableMemoryDocumentType;
  documentId: EditableMemoryDocumentId;
  date?: string;
  content: string;
}) {
  const spec = getEditableMemoryDocumentSpec(input);
  const normalizedContent = normalizeMarkdownContent(input.content);

  await writeWhitelistedFile(spec.filePath, normalizedContent);

  return {
    path: spec.filePath,
    content: normalizedContent,
    entry: spec.parse(normalizedContent),
  };
}

export async function toggleOpenLoopsChecklistItem(input: {
  no: string;
  checked: boolean;
}) {
  const spec = getEditableMemoryDocumentSpec({
    documentType: "static-memory-document",
    documentId: "open_loops",
  });
  const result = await readTextFile(spec.filePath);
  const content = result.content ?? "";
  const lines = normalizeMarkdownContent(content).split("\n");
  const targetNo = trimStringValue(input.no);

  if (!/^\d+$/.test(targetNo)) {
    throw new Error("Missing or invalid no. Expected a checklist index.");
  }

  let checklistCursor = 0;
  let replaced = false;

  const nextLines = lines.map((line) => {
    if (!/^\s*-\s+\[(x| )\]\s+/i.test(line)) {
      return line;
    }

    checklistCursor += 1;

    if (String(checklistCursor) !== targetNo) {
      return line;
    }

    replaced = true;
    return line.replace(
      /^(\s*-\s+\[)(x| )(\]\s+)/i,
      `$1${input.checked ? "x" : " "}$3`,
    );
  });

  if (!replaced) {
    throw new Error(`Open loop #${targetNo} was not found.`);
  }

  const nextContent = nextLines.join("\n");
  await writeWhitelistedFile(spec.filePath, nextContent);

  return {
    path: spec.filePath,
    content: nextContent,
    entry: parseOpenLoopsMarkdown(nextContent),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTimelineDateKey(date: string) {
  return trimStringValue(date).replace(/\./g, "-");
}

function toDotDate(date: string) {
  return normalizeTimelineDateKey(date).replace(/-/g, ".");
}

function getTimelineFactsRoot(data: unknown) {
  if (!isRecord(data)) {
    return {};
  }

  if (isRecord(data.facts)) {
    return data.facts as Record<string, unknown>;
  }

  return data;
}

function withTimelineFactsRoot(
  state: Record<string, unknown>,
  facts: Record<string, unknown>,
) {
  if (isRecord(state.facts)) {
    return {
      ...state,
      facts,
    };
  }

  return facts;
}

function findTimelineDayKey(
  facts: Record<string, unknown>,
  date: string,
  options: {
    allowCreate?: boolean;
  } = {},
) {
  const normalizedDate = normalizeTimelineDateKey(date);
  const candidates = [
    normalizedDate,
    toDotDate(normalizedDate),
  ];

  const matched = candidates.find((candidate) => isRecord(facts[candidate]));
  if (matched) {
    return matched;
  }

  return options.allowCreate ? normalizedDate : "";
}

function ensureTimelineDayRecord(
  facts: Record<string, unknown>,
  date: string,
  options: {
    allowCreate?: boolean;
  } = {},
) {
  const dayKey = findTimelineDayKey(facts, date, options);

  if (!dayKey) {
    throw new Error(`Timeline day ${date} was not found.`);
  }

  const existing = facts[dayKey];
  if (isRecord(existing) && Array.isArray(existing.events)) {
    return {
      dayKey,
      dayRecord: existing as Record<string, unknown> & { events: unknown[] },
    };
  }

  if (!options.allowCreate) {
    throw new Error(`Timeline day ${date} was not found.`);
  }

  return {
    dayKey,
    dayRecord: {
      status: "draft",
      updatedAt: "",
      source: null,
      events: [],
    },
  };
}

function parseIsoDateTime(value: unknown, fieldName: string) {
  const text = trimStringValue(value);

  if (!text) {
    throw new Error(`Missing ${fieldName}.`);
  }

  const timeMs = Date.parse(text);

  if (!Number.isFinite(timeMs)) {
    throw new Error(`Invalid ${fieldName}. Expected an ISO datetime string.`);
  }

  return new Date(timeMs).toISOString();
}

function sanitizeTimelineEventPatch(
  input: Record<string, unknown>,
  options: {
    requireAllFields?: boolean;
  } = {},
) {
  const nextPatch: Record<string, unknown> = {};

  editableFields.forEach((fieldName) => {
    if (!(fieldName in input)) {
      return;
    }

    const value = input[fieldName];

    if (fieldName === "startAt" || fieldName === "endAt") {
      nextPatch[fieldName] = parseIsoDateTime(value, fieldName);
      return;
    }

    if (fieldName === "tags") {
      nextPatch.tags = sanitizeTags(value);
      return;
    }

    if (fieldName === "confidence") {
      nextPatch.confidence = normalizeConfidence(value);
      return;
    }

    nextPatch[fieldName] = trimStringValue(value);
  });

  if (options.requireAllFields) {
    ["startAt", "endAt", "title", "categoryId", "subcategoryId"].forEach(
      (fieldName) => {
        if (!(fieldName in nextPatch)) {
          throw new Error(`Missing ${fieldName}.`);
        }
      },
    );
  }

  return nextPatch;
}

type TimelineTaxonomyMaps = {
  categoryIds: Set<string>;
  subcategoryIdsByCategory: Map<string, Set<string>>;
  eventNodeParentById: Map<string, string>;
};

function createTimelineTaxonomyMaps(): TimelineTaxonomyMaps {
  return {
    categoryIds: new Set(),
    subcategoryIdsByCategory: new Map(),
    eventNodeParentById: new Map(),
  };
}

function appendSubcategoryId(
  maps: TimelineTaxonomyMaps,
  categoryId: string,
  subcategoryId: string,
) {
  if (!maps.subcategoryIdsByCategory.has(categoryId)) {
    maps.subcategoryIdsByCategory.set(categoryId, new Set());
  }

  maps.subcategoryIdsByCategory.get(categoryId)?.add(subcategoryId);
}

function collectTimelineCategories(
  input: unknown,
  maps: TimelineTaxonomyMaps,
  parentCategoryId = "",
) {
  if (Array.isArray(input)) {
    input.forEach((item) =>
      collectTimelineCategories(item, maps, parentCategoryId),
    );
    return;
  }

  if (!isRecord(input)) {
    return;
  }

  const currentId = trimStringValue(input.id);

  if (currentId && !parentCategoryId) {
    maps.categoryIds.add(currentId);
  }

  if (currentId && parentCategoryId) {
    appendSubcategoryId(maps, parentCategoryId, currentId);
  }

  const nextParentCategoryId =
    currentId && !currentId.includes(".") ? currentId : parentCategoryId;
  const children =
    input.children ?? input.subcategories ?? input.categories ?? input.items;

  if (children) {
    collectTimelineCategories(children, maps, nextParentCategoryId);
    return;
  }

  Object.values(input).forEach((value) => {
    if (value !== children) {
      collectTimelineCategories(value, maps, nextParentCategoryId);
    }
  });
}

function collectTimelineEventNodes(
  input: unknown,
  maps: TimelineTaxonomyMaps,
) {
  if (Array.isArray(input)) {
    input.forEach((item) => collectTimelineEventNodes(item, maps));
    return;
  }

  if (!isRecord(input)) {
    return;
  }

  const currentId = trimStringValue(input.id);
  const parentId = trimStringValue(input.parentId);

  if (currentId && parentId) {
    maps.eventNodeParentById.set(currentId, parentId);
  }

  const children =
    input.children ?? input.eventNodes ?? input.nodes ?? input.items;

  if (children) {
    collectTimelineEventNodes(children, maps);
    return;
  }

  Object.values(input).forEach((value) => {
    if (value !== children) {
      collectTimelineEventNodes(value, maps);
    }
  });
}

function buildTimelineTaxonomyMaps(state: Record<string, unknown>) {
  const maps = createTimelineTaxonomyMaps();
  const taxonomy = isRecord(state.taxonomy) ? state.taxonomy : null;

  if (!taxonomy) {
    throw new Error("Timeline taxonomy was not found.");
  }

  collectTimelineCategories(taxonomy.categories, maps);
  collectTimelineEventNodes(taxonomy.eventNodes, maps);
  return maps;
}

function validateTimelineEvent(
  event: Record<string, unknown>,
  taxonomyMaps: TimelineTaxonomyMaps,
) {
  const categoryId = trimStringValue(event.categoryId);
  const subcategoryId = trimStringValue(event.subcategoryId);
  const eventNodeId = trimStringValue(event.eventNodeId);
  const startAt = parseIsoDateTime(event.startAt, "startAt");
  const endAt = parseIsoDateTime(event.endAt, "endAt");
  const title = trimStringValue(event.title);

  if (!title) {
    throw new Error("Missing title.");
  }

  if (!taxonomyMaps.categoryIds.has(categoryId)) {
    throw new Error("Invalid categoryId.");
  }

  const subcategoryIds = taxonomyMaps.subcategoryIdsByCategory.get(categoryId);

  if (!subcategoryId || !subcategoryIds?.has(subcategoryId)) {
    throw new Error("Invalid subcategoryId.");
  }

  if (
    eventNodeId &&
    taxonomyMaps.eventNodeParentById.get(eventNodeId) !== subcategoryId
  ) {
    throw new Error("Invalid eventNodeId.");
  }

  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    throw new Error("Invalid time range. endAt must be after startAt.");
  }
}

function normalizeTimelineEventRecord(event: Record<string, unknown>) {
  const normalizedEvent = {
    ...event,
    id: trimStringValue(event.id),
    startAt: parseIsoDateTime(event.startAt, "startAt"),
    endAt: parseIsoDateTime(event.endAt, "endAt"),
    title: trimStringValue(event.title),
    note: trimStringValue(event.note),
    categoryId: trimStringValue(event.categoryId),
    subcategoryId: trimStringValue(event.subcategoryId),
    eventNodeId: trimStringValue(event.eventNodeId),
    tags: sanitizeTags(event.tags),
  } as Record<string, unknown>;

  if ("confidence" in event) {
    normalizedEvent.confidence = normalizeConfidence(event.confidence);
  }

  return normalizedEvent;
}

export async function readTimelineStateFile() {
  const filePath = resolveDataPath("timeline", "timeline-state.json");
  const result = await readTextFile(filePath);

  if (!result.found || result.content == null) {
    return {
      found: false,
      path: filePath,
      content: "",
      data: null,
    };
  }

  return {
    found: true,
    path: filePath,
    content: result.content,
    data: JSON.parse(result.content) as Record<string, unknown>,
  };
}

async function writeTimelineStateFile(
  filePath: string,
  state: Record<string, unknown>,
) {
  await writeWhitelistedFile(
    filePath,
    `${JSON.stringify(state, null, 2)}\n`,
  );
}

export function findTimelineEventById(input: {
  state: Record<string, unknown>;
  date: string;
  eventId: string;
}) {
  const facts = getTimelineFactsRoot(input.state);
  const { dayKey, dayRecord } = ensureTimelineDayRecord(facts, input.date);
  const eventIndex = dayRecord.events.findIndex(
    (item) => isRecord(item) && trimStringValue(item.id) === trimStringValue(input.eventId),
  );

  if (eventIndex === -1) {
    return {
      found: false,
      dayKey,
      event: null,
    };
  }

  const event = dayRecord.events[eventIndex];
  return {
    found: true,
    dayKey,
    event: isRecord(event) ? normalizeTimelineEventRecord(event) : null,
  };
}

export async function patchTimelineEvent(input: {
  date: string;
  eventId: string;
  changes: Record<string, unknown>;
}) {
  const timelineFile = await readTimelineStateFile();

  if (!timelineFile.found || !timelineFile.data) {
    throw new Error("Timeline state was not found.");
  }

  const state = timelineFile.data;
  const facts = getTimelineFactsRoot(state);
  const { dayKey, dayRecord } = ensureTimelineDayRecord(facts, input.date);
  const eventIndex = dayRecord.events.findIndex(
    (item) => isRecord(item) && trimStringValue(item.id) === trimStringValue(input.eventId),
  );

  if (eventIndex === -1) {
    throw new Error(`Timeline event ${input.eventId} was not found.`);
  }

  const currentEvent = dayRecord.events[eventIndex];

  if (!isRecord(currentEvent)) {
    throw new Error(`Timeline event ${input.eventId} was not found.`);
  }

  const nextPatch = sanitizeTimelineEventPatch(input.changes);
  const nextEvent = normalizeTimelineEventRecord({
    ...currentEvent,
    ...nextPatch,
  });

  validateTimelineEvent(nextEvent, buildTimelineTaxonomyMaps(state));

  const nextEvents = [...dayRecord.events];
  nextEvents[eventIndex] = nextEvent;
  const nextFacts = {
    ...facts,
    [dayKey]: {
      ...dayRecord,
      updatedAt: new Date().toISOString(),
      events: nextEvents,
    },
  };
  const nextState = withTimelineFactsRoot(state, nextFacts);

  await writeTimelineStateFile(timelineFile.path, nextState);

  return {
    dayKey,
    event: nextEvent,
  };
}

export async function createTimelineEvent(input: {
  date: string;
  event: Record<string, unknown>;
}) {
  const timelineFile = await readTimelineStateFile();

  if (!timelineFile.found || !timelineFile.data) {
    throw new Error("Timeline state was not found.");
  }

  const state = timelineFile.data;
  const facts = getTimelineFactsRoot(state);
  const { dayKey, dayRecord } = ensureTimelineDayRecord(facts, input.date, {
    allowCreate: true,
  });
  const nextPatch = sanitizeTimelineEventPatch(input.event, {
    requireAllFields: true,
  });
  const nextEvent = normalizeTimelineEventRecord({
    ...input.event,
    ...nextPatch,
    id: trimStringValue(input.event.id) || randomUUID(),
  });

  if (!nextEvent.id) {
    throw new Error("Missing event id.");
  }

  if (
    dayRecord.events.some(
      (item) => isRecord(item) && trimStringValue(item.id) === nextEvent.id,
    )
  ) {
    throw new Error(`Timeline event ${nextEvent.id} already exists.`);
  }

  validateTimelineEvent(nextEvent, buildTimelineTaxonomyMaps(state));

  const nextFacts = {
    ...facts,
    [dayKey]: {
      ...dayRecord,
      status: trimStringValue(dayRecord.status) || "draft",
      updatedAt: new Date().toISOString(),
      source: "source" in dayRecord ? dayRecord.source : null,
      events: [...dayRecord.events, nextEvent],
    },
  };
  const nextState = withTimelineFactsRoot(state, nextFacts);

  await writeTimelineStateFile(timelineFile.path, nextState);

  return {
    dayKey,
    event: nextEvent,
  };
}

export async function deleteTimelineEvent(input: {
  date: string;
  eventId: string;
}) {
  const timelineFile = await readTimelineStateFile();

  if (!timelineFile.found || !timelineFile.data) {
    throw new Error("Timeline state was not found.");
  }

  const state = timelineFile.data;
  const facts = getTimelineFactsRoot(state);
  const { dayKey, dayRecord } = ensureTimelineDayRecord(facts, input.date);
  const nextEvents = dayRecord.events.filter(
    (item) => !(isRecord(item) && trimStringValue(item.id) === trimStringValue(input.eventId)),
  );

  if (nextEvents.length === dayRecord.events.length) {
    throw new Error(`Timeline event ${input.eventId} was not found.`);
  }

  const nextFacts = { ...facts };

  if (nextEvents.length === 0) {
    delete nextFacts[dayKey];
  } else {
    nextFacts[dayKey] = {
      ...dayRecord,
      updatedAt: new Date().toISOString(),
      events: nextEvents,
    };
  }
  const nextState = withTimelineFactsRoot(state, nextFacts);

  await writeTimelineStateFile(timelineFile.path, nextState);

  return {
    dayKey,
    deleted: true,
  };
}
