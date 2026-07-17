import express from "express";
import { config as loadDotenv } from "dotenv";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createLiveUpdateHub } from "./liveUpdates.js";
import {
  readConversationProfiles,
  writeConversationProfile,
} from "./conversationProfiles.js";
import {
  createTimelineEvent,
  deleteTimelineEvent,
  findTimelineEventById,
  patchTimelineEvent,
  readEditableMemoryDocument,
  readTimelineStateFile,
  toggleOpenLoopsChecklistItem,
  writeEditableMemoryDocument,
  type EditableMemoryDocumentType,
} from "./editing.js";
import {
  findExistingDataPath,
  getCyberbossDataRoot,
  listDataFileNames,
  readDataJsonFile,
  readDataTextFile,
  readJsonLinesFile,
  resolveReadableCyberbossFilePath,
  readTextFile,
  resolveDataPath,
} from "./fileLoaders.js";
import {
  parseDailySummaryMarkdown,
  parseDiaryOrLetterMarkdown,
  parseOpenLoopsMarkdown,
  parseStaticMemoryMarkdown,
} from "./parsers.js";
import type {
  ConversationRecord,
  DateIndexResponse,
  MemoryEntryResponse,
  ReminderHistoryEntry,
  StaticMemoryMode,
} from "./types.js";

// Keep .env.local highest priority for local editing setup, with .env as fallback.
loadDotenv({ path: ".env.local" });
loadDotenv();

const app = express();
const host = process.env.API_HOST || "127.0.0.1";
const port = Number(process.env.PORT || process.env.API_PORT || 8787);
const distDir = path.resolve(process.cwd(), "dist");
const distIndexPath = path.join(distDir, "index.html");
const hasBuiltClient = existsSync(distIndexPath);
const liveUpdateHub = createLiveUpdateHub(getCyberbossDataRoot());
const allowedMediaExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
]);
const defaultApiFileMaxBytes = 25 * 1024 * 1024;
const stickerAssetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);

function getStickerRoot() {
  return resolveDataPath("stickers");
}

function getStickerAssetPath(fileName: string) {
  const safeName = path.basename(String(fileName || ""));
  const extension = path.extname(safeName).toLowerCase();
  if (!safeName || safeName !== fileName || !stickerAssetExtensions.has(extension)) {
    return null;
  }
  return path.join(getStickerRoot(), "assets", safeName);
}

function getBundledStickerFallback(id: string) {
  const fileName = `${id}.png`;
  const filePath = path.join(process.cwd(), "public", "stickers", fileName);
  return existsSync(filePath)
    ? `/stickers/${encodeURIComponent(fileName)}`
    : "";
}

function getApiFileMaxBytes() {
  const configured = Number(process.env.API_FILE_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : defaultApiFileMaxBytes;
}

function getMomentDateParts(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    day: String(date.getDate()).padStart(2, "0"),
  };
}

function elapsedMs(startedAt: bigint) {
  return Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
}

function logApiFileAccess({
  status,
  extension,
  size,
  startedAt,
  reason,
}: {
  status: number;
  extension: string;
  size: number | null;
  startedAt: bigint;
  reason: string;
}) {
  console.info(
    [
      "[cyberboss-api] /api/file",
      `status=${status}`,
      `ext=${extension || "(none)"}`,
      `size=${size ?? "unknown"}`,
      `ms=${elapsedMs(startedAt)}`,
      `reason=${reason}`,
    ].join(" "),
  );
}

app.use(express.json({ limit: "6mb" }));
app.use((request, response, next) => {
  const origin = request.headers.origin;

  if (
    origin &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  ) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PUT,PATCH,POST,DELETE",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,X-MurmurLane-Edit-Token",
  );

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});

app.get("/api/events", (_request, response) => {
  liveUpdateHub.subscribe(response);
});

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getDateQuery(value: unknown, response: express.Response) {
  if (!isIsoDate(value)) {
    response.status(400).json({
      error: "Missing or invalid date. Expected yyyy-mm-dd.",
    });
    return null;
  }

  return value;
}

function isIsoMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function getOptionalLimitQuery(value: unknown, response: express.Response) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    response.status(400).json({
      error: "Invalid limit. Expected a positive integer up to 500.",
    });
    return null;
  }

  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit < 1) {
    response.status(400).json({
      error: "Invalid limit. Expected a positive integer up to 500.",
    });
    return null;
  }

  return Math.min(limit, 500);
}

