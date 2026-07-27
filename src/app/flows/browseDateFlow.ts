interface BrowseDateTarget {
  openDate(date: string): void;
}

export function createBrowseDateFlow({
  timeline,
  archive,
}: {
  readonly timeline: BrowseDateTarget;
  readonly archive: BrowseDateTarget;
}) {
  return Object.freeze({
    openDate(date: string) {
      timeline.openDate(date);
      archive.openDate(date);
    },
  });
}

