import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TimelineDetailModal } from "./TimelineDetailModal";
import { TimelineMiniStrip } from "./TimelineMiniStrip";
import { ReminderList } from "./ReminderList";
import { TimelinePeriodList } from "./TimelinePeriodList";

export function TimelineReminderView({ page }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <div className="pt-1">
      <TimelineMiniStrip page={page} />
      <ReminderList page={page} />
      <TimelinePeriodList page={page} onSelectEvent={setSelectedEvent} />
      <AnimatePresence>
        {selectedEvent && (
          <TimelineDetailModal
            event={selectedEvent}
            page={page}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
