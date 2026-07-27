export interface TimelineHighlightTarget {
  readonly mode: "Timeline";
  readonly date: string;
  readonly targetId: string;
  readonly query: string;
}

export function consumeTimelineNavigationTarget(
  current: TimelineHighlightTarget | null,
  targetId: string,
) {
  return current?.targetId === targetId
    ? null
    : current;
}
