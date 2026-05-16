import express from "express";
import {
  fileExists,
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
  StaticMemoryMode,
} from "./types.js";

const app = express();
const host = process.env.API_HOST || "127.0.0.1";
const port = Number(process.env.PORT || process.env.API_PORT || 8787);

app.use(express.json());
app.use((request, response, next) => {
  const origin = request.headers.origin;

  if (
    origin &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  ) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
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

async function getDateIndex(): Promise<DateIndexResponse> {
  const [conversationFiles, diaryFiles, dailySummaryFiles, letterFiles, timeline] =
    await Promise.all([
      listDataFileNames("conversations"),
      listDataFileNames("diary"),
      listDataFileNames("memory", "daily-summary"),
      listDataFileNames("memory", "letters"),
      readDataJsonFile<Record<string, { events?: unknown[] }>>(
        "timeline",
        "timeline-state.json",
      ),
    ]);

  const conversations = conversationFiles
    .map((fileName) => fileName.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/)?.[1] || "")
    .filter(Boolean);

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
    conversations: sortUniqueDates(conversations),
    diary: sortUniqueDates(diary),
    dailySummary: sortUniqueDates(dailySummary),
    letters: sortUniqueDates(letters),
    timeline: sortUniqueDates(timelineDates),
  };
}

app.get("/api/conversations", async (request, response, next) => {
  try {
    const date = getDateQuery(request.query.date, response);

    if (!date) {
      return;
    }

    const filePath = resolveDataPath("conversations", `${date}.jsonl`);
    const result = await readJsonLinesFile<ConversationRecord>(filePath);

    response.json(result.records);
  } catch (error) {
    next(error);
  }
});

app.get("/api/index/dates", async (_request, response, next) => {
  try {
    response.json(await getDateIndex());
  } catch (error) {
    next(error);
  }
});

app.get("/api/file", async (request, response, next) => {
  try {
    const requestedPath =
      typeof request.query.path === "string" ? request.query.path : "";
    const filePath = resolveReadableCyberbossFilePath(requestedPath);

    if (!filePath) {
      response.status(403).json({
        error: "Forbidden file path.",
      });
      return;
    }

    if (!(await fileExists(filePath))) {
      response.status(404).json({
        error: "File not found.",
      });
      return;
    }

    response.sendFile(filePath, {
      dotfiles: "allow",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/timeline", async (_request, response, next) => {
  try {
    const result = await readDataJsonFile<unknown>("timeline", "timeline-state.json");

    if (!result.found) {
      response.json({
        found: false,
        entry: null,
      });
      return;
    }

    response.json(result.data);
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

app.listen(port, host, () => {
  console.log(
    `[cyberboss-api] listening on http://${host}:${port} (data root: ${getCyberbossDataRoot()})`,
  );
});
