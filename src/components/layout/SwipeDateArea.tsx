import { useRef } from "react";

export function SwipeDateArea({ children, onSwipeDate }) {
  const gestureRef = useRef(null);

  return (
    <div
      className="h-full min-h-0"
      style={{ touchAction: "pan-y" }}
      onPointerDown={(event) => {
        gestureRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
        };
      }}
      onPointerUp={(event) => {
        if (
          !gestureRef.current ||
          gestureRef.current.pointerId !== event.pointerId
        ) {
          return;
        }

        const offsetX = event.clientX - gestureRef.current.startX;
        const offsetY = event.clientY - gestureRef.current.startY;
        gestureRef.current = null;

        if (
          Math.abs(offsetX) > 88 &&
          Math.abs(offsetX) > Math.abs(offsetY)
        ) {
          onSwipeDate(offsetX > 0 ? -1 : 1);
        }
      }}
      onPointerCancel={() => {
        gestureRef.current = null;
      }}
    >
      {children}
    </div>
  );
}
