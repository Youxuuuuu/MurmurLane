import { ConversationNavBar } from "./ConversationNavBar";

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
      <header className="h-14 shrink-0 border-b border-black/[0.06] px-3 pt-1">
        <ConversationNavBar title={title} onBack={onBack} backLabel="返回" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 text-[24px]">⌕</div>
        <p className="mt-5 text-[13px] leading-6 text-black/40">{description}</p>
      </div>
    </section>
  );
}
