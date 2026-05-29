// @ts-nocheck
import {
  getTimelineDay,
  normalizeTimelineEventCategory,
  timelineCategories,
} from "../../lib/timelinePageData";
import { toMinutes } from "../../lib/timeline";

export function TimelineMiniStrip({ page }) {
  const events = getTimelineDay(page.date, page.remoteData).events;
  const ticks = Array.from({ length: 13 }, (_, index) => index * 2);
  const boundaries = Array.from(
    new Set([
      0,
      1440,
      ...events.flatMap((event) => [
        toMinutes(event.startAt),
        toMinutes(event.endAt),
      ]),
    ]),
  ).sort((a, b) => a - b);
  const segments = boundaries
    .slice(0, -1)
    .map((start, index) => {
      const end = boundaries[index + 1];
      const categoryMinutes = {};
      events.forEach((event) => {
        const normalizedEvent = normalizeTimelineEventCategory(
          event,
          page.remoteData,
        );
        const eventStart = toMinutes(event.startAt);
        const eventEnd = toMinutes(event.endAt);
        const overlap = Math.max(
          0,
          Math.min(end, eventEnd) - Math.max(start, eventStart),
        );
        if (overlap > 0)
          categoryMinutes[normalizedEvent.categoryId] =
            (categoryMinutes[normalizedEvent.categoryId] ?? 0) + overlap;
      });
      const dominant = Object.entries(categoryMinutes).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];
      return dominant ? { start, end, categoryId: dominant } : null;
    })
    .filter(Boolean);
  const merged = segments.reduce((list, item) => {
    const last = list[list.length - 1];
    if (last && last.categoryId === item.categoryId && last.end === item.start)
      last.end = item.end;
    else list.push({ ...item });
    return list;
  }, []);

  return (
    <div className="mb-5 border-b pb-4" style={{ borderColor: page.line }}>
      <div className="relative h-12 rounded-full bg-white/24">
        <div
          className="absolute left-0 right-0 top-[24px] border-t border-dashed"
          style={{ borderColor: page.line }}
        />
        {merged.map((segment) => {
          const category =
            timelineCategories[segment.categoryId] ?? timelineCategories.life;
          const left = Math.max(0, Math.min(100, (segment.start / 1440) * 100));
          const width = Math.max(
            2.2,
            Math.min(100 - left, ((segment.end - segment.start) / 1440) * 100),
          );
          return (
            <span
              key={`${segment.start}-${segment.end}-${segment.categoryId}`}
              className="absolute top-[13px] flex h-5 items-center justify-center rounded-full shadow-[0_3px_10px_rgba(0,0,0,.06)]"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: category.color,
                opacity: 0.9,
              }}
            />
          );
        })}
      </div>
      <div
        className="mt-1 grid font-mono text-[9px] text-black/42"
        style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      >
        {ticks.map((hour) => (
          <div key={hour} className="text-center">
            {hour}
          </div>
        ))}
      </div>
    </div>
  );
}
