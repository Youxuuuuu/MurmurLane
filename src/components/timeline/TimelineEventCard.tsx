import { HighlightText } from "../common/HighlightText";
import { getTimelineCategoryMeta } from "../../lib/timelinePageData";
import {
  getEventDurationMinutes,
  getTimelineEventHeight,
  getTimelineEventVisualTopPx,
  minutesToClock,
  toMinutes,
} from "../../lib/timeline";

export function TimelineEventCard({
  event,
  range,
  page,
  layout,
  highlighted,
  highlightQuery,
  elementId,
  onSelectEvent,
}) {
  const {
    category,
    subcategoryLabel,
    eventNodeLabel,
  } = getTimelineCategoryMeta(event, page.remoteData);
  const start = toMinutes(event.startAt);
  const duration = getEventDurationMinutes(event);
  const detailLabel = [subcategoryLabel, eventNodeLabel]
    .filter(Boolean)
    .join(" · ");
  const topPercent = Math.max(
    0,
    ((start - range.startHour * 60) /
      ((range.endHour - range.startHour) * 60)) *
      100,
  );
  const height = getTimelineEventHeight(event, range);
  const topStyle =
    start === range.startHour * 60
      ? `${getTimelineEventVisualTopPx(event, range)}px`
      : `${topPercent}%`;
  const columnStart = layout?.leftPercent ?? 0;
  const columnWidth = layout?.widthPercent ?? 1;
  const horizontalGap = (layout?.conflictCount ?? 0) > 0 ? 3 : 0;
  const isTinyEvent = height <= 10;
  const isCrampedEvent = height < 16;
  const isCompactEvent = height < 24;

  return (
    <button
      id={elementId}
      type="button"
      className="absolute flex flex-col items-start justify-start overflow-hidden rounded-sm border-l-4 text-left align-top backdrop-blur-[1px] transition hover:z-20 hover:opacity-100"
      style={{
        top: topStyle,
        left: `calc(54px + (100% - 54px) * ${columnStart})`,
        width: `calc((100% - 54px) * ${columnWidth} - ${horizontalGap}px)`,
        height: `${height}px`,
        zIndex: layout?.zIndex ?? 10,
        padding: isTinyEvent
          ? "0 6px"
          : isCrampedEvent
            ? "2px 7px"
            : isCompactEvent
              ? "3px 8px"
              : "4px 10px",
        borderLeftColor: category.color,
        background: highlighted ? `${category.color}28` : category.pale,
        color: category.color,
        opacity: highlighted ? 1 : 0.82,
        outline: highlighted ? `1px solid ${category.color}` : "none",
      }}
      onClick={() => onSelectEvent(event)}
    >
      <div
        className={`w-full truncate text-left font-semibold ${isTinyEvent ? "text-[7px] leading-[8px]" : isCrampedEvent ? "text-[8px] leading-[9px]" : isCompactEvent ? "text-[9px] leading-[10px]" : "text-[10px] leading-4"}`}
      >
        <HighlightText
          text={event.title}
          query={highlighted ? highlightQuery : ""}
          color={category.color}
        />{" "}
        · {duration}分钟
      </div>
      {height >= 32 && (
        <div className="w-full truncate text-left font-mono text-[9px] leading-4 opacity-80">
          {minutesToClock(start)} → {minutesToClock(toMinutes(event.endAt))}
          {detailLabel ? ` · ${detailLabel}` : ""}
        </div>
      )}
      {height >= 58 && (
        <div className="mt-1 w-full line-clamp-2 text-left text-[9px] leading-4 opacity-80">
          {event.note}
        </div>
      )}
    </button>
  );
}
