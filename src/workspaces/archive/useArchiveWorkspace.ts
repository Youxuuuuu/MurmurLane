import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ArchiveNavigationTarget } from "../../app/navigation/appNavigation";
import type {
  EditableMemoryDocumentApiResponse,
  EditableMemoryDocumentApiRequest,
  RemoteData,
} from "../../types/api";
import type {
  MemoryEntry,
  MemoryMode,
  XiaoyeMode,
} from "../../types/memory";
import {
  applyOpenLoopToggleToEntry,
  type EditableMemoryDocumentRequest,
} from "../../lib/editableMemory";
import {
  applyArchiveMutationOverlay,
  createArchiveMutationOverlay,
  saveArchiveEntryToOverlay,
} from "./archiveMutationOverlay";

export type ArchiveSubject = "Me" | "Xiaoye";

export interface ArchiveWorkspacePort {
  loadDocument(
    input: EditableMemoryDocumentApiRequest,
  ): Promise<EditableMemoryDocumentApiResponse>;
  saveDocument(
    input: EditableMemoryDocumentApiRequest & {
      content: string;
    },
  ): Promise<EditableMemoryDocumentApiResponse>;
  toggleOpenLoop(input: {
    no: string;
    checked: boolean;
  }): Promise<EditableMemoryDocumentApiResponse>;
}

function normalizeDate(value: unknown) {
  const date = String(value ?? "").trim().replace(/-/g, ".");
  return /^\d{4}\.\d{2}\.\d{2}$/.test(date) ? date : "";
}

function toDocumentRequest(
  input: EditableMemoryDocumentApiRequest,
): EditableMemoryDocumentRequest {
  return {
    documentType: input.documentType,
    documentId: input.documentId,
    date: input.date,
  };
}

function isMemoryEntry(value: unknown): value is MemoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.title === "string" &&
    typeof entry.excerpt === "string" &&
    Array.isArray(entry.sections)
  );
}

const memoryModes = new Set<MemoryMode>([
  "Diary",
  "DailySummary",
  "Letters",
  "Project",
  "Preference",
  "Openloops",
  "Facts",
  "Patterns",
]);

function upsertDate(
  dates: readonly string[],
  date: string | undefined,
) {
  const hyphenDate = normalizeDate(date).replace(/\./g, "-");
  return hyphenDate
    ? Array.from(new Set([...dates, hyphenDate])).sort()
    : [...dates];
}

