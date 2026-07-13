export function CalendarStrip({
  page,
  onOpenDatePicker,
  onMonthSelect,
  showAll = false,
  allSelected = false,
  onSelectAll = undefined,
  selectedMonth = page.month,
  dateLabel = undefined,
  showCurrentDate = true,
}) {
  const months = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );
  return (
    <div
      className="mb-5 border-b pb-2 font-mono text-black/65"
      style={{ borderBottomColor: page.color }}
    >
      {showCurrentDate && (
        <div className="mb-2">
          <div className="text-[9px] uppercase leading-none tracking-[0.08em] text-black/38">
            current date
          </div>
          <button
            className="mt-1 text-[20px] leading-none tracking-[0.06em]"
            style={{ color: page.color }}
            type="button"
            onClick={onOpenDatePicker}
          >
            {dateLabel ?? `${page.month}/${page.day}`}
          </button>
        </div>
      )}
      <div
        className="grid gap-0 text-[9px] leading-none tracking-[0.01em]"
        style={{
          gridTemplateColumns: `repeat(${showAll ? 13 : 12}, minmax(0, 1fr))`,
        }}
      >
        {showAll && (
          <button
            className="flex min-w-0 items-center justify-center"
            style={{ color: allSelected ? page.color : "rgba(0,0,0,.38)" }}
            type="button"
            onClick={onSelectAll}
          >
            {allSelected ? "(ALL)" : "ALL"}
          </button>
        )}
        {months.map((month) => (
          <button
            key={month}
            className="flex min-w-0 items-center justify-center"
            style={{
              color:
                !allSelected && month === selectedMonth
                  ? page.color
                  : "rgba(0,0,0,.38)",
            }}
            type="button"
            onClick={() => onMonthSelect(month)}
          >
            {!allSelected && month === selectedMonth ? `(${month})` : month}
          </button>
        ))}
      </div>
    </div>
  );
}
