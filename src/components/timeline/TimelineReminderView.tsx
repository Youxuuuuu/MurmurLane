import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TimelineDetailModal } from "./TimelineDetailModal";
import { TimelineMiniStrip } from "./TimelineMiniStrip";
import { ReminderList } from "./ReminderList";
import { TimelineEventEditorDrawer } from "./TimelineEventEditorDrawer";
import { TimelinePeriodList } from "./TimelinePeriodList";

export function TimelineReminderView({
  page,
  canEdit,
  editHint,
  commands,
}) {
  const [detailEvent, setDetailEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  return (
    <div className="pt-1">
      <TimelineMiniStrip page={page} />
      <ReminderList page={page} />
      <TimelinePeriodList page={page} onSelectEvent={setDetailEvent} />
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
            commands={commands}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
