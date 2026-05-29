import {
  getReminderDueAt,
  getRemindersForDate,
} from "../../lib/reminderPageData";
import { minutesToClock, toMinutes } from "../../lib/timeline";

export function ReminderList({ page }) {
  const reminders = getRemindersForDate(page.date, page.remoteData);
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-end justify-between">
        <h3
          className="font-serif text-[16px] tracking-[0.08em]"
          style={{ color: page.color }}
        >
          今天的提醒
        </h3>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-black/32">
          reminder-archive
        </span>
      </div>
      {reminders.length ? (
        <div className="space-y-2">
          {reminders.map((entry) => {
            const dueAt = getReminderDueAt(entry);
            return (
              <div
                key={entry.reminder.id}
                className="rounded-[18px] bg-white/48 px-3 py-3 shadow-[0_10px_24px_rgba(0,0,0,.035)]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: page.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] tracking-[0.08em] text-black/42">
                      {minutesToClock(toMinutes(dueAt))}
                    </div>
                    <div className="mt-1 text-[12px] leading-[1.55] text-black/68">
                      {entry.reminder.text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[18px] bg-white/35 px-3 py-4 text-[12px] text-black/42">
          今天暂无提醒，提醒库存小憩中。
        </div>
      )}
    </section>
  );
}
