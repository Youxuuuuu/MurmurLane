export function PageViewport({
  viewportKey,
  scrollMode,
  header,
  children,
}) {
  const pageScrollClass =
    scrollMode === "page" ? "overflow-y-auto" : "overflow-hidden";

  return (
    <div
      key={viewportKey}
      className={`diary-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overscroll-contain pb-4 ${pageScrollClass}`}
      style={{ paddingBottom: "var(--app-bottom-nav-space)" }}
    >
      {header}
      <div className="mt-1 flex min-h-0 flex-1 flex-col pb-0.6">
        {children}
      </div>
    </div>
  );
}
