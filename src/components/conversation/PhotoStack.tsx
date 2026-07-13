import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ConversationMediaItem } from "../../types/conversation";
import { getConversationMediaSrc } from "../../lib/conversation";
import { TinyIcon } from "../common/TinyIcon";

const STACK_WIDTH = 142;
const STACK_HEIGHT = 190;
const PEEK = 15;
const PEEK_STEP = 12;
const ROTATION_STEP = 2.2;
const SCALE_STEP = 0.06;
const STACK_TRANSITION =
  "transform 320ms cubic-bezier(.2,.7,.3,1), opacity 300ms ease";
const PHOTO_GROUP_TRANSITION = {
  duration: 0.34,
  ease: [0.22, 0.8, 0.2, 1] as const,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getVisibleSides(current: number, total: number) {
  let left = Math.min(current, 1);
  let right = Math.min(total - 1 - current, 1);

  if (left + right < 2) {
    left = Math.min(current, 2 - right);
    right = Math.min(total - 1 - current, 2 - left);
  }

  return { left, right };
}

function getRestingStyle(index: number, current: number, total: number) {
  const { left, right } = getVisibleSides(current, total);

  if (index < current) {
    const depth = current - index;
    return {
      transform: `translateX(${-PEEK - (depth - 1) * PEEK_STEP}px) rotate(${-ROTATION_STEP * depth}deg) scale(${1 - SCALE_STEP * depth})`,
      zIndex: 40 - depth,
      opacity: depth > left ? 0 : 1,
    };
  }

  if (index === current) {
    return {
      transform: "translateX(0)",
      zIndex: 100,
      opacity: 1,
    };
  }

  const depth = index - current;
  return {
    transform: `translateX(${PEEK + (depth - 1) * PEEK_STEP}px) rotate(${ROTATION_STEP * depth}deg) scale(${1 - SCALE_STEP * depth})`,
    zIndex: 100 - depth,
    opacity: depth > right ? 0 : 1,
  };
}

function getDraggedStyle(
  index: number,
  current: number,
  total: number,
  direction: number,
  progress: number,
) {
  const style = { ...getRestingStyle(index, current, total) };
  const atStart = direction > 0 ? current === 0 : current === total - 1;

  if (atStart) {
    if (index === current) {
      style.transform = `translateX(${direction * 24 * progress}px) rotate(${direction * 2.5 * progress}deg)`;
      style.zIndex = 110;
    }

    const firstNeighbor = current + direction;
    const secondNeighbor = current + direction * 2;
    if (index === firstNeighbor) {
      style.transform = `translateX(${direction * (PEEK + 8 * progress)}px) rotate(${direction * ROTATION_STEP}deg) scale(${1 - SCALE_STEP})`;
    }
    if (index === secondNeighbor) {
      style.transform = `translateX(${direction * (PEEK + PEEK_STEP + 5 * progress)}px) rotate(${direction * ROTATION_STEP * 2}deg) scale(${1 - SCALE_STEP * 2})`;
    }
    return style;
  }

  const width = STACK_WIDTH;
  const maxX = width * 0.52;

  if (index === current) {
    let x: number;
    let rotation: number;
    let scale = 1;

    if (progress <= 0.5) {
      const phase = progress / 0.5;
      x = direction * maxX * phase;
      rotation = direction * 8 * phase;
    } else {
      const phase = (progress - 0.5) / 0.5;
      x = direction * (maxX - (maxX - PEEK) * phase);
      rotation = direction * (8 - (8 - ROTATION_STEP) * phase);
      scale = 1 - SCALE_STEP * phase;
    }

    style.transform = `translateX(${x}px) rotate(${rotation}deg) scale(${scale})`;
    style.zIndex = progress < 0.5 ? 110 : 102;
    return style;
  }

  const nextTop = current - direction;
  if (index === nextTop) {
    style.transform = `translateX(${-direction * PEEK * (1 - progress)}px) rotate(${-direction * ROTATION_STEP * (1 - progress)}deg) scale(${1 - SCALE_STEP + SCALE_STEP * progress})`;
    style.opacity = 1;
    style.zIndex = 105;
    return style;
  }

  const nextPeek = current - direction * 2;
  if (index === nextPeek) {
    style.transform = `translateX(${-direction * (PEEK + PEEK_STEP - 12 * progress)}px) rotate(${-direction * (ROTATION_STEP * 2 - ROTATION_STEP * progress)}deg) scale(${1 - SCALE_STEP * 2 + SCALE_STEP * progress})`;
    style.opacity = Math.max(style.opacity, Math.max(0, (progress - 0.45) / 0.55));
    style.zIndex = direction < 0 ? 98 : 38;
    return style;
  }

  const oldSide = current + direction;
  if (index === oldSide) {
    const nextCurrent = clamp(current - direction, 0, total - 1);
    const { left, right } = getVisibleSides(nextCurrent, total);
    const staysOnLeft = index < nextCurrent && nextCurrent - index <= left;
    const staysOnRight = index > nextCurrent && index - nextCurrent <= right;

    if (!staysOnLeft && !staysOnRight) {
      style.opacity = Math.max(0, 1 - progress / 0.55);
    } else {
      style.transform = `translateX(${direction * (PEEK + PEEK_STEP * progress)}px) rotate(${direction * (ROTATION_STEP + ROTATION_STEP * progress)}deg) scale(${1 - SCALE_STEP - SCALE_STEP * progress})`;
    }
  }

  return style;
}

function getMediaLabel(item: ConversationMediaItem, index: number) {
  return item?.label || item?.fileName || item?.relativePath || `图片 ${index + 1}`;
}

function getMediaKey(item: ConversationMediaItem, index: number) {
  return item?.mediaKey || item?.fileName || item?.relativePath || `photo-${index}`;
}

type PhotoControlPage = {
  color?: string;
  line?: string;
};

function getPhotoControlStyle(_page?: PhotoControlPage) {
  return {
    color: "rgba(0,0,0,.58)",
    backgroundColor: "rgba(0,0,0,.07)",
  };
}

function PhotoControl({
  page,
  label,
  onClick,
  ariaLabel,
}: {
  page?: PhotoControlPage;
  label: string;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel || label}
      data-photo-control="true"
      className="inline-flex min-h-8 items-center whitespace-nowrap rounded-full border-0 px-3 py-2 font-mono text-[9px] font-semibold leading-none tracking-[0.08em] transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-black/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15"
      style={getPhotoControlStyle(page)}
      onPointerDown={(event) => {
        // Do not let the collapsed stack capture the expand/collapse button.
        event.stopPropagation();
      }}
      onClick={(event) => {
        // The collapsed PhotoStack listens for clicks to open the viewer. Keep
        // the expand/collapse action independent from that parent interaction.
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

function ImageFallback() {
  return (
    <span className="flex h-full w-full items-center justify-center bg-black/[0.04]">
      <TinyIcon color="rgba(0,0,0,.38)" />
    </span>
  );
}

function PhotoViewer({
  entries,
  index,
  brokenKeys,
  onImageError,
  onChange,
  onClose,
}: {
  entries: Array<{ key: string; src: string; label: string }>;
  index: number;
  brokenKeys: Set<string>;
  onImageError: (key: string) => void;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const startX = useRef<number | null>(null);
  const active = entries[index] || entries[0];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onChange(clamp(index - 1, 0, entries.length - 1));
      if (event.key === "ArrowRight") onChange(clamp(index + 1, 0, entries.length - 1));
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [entries.length, index, onChange, onClose]);

  if (!active || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/[0.9] p-4 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      style={{ touchAction: "pan-y" }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center"
        onPointerDown={(event) => {
          startX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (startX.current === null) return;
          const delta = event.clientX - startX.current;
          startX.current = null;

          if (Math.abs(delta) > 40 && entries.length > 1) {
            const next = clamp(index + (delta < 0 ? 1 : -1), 0, entries.length - 1);
            onChange(next);
            return;
          }

          if (event.target === event.currentTarget) onClose();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <button
          type="button"
          aria-label="关闭图片预览"
          onClick={onClose}
          className="absolute right-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.14] text-2xl leading-none text-white/90 transition hover:bg-white/[0.24]"
        >
          ×
        </button>
        {entries.length > 1 && index > 0 && (
          <button
            type="button"
            aria-label="上一张图片"
            onClick={() => onChange(index - 1)}
            className="absolute left-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.14] text-2xl text-white/90 transition hover:bg-white/[0.24]"
          >
            ‹
          </button>
        )}
        {entries.length > 1 && index < entries.length - 1 && (
          <button
            type="button"
            aria-label="下一张图片"
            onClick={() => onChange(index + 1)}
            className="absolute right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.14] text-2xl text-white/90 transition hover:bg-white/[0.24]"
          >
            ›
          </button>
        )}
        <div className="flex max-h-full max-w-full flex-col items-center gap-3">
          <div className="rounded-full bg-white/[0.14] px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-white/90">
            {index + 1} / {entries.length}
          </div>
          <div className="flex max-h-[84vh] max-w-[92vw] items-center justify-center overflow-hidden rounded-[10px]">
            {active.src && !brokenKeys.has(active.key) ? (
              <img
                className="block max-h-[84vh] max-w-[92vw] object-contain"
                src={active.src}
                alt={active.label}
                draggable={false}
                onError={() => onImageError(active.key)}
              />
            ) : (
              <div className="h-40 w-40">
                <ImageFallback />
              </div>
            )}
          </div>
          <div className="max-w-[80vw] truncate font-sans text-[11px] text-white/55">
            {active.label}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PhotoStackCollection({
  entries,
  page,
  expanded,
  controlSide,
  onOpen,
  onExpand,
  onCollapse,
  brokenKeys,
  onImageError,
}: {
  entries: Array<{ key: string; src: string; label: string }>;
  page?: PhotoControlPage;
  expanded: boolean;
  controlSide: "left" | "right";
  onOpen: (index: number) => void;
  onExpand: () => void;
  onCollapse: () => void;
  brokenKeys: Set<string>;
  onImageError: (key: string) => void;
}) {
  const collapsed = !expanded;
  const [currentIndex, setCurrentIndex] = useState(0);
  const startRef = useRef<{
    x: number;
    y: number;
    time: number;
    lastX: number;
    lastTime: number;
    velocity: number;
    dragging: boolean;
    direction: number;
    progress: number;
  } | null>(null);
  const swipedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const animationDirectionRef = useRef(0);
  const currentIndexRef = useRef(0);
  const cardShellRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const applyStackStyles = (
    gesture: { direction: number; progress: number } | null,
    withTransition: boolean,
    activeIndex = currentIndexRef.current,
  ) => {
    entries.forEach((_, index) => {
      const shell = cardShellRefs.current[index];
      const card = cardRefs.current[index];
      if (!shell || !card) return;

      const style = gesture
        ? getDraggedStyle(
            index,
            activeIndex,
            entries.length,
            gesture.direction,
            gesture.progress,
          )
        : getRestingStyle(index, activeIndex, entries.length);

      shell.style.zIndex = String(style.zIndex);
      shell.style.opacity = String(style.opacity);
      shell.style.transition = withTransition ? "opacity 300ms ease" : "none";
      card.style.transform = style.transform;
      card.style.transition = withTransition ? STACK_TRANSITION : "none";
    });
  };

  useEffect(() => {
    setCurrentIndex((value) => {
      const next = clamp(value, 0, entries.length - 1);
      currentIndexRef.current = next;
      return next;
    });
  }, [entries.length]);

  useEffect(() => {
    if (expanded) {
      startRef.current = null;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationDirectionRef.current = 0;
    }
  }, [expanded]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const finish = (direction: number, fromProgress: number) => {
    const activeIndex = currentIndexRef.current;
    const nextIndex = direction < 0 ? activeIndex + 1 : activeIndex - 1;
    if (nextIndex < 0 || nextIndex >= entries.length) {
      applyStackStyles(null, true, activeIndex);
      return;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    animationDirectionRef.current = direction;
    const duration = Math.max(140, (1 - fromProgress) * 340);
    const startedAt = performance.now();

    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 2);
      applyStackStyles(
        {
          direction,
          progress: fromProgress + (1 - fromProgress) * eased,
        },
        false,
        activeIndex,
      );

      if (elapsed < 1) {
        animationFrameRef.current = window.requestAnimationFrame(step);
        return;
      }

      animationFrameRef.current = null;
      animationDirectionRef.current = 0;
      currentIndexRef.current = nextIndex;
      applyStackStyles(null, true, nextIndex);
      setCurrentIndex(nextIndex);
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
  };

  const settleInterruptedAnimation = () => {
    if (animationFrameRef.current === null) return;

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (animationDirectionRef.current !== 0) {
      const direction = animationDirectionRef.current;
      const nextIndex = clamp(
        currentIndexRef.current + (direction < 0 ? 1 : -1),
        0,
        entries.length - 1,
      );
      animationDirectionRef.current = 0;
      currentIndexRef.current = nextIndex;
      applyStackStyles(null, false, nextIndex);
      setCurrentIndex(nextIndex);
    }
  };

  const handlePointerDown = (event) => {
    if (!collapsed) return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-photo-control]")) {
      return;
    }
    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      dragging: false,
      direction: 0,
      progress: 0,
    };
    swipedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!collapsed) return;
    const start = startRef.current;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const now = event.timeStamp || performance.now();
    const elapsed = now - start.lastTime;

    if (elapsed > 0) {
      start.velocity = 0.7 * ((event.clientX - start.lastX) / elapsed) + 0.3 * start.velocity;
    }
    start.lastX = event.clientX;
    start.lastTime = now;

    if (!start.dragging && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      start.dragging = true;
      settleInterruptedAnimation();
    }

    if (!start.dragging) return;

    const direction = deltaX < 0 ? -1 : 1;
    event.preventDefault();
    const progress = Math.min(1, Math.abs(deltaX) / Math.max(120, start.x || 240));
    start.direction = direction;
    start.progress = progress;
    applyStackStyles({ direction, progress }, false);
  };

  const handlePointerUp = (event) => {
    if (!collapsed) return;
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    if (!start.dragging) return;

    swipedRef.current = true;
    const canMove = start.direction < 0
      ? currentIndexRef.current < entries.length - 1
      : currentIndexRef.current > 0;
    const fling =
      Math.abs(start.velocity) > 0.4 &&
      Math.sign(start.velocity) === Math.sign(event.clientX - start.x) &&
      start.progress > 0.04;

    if (canMove && (start.progress > 0.5 || fling)) {
      finish(start.direction, start.progress);
    } else {
      applyStackStyles(null, true);
    }
  };

  const handlePointerCancel = () => {
    if (!collapsed) return;
    startRef.current = null;
    applyStackStyles(null, true);
  };

  const control = (
    <motion.div
      layout
      transition={PHOTO_GROUP_TRANSITION}
      className={`flex shrink-0 ${expanded ? "pt-[118px]" : "self-center"}`}
    >
      <PhotoControl
        page={page}
        label={expanded ? "收起" : `展开 ${entries.length}`}
        ariaLabel={expanded ? "收起图片组" : `展开 ${entries.length} 张图片`}
        onClick={expanded ? onCollapse : onExpand}
      />
    </motion.div>
  );

  const imageCollection = (
    <motion.div
      layout
      transition={PHOTO_GROUP_TRANSITION}
      className={expanded ? "flex min-w-0 flex-col gap-3" : "relative shrink-0"}
      style={
        expanded
          ? undefined
          : {
              width: STACK_WIDTH,
              height: STACK_HEIGHT,
              touchAction: "pan-y",
            }
      }
      role={collapsed ? "button" : undefined}
      tabIndex={collapsed ? 0 : undefined}
      aria-label={collapsed ? `查看 ${entries.length} 张图片` : undefined}
      onPointerDown={collapsed ? handlePointerDown : undefined}
      onPointerMove={collapsed ? handlePointerMove : undefined}
      onPointerUp={collapsed ? handlePointerUp : undefined}
      onPointerCancel={collapsed ? handlePointerCancel : undefined}
      onClick={
        collapsed
          ? () => {
              if (swipedRef.current) {
                swipedRef.current = false;
                return;
              }
              onOpen(currentIndex);
            }
          : undefined
      }
      onKeyDown={
        collapsed
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(currentIndex);
              }
            }
          : undefined
      }
    >
      {entries.map((entry, index) => {
        const stackStyle = getRestingStyle(index, currentIndex, entries.length);
        const layoutDuration = 0.45 + index * 0.09;

        return (
          <motion.div
            key={entry.key}
            ref={(node) => {
              cardShellRefs.current[index] = node;
            }}
            layout
            className={
              expanded
                ? "block max-w-[220px]"
                : "absolute inset-0"
            }
            style={{
              zIndex: collapsed ? stackStyle.zIndex : 1,
              opacity: collapsed ? stackStyle.opacity : 1,
              transition: `opacity ${layoutDuration}s cubic-bezier(.22,.8,.2,1)`,
            }}
            transition={{
              duration: layoutDuration,
              ease: PHOTO_GROUP_TRANSITION.ease,
            }}
          >
            <button
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              type="button"
              className={
                expanded
                  ? "block max-w-[220px] overflow-hidden rounded-[6px] bg-black/5 text-left outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                  : "flex h-full w-full items-center justify-center overflow-hidden rounded-[14px] bg-transparent shadow-[0_3px_14px_rgba(0,0,0,.14)]"
              }
              style={{
                transform: collapsed
                  ? stackStyle.transform
                  : "translateX(0) rotate(0deg) scale(1)",
                transition: `transform ${layoutDuration}s cubic-bezier(.22,.8,.2,1)`,
              }}
              title={entry.label}
              aria-label={`查看${entry.label}`}
              onClick={(event) => {
                if (!expanded) return;
                event.stopPropagation();
                onOpen(index);
              }}
              onKeyDown={(event) => {
                if (!expanded) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(index);
                }
              }}
            >
              {entry.src && !brokenKeys.has(entry.key) ? (
                <img
                  className={
                    expanded
                      ? "block max-h-[280px] max-w-[220px] object-contain"
                      : "pointer-events-none h-full w-full scale-[1.04] object-cover"
                  }
                  src={entry.src}
                  alt={entry.label}
                  loading={
                    expanded || index === currentIndex ? "eager" : "lazy"
                  }
                  draggable={false}
                  onError={() => onImageError(entry.key)}
                />
              ) : (
                <div className={expanded ? "h-24 w-24" : "h-full w-full"}>
                  <ImageFallback />
                </div>
              )}
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );

  return (
    <motion.div
      layout
      transition={PHOTO_GROUP_TRANSITION}
      className={`flex gap-[24px] sm:gap-[26px] ${
        expanded ? "items-start" : "select-none items-center"
      }`}
    >
      {controlSide === "left" && control}
      {imageCollection}
      {controlSide === "right" && control}
    </motion.div>
  );
}

export function ConversationPhotoGallery({
  items,
  page,
  controlSide = "right",
}: {
  items: ConversationMediaItem[];
  page?: PhotoControlPage;
  controlSide?: "left" | "right";
}) {
  const entries = items.map((item, index) => ({
    key: getMediaKey(item, index),
    src: getConversationMediaSrc(item),
    label: getMediaLabel(item, index),
  }));
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [brokenKeys, setBrokenKeys] = useState<Set<string>>(() => new Set());

  const markImageBroken = (key: string) => {
    setBrokenKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  if (!entries.length) return <ImageFallback />;

  return (
    <div>
      {entries.length > 1 ? (
        <PhotoStackCollection
          entries={entries}
          page={page}
          expanded={expanded}
          controlSide={controlSide}
          brokenKeys={brokenKeys}
          onImageError={markImageBroken}
          onOpen={setViewerIndex}
          onExpand={() => setExpanded(true)}
          onCollapse={() => setExpanded(false)}
        />
      ) : (
        <button
          type="button"
          className="block max-w-[220px] overflow-hidden rounded-[6px] bg-black/5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-black/20"
          title={entries[0].label}
          aria-label={`查看${entries[0].label}`}
          onClick={() => setViewerIndex(0)}
        >
          {entries[0].src && !brokenKeys.has(entries[0].key) ? (
            <img
              className="block max-h-[280px] max-w-[220px] object-contain"
              src={entries[0].src}
              alt={entries[0].label}
              loading="lazy"
              onError={() => markImageBroken(entries[0].key)}
            />
          ) : (
            <div className="h-24 w-24">
              <ImageFallback />
            </div>
          )}
        </button>
      )}
      {viewerIndex !== null && (
        <PhotoViewer
          entries={entries}
          index={clamp(viewerIndex, 0, entries.length - 1)}
          brokenKeys={brokenKeys}
          onImageError={markImageBroken}
          onChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
