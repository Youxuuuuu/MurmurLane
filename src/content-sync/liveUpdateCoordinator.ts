export interface ContentChangeEvent {
  readonly type: string;
  readonly date?: string;
  readonly mode?: string;
  readonly threadId?: string;
  readonly id?: string | number;
}

type ScheduledTask = unknown;

export interface LiveUpdateCoordinatorDependencies {
  readonly subscribe: (
    onEvent: (event: ContentChangeEvent) => void,
  ) => () => void;
  readonly refresh: (
    events: readonly ContentChangeEvent[],
  ) => Promise<void>;
  readonly schedule: (
    callback: () => void,
    delayMs: number,
  ) => ScheduledTask;
  readonly cancelSchedule: (task: ScheduledTask) => void;
  readonly isRefreshBlocked: () => boolean;
  readonly batchDelayMs?: number;
}

export interface LiveUpdateCoordinator {
  start(): void;
  stop(): void;
  enqueue(event: ContentChangeEvent): void;
  flushPending(): void;
  setVisible(visible: boolean): void;
}

function eventKey(event: ContentChangeEvent) {
  return [
    event.type,
    event.date ?? "",
    event.mode ?? "",
    event.threadId ?? "",
  ].join(":");
}

export function createLiveUpdateCoordinator({
  subscribe,
  refresh,
  schedule,
  cancelSchedule,
  isRefreshBlocked,
  batchDelayMs = 220,
}: LiveUpdateCoordinatorDependencies): LiveUpdateCoordinator {
  const pendingEvents = new Map<string, ContentChangeEvent>();
  let scheduledTask: ScheduledTask | undefined;
  let unsubscribe: (() => void) | undefined;
  let visible = true;
  let started = false;

  const clearScheduledTask = () => {
    if (scheduledTask === undefined) return;
    cancelSchedule(scheduledTask);
    scheduledTask = undefined;
  };

  const flushPending = () => {
    clearScheduledTask();
    if (!visible || isRefreshBlocked() || !pendingEvents.size) return;
    const events = Array.from(pendingEvents.values());
    pendingEvents.clear();
    void refresh(events);
  };

  const schedulePendingRefresh = () => {
    if (!visible || isRefreshBlocked()) return;
    clearScheduledTask();
    scheduledTask = schedule(() => {
      scheduledTask = undefined;
      flushPending();
    }, batchDelayMs);
  };

  const enqueue = (event: ContentChangeEvent) => {
    pendingEvents.set(eventKey(event), event);
    schedulePendingRefresh();
  };

  const startSubscription = () => {
    if (!started || !visible || unsubscribe) return;
    unsubscribe = subscribe(enqueue);
  };

  const stopSubscription = () => {
    unsubscribe?.();
    unsubscribe = undefined;
  };

  return {
    start() {
      if (started) return;
      started = true;
      startSubscription();
    },
    stop() {
      started = false;
      stopSubscription();
      clearScheduledTask();
    },
    enqueue,
    flushPending,
    setVisible(nextVisible) {
      if (visible === nextVisible) return;
      visible = nextVisible;
      if (!visible) {
        stopSubscription();
        clearScheduledTask();
        return;
      }
      enqueue({ type: "resync", id: Date.now() });
      startSubscription();
    },
  };
}