function getStaticModeQuery(value: unknown, response: express.Response) {
  const modes: StaticMemoryMode[] = [
    "projects",
    "preferences",
    "open_loops",
    "facts",
    "patterns",
  ];

  if (typeof value !== "string" || !modes.includes(value as StaticMemoryMode)) {
    response.status(400).json({
      error:
        "Missing or invalid mode. Expected projects|preferences|open_loops|facts|patterns.",
    });
    return null;
  }

  return value as StaticMemoryMode;
}

type XiaoyeStaticMode = "weixin_instructions" | "personality_anchor";

function getXiaoyeStaticModeQuery(
  value: unknown,
  response: express.Response,
) {
  const modes: XiaoyeStaticMode[] = [
    "weixin_instructions",
    "personality_anchor",
  ];

  if (typeof value !== "string" || !modes.includes(value as XiaoyeStaticMode)) {
    response.status(400).json({
      error:
        "Missing or invalid mode. Expected weixin_instructions|personality_anchor.",
    });
    return null;
  }

  return value as XiaoyeStaticMode;
}

function getEditableMemoryDocumentTypeQuery(
  value: unknown,
  response: express.Response,
) {
  const supportedTypes: EditableMemoryDocumentType[] = [
    "dated-memory-document",
    "static-memory-document",
    "xiaoye-memory-document",
  ];

  if (
    typeof value !== "string" ||
    !supportedTypes.includes(value as EditableMemoryDocumentType)
  ) {
    response.status(400).json({
      error:
        "Missing or invalid documentType. Expected dated-memory-document|static-memory-document|xiaoye-memory-document.",
    });
    return null;
  }

  return value as EditableMemoryDocumentType;
}

function getEditToken() {
  return String(process.env.MURMURLANE_EDIT_TOKEN || "").trim();
}

function ensureEditToken(request: express.Request, response: express.Response) {
  const configuredToken = getEditToken();

  if (!configuredToken) {
    response.status(403).json({
      error: "Editing is disabled. Set MURMURLANE_EDIT_TOKEN to enable writes.",
    });
    return false;
  }

  const providedToken = String(
    request.headers["x-murmurlane-edit-token"] || "",
  ).trim();

  if (!providedToken || providedToken !== configuredToken) {
    response.status(403).json({
      error: "Invalid edit token.",
    });
    return false;
  }

  return true;
}

function handleWritableRouteError(
  error: unknown,
  response: express.Response,
  next: express.NextFunction,
) {
  if (!(error instanceof Error)) {
    next(error);
    return;
  }

  if (
    /^(Missing|Invalid|Unsupported|Editing is disabled|Open loop #|Timeline .+ was not found\.|Timeline state was not found\.|Timeline taxonomy was not found\.)/i.test(
      error.message,
    )
  ) {
    const status = /not found/i.test(error.message) ? 404 : 400;
    response.status(status).json({
      error: error.message,
    });
    return;
  }

  next(error);
}

function notFoundEntry(response: express.Response<MemoryEntryResponse>) {
  response.json({
    found: false,
    entry: null,
  });
}

function normalizeIndexedDate(value: string) {
  const normalized = String(value).trim().replace(/\./g, "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function sortUniqueDates(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

interface ConversationFileSnapshot {
  date: string;
  fileName: string;
  size: number;
  mtimeMs: number;
}

let conversationIndexCache:
  | {
      signature: string;
      dates: string[];
      conversationThreads: Record<string, string[]>;
    }
  | null = null;

let timelineStateCache:
  | {
      signature: string;
      data: unknown;
    }
  | null = null;

async function getConversationFileSnapshots() {
  const directoryPath = resolveDataPath("conversations");

  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const snapshots = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const date =
            entry.name.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/)?.[1] || "";

          if (!date) {
            return null;
          }

          const filePath = resolveDataPath("conversations", entry.name);
          const fileStat = await stat(filePath);

          return {
            date,
            fileName: entry.name,
            size: fileStat.size,
            mtimeMs: fileStat.mtimeMs,
          } satisfies ConversationFileSnapshot;
        }),
    );

    return snapshots
      .filter((item): item is ConversationFileSnapshot => Boolean(item))
      .sort((left, right) => left.date.localeCompare(right.date));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function getConversationIndexSignature(snapshots: ConversationFileSnapshot[]) {
  return snapshots
    .map((item) => `${item.date}:${item.size}:${item.mtimeMs}`)
    .join("|");
}

