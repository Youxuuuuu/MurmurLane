import { watch, type FSWatcher } from "node:fs";
import path from "node:path";

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

export function createLiveUpdateService(dataRoot: string) {
  const listeners = new Set<(event: LiveUpdateEvent) => void>();
  const pendingPaths = new Map<string, NodeJS.Timeout>();
  let nextEventId = Date.now();
  let watcher: FSWatcher | null = null;

  const broadcast = (event: Omit<LiveUpdateEvent, "id">) => {
    const payload = { ...event, id: ++nextEventId } as LiveUpdateEvent;
    listeners.forEach((listener) => listener(payload));
  };

  const subscribe = (
    listener: (event: LiveUpdateEvent) => void,
  ) => {
    listeners.add(listener);
    listener({ id: ++nextEventId, type: "resync" });
    return () => {
      listeners.delete(listener);
    };
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
    } catch (error) {
      console.warn("[cyberboss-api] live update watcher unavailable", error);
    }
  };

  const close = () => {
    watcher?.close();
    pendingPaths.forEach((timer) => clearTimeout(timer));
    listeners.clear();
  };

  return { subscribe, start, close };
}
