import type { ServerAccess } from "../fileLoaders.js";
import { readJsonLinesFile } from "../fileLoaders.js";
import type { ConversationRecord } from "../types.js";

export function createConversationReadModel(access: ServerAccess) {
  return Object.freeze({
    async read(input: {
      date: string;
      threadId?: string;
      limit?: number | null;
    }) {
      const filePath = access.resolveDataPath(
        "conversations",
        `${input.date}.jsonl`,
      );
      const result =
        await readJsonLinesFile<ConversationRecord>(filePath);
      const threadRecords = input.threadId
        ? result.records.filter(
            (record) => record.threadId === input.threadId,
          )
        : result.records;
      return input.limit
        ? threadRecords.slice(-input.limit)
        : threadRecords;
    },
    async search(input: {
      query: string;
      threadId?: string;
      date?: string;
      month?: string;
      limit: number;
    }) {
      const normalizedQuery =
        input.query.toLocaleLowerCase();
      const fileNames = (
        await access.listDataFileNames("conversations")
      )
        .filter((fileName) =>
          /^\d{4}-\d{2}-\d{2}\.jsonl$/i.test(fileName),
        )
        .filter(
          (fileName) =>
            !input.date ||
            fileName.startsWith(`${input.date}.`),
        )
        .filter(
          (fileName) =>
            !input.month ||
            fileName.startsWith(`${input.month}-`),
        )
        .sort()
        .reverse();
      const matches: Array<
        ConversationRecord & { conversationDate: string }
      > = [];
      for (const fileName of fileNames) {
        const date = fileName.slice(0, 10);
        const result =
          await readJsonLinesFile<ConversationRecord>(
            access.resolveDataPath(
              "conversations",
              fileName,
            ),
          );
        const records = result.records
          .filter(
            (record) =>
              !input.threadId ||
              record.threadId === input.threadId,
          )
          .filter((record) =>
            JSON.stringify(record)
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          )
          .reverse();
        for (const record of records) {
          matches.push({
            ...record,
            conversationDate: date.replace(/-/g, "."),
          });
          if (matches.length >= input.limit) break;
        }
        if (matches.length >= input.limit) break;
      }
      return matches;
    },
  });
}
