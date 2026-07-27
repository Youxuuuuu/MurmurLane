import { useEffect, useState } from "react";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { PageCard } from "../layout/PageCard";
import { TimelineDayView } from "./TimelineDayView";
import { TimelineReminderView } from "./TimelineReminderView";
import { TimelineStatsView } from "./TimelineStatsView";

export function TimelinePage({
  page,
  timelineView,
  statsPeriod,
  highlightResult: requestedHighlightResult,
  onHighlightConsumed,
  onSelectStatsPeriod,
  onOpenDatePicker,
  onMonthSelect,
  scrollHitIntoView,
  canEdit,
  editHint,
  commands,
}) {
  const [highlightResult, setHighlightResult] = useState(
    requestedHighlightResult,
  );
  useEffect(() => {
    setHighlightResult(requestedHighlightResult);
    if (!requestedHighlightResult) return;
    const targetId = requestedHighlightResult.targetId;
    const timer = window.setTimeout(() => {
      setHighlightResult(null);
      onHighlightConsumed?.(targetId);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [onHighlightConsumed, requestedHighlightResult]);
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
            canEdit={canEdit}
            editHint={editHint}
            commands={commands}
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
            canEdit={canEdit}
            editHint={editHint}
            commands={commands}
          />
        )}
      </div>
    </PageCard>
  );
}
