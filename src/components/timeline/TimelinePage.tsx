import { CalendarStrip } from "../calendar/CalendarStrip";
import { PageCard } from "../layout/PageCard";
import { TimelineDayView } from "./TimelineDayView";
import { TimelineReminderView } from "./TimelineReminderView";
import { TimelineStatsView } from "./TimelineStatsView";

export function TimelinePage({
  page,
  timelineView,
  statsPeriod,
  highlightResult,
  onSelectStatsPeriod,
  onOpenDatePicker,
  onMonthSelect,
  scrollHitIntoView,
  onTimelineEventSaved,
  onTimelineEventDeleted,
  canEdit,
  editHint,
}) {
  return (
    <PageCard
      page={page}
      motionKey={`${page.id}-timeline-${page.date}-${timelineView}-${statsPeriod}`}
      className="relative min-h-[980px] border bg-[#f7f5ee] p-5 pb-[calc(var(--app-bottom-nav-space,96px)+28px)]"
    >
      <div className="relative min-h-[920px]">
        <CalendarStrip
          page={page}
          onOpenDatePicker={onOpenDatePicker}
          onMonthSelect={onMonthSelect}
        />
        {timelineView === "line" ? (
          <TimelineDayView
            page={page}
            highlightResult={highlightResult}
            scrollHitIntoView={scrollHitIntoView}
            onTimelineEventSaved={onTimelineEventSaved}
            onTimelineEventDeleted={onTimelineEventDeleted}
            canEdit={canEdit}
            editHint={editHint}
          />
        ) : timelineView === "stats" ? (
          <TimelineStatsView
            page={page}
            period={statsPeriod}
            onSelectPeriod={onSelectStatsPeriod}
          />
        ) : (
          <TimelineReminderView
            page={page}
            onTimelineEventSaved={onTimelineEventSaved}
            onTimelineEventDeleted={onTimelineEventDeleted}
            canEdit={canEdit}
            editHint={editHint}
          />
        )}
      </div>
    </PageCard>
  );
}
