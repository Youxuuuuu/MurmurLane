import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  createLiveUpdateService,
  type LiveUpdateEvent,
} from "./liveUpdates.js";
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
import type { ServerAccess } from "./fileLoaders.js";
import type { ServerConfig } from "./config.js";
import {
  createContentReadModel,
  filterTimelineData,
} from "./readModels/contentReadModel.js";
import { createConversationReadModel } from "./conversation/readModel.js";
import { createMemoryService } from "./memory/service.js";
import type { EditableStaticMemoryMode } from "./memory/service.js";
import { createMediaService } from "./media/service.js";
import { createReminderService } from "./reminder/service.js";
import { ServerDomainError } from "./domainErrors.js";

export interface ServerRouteDependencies {
  readonly config: ServerConfig;
  readonly liveUpdates: ReturnType<
    typeof createLiveUpdateService
  >;
  readonly access: ServerAccess;
  readonly contentReadModel: ReturnType<
    typeof createContentReadModel
  >;
  readonly conversationReadModel: ReturnType<
    typeof createConversationReadModel
  >;
  readonly memoryService: ReturnType<
    typeof createMemoryService
  >;
  readonly mediaService: ReturnType<
    typeof createMediaService
  >;
  readonly reminderService: ReturnType<
    typeof createReminderService
  >;
}

export function registerRoutes(
  app: express.Express,
  dependencies: ServerRouteDependencies,
) {
const distDir = dependencies.config.staticDistDirectory;
const distIndexPath = path.join(distDir, "index.html");
const hasBuiltClient = existsSync(distIndexPath);
const liveUpdateHub = dependencies.liveUpdates;
const {
  contentReadModel,
  conversationReadModel,
  memoryService,
  mediaService,
  reminderService,
} = dependencies;

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
  response.status(200);
  response.setHeader(
    "Content-Type",
    "text/event-stream; charset=utf-8",
  );
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();
  response.write("retry: 3000\n\n");
  const send = (event: LiveUpdateEvent) => {
    response.write(`id: ${event.id}\n`);
    response.write("event: change\n");
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const unsubscribe = liveUpdateHub.subscribe(send);
  const keepAliveTimer = setInterval(() => {
    response.write(": keep-alive\n\n");
  }, 25_000);
  response.on("close", () => {
    clearInterval(keepAliveTimer);
    unsubscribe();
  });
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
  const modes: EditableStaticMemoryMode[] = [
    "projects",
    "preferences",
    "open_loops",
    "facts",
    "patterns",
  ];

  if (
    typeof value !== "string" ||
    !modes.includes(value as EditableStaticMemoryMode)
  ) {
    response.status(400).json({
      error:
        "Missing or invalid mode. Expected projects|preferences|open_loops|facts|patterns.",
    });
    return null;
  }

  return value as EditableStaticMemoryMode;
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
  return dependencies.config.editToken;
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
  if (error instanceof ServerDomainError) {
    const status = {
      "invalid-input": 400,
      "not-found": 404,
      "access-denied": 403,
      conflict: 409,
    }[error.kind];
    response.status(status).json({ error: error.message });
    return;
  }
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
    response.json(
      await conversationReadModel.read({
        date,
        threadId,
        limit,
      }),
    );
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

    response.json(
      await conversationReadModel.search({
        query,
        threadId,
        date: requestedDate,
        month: requestedMonth,
        limit,
      }),
    );
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
    response.json(await mediaService.listMoments(days));
  } catch (error) {
    next(error);
  }
});

app.get("/api/conversation-profiles", async (_request, response, next) => {
  try {
    response.json(
      await readConversationProfiles(dependencies.access),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/stickers", async (_request, response, next) => {
  try {
    response.json({
      stickers: await mediaService.listStickers(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/stickers/assets/:fileName", async (request, response, next) => {
  try {
    const asset = await mediaService.readStickerAsset(
      request.params.fileName,
    );
    if (!asset) {
      response.status(404).json({ error: "Sticker not found." });
      return;
    }
    response.setHeader("Cache-Control", "public, max-age=86400, immutable");
    if (String(request.query.raw || "") === "1") {
      response.setHeader("Content-Type", "application/octet-stream");
    } else {
      response.type(asset.extension);
    }
    response.send(asset.bytes);
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
      }, dependencies.access),
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
        }, dependencies.access),
      );
    } catch (error) {
      handleWritableRouteError(error, response, next);
    }
  },
);

app.get("/api/index/dates", async (_request, response, next) => {
  try {
    response.json(await contentReadModel.getDateIndex());
  } catch (error) {
    handleWritableRouteError(error, response, next);
  }
});

app.get("/api/reminders/history", async (_request, response, next) => {
  try {
    response.json(await reminderService.readHistory());
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
    const resolved = await mediaService.resolveFile(requestedPath);
    extension =
      "extension" in resolved
        ? resolved.extension ?? ""
        : "";
    fileSize =
      "size" in resolved ? resolved.size ?? null : null;
    if (resolved.status !== 200) {
      logApiFileAccess({
        status: resolved.status,
        extension,
        size: fileSize,
        startedAt,
        reason: resolved.reason,
      });
      const messages = {
        403: "Forbidden file path.",
        404: "File not found.",
        413: "File too large.",
        415: "Unsupported media type.",
      } as const;
      response.status(resolved.status).json({
        error: messages[resolved.status],
      });
      return;
    }

    response.sendFile(resolved.path, {
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

    const result = await contentReadModel.getTimelineState();

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

    const timelineFile = await readTimelineStateFile(
      dependencies.access,
    );

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

    response.json(await memoryService.readDiary(date));
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

    response.json(
      await memoryService.readDailySummary(date),
    );
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

    response.json(await memoryService.readLetters(date));
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

    response.json(await memoryService.readStatic(mode));
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

    response.json(await memoryService.readXiaoye(mode));
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
      documentId:
        documentId as Parameters<
          typeof readEditableMemoryDocument
        >[0]["documentId"],
      date,
    }, dependencies.access);

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
      documentId:
        documentId as Parameters<
          typeof writeEditableMemoryDocument
        >[0]["documentId"],
      date,
      content,
    }, dependencies.access);

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
      }, dependencies.access);

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
    }, dependencies.access);

    contentReadModel.invalidateTimeline();

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
    }, dependencies.access);

    contentReadModel.invalidateTimeline();

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
    }, dependencies.access);

    contentReadModel.invalidateTimeline();

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

}
