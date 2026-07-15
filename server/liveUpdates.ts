import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import type { Response } from "express";

export type LiveUpdateEvent = {
  id: number;
  type:
    | "conversations"
    | "timeline"
    | "diary"
    | "dailySummary"
    | "letters"
    | "staticMemory"
    | "xiaoye"
    | "reminders"
    | "profiles"
    | "moments"
    | "resync";
  date?: string;
  mode?: string;
  threadId?: string;
};

const datedFilePattern = /(\d{4}-\d{2}-\d{2})/;

export function classifyChangedPath(
  relativePath: string,
): Omit<LiveUpdateEvent, "id"> | null {
  const normalized = relativePath.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const date = normalized.match(datedFilePattern)?.[1];

  if (/^conversations\/\d{4}-\d{2}-\d{2}\.jsonl$/i.test(normalized)) {
    return { type: "conversations", date };
  }
  if (lower === "timeline/timeline-state.json") return { type: "timeline" };
  if (/^diary\/\d{4}-\d{2}-\d{2}\.md$/i.test(normalized)) {
    return { type: "diary", date };
  }
  if (/^memory\/daily-summary\/daily-summary-\d{4}-\d{2}-\d{2}\.md$/i.test(normalized)) {
    return { type: "dailySummary", date };
  }
  if (/^memory\/letters\/\d{4}-\d{2}-\d{2}\.md$/i.test(normalized)) {
    return { type: "letters", date };
  }
  if (/^memory\/(projects|preferences|open_loops|facts|patterns|patterrns)(\.md)?$/i.test(normalized)) {
    return {
      type: "staticMemory",
      mode: path.basename(normalized).replace(/\.md$/i, ""),
    };
  }
  if (lower === "weixin-instructions.md") {
    return { type: "xiaoye", mode: "weixin_instructions" };
  }
  if (lower === "personality-anchor.md") {
    return { type: "xiaoye", mode: "personality_anchor" };
  }
  if (lower === "reminder-archive/reminders-history.jsonl") {
    return { type: "reminders" };
  }
  if (lower.startsWith("mlane/profiles/")) return { type: "profiles" };
  if (lower.startsWith("mlane/moment/")) return { type: "moments", date };

  return null;
}

export function createLiveUpdateHub(dataRoot: string) {
  const clients = new Set<Response>();
  const pendingPaths = new Map<string, NodeJS.Timeout>();
  let nextEventId = Date.now();
  let watcher: FSWatcher | null = null;
  let keepAliveTimer: NodeJS.Timeout | null = null;

  const send = (response: Response, event: LiveUpdateEvent) => {
    response.write(`id: ${event.id}\n`);
    response.write("event: change\n");
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const broadcast = (event: Omit<LiveUpdateEvent, "id">) => {
    const payload = { ...event, id: ++nextEventId } as LiveUpdateEvent;
    clients.forEach((client) => send(client, payload));
  };

  const subscribe = (response: Response) => {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();
    response.write("retry: 3000\n\n");
    send(response, { id: ++nextEventId, type: "resync" });
    clients.add(response);

    response.on("close", () => {
      clients.delete(response);
    });
  };

  const start = () => {
    try {
      watcher = watch(dataRoot, { recursive: true }, (_eventType, filename) => {
        if (!filename) {
          broadcast({ type: "resync" });
          return;
        }

        const relativePath = String(filename);
        const previousTimer = pendingPaths.get(relativePath);
        if (previousTimer) clearTimeout(previousTimer);
        pendingPaths.set(
          relativePath,
          setTimeout(() => {
            pendingPaths.delete(relativePath);
            const event = classifyChangedPath(relativePath);
            if (event) broadcast(event);
          }, 180),
        );
      });
      watcher.on("error", (error) => {
        console.warn("[cyberboss-api] live update watcher failed", error);
        broadcast({ type: "resync" });
      });
      keepAliveTimer = setInterval(() => {
        clients.forEach((client) => client.write(": keep-alive\n\n"));
      }, 25_000);
    } catch (error) {
      console.warn("[cyberboss-api] live update watcher unavailable", error);
    }
  };

  const close = () => {
    watcher?.close();
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    pendingPaths.forEach((timer) => clearTimeout(timer));
    clients.forEach((client) => client.end());
    clients.clear();
  };

  return { subscribe, start, close };
}
