import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TimelineNavigationTarget } from "../../app/navigation/appNavigation";
import type {
  RemoteData,
  TimelineEventApiResponse,
} from "../../types/api";
import type {
  TimelineEvent,
  TimelineState,
} from "../../types/timeline";
import {
  applyTimelineMutationOverlay,
  createTimelineMutationOverlay,
  deleteTimelineEventFromOverlay,
  upsertTimelineEventInOverlay,
} from "./timelineMutationOverlay";

export type TimelineViewMode =
  | "line"
  | "stats"
  | "reminders";

export function resolveTimelineNavigationView(
  value: unknown,
): TimelineViewMode {
  return value === "stats" || value === "reminders"
    ? value
    : "line";
}

export interface TimelineWorkspacePort {
  fetchEvent(
    date: string,
    eventId: string,
  ): Promise<TimelineEventApiResponse>;
  patchEvent(input: {
    date: string;
    eventId: string;
    changes: Record<string, unknown>;
  }): Promise<TimelineEventApiResponse>;
  deleteEvent(input: {
    date: string;
    eventId: string;
  }): Promise<TimelineEventApiResponse>;
}

function normalizeDate(value: unknown) {
  const date = String(value ?? "").trim().replace(/-/g, ".");
  return /^\d{4}\.\d{2}\.\d{2}$/.test(date) ? date : "";
}

function isTimelineEvent(value: unknown): value is TimelineEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    typeof event.startAt === "string" &&
    typeof event.endAt === "string" &&
    typeof event.title === "string"
  );
}

function deriveTimelineDateIndex(
  current: readonly string[],
  effectiveState: TimelineState,
) {
  const dates = new Set(current);
  Object.entries(effectiveState).forEach(([date, day]) => {
    const hyphenDate = date.replace(/\./g, "-");
    if (day.events.length) {
      dates.add(hyphenDate);
    } else {
      dates.delete(hyphenDate);
    }
  });
  return Array.from(dates).sort();
}

export function useTimelineWorkspace<Theme, Page>({
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
  buildPage(
    theme: Theme,
    date: string,
    remoteData: RemoteData,
  ): Page;
  port: TimelineWorkspacePort;
  navigation: {
    readonly revision: number;
    readonly target?: TimelineNavigationTarget;
    acknowledge(revision: number): void;
  } | null;
}) {
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<TimelineViewMode>("line");
  const [statsPeriod, setStatsPeriod] = useState("day");
  const [overlay, setOverlay] = useState(
    createTimelineMutationOverlay,
  );
  const [navigationTarget, setNavigationTarget] = useState<{
    readonly mode: "Timeline";
    readonly date: string;
    readonly targetId: string;
    readonly query: string;
  } | null>(null);
  const lastNavigationRevisionRef = useRef(-1);
  const mutationSequenceByTargetRef = useRef(
    new Map<string, number>(),
  );

  const effectiveTimelineState = useMemo(
    () =>
      applyTimelineMutationOverlay(
        remoteData.timelineState,
        overlay,
      ),
    [overlay, remoteData.timelineState],
  );
  const effectiveRemoteData = useMemo<RemoteData>(
    () => ({
      ...remoteData,
      timelineState: effectiveTimelineState,
      searchCache: {
        ...remoteData.searchCache,
        timeline: effectiveTimelineState,
      },
      dateIndex: remoteData.dateIndex
        ? {
            ...remoteData.dateIndex,
            timeline: deriveTimelineDateIndex(
              remoteData.dateIndex.timeline,
              effectiveTimelineState,
            ),
          }
        : null,
    }),
    [effectiveTimelineState, remoteData],
  );

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
    const targetView = resolveTimelineNavigationView(
      target.view,
    );
    setDate(targetDate);
    setView(targetView);
    setNavigationTarget(
      target.eventId
        ? {
            mode: "Timeline",
            date: targetDate,
            targetId: String(target.eventId),
            query: String(target.query ?? ""),
          }
        : null,
    );
    navigation.acknowledge(navigation.revision);
  }, [date, navigation]);

  const nextMutationSequence = useCallback((targetKey: string) => {
    const sequence =
      (mutationSequenceByTargetRef.current.get(targetKey) ?? 0) + 1;
    mutationSequenceByTargetRef.current.set(targetKey, sequence);
    return sequence;
  }, []);

  const fetchEvent = useCallback(
    (eventDate: string, eventId: string) =>
      port.fetchEvent(eventDate, eventId),
    [port],
  );
  const saveEvent = useCallback(
    async (input: {
      date: string;
      eventId: string;
      changes: Record<string, unknown>;
    }) => {
      const targetKey = `${normalizeDate(input.date)}:${input.eventId}`;
      const sequence = nextMutationSequence(targetKey);
      const result = await port.patchEvent(input);
      const resultEvent = result.event;
      if (
        mutationSequenceByTargetRef.current.get(targetKey) ===
          sequence &&
        isTimelineEvent(resultEvent)
      ) {
        setOverlay((current) =>
          upsertTimelineEventInOverlay(current, {
            date: normalizeDate(result.date ?? input.date),
            event: resultEvent,
            baseRevision: sourceRevision,
          }),
        );
      }
      return result;
    },
    [nextMutationSequence, port, sourceRevision],
  );
  const deleteEvent = useCallback(
    async (input: { date: string; eventId: string }) => {
      const targetKey = `${normalizeDate(input.date)}:${input.eventId}`;
      const sequence = nextMutationSequence(targetKey);
      const result = await port.deleteEvent(input);
      if (
        mutationSequenceByTargetRef.current.get(targetKey) ===
        sequence
      ) {
        setOverlay((current) =>
          deleteTimelineEventFromOverlay(current, {
            date: normalizeDate(result.date ?? input.date),
            eventId: input.eventId,
            baseRevision: sourceRevision,
          }),
        );
      }
      return result;
    },
    [nextMutationSequence, port, sourceRevision],
  );
  const openDate = useCallback((nextDate: string) => {
    const normalized = normalizeDate(nextDate);
    if (normalized) setDate(normalized);
  }, []);
  const selectView = useCallback((nextView: TimelineViewMode) => {
    setView(nextView);
  }, []);
  const selectStatsPeriod = useCallback((period: string) => {
    setStatsPeriod(period);
  }, []);

  const page = useMemo(
    () => buildPage(theme, date, effectiveRemoteData),
    [buildPage, date, effectiveRemoteData, theme],
  );
  const viewModel = useMemo(
    () => ({
      date,
      view,
      statsPeriod,
      page,
      effectiveRemoteData,
      navigationTarget,
    }),
    [
      date,
      effectiveRemoteData,
      navigationTarget,
      page,
      statsPeriod,
      view,
    ],
  );
  const commands = useMemo(
    () => ({
      openDate,
      selectView,
      selectStatsPeriod,
      fetchEvent,
      saveEvent,
      deleteEvent,
    }),
    [
      deleteEvent,
      fetchEvent,
      openDate,
      saveEvent,
      selectStatsPeriod,
      selectView,
    ],
  );

  return useMemo(
    () => Object.freeze({ viewModel, commands }),
    [commands, viewModel],
  );
}
