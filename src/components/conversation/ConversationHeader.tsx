import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationNavBar } from "./ConversationNavBar";

function SearchDotsIcon() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none" aria-hidden="true">
      <circle cx="7" cy="14" r="1.5" fill="currentColor" />
      <circle cx="14" cy="14" r="1.5" fill="currentColor" />
      <circle cx="21" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function ConversationHeader({
  userProfile,
  threadProfile,
  onBack,
  onEditThread,
  onOpenSearch,
  floatingDate,
  onOpenDatePicker,
}: {
  userProfile: ConversationIdentity;
  threadProfile: ConversationThreadProfile;
  onBack: () => void;
  onEditThread: () => void;
  onOpenSearch: () => void;
  floatingDate?: string;
  onOpenDatePicker: () => void;
}) {
  return (
    <header
      className="relative z-30 shrink-0 px-3 pb-3 pt-2"
      style={{ backgroundColor: threadProfile.background || "transparent" }}
    >
      <ConversationNavBar
        title={floatingDate || threadProfile.name}
        subtitle={floatingDate ? "SELECT DATE" : threadProfile.handle}
        onBack={onBack}
        backLabel="返回对话列表"
        onTitleClick={floatingDate ? onOpenDatePicker : undefined}
        trailing={
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-11 w-11 items-center justify-end text-black/70"
            aria-label="搜索当前聊天"
          >
            <SearchDotsIcon />
          </button>
        }
      />

      <div className="mt-2 flex items-center gap-3 px-3">
        <ConversationAvatar src={userProfile.avatar} name={userProfile.name} size="lg" />
        <span className="text-[17px] text-[#dfeef1]" aria-hidden="true">♥</span>
        <button type="button" onClick={onEditThread} className="shrink-0" aria-label={`编辑${threadProfile.name}的聊天资料`}>
          <ConversationAvatar
            src={threadProfile.avatar}
            name={threadProfile.name}
            size="lg"
          />
        </button>
        <button
          type="button"
          onClick={onEditThread}
          className="min-w-0 flex-1 text-left font-sans"
        >
          <div className="truncate text-[23px] font-bold leading-none text-black/45">
            {threadProfile.name}
          </div>
          <div className="mt-1 truncate text-[12px] font-semibold tracking-[0.05em] text-black/[0.32]">
            {threadProfile.handle} &gt;
          </div>
        </button>
      </div>
      <p className="mt-3 truncate px-4 text-left font-sans text-[11px] font-semibold text-black/20">
        /*{threadProfile.signature}*/
      </p>
    </header>
  );
}