export function useArchiveWorkspace<Theme, Page>({
  initialDate,
  remoteData,
  sourceRevision,
  theme,
  buildPage,
  port,
  navigation,
}: {
  initialDate: string;
  remoteData: RemoteData;
  sourceRevision: number;
  theme: Theme;
  buildPage(input: {
    readonly theme: Theme;
    readonly date: string;
    readonly mode: MemoryMode;
    readonly subject: string;
    readonly xiaoyeMode: XiaoyeMode;
    readonly remoteData: RemoteData;
  }): Page;
  port: ArchiveWorkspacePort;
  navigation: {
    readonly revision: number;
    readonly target?: ArchiveNavigationTarget;
    acknowledge(revision: number): void;
  } | null;
}) {
  const [date, setDate] = useState(initialDate);
  const [mode, setMode] = useState<MemoryMode>("Diary");
  const [subject, setSubject] = useState<ArchiveSubject>("Me");
  const [xiaoyeMode, setXiaoyeMode] =
    useState<XiaoyeMode>("Ins");
  const [overlay, setOverlay] = useState(
    createArchiveMutationOverlay,
  );
  const [navigationTarget, setNavigationTarget] = useState<{
    readonly mode: string;
    readonly date: string;
    readonly targetId: string;
    readonly query: string;
  } | null>(null);
  const lastNavigationRevisionRef = useRef(-1);
  const openLoopSequenceRef = useRef(0);

  const effectiveRemoteData = useMemo(() => {
    const effective = applyArchiveMutationOverlay(
      remoteData,
      overlay,
    );
    if (!effective.dateIndex) return effective;
    let diary = effective.dateIndex.diary;
    let dailySummary = effective.dateIndex.dailySummary;
    let letters = effective.dateIndex.letters;
    Object.values(overlay.entries).forEach(({ document }) => {
      if (document.documentId === "diary") {
        diary = upsertDate(diary, document.date);
      } else if (document.documentId === "daily-summary") {
        dailySummary = upsertDate(
          dailySummary,
          document.date,
        );
      } else if (document.documentId === "letters") {
        letters = upsertDate(letters, document.date);
      }
    });
    return {
      ...effective,
      dateIndex: {
        ...effective.dateIndex,
        diary,
        dailySummary,
        letters,
      },
    };
  }, [overlay, remoteData]);

  useEffect(() => {
    if (
      !navigation ||
      navigation.revision <= lastNavigationRevisionRef.current
    ) {
      return;
    }
    lastNavigationRevisionRef.current = navigation.revision;
    const target = navigation.target;
    if (!target) return;
    const targetDate = normalizeDate(target.date ?? date);
    if (!targetDate) {
      navigation.acknowledge(navigation.revision);
      return;
    }
    const targetSubject: ArchiveSubject =
      target.subject === "Xiaoye" ? "Xiaoye" : "Me";
    setDate(targetDate);
    setSubject(targetSubject);
    if (memoryModes.has(target.mode as MemoryMode)) {
      setMode(target.mode as MemoryMode);
    }
    if (target.xiaoyeMode) {
      setXiaoyeMode(target.xiaoyeMode);
    }
    setNavigationTarget(
      target.documentId
        ? {
            mode:
              targetSubject === "Xiaoye"
                ? "Xiaoye"
                : String(target.mode ?? mode),
            date: targetDate,
            targetId: String(target.documentId),
            query: String(target.query ?? ""),
          }
        : null,
    );
    navigation.acknowledge(navigation.revision);
  }, [date, mode, navigation]);

  const loadDocument = useCallback(
    (input: EditableMemoryDocumentApiRequest) =>
      port.loadDocument(input),
    [port],
  );
  const saveDocument = useCallback(
    async (
      input: EditableMemoryDocumentApiRequest & {
        content: string;
      },
    ) => {
      const result = await port.saveDocument(input);
      const resultEntry = result.entry;
      if (isMemoryEntry(resultEntry)) {
        setOverlay((current) =>
          saveArchiveEntryToOverlay(current, {
            document: toDocumentRequest(input),
            entry: resultEntry,
            baseRevision: sourceRevision,
          }),
        );
      }
      return result;
    },
    [port, sourceRevision],
  );
  const toggleOpenLoop = useCallback(
    async (no: string | number, checked: boolean) => {
      const sequence = ++openLoopSequenceRef.current;
      const previousEntry =
        effectiveRemoteData.staticModeEntries.Openloops;
      const document: EditableMemoryDocumentRequest = {
        documentType: "static-memory-document",
        documentId: "open_loops",
      };
      if (previousEntry) {
        setOverlay((current) =>
          saveArchiveEntryToOverlay(current, {
            document,
            entry: applyOpenLoopToggleToEntry(
              previousEntry,
              String(no),
              checked,
            ),
            baseRevision: sourceRevision,
          }),
        );
      }
      try {
        const result = await port.toggleOpenLoop({
          no: String(no),
          checked,
        });
        const resultEntry = result.entry;
        if (
          openLoopSequenceRef.current === sequence &&
          isMemoryEntry(resultEntry)
        ) {
          setOverlay((current) =>
            saveArchiveEntryToOverlay(current, {
              document,
              entry: resultEntry,
              baseRevision: sourceRevision,
            }),
          );
        }
        return result;
      } catch (error) {
        if (
          openLoopSequenceRef.current === sequence &&
          previousEntry
        ) {
          setOverlay((current) =>
            saveArchiveEntryToOverlay(current, {
              document,
              entry: previousEntry,
              baseRevision: sourceRevision,
            }),
          );
        }
        throw error;
      }
    },
    [
      effectiveRemoteData.staticModeEntries.Openloops,
      port,
      sourceRevision,
    ],
  );

  const page = useMemo(
    () =>
      buildPage({
        theme,
        date,
        mode,
        subject,
        xiaoyeMode,
        remoteData: effectiveRemoteData,
      }),
    [
      buildPage,
      date,
      effectiveRemoteData,
      mode,
      subject,
      theme,
      xiaoyeMode,
    ],
  );
  const openDate = useCallback(
    (nextDate: string) => {
      const normalized = normalizeDate(nextDate);
      if (normalized) setDate(normalized);
    },
    [],
  );
  const selectMode = useCallback((nextMode: MemoryMode) => {
    setMode(nextMode);
  }, []);
  const selectSubject = useCallback(
    (nextSubject: ArchiveSubject) => {
      setSubject(nextSubject);
    },
    [],
  );
  const selectXiaoyeMode = useCallback(
    (nextMode: XiaoyeMode) => {
      setXiaoyeMode(nextMode);
    },
    [],
  );
  const viewModel = useMemo(
    () => ({
      date,
      mode,
      subject,
      xiaoyeMode,
      page,
      effectiveRemoteData,
      navigationTarget,
    }),
    [
      date,
      effectiveRemoteData,
      mode,
      navigationTarget,
      page,
      subject,
      xiaoyeMode,
    ],
  );
  const commands = useMemo(
    () => ({
      openDate,
      selectMode,
      selectSubject,
      selectXiaoyeMode,
      loadDocument,
      saveDocument,
      toggleOpenLoop,
    }),
    [
      loadDocument,
      openDate,
      saveDocument,
      selectMode,
      selectSubject,
      selectXiaoyeMode,
      toggleOpenLoop,
    ],
  );

  return useMemo(
    () => Object.freeze({ viewModel, commands }),
    [commands, viewModel],
  );
}
