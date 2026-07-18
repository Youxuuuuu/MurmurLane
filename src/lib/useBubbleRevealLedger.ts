import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import {
  bubbleRevealLedger,
  type BubbleRevealMode,
} from "./BubbleRevealLedger";

export function useBubbleRevealLedger(
  renderId: string,
  totalCount: number,
  mode: BubbleRevealMode,
  stableSlotIds?: readonly string[],
) {
  const prepared = bubbleRevealLedger.prepareMessage(
    renderId,
    totalCount,
    mode,
    stableSlotIds,
  );
  const subscribe = useCallback(
    (listener: () => void) => bubbleRevealLedger.subscribe(renderId, listener),
    [renderId],
  );
  const getSnapshot = useCallback(
    () => bubbleRevealLedger.getSnapshot(renderId) || prepared,
    [prepared, renderId],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useLayoutEffect(() => {
    bubbleRevealLedger.revealNextIfReady(renderId);
  }, [renderId, snapshot]);
  return snapshot;
}
