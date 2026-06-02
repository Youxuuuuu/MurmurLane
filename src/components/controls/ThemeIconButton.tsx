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
      className={`flex h-5 w-5 items-center justify-center border border-transparent transition-colors sm:h-5 sm:w-5 ${
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
        className="h-[16px] w-[16px] sm:h-[17px] sm:w-[17px]"
        fill="currentColor"
      >
        <path d={path} />
      </svg>
    </button>
  );
}
