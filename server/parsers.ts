import type { MemoryEntry, MemorySection, StaticMemoryMode } from "./types.js";

function normalizeMarkdown(source: string) {
  return String(source ?? "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
}

function nonEmptyLines(source: string) {
  return normalizeMarkdown(source)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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

export function parseDiaryOrLetterMarkdown(
  source: string,
  options: {
    fallbackTitle: string;
  },
): MemoryEntry {
  const normalized = normalizeMarkdown(source);
  const title = extractTitleFromMarkdown(normalized) || options.fallbackTitle;
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

export function parseDailySummaryMarkdown(source: string): MemoryEntry {
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

export function parseOpenLoopsMarkdown(source: string): MemoryEntry {
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

export function parseStaticMemoryMarkdown(
  mode: StaticMemoryMode,
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
    const split = splitTitleAndText(content);
    const titleText =
      split.title !== split.text
        ? split.title
        : currentGroup || split.title;

    const section: MemorySection = {
      no: String(sections.length + 1),
      title: titleText,
      text: split.title !== split.text ? split.text : content.trim(),
    };

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

