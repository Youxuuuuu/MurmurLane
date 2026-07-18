export const bubbleRevealInitial = {
  opacity: 0,
  transform: "translateY(6px) scale(0.99)",
} as const;

export const bubbleRevealTarget = {
  opacity: 1,
  transform: "translateY(0px) scale(1)",
} as const;

export const bubbleRevealTransition = {
  type: "spring",
  duration: 0.26,
  bounce: 0,
} as const;

export const bubbleRevealAdvanceOpacity = 0.82;

export function shouldAdvanceBubbleReveal(opacity: unknown) {
  const value = Number(opacity);
  return Number.isFinite(value) && value >= bubbleRevealAdvanceOpacity;
}

export const chatStatusEnterTransition = {
  duration: 0.14,
  ease: [0.23, 1, 0.32, 1],
} as const;

export const chatStatusExitTransition = {
  duration: 0.1,
  ease: [0.23, 1, 0.32, 1],
} as const;
