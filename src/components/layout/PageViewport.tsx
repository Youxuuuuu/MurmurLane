export function PageViewport({
  viewportKey,
  scrollMode,
  header,
  contentClassName = "mt-1",
  children,
}) {
  const pageScrollClass =
    scrollMode === "page" ? "overflow-y-auto" : "overflow-hidden";

  return (
    <div
      key={viewportKey}
      className={`diary-scroll relative flex min-h-0 flex-1 flex-col overflow-x-hidden overscroll-contain pb-4 ${pageScrollClass}`}
      style={{ paddingBottom: "var(--app-bottom-nav-space)" }}
    >
      {header}
      <div className={`${contentClassName} flex min-h-0 flex-1 flex-col pb-0.6`}>
        {children}
      </div>
    </div>
  );
}
