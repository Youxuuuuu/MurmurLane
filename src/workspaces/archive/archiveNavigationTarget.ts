export interface ArchiveHighlightTarget {
  readonly mode: string;
  readonly date: string;
  readonly targetId: string;
  readonly query: string;
}

export function consumeArchiveNavigationTarget(
  current: ArchiveHighlightTarget | null,
  targetId: string,
) {
  return current?.targetId === targetId
    ? null
    : current;
}
