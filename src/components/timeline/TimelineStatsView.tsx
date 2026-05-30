import { getDateParts, pad2 } from "../../lib/date";
import {
  aggregateTimelineEvents,
  getTimelineEventsForPeriod,
  timelineCategories,
} from "../../lib/timelinePageData";

function TimelineStatsPeriodSwitch({ page, period, onSelectPeriod }) {
  const items = [
    { id: "day", label: "日" },
    { id: "month", label: "月" },
    { id: "year", label: "年" },
  ];
  return (
    <div className="mb-4 grid grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-[0.1em]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="border px-3 py-2"
          style={{
            color: period === item.id ? page.color : "rgba(0,0,0,.45)",
            borderColor: period === item.id ? page.color : page.line,
            background: period === item.id ? page.pale : "transparent",
          }}
          onClick={() => onSelectPeriod(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function hexToRgba(hex, alpha = 0.68) {
  const value = String(hex || "").replace("#", "");

  if (value.length !== 6) return hex;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TimelineDonut({ aggregates }) {
  const total = aggregates.reduce((sum, item) => sum + item.minutes, 0);
  let current = 0;
  const gradient = aggregates
    .map((item) => {
      const category =
        timelineCategories[item.categoryId] ?? timelineCategories.life;
      const start = current;
      current += total ? (item.minutes / total) * 100 : 0;
      return `${hexToRgba(category.color, 0.65)} ${start}% ${current}%`;
    })
    .join(", ");

  return (
    <div
      className="mx-auto flex h-[210px] w-[210px] items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${gradient || "#ddd 0% 100%"})` }}
    >
      <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full bg-[#f7f5ee] text-center">
        <div className="text-[13px] font-semibold">合计</div>
        <div className="mt-2 font-mono text-[16px]">
          {Math.floor(total / 60)}:{pad2(total % 60)}
        </div>
      </div>
    </div>
  );
}

export function TimelineStatsView({ page, period, onSelectPeriod }) {
  const events = getTimelineEventsForPeriod(page.date, period, page.remoteData);
  const aggregates = aggregateTimelineEvents(events, page.remoteData);
  return (
    <div className="pt-2">
      <TimelineStatsPeriodSwitch
        page={page}
        period={period}
        onSelectPeriod={onSelectPeriod}
      />
      <div className="mb-3 font-mono text-[11px] tracking-[0.1em] text-black/45">
        {period === "day"
          ? page.date
          : period === "month"
            ? `${getDateParts(page.date).year}.${getDateParts(page.date).month}`
            : getDateParts(page.date).year}
      </div>
      <TimelineDonut aggregates={aggregates} />
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-1.5">
        {aggregates.map((item) => {
          const category =
            timelineCategories[item.categoryId] ?? timelineCategories.life;
          return (
            <div
              key={item.categoryId}
              className="flex items-center gap-1.5 text-[11px] leading-4"
            >
              <span
                className="h-3.5 w-[3px] shrink-0"
                style={{ background: hexToRgba(category.color, 0.68) }}
              />
              <span className="min-w-0 flex-1 truncate font-semibold text-black/68">
                {category.label}
              </span>
              <span className="shrink-0 text-right font-mono text-[10px] text-black/45">
                {Math.floor(item.minutes / 60)}:{pad2(item.minutes % 60)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
