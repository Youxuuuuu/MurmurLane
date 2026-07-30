import { useLayoutEffect } from "react";

const KEYBOARD_OPEN_THRESHOLD = 80;
const ANDROID_VISUAL_VIEWPORT_OCCLUSION_FALLBACK = 16;
const COMPOSER_CLOSED_BOTTOM_CLEARANCE =
  "calc(10px + env(safe-area-inset-bottom))";

interface VirtualKeyboardController extends EventTarget {
  boundingRect: DOMRectReadOnly;
  overlaysContent: boolean;
}

interface NavigatorWithKeyboardGeometry extends Navigator {
  userAgentData?: {
    platform?: string;
  };
  virtualKeyboard?: VirtualKeyboardController;
}

export function resolveComposerBottomClearance(keyboardInset: number) {
  return keyboardInset > KEYBOARD_OPEN_THRESHOLD
    ? "8px"
    : COMPOSER_CLOSED_BOTTOM_CLEARANCE;
}

interface ComposerKeyboardInsetOptions {
  fallbackOcclusionInset?: number;
  layoutViewportTracksKeyboard: boolean;
  virtualKeyboardInset?: number;
  viewportKeyboardInset: number;
}

export function resolveComposerKeyboardInset({
  fallbackOcclusionInset = 0,
  layoutViewportTracksKeyboard,
  virtualKeyboardInset = 0,
  viewportKeyboardInset,
}: ComposerKeyboardInsetOptions) {
  if (virtualKeyboardInset > 0) {
    return virtualKeyboardInset;
  }
  if (layoutViewportTracksKeyboard) {
    return 0;
  }
  return (
    viewportKeyboardInset +
    (viewportKeyboardInset > KEYBOARD_OPEN_THRESHOLD
      ? fallbackOcclusionInset
      : 0)
  );
}

function getVirtualKeyboardController() {
  return (navigator as NavigatorWithKeyboardGeometry).virtualKeyboard;
}

function isAndroidPlatform() {
  const navigatorWithKeyboardGeometry =
    navigator as NavigatorWithKeyboardGeometry;
  return (
    navigatorWithKeyboardGeometry.userAgentData?.platform === "Android" ||
    /Android/iu.test(navigator.userAgent)
  );
}

export function useStableViewport() {
  useLayoutEffect(() => {
    let stableHeight = Math.max(
      window.innerHeight || 0,
      window.visualViewport?.height || 0,
    );
    const androidPlatform = isAndroidPlatform();
    const virtualKeyboard = getVirtualKeyboardController();
    const virtualKeyboardInitialOverlaysContent =
      virtualKeyboard?.overlaysContent ?? false;
    let virtualKeyboardControlsViewport = false;

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
      const nextViewportKeyboardInset = Math.max(
        0,
        stableHeight - currentVisualHeight - currentVisualOffsetTop,
      );

      if (
        nextViewportKeyboardInset <= KEYBOARD_OPEN_THRESHOLD ||
        candidateHeight > stableHeight
      ) {
        stableHeight = candidateHeight;
      }
      const viewportKeyboardInset = Math.max(
        0,
        stableHeight - currentVisualHeight - currentVisualOffsetTop,
      );
      const virtualKeyboardRect = virtualKeyboardControlsViewport
        ? virtualKeyboard?.boundingRect
        : undefined;
      const virtualKeyboardInset =
        virtualKeyboardRect && virtualKeyboardRect.height > 0
          ? Math.max(0, stableHeight - virtualKeyboardRect.y)
          : 0;
      const keyboardInset =
        virtualKeyboardInset > 0
          ? virtualKeyboardInset
          : viewportKeyboardInset;
      const layoutViewportTracksKeyboard =
        currentLayoutHeight > 0 &&
        currentVisualHeight > 0 &&
        Math.abs(currentLayoutHeight - currentVisualHeight) < 2 &&
        currentLayoutHeight < stableHeight - KEYBOARD_OPEN_THRESHOLD;
      const fallbackOcclusionInset =
        androidPlatform &&
        virtualKeyboardInset <= 0 &&
        viewportKeyboardInset > KEYBOARD_OPEN_THRESHOLD &&
        !layoutViewportTracksKeyboard
          ? ANDROID_VISUAL_VIEWPORT_OCCLUSION_FALLBACK
          : 0;
      const composerKeyboardInset = resolveComposerKeyboardInset({
        fallbackOcclusionInset,
        layoutViewportTracksKeyboard,
        virtualKeyboardInset,
        viewportKeyboardInset,
      });

      document.documentElement.style.setProperty(
        "--app-stable-height",
        `${Math.round(stableHeight)}px`,
      );
      document.documentElement.style.setProperty(
        "--app-keyboard-inset",
        `${Math.round(composerKeyboardInset)}px`,
      );
      document.documentElement.style.setProperty(
        "--app-composer-bottom-clearance",
        resolveComposerBottomClearance(keyboardInset),
      );
      document.documentElement.style.setProperty(
        "--app-keyboard-center-offset",
        `${Math.round(keyboardInset / 2)}px`,
      );

      window.requestAnimationFrame(resetDocumentScroll);
    };

    const handleWindowResize = () => applyStableViewport();
    const handleVisualViewportResize = () => applyStableViewport();
    const handleVisualViewportScroll = () => applyStableViewport();
    const handleVirtualKeyboardGeometryChange = () => applyStableViewport();

    if (
      virtualKeyboard &&
      window.isSecureContext &&
      window.top === window
    ) {
      try {
        virtualKeyboard.overlaysContent = true;
        virtualKeyboardControlsViewport = virtualKeyboard.overlaysContent;
      } catch {
        virtualKeyboardControlsViewport = false;
      }
    }
    applyStableViewport();
    window.addEventListener("resize", handleWindowResize, { passive: true });
    window.addEventListener("blur", resetDocumentScroll);
    window.addEventListener("focusout", resetDocumentScroll);
    document.addEventListener("visibilitychange", resetDocumentScroll);
    window.visualViewport?.addEventListener("scroll", handleVisualViewportScroll, {
      passive: true,
    });
    window.visualViewport?.addEventListener("resize", handleVisualViewportResize, {
      passive: true,
    });
    if (virtualKeyboardControlsViewport) {
      virtualKeyboard?.addEventListener(
        "geometrychange",
        handleVirtualKeyboardGeometryChange,
      );
    }

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("blur", resetDocumentScroll);
      window.removeEventListener("focusout", resetDocumentScroll);
      document.removeEventListener("visibilitychange", resetDocumentScroll);
      window.visualViewport?.removeEventListener("scroll", handleVisualViewportScroll);
      window.visualViewport?.removeEventListener("resize", handleVisualViewportResize);
      virtualKeyboard?.removeEventListener(
        "geometrychange",
        handleVirtualKeyboardGeometryChange,
      );
      if (virtualKeyboardControlsViewport && virtualKeyboard) {
        try {
          virtualKeyboard.overlaysContent =
            virtualKeyboardInitialOverlaysContent;
        } catch {
          // 页面销毁期间原生键盘控制器可能已经不可用。
        }
      }
    };
  }, []);
}