async function getConversationIndexFromCache() {
  const startedAt = process.hrtime.bigint();
  const snapshots = await getConversationFileSnapshots();
  const signature = getConversationIndexSignature(snapshots);

  if (conversationIndexCache?.signature === signature) {
    console.info(
      `[cyberboss-api] /api/index/dates conversations-cache hit files=${snapshots.length} dates=${conversationIndexCache.dates.length} ms=${elapsedMs(startedAt)}`,
    );
    return conversationIndexCache;
  }

  const threadDates: Record<string, string[]> = {};

  await Promise.all(
    snapshots.map(async ({ date, fileName }) => {
      try {
        const result = await readJsonLinesFile<ConversationRecord>(
          resolveDataPath("conversations", fileName),
        );

        result.records.forEach((record) => {
          const threadId =
            typeof record.threadId === "string" ? record.threadId.trim() : "";

          if (!threadId) {
            return;
          }

          if (!threadDates[threadId]) {
            threadDates[threadId] = [];
          }

          threadDates[threadId].push(date);
        });
      } catch (error) {
        console.warn(
          `[cyberboss-api] failed to index conversation file for ${date}`,
          error,
        );
      }
    }),
  );

  const dates = sortUniqueDates(snapshots.map((item) => item.date));
  const conversationThreads = Object.fromEntries(
    Object.entries(threadDates)
      .map(([threadId, dates]) => [threadId, sortUniqueDates(dates)])
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  conversationIndexCache = {
    signature,
    dates,
    conversationThreads,
  };

  console.info(
    `[cyberboss-api] /api/index/dates conversations-cache refresh files=${snapshots.length} dates=${dates.length} ms=${elapsedMs(startedAt)}`,
  );

  return conversationIndexCache;
}

async function getTimelineStateFromCache() {
  const startedAt = process.hrtime.bigint();
  const filePath = resolveDataPath("timeline", "timeline-state.json");

  let fileStat;

  try {
    fileStat = await stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      timelineStateCache = null;
      console.info(
        `[cyberboss-api] /api/timeline cache missing ms=${elapsedMs(startedAt)}`,
      );
      return {
        found: false,
        data: null,
      };
    }

    throw error;
  }

  const signature = `${fileStat.size}:${fileStat.mtimeMs}`;

  if (timelineStateCache?.signature === signature) {
    console.info(
      `[cyberboss-api] /api/timeline cache hit size=${fileStat.size} ms=${elapsedMs(startedAt)}`,
    );
    return {
      found: true,
      data: timelineStateCache.data,
    };
  }

  const result = await readDataJsonFile<unknown>(
    "timeline",
    "timeline-state.json",
  );

  if (!result.found) {
    timelineStateCache = null;
    return {
      found: false,
      data: null,
    };
  }

  timelineStateCache = {
    signature,
    data: result.data,
  };

  console.info(
    `[cyberboss-api] /api/timeline cache refresh size=${fileStat.size} ms=${elapsedMs(startedAt)}`,
  );

  return {
    found: true,
    data: result.data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getTimelineFacts(data: unknown) {
  if (!isRecord(data)) {
    return null;
  }

  const facts = data.facts;

  if (isRecord(facts)) {
    return facts;
  }

  return data;
}

function filterTimelineData(
  data: unknown,
  predicate: (date: string) => boolean,
) {
  if (!isRecord(data)) {
    return data;
  }

  const facts = getTimelineFacts(data);
  const filteredFacts = facts
    ? Object.fromEntries(
        Object.entries(facts).filter(([key, value]) => {
          const normalizedDate = normalizeIndexedDate(key);
          return Boolean(
            normalizedDate &&
              predicate(normalizedDate) &&
              isRecord(value) &&
              Array.isArray(value.events),
          );
        }),
      )
    : {};

  if (isRecord(data.facts)) {
    return {
      ...data,
      facts: filteredFacts,
    };
  }

  return filteredFacts;
}

async function getDateIndex(): Promise<DateIndexResponse> {
  const [conversationIndex, diaryFiles, dailySummaryFiles, letterFiles, timeline] =
    await Promise.all([
      getConversationIndexFromCache(),
      listDataFileNames("diary"),
      listDataFileNames("memory", "daily-summary"),
      listDataFileNames("memory", "letters"),
      readDataJsonFile<Record<string, { events?: unknown[] }>>(
        "timeline",
        "timeline-state.json",
      ),
    ]);

  const diary = diaryFiles
    .map((fileName) => fileName.match(/^(\d{4}-\d{2}-\d{2})\.md$/)?.[1] || "")
    .filter(Boolean);

  const dailySummary = dailySummaryFiles
    .map(
      (fileName) =>
        fileName.match(/^daily-summary-(\d{4}-\d{2}-\d{2})\.md$/)?.[1] || "",
    )
    .filter(Boolean);

  const letters = letterFiles
    .map((fileName) => fileName.match(/^(\d{4}-\d{2}-\d{2})\.md$/)?.[1] || "")
    .filter(Boolean);

  const timelineFacts =
    timeline.found && timeline.data && typeof timeline.data === "object"
      ? timeline.data.facts ?? timeline.data
      : null;

  const timelineDates = timelineFacts
    ? Object.entries(timelineFacts)
        .filter(([, value]) => Array.isArray(value?.events) && value.events.length > 0)
        .map(([key]) => normalizeIndexedDate(key))
        .filter(Boolean)
    : [];

  return {
    conversations: conversationIndex.dates,
    conversationThreads: conversationIndex.conversationThreads,
    diary: sortUniqueDates(diary),
    dailySummary: sortUniqueDates(dailySummary),
    letters: sortUniqueDates(letters),
    timeline: sortUniqueDates(timelineDates),
  };
}

app.get("/api/conversations", async (request, response, next) => {
  try {
    const date = getDateQuery(request.query.date, response);
    const limit = getOptionalLimitQuery(request.query.limit, response);

    if (!date) {
      return;
    }

    if (request.query.limit != null && limit == null) {
      return;
    }

    const threadId =
      typeof request.query.threadId === "string"
        ? request.query.threadId.trim()
        : "";
    const filePath = resolveDataPath("conversations", `${date}.jsonl`);
    const result = await readJsonLinesFile<ConversationRecord>(filePath);
    const threadRecords = threadId
      ? result.records.filter((record) => record.threadId === threadId)
      : result.records;
    const limitedRecords = limit ? threadRecords.slice(-limit) : threadRecords;

    response.json(limitedRecords);
  } catch (error) {
    handleWritableRouteError(error, response, next);
  }
});

app.get("/api/conversations/search", async (request, response, next) => {
  try {
    const threadId =
      typeof request.query.threadId === "string"
        ? request.query.threadId.trim()
        : "";
    const query =
      typeof request.query.q === "string" ? request.query.q.trim() : "";
    const requestedDate =
      typeof request.query.date === "string" ? request.query.date.trim() : "";
    const requestedMonth =
      typeof request.query.month === "string" ? request.query.month.trim() : "";
    const requestedLimit = getOptionalLimitQuery(request.query.limit, response);

    if (request.query.limit != null && requestedLimit == null) {
      return;
    }
    const limit = requestedLimit ?? 120;
    if (!query) {
      response.json([]);
      return;
    }
    if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      response.status(400).json({ error: "Invalid date. Expected YYYY-MM-DD." });
      return;
    }
    if (requestedMonth && !/^\d{4}-\d{2}$/.test(requestedMonth)) {
      response.status(400).json({ error: "Invalid month. Expected YYYY-MM." });
      return;
    }

    const normalizedQuery = query.toLocaleLowerCase();
    const fileNames = (await listDataFileNames("conversations"))
      .filter((fileName) => /^\d{4}-\d{2}-\d{2}\.jsonl$/i.test(fileName))
      .filter((fileName) => !requestedDate || fileName.startsWith(`${requestedDate}.`))
      .filter((fileName) => !requestedMonth || fileName.startsWith(`${requestedMonth}-`))
      .sort()
      .reverse();
    const matches: Array<ConversationRecord & { conversationDate: string }> = [];

    for (const fileName of fileNames) {
      const date = fileName.slice(0, 10);
      const result = await readJsonLinesFile<ConversationRecord>(
        resolveDataPath("conversations", fileName),
      );
      const records = result.records
        .filter((record) => !threadId || record.threadId === threadId)
        .filter((record) =>
          JSON.stringify(record).toLocaleLowerCase().includes(normalizedQuery),
        )
        .reverse();

      for (const record of records) {
        matches.push({
          ...record,
          conversationDate: date.replace(/-/g, "."),
        });
        if (matches.length >= limit) break;
      }
      if (matches.length >= limit) break;
    }

    response.json(matches);
  } catch (error) {
    next(error);
  }
});

app.get("/api/moments", async (request, response, next) => {
  try {
    const requestedDays = Number(request.query.days ?? 3);
    const days = Number.isFinite(requestedDays)
      ? Math.min(7, Math.max(1, Math.floor(requestedDays)))
      : 3;
    const momentRoot = resolveDataPath("MLane", "moment");
    const moments: Array<{
      id: string;
      date: string;
      fileName: string;
      path: string;
      src: string;
    }> = [];

    for (let offset = 0; offset < days; offset += 1) {
      const { year, month, day } = getMomentDateParts(offset);
      const date = `${year}-${month}-${day}`;
      const directoryPath = path.join(momentRoot, year, month, day);
      let entries;

      try {
        entries = await readdir(directoryPath, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }

      entries
        .filter(
          (entry) =>
            entry.isFile() &&
            allowedMediaExtensions.has(path.extname(entry.name).toLowerCase()),
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .forEach((entry) => {
          const filePath = path.join(directoryPath, entry.name);
          moments.push({
            id: `${date}:${entry.name}`,
            date,
            fileName: entry.name,
            path: filePath,
            src: `/api/file?path=${encodeURIComponent(filePath)}`,
          });
        });
    }

    response.json({ root: momentRoot, days, moments });
  } catch (error) {
    next(error);
  }
});

app.get("/api/conversation-profiles", async (_request, response, next) => {
  try {
    response.json(await readConversationProfiles());
  } catch (error) {
    next(error);
  }
});

app.get("/api/stickers", async (_request, response, next) => {
  try {
    const assetRoot = path.join(getStickerRoot(), "assets");
    const files = (await readdir(assetRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && stickerAssetExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));
    let index: Record<string, { name?: string; tags?: string[]; category?: string; desc?: string }> = {};
    try {
      index = JSON.parse(await readFile(path.join(getStickerRoot(), "index.json"), "utf8"));
    } catch {
      // The asset folder remains usable when optional metadata is absent.
    }
    response.json({
      stickers: files.map((fileName) => {
        const id = path.parse(fileName).name;
        const metadata = index[id] || {};
        return {
          id,
          fileName,
          name: metadata.name || id,
          tags: Array.isArray(metadata.tags) ? metadata.tags : [],
          category: metadata.category || "",
          description: metadata.desc || "",
          // Use an octet-stream response for previews. Some mobile/browser
          // shells block direct GIF subresources, while image decoders still
          // render the same bytes when the response is loaded as an image.
          src:
            getBundledStickerFallback(id) ||
            `/api/stickers/assets/${encodeURIComponent(fileName)}?raw=1`,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/stickers/assets/:fileName", async (request, response, next) => {
  try {
    const filePath = getStickerAssetPath(request.params.fileName);
    if (!filePath || !existsSync(filePath)) {
      response.status(404).json({ error: "Sticker not found." });
      return;
    }
    response.setHeader("Cache-Control", "public, max-age=86400, immutable");
    if (String(request.query.raw || "") === "1") {
      response.setHeader("Content-Type", "application/octet-stream");
    } else {
      response.type(path.extname(filePath));
    }
    response.send(await readFile(filePath));
  } catch (error) {
    next(error);
  }
});

app.put("/api/conversation-profiles/user", async (request, response, next) => {
  try {
    if (!ensureEditToken(request, response)) return;
    response.json(
      await writeConversationProfile({
        scope: "user",
        payload: request.body ?? {},
      }),
    );
  } catch (error) {
    handleWritableRouteError(error, response, next);
  }
});

app.put(
  "/api/conversation-profiles/thread/:threadId",
  async (request, response, next) => {
    try {
      if (!ensureEditToken(request, response)) return;
      response.json(
        await writeConversationProfile({
          scope: "thread",
          threadId: request.params.threadId,
          payload: request.body ?? {},
        }),
      );
    } catch (error) {
      handleWritableRouteError(error, response, next);
    }
  },
);

app.get("/api/index/dates", async (_request, response, next) => {
  try {
    response.json(await getDateIndex());
  } catch (error) {
    handleWritableRouteError(error, response, next);
  }
});

app.get("/api/reminders/history", async (_request, response, next) => {
  try {
    const filePath = resolveDataPath(
      "reminder-archive",
      "reminders-history.jsonl",
    );

    try {
      const result = await readJsonLinesFile<ReminderHistoryEntry>(filePath);

      if (!result.found || result.records.length === 0) {
        response.json({
          found: false,
          entries: [],
        });
        return;
      }

      response.json({
        found: true,
        entries: result.records,
      });
    } catch (error) {
      console.warn("[cyberboss-api] failed to read reminder history", error);
      response.json({
        found: false,
        entries: [],
      });
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/file", async (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  let extension = "";
  let fileSize: number | null = null;

  try {
    const requestedPath =
      typeof request.query.path === "string" ? request.query.path : "";
    const filePath = resolveReadableCyberbossFilePath(requestedPath);

    if (!filePath) {
      logApiFileAccess({
        status: 403,
        extension,
        size: fileSize,
        startedAt,
        reason: "forbidden_path",
      });
      response.status(403).json({
        error: "Forbidden file path.",
      });
      return;
    }

    extension = path.extname(filePath).toLowerCase();

    if (!allowedMediaExtensions.has(extension)) {
      logApiFileAccess({
        status: 415,
        extension,
        size: fileSize,
        startedAt,
        reason: "unsupported_extension",
      });
      response.status(415).json({
        error: "Unsupported media type.",
      });
      return;
    }

    let fileStat;

    try {
      fileStat = await stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      logApiFileAccess({
        status: 404,
        extension,
        size: fileSize,
        startedAt,
        reason: "not_found",
      });
      response.status(404).json({
        error: "File not found.",
      });
      return;
    }

    fileSize = fileStat.size;

    if (!fileStat.isFile()) {
      logApiFileAccess({
        status: 404,
        extension,
        size: fileSize,
        startedAt,
        reason: "not_file",
      });
      response.status(404).json({
        error: "File not found.",
      });
      return;
    }

    if (fileSize > getApiFileMaxBytes()) {
      logApiFileAccess({
        status: 413,
        extension,
        size: fileSize,
        startedAt,
        reason: "file_too_large",
      });
      response.status(413).json({
        error: "File too large.",
      });
      return;
    }

    response.sendFile(filePath, {
      dotfiles: "allow",
    }, (error) => {
      if (error) {
        const status = (error as { statusCode?: number; status?: number })
          .statusCode ?? (error as { status?: number }).status ?? 500;
        logApiFileAccess({
          status,
          extension,
          size: fileSize,
          startedAt,
          reason: "send_failed",
        });

        if (response.headersSent) {
          next(error);
          return;
        }

        response.status(status).json({
          error: "Failed to send file.",
        });
        return;
      }

      logApiFileAccess({
        status: response.statusCode,
        extension,
        size: fileSize,
        startedAt,
        reason: "ok",
      });
    });
  } catch (error) {
    logApiFileAccess({
      status: 500,
      extension,
      size: fileSize,
      startedAt,
      reason: "error",
    });
    next(error);
  }
});

app.get("/api/timeline", async (request, response, next) => {
  try {
    const date =
      typeof request.query.date === "string"
        ? request.query.date.trim().replace(/\./g, "-")
        : "";
    const month =
      typeof request.query.month === "string"
        ? request.query.month.trim().replace(/\./g, "-")
        : "";

    if (date && !isIsoDate(date)) {
      response.status(400).json({
        error: "Invalid date. Expected yyyy-mm-dd.",
      });
      return;
    }

    if (month && !isIsoMonth(month)) {
      response.status(400).json({
        error: "Invalid month. Expected yyyy-mm.",
      });
      return;
    }

    const result = await getTimelineStateFromCache();

    if (!result.found) {
      response.json({
        found: false,
        entry: null,
      });
      return;
    }

    if (date) {
      response.json(
        filterTimelineData(result.data, (entryDate) => entryDate === date),
      );
      return;
    }

    if (month) {
      response.json(
        filterTimelineData(result.data, (entryDate) =>
          entryDate.startsWith(`${month}-`),
        ),
      );
      return;
    }

    response.json(result.data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/timeline/event", async (request, response, next) => {
  try {
    const date = getDateQuery(request.query.date, response);
    const eventId =
      typeof request.query.eventId === "string"
        ? request.query.eventId.trim()
        : "";

    if (!date) {
      return;
    }

    if (!eventId) {
      response.status(400).json({
        error: "Missing or invalid eventId.",
      });
      return;
    }

    const timelineFile = await readTimelineStateFile();

    if (!timelineFile.found || !timelineFile.data) {
      response.json({
        found: false,
        event: null,
      });
      return;
    }

    const result = findTimelineEventById({
      state: timelineFile.data,
      date,
      eventId,
    });

    response.json({
      found: result.found,
      event: result.event,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/memory/diary", async (request, response, next) => {
  try {
    const date = getDateQuery(request.query.date, response);

    if (!date) {
      return;
    }

    const result = await readDataTextFile("diary", `${date}.md`);

    if (!result.found || result.content == null) {
      notFoundEntry(response);
      return;
    }

    response.json({
      found: true,
      entry: parseDiaryOrLetterMarkdown(result.content, {
        fallbackTitle: date,
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/memory/daily-summary", async (request, response, next) => {
  try {
    const date = getDateQuery(request.query.date, response);

    if (!date) {
      return;
    }

    const result = await readDataTextFile(
      "memory",
      "daily-summary",
      `daily-summary-${date}.md`,
    );

    if (!result.found || result.content == null) {
      notFoundEntry(response);
      return;
    }

    response.json({
      found: true,
      entry: parseDailySummaryMarkdown(result.content),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/memory/letters", async (request, response, next) => {
  try {
    const date = getDateQuery(request.query.date, response);

    if (!date) {
      return;
    }

    const result = await readDataTextFile("memory", "letters", `${date}.md`);

    if (!result.found || result.content == null) {
      notFoundEntry(response);
      return;
    }

    response.json({
      found: true,
      entry: parseDiaryOrLetterMarkdown(result.content, {
        fallbackTitle: "给小栩的信",
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/memory/static", async (request, response, next) => {
  try {
    const mode = getStaticModeQuery(request.query.mode, response);

    if (!mode) {
      return;
    }

    const candidates: Record<string, string[]> = {
      projects: ["memory/projects.md", "memory/projects"],
      preferences: ["memory/preferences.md", "memory/preferences"],
      open_loops: ["memory/open_loops.md", "memory/open_loops"],
      facts: ["memory/facts", "memory/facts.md"],
      patterns: [
        "memory/patterrns",
        "memory/patterrns.md",
        "memory/patterns",
        "memory/patterns.md",
      ],
    };

    const filePath = await findExistingDataPath(candidates[mode]);
    const result = await readTextFile(filePath);

    if (!result.found || result.content == null) {
      notFoundEntry(response);
      return;
    }

    const entry =
      mode === "open_loops"
        ? parseOpenLoopsMarkdown(result.content)
        : parseStaticMemoryMarkdown(mode, result.content);

    response.json({
      found: true,
      entry,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/xiaoye/static", async (request, response, next) => {
  try {
    const mode = getXiaoyeStaticModeQuery(request.query.mode, response);

    if (!mode) {
      return;
    }

    const files: Record<XiaoyeStaticMode, string> = {
      weixin_instructions: "weixin-instructions.md",
      personality_anchor: "personality-anchor.md",
    };
    const result = await readTextFile(resolveDataPath(files[mode]));

    if (!result.found || result.content == null) {
      notFoundEntry(response);
      return;
    }

    response.json({
      found: true,
      entry: parseStaticMemoryMarkdown(mode, result.content),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/editable-memory/document", async (request, response, next) => {
  try {
    const documentType = getEditableMemoryDocumentTypeQuery(
      request.query.documentType,
      response,
    );
    const documentId =
      typeof request.query.documentId === "string"
        ? request.query.documentId.trim()
        : "";
    const date =
      typeof request.query.date === "string" ? request.query.date.trim() : "";

    if (!documentType) {
      return;
    }

    if (!documentId) {
      response.status(400).json({
        error: "Missing or invalid documentId.",
      });
      return;
    }

    const result = await readEditableMemoryDocument({
      documentType,
      documentId,
      date,
    });

    response.json({
      found: result.found,
      writeEnabled: Boolean(getEditToken()),
      path: result.path,
      content: result.content,
      entry: result.entry,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/editable-memory/document", async (request, response, next) => {
  try {
    if (!ensureEditToken(request, response)) {
      return;
    }

    const body = request.body ?? {};
    const documentType = getEditableMemoryDocumentTypeQuery(
      body.documentType,
      response,
    );
    const documentId =
      typeof body.documentId === "string" ? body.documentId.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const content =
      typeof body.content === "string" ? body.content : String(body.content ?? "");

    if (!documentType) {
      return;
    }

    if (!documentId) {
      response.status(400).json({
        error: "Missing or invalid documentId.",
      });
      return;
    }

    const result = await writeEditableMemoryDocument({
      documentType,
      documentId,
      date,
      content,
    });

    response.json({
      found: true,
      path: result.path,
      content: result.content,
      entry: result.entry,
    });
  } catch (error) {
    next(error);
  }
});

app.patch(
  "/api/editable-memory/open-loops/toggle",
  async (request, response, next) => {
    try {
      if (!ensureEditToken(request, response)) {
        return;
      }

      const no = typeof request.body?.no === "string" ? request.body.no : "";
      const checked = Boolean(request.body?.checked);
      const result = await toggleOpenLoopsChecklistItem({
        no,
        checked,
      });

      response.json({
        found: true,
        path: result.path,
        content: result.content,
        entry: result.entry,
      });
    } catch (error) {
      handleWritableRouteError(error, response, next);
    }
  },
);

app.patch("/api/timeline/event", async (request, response, next) => {
  try {
    if (!ensureEditToken(request, response)) {
      return;
    }

    const date = getDateQuery(request.body?.date, response);
    const eventId =
      typeof request.body?.eventId === "string"
        ? request.body.eventId.trim()
        : "";
    const changes =
      request.body && typeof request.body.changes === "object"
        ? request.body.changes
        : request.body;

    if (!date) {
      return;
    }

    if (!eventId) {
      response.status(400).json({
        error: "Missing or invalid eventId.",
      });
      return;
    }

    const result = await patchTimelineEvent({
      date,
      eventId,
      changes,
    });

    timelineStateCache = null;

    response.json({
      found: true,
      date: result.dayKey,
      event: result.event,
    });
  } catch (error) {
    handleWritableRouteError(error, response, next);
  }
});

app.post("/api/timeline/event", async (request, response, next) => {
  try {
    if (!ensureEditToken(request, response)) {
      return;
    }

    const date = getDateQuery(request.body?.date, response);
    const event =
      request.body && typeof request.body.event === "object"
        ? request.body.event
        : request.body;

    if (!date) {
      return;
    }

    const result = await createTimelineEvent({
      date,
      event,
    });

    timelineStateCache = null;

    response.json({
      found: true,
      date: result.dayKey,
      event: result.event,
    });
  } catch (error) {
    handleWritableRouteError(error, response, next);
  }
});

app.delete("/api/timeline/event", async (request, response, next) => {
  try {
    if (!ensureEditToken(request, response)) {
      return;
    }

    const date = getDateQuery(request.body?.date, response);
    const eventId =
      typeof request.body?.eventId === "string"
        ? request.body.eventId.trim()
        : "";

    if (!date) {
      return;
    }

    if (!eventId) {
      response.status(400).json({
        error: "Missing or invalid eventId.",
      });
      return;
    }

    const result = await deleteTimelineEvent({
      date,
      eventId,
    });

    timelineStateCache = null;

    response.json({
      found: true,
      date: result.dayKey,
      deleted: result.deleted,
    });
  } catch (error) {
    handleWritableRouteError(error, response, next);
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    response.status(500).json({
      error: "Internal server error.",
    });
  },
);

if (hasBuiltClient) {
  app.use(
    express.static(distDir, {
      index: false,
    }),
  );

  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(distIndexPath);
  });
}

const server = app.listen(port, host, () => {
  console.log(
    `[cyberboss-api] listening on http://${host}:${port} (data root: ${getCyberbossDataRoot()})`,
  );

  if (hasBuiltClient) {
    console.log(
      `[murmur-lane] serving built client from ${distDir}`,
    );
  }

  liveUpdateHub.start();
});

const closeServer = () => {
  liveUpdateHub.close();
  server.close();
};

process.once("SIGINT", closeServer);
process.once("SIGTERM", closeServer);
