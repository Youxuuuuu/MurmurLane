import {
  getTimelineCategoryMeta,
  getTimelineDay,
} from "../../lib/timelinePageData";
import {
  getEventDurationMinutes,
  minutesToClock,
  toMinutes,
} from "../../lib/timeline";

export function TimelinePeriodList({ page, onSelectEvent }) {
  const events = [...getTimelineDay(page.date, page.remoteData).events].sort(
    (a, b) => toMinutes(a.startAt) - toMinutes(b.startAt),
  );
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <h3
          className="font-serif text-[16px] tracking-[0.08em]"
          style={{ color: page.color }}
        >
          时间段列表
        </h3>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-black/[0.32]">
          timeline-state
        </span>
      </div>
      <div className="space-y-3">
        {events.map((event) => {
          const { category, categoryLabel } =
            getTimelineCategoryMeta(event, page.remoteData);
          const start = toMinutes(event.startAt);
          const end = toMinutes(event.endAt);
          const duration = getEventDurationMinutes(event);
          return (
            <button
              key={event.id}
              type="button"
              className="w-full rounded-[16px] bg-white/50 px-4 py-4 text-left shadow-[0_4px_8px_rgba(0,0,0,.035)] transition active:scale-[0.99]"
              onClick={() => onSelectEvent(event)}
            >
              <div className="flex gap-3">
                <span
                  className="w-1 shrink-0 rounded-full"
                  style={{ background: category.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-[13px] leading-4 text-black/[0.58]">
                    {event.title} · {duration}分钟
                  </div>
                  <div className="mt-2 truncate font-mono text-[11px] leading-4 text-black/40">
                    {minutesToClock(start)} - {minutesToClock(end)} · #
                    {categoryLabel} · {event.note}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
