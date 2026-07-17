import { useLayoutEffect } from "react";

export function useStableViewport() {
  useLayoutEffect(() => {
    let stableHeight = Math.max(
      window.innerHeight || 0,
      window.visualViewport?.height || 0,
    );
    const resetDocumentScroll = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const applyStableViewport = () => {
      const visualViewport = window.visualViewport;
      const currentLayoutHeight = window.innerHeight || 0;
      const currentVisualHeight = visualViewport?.height || 0;
      const currentVisualOffsetTop = visualViewport?.offsetTop || 0;
      const candidateHeight = Math.max(currentLayoutHeight, currentVisualHeight);
      const nextKeyboardInset = Math.max(
        0,
        stableHeight - currentVisualHeight - currentVisualOffsetTop,
      );

      if (nextKeyboardInset <= 80 || candidateHeight > stableHeight) {
        stableHeight = candidateHeight;
      }
      const keyboardInset = Math.max(
        0,
        stableHeight - currentVisualHeight - currentVisualOffsetTop,
      );
      const layoutViewportTracksKeyboard =
        currentLayoutHeight > 0 &&
        currentVisualHeight > 0 &&
        Math.abs(currentLayoutHeight - currentVisualHeight) < 2 &&
        currentLayoutHeight < stableHeight - 80;
      const composerKeyboardInset = layoutViewportTracksKeyboard
        ? 0
        : keyboardInset;

      document.documentElement.style.setProperty(
        "--app-stable-height",
        `${Math.round(stableHeight)}px`,
      );
      document.documentElement.style.setProperty(
        "--app-keyboard-inset",
        `${Math.round(composerKeyboardInset)}px`,
      );
      document.documentElement.style.setProperty(
        "--app-keyboard-center-offset",
        `${Math.round(keyboardInset / 2)}px`,
      );

      window.requestAnimationFrame(resetDocumentScroll);
    };

    applyStableViewport();
    window.addEventListener("resize", applyStableViewport, { passive: true });
    window.addEventListener("blur", resetDocumentScroll);
    window.addEventListener("focusout", resetDocumentScroll);
    document.addEventListener("visibilitychange", resetDocumentScroll);
    window.visualViewport?.addEventListener("scroll", applyStableViewport, {
      passive: true,
    });
    window.visualViewport?.addEventListener("resize", applyStableViewport, {
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", applyStableViewport);
      window.removeEventListener("blur", resetDocumentScroll);
      window.removeEventListener("focusout", resetDocumentScroll);
      document.removeEventListener("visibilitychange", resetDocumentScroll);
      window.visualViewport?.removeEventListener("scroll", applyStableViewport);
      window.visualViewport?.removeEventListener("resize", applyStableViewport);
    };
  }, []);
}
