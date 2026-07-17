import { useCallback, useSyncExternalStore } from "react";
import {
  bubbleRevealLedger,
  type BubbleRevealMode,
} from "./BubbleRevealLedger";

export function useBubbleRevealLedger(
  renderId: string,
  totalCount: number,
  mode: BubbleRevealMode,
) {
  const prepared = bubbleRevealLedger.prepareMessage(renderId, totalCount, mode);
  const subscribe = useCallback(
    (listener: () => void) => bubbleRevealLedger.subscribe(renderId, listener),
    [renderId],
  );
  const getSnapshot = useCallback(
    () => bubbleRevealLedger.getSnapshot(renderId) || prepared,
    [prepared, renderId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
