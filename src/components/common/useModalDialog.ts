import { useEffect, useRef, type KeyboardEvent } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let bodyScrollLockCount = 0;
let previousBodyOverflow = "";

export function useModalDialog<T extends HTMLElement = HTMLElement>(onClose: () => void) {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    if (bodyScrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    bodyScrollLockCount += 1;

    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = dialog?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? dialog)?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<T>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return {
    ref: dialogRef,
    role: "dialog" as const,
    "aria-modal": true as const,
    tabIndex: -1,
    onKeyDown,
  };
}
