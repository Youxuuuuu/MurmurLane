import type {
  TimelineEvent,
  TimelineState,
} from "../../types/timeline";

interface TimelineUpsertMutation {
  readonly event: TimelineEvent;
  readonly baseRevision: number;
}

interface TimelineDeleteMutation {
  readonly baseRevision: number;
}

export interface TimelineMutationOverlay {
  readonly upserts: Readonly<
    Record<string, Readonly<Record<string, TimelineUpsertMutation>>>
  >;
  readonly deletions: Readonly<
    Record<string, Readonly<Record<string, TimelineDeleteMutation>>>
  >;
}

export function createTimelineMutationOverlay(): TimelineMutationOverlay {
  return {
    upserts: {},
    deletions: {},
  };
}

export function upsertTimelineEventInOverlay(
  overlay: TimelineMutationOverlay,
  mutation: {
    readonly date: string;
    readonly event: TimelineEvent;
    readonly baseRevision: number;
  },
): TimelineMutationOverlay {
  const date = mutation.date;
  const eventId = mutation.event.id;
  const nextDeletions = {
    ...(overlay.deletions[date] ?? {}),
  };
  delete nextDeletions[eventId];
  return {
    upserts: {
      ...overlay.upserts,
      [date]: {
        ...(overlay.upserts[date] ?? {}),
        [eventId]: {
          event: mutation.event,
          baseRevision: mutation.baseRevision,
        },
      },
    },
    deletions: {
      ...overlay.deletions,
      [date]: nextDeletions,
    },
  };
}

export function deleteTimelineEventFromOverlay(
  overlay: TimelineMutationOverlay,
  mutation: {
    readonly date: string;
    readonly eventId: string;
    readonly baseRevision: number;
  },
): TimelineMutationOverlay {
  const date = mutation.date;
  const nextUpserts = {
    ...(overlay.upserts[date] ?? {}),
  };
  delete nextUpserts[mutation.eventId];
  return {
    upserts: {
      ...overlay.upserts,
      [date]: nextUpserts,
    },
    deletions: {
      ...overlay.deletions,
      [date]: {
        ...(overlay.deletions[date] ?? {}),
        [mutation.eventId]: {
          baseRevision: mutation.baseRevision,
        },
      },
    },
  };
}

export function applyTimelineMutationOverlay(
  canonical: TimelineState,
  overlay: TimelineMutationOverlay,
): TimelineState {
  const dates = new Set([
    ...Object.keys(canonical),
    ...Object.keys(overlay.upserts),
    ...Object.keys(overlay.deletions),
  ]);
  const effective: TimelineState = { ...canonical };
  dates.forEach((date) => {
    const canonicalDay = canonical[date];
    const eventsById = new Map(
      (canonicalDay?.events ?? []).map((event) => [
        event.id,
        event,
      ]),
    );
    Object.keys(overlay.deletions[date] ?? {}).forEach(
      (eventId) => eventsById.delete(eventId),
    );
    Object.values(overlay.upserts[date] ?? {}).forEach(
      ({ event }) => eventsById.set(event.id, event),
    );
    if (
      canonicalDay ||
      overlay.upserts[date] ||
      overlay.deletions[date]
    ) {
      effective[date] = {
        ...(canonicalDay ?? {
          status: "draft",
          updatedAt: "",
        }),
        events: Array.from(eventsById.values()),
      };
    }
  });
  return effective;
}

