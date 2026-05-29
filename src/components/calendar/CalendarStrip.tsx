export function CalendarStrip({ page, onOpenDatePicker, onMonthSelect }) {
  const months = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );
  return (
    <div
      className="mb-5 border-b pb-2 font-mono text-black/65"
      style={{ borderBottomColor: page.color }}
    >
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
          {page.month}/{page.day}
        </button>
      </div>
      <div className="grid grid-cols-12 gap-0 text-[9px] leading-none tracking-[0.01em]">
        {months.map((month) => (
          <button
            key={month}
            className="flex min-w-0 items-center justify-center"
            style={{
              color: month === page.month ? page.color : "rgba(0,0,0,.38)",
            }}
            type="button"
            onClick={() => onMonthSelect(month)}
          >
            {month === page.month ? `(${month})` : month}
          </button>
        ))}
      </div>
    </div>
  );
}
