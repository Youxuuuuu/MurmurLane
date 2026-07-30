export function shouldReleaseDeletedThreadOverlay({
  archiveContainsThread,
  latestSourceKey,
  deletedSourceKeys,
}: {
  archiveContainsThread: boolean;
  latestSourceKey: string;
  deletedSourceKeys: ReadonlySet<string> | undefined;
}) {
  if (!archiveContainsThread) return true;
  return Boolean(
    latestSourceKey &&
      deletedSourceKeys?.size &&
      !deletedSourceKeys.has(latestSourceKey),
  );
}
