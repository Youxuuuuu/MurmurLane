import type { MemoryEntry, MemorySection } from "../types/memory";

export type EditableMemoryDocumentType =
  | "dated-memory-document"
  | "static-memory-document"
  | "xiaoye-memory-document";

export type EditableMemoryDocumentId =
  | "diary"
  | "daily-summary"
  | "letters"
  | "projects"
  | "preferences"
  | "facts"
  | "patterns"
  | "open_loops"
  | "weixin_instructions"
  | "personality_anchor";

export interface EditableMemoryDocumentRequest {
  documentType: EditableMemoryDocumentType;
  documentId: EditableMemoryDocumentId;
  date?: string;
}

function normalizeMarkdown(source: string) {
  return String(source ?? "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
}

function firstMeaningfulLine(text: string) {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
}

function buildExcerpt(sections: MemorySection[], fallback = "") {
  for (const section of sections) {
    if (section.text.trim()) {
      return firstMeaningfulLine(section.text).slice(0, 120);
    }

    if (section.title.trim()) {
      return section.title.trim().slice(0, 120);
    }
  }

  return fallback.trim().slice(0, 120);
}

function toSection(no: number, title: string, text: string): MemorySection {
  return {
    no: String(no),
    title: title.trim(),
    text: text.trim(),
  };
}

function splitTitleAndText(value: string) {
  const trimmed = value.trim();
  const separatorMatch = trimmed.match(/^(.+?)(?:：|:|——)(.+)$/);

  if (!separatorMatch) {
    return {
      title: trimmed,
      text: trimmed,
    };
  }

  return {
    title: separatorMatch[1]?.trim() || trimmed,
    text: separatorMatch[2]?.trim() || trimmed,
  };
}

function extractTitleFromMarkdown(source: string) {
  const match = normalizeMarkdown(source).match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || "";
}

function stripLeadingTitle(source: string) {
  return normalizeMarkdown(source).replace(/^#\s+.+\n*/m, "").trim();
}

function stripLeadingSubTitle(source: string) {
  return normalizeMarkdown(source).replace(/^##\s+.+\n*/m, "").trim();
}

function splitByHorizontalRule(source: string) {
  return normalizeMarkdown(source)
    .split(/\n\s*---+\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractDatePrefix(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[:： ]?(.*)$/);

  if (!match) {
    return {
      date: "",
      content: value.trim(),
    };
  }

  return {
    date: match[1] || "",
    content: (match[2] || "").trim(),
  };
}

function parseDiaryOrLetterMarkdown(
  source: string,
  fallbackTitle: string,
): MemoryEntry {
  const normalized = normalizeMarkdown(source);
  const title = extractTitleFromMarkdown(normalized) || fallbackTitle;
  const body = stripLeadingTitle(normalized);
  const blocks = splitByHorizontalRule(body);
  const rawSections = blocks.length ? blocks : [body].filter(Boolean);
  const sections = rawSections.map((block, index) => {
    const sectionTitle = block.match(/^##\s+(.+)$/m)?.[1]?.trim() || "";
    const text = sectionTitle ? stripLeadingSubTitle(block) : block.trim();
    return toSection(index + 1, sectionTitle, text);
  });

  return {
    title,
    excerpt: buildExcerpt(sections, title),
    sections,
  };
}

function parseDailySummaryMarkdown(source: string): MemoryEntry {
  const normalized = normalizeMarkdown(source);
  const lines = normalized.split("\n");
  const title = extractTitleFromMarkdown(normalized) || "每日摘要";
  const sections: MemorySection[] = [];
  let currentTitle = "";
  let currentBullets: string[] = [];

  const pushSection = () => {
    if (!currentTitle && currentBullets.length === 0) {
      return;
    }

    sections.push(
      toSection(
        sections.length + 1,
        currentTitle,
        currentBullets.join("\n").trim(),
      ),
    );
    currentTitle = "";
    currentBullets = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("# ")) {
      continue;
    }

    if (line.startsWith("## ")) {
      pushSection();
      currentTitle = line.replace(/^##\s+/, "").trim();
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.*)$/)?.[1];
    if (bullet) {
      currentBullets.push(bullet.trim());
      continue;
    }

    currentBullets.push(line);
  }

  pushSection();

  return {
    title,
    excerpt: buildExcerpt(sections, title),
    sections,
  };
}

function parseOpenLoopsMarkdown(source: string): MemoryEntry {
  const normalized = normalizeMarkdown(source);
  const title = extractTitleFromMarkdown(normalized) || "Open Loops";
  const sections = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-\s+\[(x| )\]\s+/i.test(line))
    .map((line, index) => {
      const match = line.match(/^-\s+\[(x| )\]\s+(.*)$/i);
      const checked = match?.[1]?.toLowerCase() === "x";
      const content = match?.[2]?.trim() || "";
      const { title, text } = splitTitleAndText(content);
      return {
        no: String(index + 1),
        title,
        text,
        checked,
      } satisfies MemorySection;
    });

  return {
    title,
    excerpt: buildExcerpt(sections, title),
    sections,
  };
}

function parseStaticMemoryMarkdown(
  mode: EditableMemoryDocumentId,
  source: string,
): MemoryEntry {
  const normalized = normalizeMarkdown(source);
  const title = extractTitleFromMarkdown(normalized) || mode;
  const lines = normalized.split("\n");
  const sections: MemorySection[] = [];
  let currentGroup = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("# ")) {
      continue;
    }

    if (line.startsWith("## ")) {
      currentGroup = line.replace(/^##\s+/, "").trim();
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.*)$/)?.[1];

    if (!bullet) {
      continue;
    }

    const { date, content } = extractDatePrefix(bullet.trim());
    let section: MemorySection;

    if (
      mode === "preferences" ||
      mode === "facts" ||
      mode === "patterns" ||
      mode === "weixin_instructions" ||
      mode === "personality_anchor"
    ) {
      section = {
        no: String(sections.length + 1),
        title: "",
        text: content.trim(),
      };
    } else {
      const split = splitTitleAndText(content);
      const titleText =
        split.title !== split.text ? split.title : currentGroup || split.title;

      section = {
        no: String(sections.length + 1),
        title: titleText,
        text: split.title !== split.text ? split.text : content.trim(),
      };
    }

    if (currentGroup) {
      section.group = currentGroup;
    }

    if (date) {
      section.date = date;
    }

    sections.push(section);
  }

  return {
    title,
    excerpt: buildExcerpt(sections, title),
    sections,
  };
}

export function getEditableMemoryDocumentForPage(page: Record<string, unknown>) {
  const mode = String(page.mode ?? "");

  if (mode === "Diary") {
    return {
      documentType: "dated-memory-document" as const,
      documentId: "diary" as const,
      date: String(page.date ?? "").replace(/\./g, "-"),
    };
  }

  if (mode === "DailySummary") {
    return {
      documentType: "dated-memory-document" as const,
      documentId: "daily-summary" as const,
      date: String(page.date ?? "").replace(/\./g, "-"),
    };
  }

  if (mode === "Letters") {
    return {
      documentType: "dated-memory-document" as const,
      documentId: "letters" as const,
      date: String(page.date ?? "").replace(/\./g, "-"),
    };
  }

  if (mode === "Project") {
    return {
      documentType: "static-memory-document" as const,
      documentId: "projects" as const,
    };
  }

  if (mode === "Preference") {
    return {
      documentType: "static-memory-document" as const,
      documentId: "preferences" as const,
    };
  }

  if (mode === "Facts") {
    return {
      documentType: "static-memory-document" as const,
      documentId: "facts" as const,
    };
  }

  if (mode === "Patterns") {
    return {
      documentType: "static-memory-document" as const,
      documentId: "patterns" as const,
    };
  }

  if (mode === "Openloops") {
    return {
      documentType: "static-memory-document" as const,
      documentId: "open_loops" as const,
    };
  }

  if (mode === "Xiaoye" && String(page.xiaoyeMode ?? "") === "PersonalityAnchor") {
    return {
      documentType: "xiaoye-memory-document" as const,
      documentId: "personality_anchor" as const,
    };
  }

  if (mode === "Xiaoye") {
    return {
      documentType: "xiaoye-memory-document" as const,
      documentId: "weixin_instructions" as const,
    };
  }

  return null;
}

export function parseEditableMemoryContent(
  document: EditableMemoryDocumentRequest,
  content: string,
) {
  if (document.documentId === "diary") {
    return parseDiaryOrLetterMarkdown(
      content,
      document.date || "Diary",
    );
  }

  if (document.documentId === "daily-summary") {
    return parseDailySummaryMarkdown(content);
  }

  if (document.documentId === "letters") {
    return parseDiaryOrLetterMarkdown(content, "给小栩的信");
  }

  if (document.documentId === "open_loops") {
    return parseOpenLoopsMarkdown(content);
  }

  return parseStaticMemoryMarkdown(document.documentId, content);
}

export function buildEditableMemoryTemplate(
  document: EditableMemoryDocumentRequest,
) {
  if (document.documentId === "diary") {
    return `# ${document.date || "Diary"}\n\n`;
  }

  if (document.documentId === "daily-summary") {
    return "# 每日摘要\n\n## 今日摘要\n- \n";
  }

  if (document.documentId === "letters") {
    return "# 给小栩的信\n\n";
  }

  if (document.documentId === "projects") {
    return "# Projects\n\n* \n";
  }

  if (document.documentId === "preferences") {
    return "# Preferences\n\n## 日常\n- \n";
  }

  if (document.documentId === "facts") {
    return "# Facts\n\n## 稳定事实\n- \n";
  }

  if (document.documentId === "patterns") {
    return "# Patterns\n\n## 常见模式\n- \n";
  }

  if (document.documentId === "open_loops") {
    return "# Open Loops\n\n- [ ] \n";
  }

  if (document.documentId === "personality_anchor") {
    return "# personality anchor\n\n## 核心锚点\n- \n";
  }

  return "# ins\n\n## Identity\n- \n";
}

export function applyOpenLoopToggleToEntry(
  entry: MemoryEntry,
  no: string,
  checked: boolean,
) {
  return {
    ...entry,
    sections: entry.sections.map((section) =>
      String(section.no) === String(no)
        ? {
            ...section,
            checked,
          }
        : section,
    ),
  };
}

export function upsertDateIndexDate(dates: string[] = [], date: string) {
  return Array.from(new Set([...(dates || []), date])).sort();
}

export function removeDateIndexDate(dates: string[] = [], date: string) {
  return (dates || []).filter((item) => item !== date);
}
