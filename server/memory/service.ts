import type { ServerAccess } from "../fileLoaders.js";
import { readTextFile } from "../fileLoaders.js";
import {
  parseDailySummaryMarkdown,
  parseDiaryOrLetterMarkdown,
  parseOpenLoopsMarkdown,
  parseStaticMemoryMarkdown,
} from "../parsers.js";
import type { StaticMemoryMode } from "../types.js";

export type EditableStaticMemoryMode = Exclude<
  StaticMemoryMode,
  "weixin_instructions" | "personality_anchor"
>;

export function createMemoryService(access: ServerAccess) {
  const response = async (
    result: Awaited<ReturnType<typeof readTextFile>>,
    parse: (content: string) => unknown,
  ) => {
    if (!result.found || result.content == null) {
      return { found: false, entry: null } as const;
    }
    return {
      found: true,
      entry: parse(result.content),
    } as const;
  };

  return Object.freeze({
    readDiary(date: string) {
      return access
        .readDataTextFile("diary", `${date}.md`)
        .then((result) =>
          response(result, (content) =>
            parseDiaryOrLetterMarkdown(content, {
              fallbackTitle: date,
            }),
          ),
        );
    },
    readDailySummary(date: string) {
      return access
        .readDataTextFile(
          "memory",
          "daily-summary",
          `daily-summary-${date}.md`,
        )
        .then((result) =>
          response(result, parseDailySummaryMarkdown),
        );
    },
    readLetters(date: string) {
      return access
        .readDataTextFile(
          "memory",
          "letters",
          `${date}.md`,
        )
        .then((result) =>
          response(result, (content) =>
            parseDiaryOrLetterMarkdown(content, {
              fallbackTitle: "给小栩的信",
            }),
          ),
        );
    },
    async readStatic(mode: EditableStaticMemoryMode) {
      const candidates: Record<
        EditableStaticMemoryMode,
        string[]
      > = {
        projects: ["memory/projects.md", "memory/projects"],
        preferences: [
          "memory/preferences.md",
          "memory/preferences",
        ],
        open_loops: [
          "memory/open_loops.md",
          "memory/open_loops",
        ],
        facts: ["memory/facts", "memory/facts.md"],
        patterns: [
          "memory/patterrns",
          "memory/patterrns.md",
          "memory/patterns",
          "memory/patterns.md",
        ],
      };
      const filePath = await access.findExistingDataPath(
        candidates[mode],
      );
      const result = await readTextFile(filePath);
      return response(
        result,
        mode === "open_loops"
          ? parseOpenLoopsMarkdown
          : (content) =>
              parseStaticMemoryMarkdown(mode, content),
      );
    },
    readXiaoye(
      mode: "weixin_instructions" | "personality_anchor",
    ) {
      const files = {
        weixin_instructions: "weixin-instructions.md",
        personality_anchor: "personality-anchor.md",
      } as const;
      return readTextFile(
        access.resolveDataPath(files[mode]),
      ).then((result) =>
        response(result, (content) =>
          parseStaticMemoryMarkdown(mode, content),
        ),
      );
    },
  });
}
