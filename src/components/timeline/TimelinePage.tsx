import { motion } from "framer-motion";
import { PaperTexture } from "../common/PaperTexture";
import { CalendarStrip } from "../calendar/CalendarStrip";
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
}) {
  return (
    <motion.section
      key={`${page.id}-timeline-${page.date}-${timelineView}-${statsPeriod}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative min-h-[980px] border bg-[#f7f5ee] p-5 pb-10"
      style={{ background: page.paper, borderColor: page.line }}
    >
      <PaperTexture mode={page.texture} />
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
          />
        ) : timelineView === "stats" ? (
          <TimelineStatsView
            page={page}
            period={statsPeriod}
            onSelectPeriod={onSelectStatsPeriod}
          />
        ) : (
          <TimelineReminderView page={page} />
        )}
      </div>
    </motion.section>
  );
}
