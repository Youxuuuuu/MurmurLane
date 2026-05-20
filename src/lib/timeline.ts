import type {
  TimelineEvent,
  TimelineEventGroup,
  TimelineEventLayoutItem,
  TimelineRange,
} from "../types/timeline";
import { pad2 } from "./date";

export const TIMELINE_TIMEZONE = "Asia/Shanghai";
export const DAY_TIMELINE_HEIGHT = 960;
export const MIN_TIMELINE_EVENT_HEIGHT = 8;
export function getZonedTimeParts(
  dateLike: string | number | Date,
  timeZone = TIMELINE_TIMEZONE,
) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(dateLike))
      .map((part) => [part.type, part.value]),
  );
}
export function toMinutes(dateLike: string | number | Date) {
  const parts = getZonedTimeParts(dateLike);
  return Number(parts.hour) * 60 + Number(parts.minute);
}
export function minutesToClock(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(24 * 60, minutes));
  return `${pad2(Math.floor(safeMinutes / 60))}:${pad2(safeMinutes % 60)}`;
}
export function getEventDurationMinutes(event: TimelineEvent) {
  return Math.max(
    1,
    Math.round(
      (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) /
        60000,
    ),
  );
}
export function getTimelineRange(): TimelineRange {
  return { startHour: 0, endHour: 24 };
}
export function getTimelineEventHeight(
  event: TimelineEvent,
  range = getTimelineRange(),
) {
  const totalMinutes = (range.endHour - range.startHour) * 60;
  return Math.max(
    MIN_TIMELINE_EVENT_HEIGHT,
    Math.round(
      (getEventDurationMinutes(event) / totalMinutes) * DAY_TIMELINE_HEIGHT,
    ),
  );
}
export function getTimelineEventTopPx(
  event: TimelineEvent,
  range = getTimelineRange(),
) {
  const start = toMinutes(event.startAt);
  const totalMinutes = (range.endHour - range.startHour) * 60;
  return ((start - range.startHour * 60) / totalMinutes) * DAY_TIMELINE_HEIGHT;
}
export function getTimelineEventVisualTopPx(
  event: TimelineEvent,
  range = getTimelineRange(),
) {
  const top = getTimelineEventTopPx(event, range);
  const startsAtRangeTop = toMinutes(event.startAt) === range.startHour * 60;

  return startsAtRangeTop ? Math.max(0, top - 1) : Math.max(0, top);
}
export function getTimelineEventVisualRange(
  event: TimelineEvent,
  range = getTimelineRange(),
) {
  const start = getTimelineEventVisualTopPx(event, range);
  return { start, end: start + getTimelineEventHeight(event, range) };
}
export function doTimelineEventBoxesOverlap(
  first: TimelineEvent,
  second: TimelineEvent,
  range = getTimelineRange(),
) {
  const a = getTimelineEventVisualRange(first, range);
  const b = getTimelineEventVisualRange(second, range);
  return a.start < b.end && b.start < a.end;
}
export function groupOverlappingTimelineEvents(
  events: TimelineEvent[],
  range = getTimelineRange(),
): TimelineEventGroup[] {
  const sorted = [...events].sort(
    (a, b) =>
      getTimelineEventVisualTopPx(a, range) -
        getTimelineEventVisualTopPx(b, range) ||
      getTimelineEventHeight(b, range) - getTimelineEventHeight(a, range),
  );
  const groups = [];
  sorted.forEach((event) => {
    const visualRange = getTimelineEventVisualRange(event, range);
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || visualRange.start >= lastGroup.maxEnd)
      groups.push({ events: [event], maxEnd: visualRange.end });
    else {
      lastGroup.events.push(event);
      lastGroup.maxEnd = Math.max(lastGroup.maxEnd, visualRange.end);
    }
  });
  return groups;
}
export function findTimelineEventConflicts(
  event: TimelineEvent,
  events: TimelineEvent[],
  range = getTimelineRange(),
) {
  return events.filter(
    (item) =>
      item.id !== event.id && doTimelineEventBoxesOverlap(event, item, range),
  );
}
export function canTimelineEventExpandToColumn(
  event: TimelineEvent,
  targetColumn: number,
  arranged: Array<{ event: TimelineEvent; column: number }>,
  range = getTimelineRange(),
) {
  return arranged.every(
    (item) =>
      item.column !== targetColumn ||
      !doTimelineEventBoxesOverlap(event, item.event, range),
  );
}
export function packTimelineColumns(
  events: TimelineEvent[],
  range = getTimelineRange(),
): TimelineEventLayoutItem[] {
  const sorted = [...events].sort(
    (a, b) =>
      getTimelineEventVisualTopPx(a, range) -
        getTimelineEventVisualTopPx(b, range) ||
      getTimelineEventHeight(b, range) - getTimelineEventHeight(a, range),
  );
  const columnEnds = [];
  const arranged = sorted.map((event) => {
    const visualRange = getTimelineEventVisualRange(event, range);
    let column = columnEnds.findIndex((end) => visualRange.start >= end);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(visualRange.end);
    } else columnEnds[column] = visualRange.end;
    return { event, column };
  });
  const columns = Math.max(1, columnEnds.length);
  return arranged.map((item) => {
    let span = 1;
    for (
      let nextColumn = item.column + 1;
      nextColumn < columns;
      nextColumn += 1
    ) {
      if (
        !canTimelineEventExpandToColumn(item.event, nextColumn, arranged, range)
      )
        break;
      span += 1;
    }
    return {
      ...item,
      columns,
      span,
      leftPercent: item.column / columns,
      widthPercent: span / columns,
      zIndex: 10,
      conflictCount: findTimelineEventConflicts(item.event, events, range)
        .length,
    };
  });
}
export function layoutTimelineEvents(
  events: TimelineEvent[],
  range = getTimelineRange(),
): TimelineEventLayoutItem[] {
  return groupOverlappingTimelineEvents(events, range).flatMap((group) =>
    group.events.length === 1
      ? [
          {
            event: group.events[0],
            column: 0,
            columns: 1,
            span: 1,
            leftPercent: 0,
            widthPercent: 1,
            zIndex: 10,
            conflictCount: 0,
          },
        ]
      : packTimelineColumns(group.events, range),
  );
}
export function getZonedDateText(
  dateLike: string | number | Date,
  timeZone = TIMELINE_TIMEZONE,
) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(dateLike))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}.${parts.month}.${parts.day}`;
}


