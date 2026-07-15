// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { pad2 } from "../../lib/date";
import { getTimelineDay } from "../../lib/timelinePageData";
import {
  DAY_TIMELINE_HEIGHT,
  getTimelineRange,
  layoutTimelineEvents,
} from "../../lib/timeline";
import { TimelineDetailModal } from "./TimelineDetailModal";
import { TimelineEventEditorDrawer } from "./TimelineEventEditorDrawer";
import { TimelineEventCard } from "./TimelineEventCard";

export function TimelineDayView({
  page,
  highlightResult,
  scrollHitIntoView,
  onTimelineEventSaved,
  onTimelineEventDeleted,
  canEdit,
  editHint,
}) {
  const [detailEvent, setDetailEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const events = getTimelineDay(page.date, page.remoteData).events;
  const range = getTimelineRange(events);
  const laidOutEvents = useMemo(
    () => layoutTimelineEvents(events, range),
    [events, range],
  );
  const hours = Array.from(
    { length: range.endHour - range.startHour + 1 },
    (_, index) => range.startHour + index,
  );

  useEffect(() => {
    if (
      highlightResult?.mode !== "Timeline" ||
      highlightResult.date !== page.date
    )
      return;
    scrollHitIntoView(`timeline-${highlightResult.targetId}`);
  }, [highlightResult, page.date]);

  return (
    <div
      className="relative pt-2"
      style={{ height: `${DAY_TIMELINE_HEIGHT}px` }}
    >
      {hours.map((hour) => {
        const top =
          ((hour - range.startHour) / (range.endHour - range.startHour)) * 100;
        return (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t"
            style={{ top: `${top}%`, borderColor: page.line }}
          >
            <span className="absolute -top-2 left-0 bg-transparent font-mono text-[11px] text-black/[0.38]">
              {pad2(hour)}:00
            </span>
          </div>
        );
      })}
      {laidOutEvents.length > 0 ? (
        laidOutEvents.map((item) => (
          <TimelineEventCard
            key={item.event.id}
            elementId={`hit-timeline-${item.event.id}`}
            event={item.event}
            layout={item}
            range={range}
            page={page}
            highlighted={
              highlightResult?.mode === "Timeline" &&
              highlightResult?.targetId === item.event.id
            }
            highlightQuery={highlightResult?.query}
            onSelectEvent={setDetailEvent}
          />
        ))
      ) : (
        <div
          className="absolute left-[54px] right-0 top-8 border border-dashed bg-white/25 px-3 py-3 font-serif text-[12px] text-black/45"
          style={{ borderColor: page.line }}
        >
          暂无时间轴，速速召唤家机记录......
        </div>
      )}
      <AnimatePresence>
        {detailEvent && (
          <TimelineDetailModal
            event={detailEvent}
            page={page}
            onClose={() => setDetailEvent(null)}
            onEdit={() => {
              setEditingEvent(detailEvent);
              setDetailEvent(null);
            }}
            canEdit={canEdit}
            editHint={editHint}
          />
        )}
        {editingEvent && (
          <TimelineEventEditorDrawer
            event={editingEvent}
            page={page}
            onClose={() => setEditingEvent(null)}
            onEventSaved={onTimelineEventSaved}
            onEventDeleted={onTimelineEventDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
