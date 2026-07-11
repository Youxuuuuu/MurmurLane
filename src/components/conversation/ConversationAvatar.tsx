export function ConversationAvatar({
  src,
  name,
  size = "md",
  className = "",
}: {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass = {
    sm: "h-9 w-9 text-[12px]",
    md: "h-12 w-12 text-[15px]",
    lg: "h-16 w-16 text-[18px]",
    xl: "h-24 w-24 text-[24px]",
  }[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-[#efefed] font-sans font-semibold text-black/45 shadow-[0_0_0_1px_rgba(0,0,0,.12)] ${sizeClass} ${className}`}
      aria-label={name}
    >
      {src ? (
        <img className="h-full w-full object-cover" src={src} alt={name} />
      ) : (
        <span>{String(name || "?").slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}
