import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  clampConversationSwipeOffset,
  resolveConversationSwipeIntent,
  shouldRevealConversationActions,
  type ConversationSwipeIntent,
} from "./conversationSwipe";

const ACTION_WIDTH = 210;

export function ConversationSwipeRow({
  open,
  onOpenChange,
  onSwipeIntent,
  actions,
  children,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onSwipeIntent(): void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(open ? -ACTION_WIDTH : 0);
  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseOffset: number;
    intent: ConversationSwipeIntent;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!gestureRef.current) {
      setOffset(open ? -ACTION_WIDTH : 0);
    }
  }, [open]);

  const resetGesture = () => {
    gestureRef.current = null;
  };

  const finishGesture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.intent === "horizontal") {
      const shouldOpen = shouldRevealConversationActions(
        offset,
        ACTION_WIDTH,
      );
      suppressClickRef.current = true;
      onOpenChange(shouldOpen);
      setOffset(shouldOpen ? -ACTION_WIDTH : 0);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    } else {
      setOffset(open ? -ACTION_WIDTH : 0);
    }
    resetGesture();
  };

  return (
    <div className="relative overflow-hidden bg-white">
      <div
        className="absolute inset-y-0 right-0 flex w-[210px]"
        aria-hidden={!open && offset === 0}
      >
        {actions}
      </div>
      <div
        className="relative bg-white will-change-transform"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: gestureRef.current
            ? "none"
            : "transform 180ms cubic-bezier(.2,.8,.2,1)",
          touchAction: "pan-y",
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          gestureRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            baseOffset: open ? -ACTION_WIDTH : 0,
            intent: "pending",
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const gesture = gestureRef.current;
          if (!gesture || gesture.pointerId !== event.pointerId) return;
          const deltaX = event.clientX - gesture.startX;
          const deltaY = event.clientY - gesture.startY;
          if (gesture.intent === "pending") {
            gesture.intent = resolveConversationSwipeIntent(
              deltaX,
              deltaY,
            );
          }
          if (gesture.intent !== "horizontal") return;
          event.preventDefault();
          onSwipeIntent();
          setOffset(
            clampConversationSwipeOffset(
              gesture.baseOffset,
              deltaX,
              ACTION_WIDTH,
            ),
          );
        }}
        onPointerUp={finishGesture}
        onPointerCancel={(event) => {
          if (
            gestureRef.current?.pointerId === event.pointerId
          ) {
            setOffset(open ? -ACTION_WIDTH : 0);
            resetGesture();
          }
        }}
        onClickCapture={(event) => {
          if (suppressClickRef.current || open) {
            event.preventDefault();
            event.stopPropagation();
            if (open) onOpenChange(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
