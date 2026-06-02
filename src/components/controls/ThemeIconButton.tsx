const inactiveColor = "#8A8580";

export function ThemeIconButton({
  label,
  viewBox,
  path,
  selected,
  accentColor,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`flex h-7 w-7 items-center justify-center border border-transparent transition-colors sm:h-8 sm:w-8 ${
        selected ? "" : "text-[#8A8580] hover:text-[#6f6a60]"
      }`}
      style={{
        color: selected ? accentColor : inactiveColor,
      }}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        viewBox={viewBox}
        className="h-[22px] w-[22px] sm:h-[23px] sm:w-[23px]"
        fill="currentColor"
      >
        <path d={path} />
      </svg>
    </button>
  );
}
