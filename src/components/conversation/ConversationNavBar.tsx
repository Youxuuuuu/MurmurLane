import type { ReactNode } from "react";

export function ConversationBackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 min-w-11 items-center justify-start text-black/70"
      aria-label={label}
    >
      <span className="text-[34px] font-light leading-none" aria-hidden="true">‹</span>
    </button>
  );
}

export function ConversationNavBar({
  title,
  subtitle,
  onBack,
  backLabel,
  trailing,
  onTitleClick,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel: string;
  trailing?: ReactNode;
  onTitleClick?: () => void;
}) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
      <ConversationBackButton onClick={onBack} label={backLabel} />
      <button
        type="button"
        onClick={onTitleClick}
        disabled={!onTitleClick}
        className="min-w-0 text-center font-sans disabled:cursor-default"
      >
        <div className="truncate text-[15px] font-bold text-black/[0.72]">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-[10px] font-medium text-black/[0.35]">{subtitle}</div>
        ) : null}
      </button>
      <div className="flex h-11 items-center justify-end">{trailing}</div>
    </div>
  );
}
