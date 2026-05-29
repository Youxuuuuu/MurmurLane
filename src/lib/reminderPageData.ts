import { emptyRemoteData } from "../data/emptyRemoteData";
import { reminderHistoryEntries } from "../data/mockEntries";
import type { RemoteData } from "../types/api";
import type { ReminderHistoryEntry } from "../types/memory";
import { getZonedDateText } from "./timeline";

export function getReminderDueAt(reminderEntry: ReminderHistoryEntry) {
  const dueAtMs = Number(reminderEntry?.reminder?.dueAtMs);

  if (Number.isFinite(dueAtMs)) {
    return new Date(dueAtMs);
  }

  return new Date(
    reminderEntry?.reminder?.createdAt ??
      reminderEntry?.archivedAt ??
      Date.now(),
  );
}

export function getReminderHistorySource(
  remoteData: RemoteData = emptyRemoteData,
) {
  return remoteData.reminderHistoryEntries?.length
    ? remoteData.reminderHistoryEntries
    : reminderHistoryEntries;
}

export function getRemindersForDate(
  dateText: string,
  remoteData: RemoteData = emptyRemoteData,
) {
  return getReminderHistorySource(remoteData)
    .filter((entry) => getZonedDateText(getReminderDueAt(entry)) === dateText)
    .sort(
      (a, b) => getReminderDueAt(a).getTime() - getReminderDueAt(b).getTime(),
    );
}
