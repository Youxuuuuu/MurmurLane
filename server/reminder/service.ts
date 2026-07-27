import type { ServerAccess } from "../fileLoaders.js";
import { readJsonLinesFile } from "../fileLoaders.js";
import type { ReminderHistoryEntry } from "../types.js";

export function createReminderService(access: ServerAccess) {
  return Object.freeze({
    async readHistory() {
      const filePath = access.resolveDataPath(
        "reminder-archive",
        "reminders-history.jsonl",
      );
      try {
        const result =
          await readJsonLinesFile<ReminderHistoryEntry>(
            filePath,
          );
        return {
          found: result.found && result.records.length > 0,
          entries: result.records,
        };
      } catch (error) {
        console.warn(
          "[cyberboss-api] failed to read reminder history",
          error,
        );
        return { found: false, entries: [] };
      }
    },
  });
}
