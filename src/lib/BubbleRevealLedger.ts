import { createBubbleId } from "./conversationIdentity";

export type BubbleRevealMode = "rest" | "sequential";
export type BubbleRevealStatus = "hidden" | "queued" | "entering" | "entered" | "rest";

export interface BubbleRevealSlot {
  bubbleId: string;
  slotId: string;
  status: BubbleRevealStatus;
}

export interface BubbleRevealSnapshot {
  renderId: string;
  mode: BubbleRevealMode;
  visibleSlots: BubbleRevealSlot[];
  totalCount: number;
}

export type BubbleRevealLifecycleEvent = {
  phase: "entering" | "will-mount" | "mounted";
  renderId: string;
  bubbleId: string;
};

interface InternalSlot extends BubbleRevealSlot {
  enterCount: number;
}

interface MessageRevealState {
  renderId: string;
  mode: BubbleRevealMode;
  slots: InternalSlot[];
  visibleCount: number;
  snapshot: BubbleRevealSnapshot;
}

function defaultSlotTokenFactory() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `segment-${crypto.randomUUID()}`;
  }
  return `segment-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export class BubbleRevealLedger {
  private readonly states = new Map<string, MessageRevealState>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly lifecycleListeners = new Set<(
    event: BubbleRevealLifecycleEvent,
  ) => void>();
  private readonly createSlotToken: () => string;

  constructor({ createSlotToken = defaultSlotTokenFactory }: {
    createSlotToken?: () => string;
  } = {}) {
    this.createSlotToken = createSlotToken;
  }

  prepareMessage(
    renderId: string,
    totalCount: number,
    requestedMode: BubbleRevealMode,
  ) {
    const normalizedCount = Math.max(0, Math.floor(Number(totalCount) || 0));
    let state = this.states.get(renderId);
    if (!state) {
      state = {
        renderId,
        mode: requestedMode,
        slots: [],
        visibleCount: requestedMode === "sequential" && normalizedCount > 0
          ? 1
          : normalizedCount,
        snapshot: {
          renderId,
          mode: requestedMode,
          visibleSlots: [],
          totalCount: normalizedCount,
        },
      };
      this.states.set(renderId, state);
    }
    while (state.slots.length < normalizedCount) {
      const slotId = this.createSlotToken();
      state.slots.push({
        slotId,
        bubbleId: createBubbleId(renderId, slotId),
        status: "hidden",
        enterCount: 0,
      });
    }

    if (state.mode === "rest" || requestedMode === "rest") {
      state.mode = "rest";
      state.visibleCount = normalizedCount;
      state.slots.slice(0, normalizedCount).forEach((slot) => {
        slot.status = "rest";
      });
    } else {
      state.mode = "sequential";
      if (normalizedCount > 0 && state.visibleCount === 0) {
        state.visibleCount = 1;
      }
      const visibleCount = Math.min(state.visibleCount, normalizedCount);
      state.slots.slice(0, visibleCount).forEach((slot) => {
        if (slot.status === "hidden") slot.status = "queued";
      });
    }

    this.rebuildSnapshot(state, normalizedCount);
    return state.snapshot;
  }

  getSnapshot(renderId: string) {
    return this.states.get(renderId)?.snapshot;
  }

  subscribe(renderId: string, listener: () => void) {
    const current = this.listeners.get(renderId) || new Set<() => void>();
    current.add(listener);
    this.listeners.set(renderId, current);
    return () => {
      current.delete(listener);
      if (!current.size) this.listeners.delete(renderId);
    };
  }

  subscribeLifecycle(listener: (event: BubbleRevealLifecycleEvent) => void) {
    this.lifecycleListeners.add(listener);
    return () => {
      this.lifecycleListeners.delete(listener);
    };
  }

  notifyMounted(renderId: string, bubbleId: string) {
    this.emitLifecycle({ phase: "mounted", renderId, bubbleId });
  }

  claimEntering(renderId: string, bubbleId: string) {
    const state = this.states.get(renderId);
    const slot = state?.slots.find((candidate) => candidate.bubbleId === bubbleId);
    if (!state || !slot || slot.status !== "queued") return false;
    slot.status = "entering";
    slot.enterCount += 1;
    this.rebuildSnapshot(state, state.snapshot.totalCount);
    this.emitLifecycle({ phase: "entering", renderId, bubbleId });
    return true;
  }

  completeEntering(renderId: string, bubbleId: string) {
    const state = this.states.get(renderId);
    const slot = state?.slots.find((candidate) => candidate.bubbleId === bubbleId);
    if (!state || !slot || slot.status !== "entering") {
      return false;
    }
    slot.status = "entered";
    this.rebuildSnapshot(state, state.snapshot.totalCount);
    if (!this.revealNextIfReady(renderId)) this.emit(renderId);
    return true;
  }

  revealNextIfReady(renderId: string) {
    const state = this.states.get(renderId);
    if (
      !state
      || state.mode !== "sequential"
      || state.visibleCount >= state.snapshot.totalCount
      || !state.slots
        .slice(0, state.visibleCount)
        .every((slot) => slot.status === "entered")
    ) {
      return false;
    }

    const nextSlot = state.slots[state.visibleCount];
    if (!nextSlot || nextSlot.status !== "hidden") return false;
    this.emitLifecycle({
      phase: "will-mount",
      renderId,
      bubbleId: nextSlot.bubbleId,
    });
    state.visibleCount += 1;
    nextSlot.status = "queued";
    this.rebuildSnapshot(state, state.snapshot.totalCount);
    this.emit(renderId);
    return true;
  }

  getEnterCount(renderId: string, bubbleId: string) {
    const state = this.states.get(renderId);
    return state?.slots.find((candidate) => candidate.bubbleId === bubbleId)?.enterCount || 0;
  }

  getRenderEnterCount(renderId: string) {
    return this.states.get(renderId)?.slots.reduce(
      (total, slot) => total + slot.enterCount,
      0,
    ) || 0;
  }

  private rebuildSnapshot(state: MessageRevealState, totalCount: number) {
    const visibleCount = Math.min(state.visibleCount, totalCount);
    const visibleSlots = state.slots.slice(0, visibleCount).map((slot) => ({
      bubbleId: slot.bubbleId,
      slotId: slot.slotId,
      status: slot.status,
    }));
    const current = state.snapshot;
    const unchanged = current.mode === state.mode
      && current.totalCount === totalCount
      && current.visibleSlots.length === visibleSlots.length
      && current.visibleSlots.every((slot, index) => (
        slot.bubbleId === visibleSlots[index].bubbleId
        && slot.slotId === visibleSlots[index].slotId
        && slot.status === visibleSlots[index].status
      ));
    if (unchanged) return;
    state.snapshot = {
      renderId: state.renderId,
      mode: state.mode,
      totalCount,
      visibleSlots,
    };
  }

  private emit(renderId: string) {
    this.listeners.get(renderId)?.forEach((listener) => listener());
  }

  private emitLifecycle(event: BubbleRevealLifecycleEvent) {
    this.lifecycleListeners.forEach((listener) => listener(event));
  }
}

export const bubbleRevealLedger = new BubbleRevealLedger();
