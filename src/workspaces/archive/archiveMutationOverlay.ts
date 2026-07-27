import type { RemoteData } from "../../types/api";
import type { MemoryEntry } from "../../types/memory";
import type { EditableMemoryDocumentRequest } from "../../lib/editableMemory";

interface ArchiveEntryMutation {
  readonly document: EditableMemoryDocumentRequest;
  readonly entry: MemoryEntry;
  readonly baseRevision: number;
}

export interface ArchiveMutationOverlay {
  readonly entries: Readonly<Record<string, ArchiveEntryMutation>>;
}

export function createArchiveMutationOverlay(): ArchiveMutationOverlay {
  return { entries: {} };
}

function getArchiveMutationKey(
  document: EditableMemoryDocumentRequest,
) {
  return [
    document.documentType,
    document.documentId,
    document.date ?? "",
  ].join(":");
}

export function saveArchiveEntryToOverlay(
  overlay: ArchiveMutationOverlay,
  mutation: ArchiveEntryMutation,
): ArchiveMutationOverlay {
  return {
    entries: {
      ...overlay.entries,
      [getArchiveMutationKey(mutation.document)]: mutation,
    },
  };
}

function getStaticMode(documentId: string) {
  if (documentId === "projects") return "Project";
  if (documentId === "preferences") return "Preference";
  if (documentId === "facts") return "Facts";
  if (documentId === "patterns") return "Patterns";
  return "Openloops";
}

export function applyArchiveMutationOverlay(
  canonical: RemoteData,
  overlay: ArchiveMutationOverlay,
): RemoteData {
  let diaryEntries = canonical.diaryEntries;
  let dailySummaryEntries = canonical.dailySummaryEntries;
  let letterEntries = canonical.letterEntries;
  let staticModeEntries = canonical.staticModeEntries;
  let xiaoyeEntries = canonical.xiaoyeEntries;

  Object.values(overlay.entries).forEach(({ document, entry }) => {
    const date = String(document.date ?? "").replace(/-/g, ".");
    if (document.documentId === "diary") {
      diaryEntries = { ...diaryEntries, [date]: entry };
      return;
    }
    if (document.documentId === "daily-summary") {
      dailySummaryEntries = {
        ...dailySummaryEntries,
        [date]: entry,
      };
      return;
    }
    if (document.documentId === "letters") {
      letterEntries = { ...letterEntries, [date]: entry };
      return;
    }
    if (document.documentType === "xiaoye-memory-document") {
      const mode =
        document.documentId === "personality_anchor"
          ? "PersonalityAnchor"
          : "Ins";
      xiaoyeEntries = { ...xiaoyeEntries, [mode]: entry };
      return;
    }
    staticModeEntries = {
      ...staticModeEntries,
      [getStaticMode(document.documentId)]: entry,
    };
  });

  return {
    ...canonical,
    diaryEntries,
    dailySummaryEntries,
    letterEntries,
    staticModeEntries,
    xiaoyeEntries,
  };
}

