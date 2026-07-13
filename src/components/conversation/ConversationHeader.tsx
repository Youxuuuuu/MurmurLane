import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { ConversationAvatar } from "./ConversationAvatar";

function SearchDotsIcon() {
  return (
    <svg viewBox="0 0 36 36" className="h-8 w-8" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="13" cy="18" r="1.4" fill="currentColor" />
      <circle cx="18" cy="18" r="1.4" fill="currentColor" />
      <circle cx="23" cy="18" r="1.4" fill="currentColor" />
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
      <div className="grid grid-cols-[38px_minmax(0,1fr)_38px] items-center">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center text-black/75"
          aria-label="返回对话列表"
        >
          <span className="text-[30px] font-light leading-none">‹</span>
        </button>
        {floatingDate ? (
          <button
            type="button"
            onClick={onOpenDatePicker}
            className="min-w-0 truncate text-center font-sans text-[13px] font-semibold text-black/55"
          >
            {floatingDate}
          </button>
        ) : (
          <div className="min-w-0 text-center font-sans">
            <div className="truncate text-[14px] font-semibold text-black/72">
              {threadProfile.name}
            </div>
            <div className="truncate text-[10px] tracking-[0.04em] text-black/35">
              {threadProfile.handle}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 w-9 items-center justify-center text-black/75"
          aria-label="搜索当前聊天"
        >
          <SearchDotsIcon />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 px-3">
        <ConversationAvatar src={userProfile.avatar} name={userProfile.name} size="lg" />
        <span className="text-[17px] text-[#dfeef1]" aria-hidden="true">♥</span>
        <button type="button" onClick={onEditThread} className="shrink-0">
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
          <div className="truncate text-[23px] font-semibold leading-none text-black/45">
            {threadProfile.name}
          </div>
          <div className="mt-1 truncate text-[12px] tracking-[0.05em] text-black/32">
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
