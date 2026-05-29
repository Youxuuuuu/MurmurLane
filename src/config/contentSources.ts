export const cyberbossDisplayRoot = "D:/study/.cyberboss";

function buildCyberbossPath(relativePath: string) {
  return `${cyberbossDisplayRoot}/${relativePath}`;
}

export const contentSourcePaths = {
  Diary: buildCyberbossPath("diary/{date}.md"),
  DailySummary: buildCyberbossPath(
    "memory/daily-summary/daily-summary-{date}.md",
  ),
  Letters: buildCyberbossPath("memory/letters/{date}.md"),
  Project: buildCyberbossPath("memory/projects.md"),
  Preference: buildCyberbossPath("memory/preferences.md"),
  Openloops: buildCyberbossPath("memory/open_loops.md"),
  Facts: buildCyberbossPath("memory/facts.md"),
  Patterns: buildCyberbossPath("memory/patterns.md"),
  Conversation: buildCyberbossPath("conversations/{date}.jsonl"),
  Timeline: buildCyberbossPath("timeline/timeline-state.json"),
  Reminders: buildCyberbossPath("reminder-archive/reminders-history.jsonl"),
};

export const staticModeApiMap = {
  Project: "projects",
  Preference: "preferences",
  Openloops: "open_loops",
  Facts: "facts",
  Patterns: "patterns",
};
