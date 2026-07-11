export function ConversationPlaceholderPage({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-white font-sans text-black">
      <header className="grid h-14 shrink-0 grid-cols-[48px_1fr_48px] items-center border-b border-black/[0.06] px-3">
        <button type="button" onClick={onBack} className="text-left text-[34px] font-light" aria-label="返回">‹</button>
        <h1 className="text-center text-[15px] font-semibold">{title}</h1>
        <span />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 text-[24px]">⌕</div>
        <p className="mt-5 text-[13px] leading-6 text-black/40">{description}</p>
      </div>
    </section>
  );
}
