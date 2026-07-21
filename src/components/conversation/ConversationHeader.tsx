import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationNavBar } from "./ConversationNavBar";
import { AnimatePresence, motion } from "framer-motion";
import {
  chatStatusEnterTransition,
  chatStatusExitTransition,
} from "../../lib/chatMotion";

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
  isTyping = false,
}: {
  userProfile: ConversationIdentity;
  threadProfile: ConversationThreadProfile;
  onBack: () => void;
  onEditThread: () => void;
  onOpenSearch: () => void;
  floatingDate?: string;
  onOpenDatePicker: () => void;
  isTyping?: boolean;
}) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-30 px-4 pb-3 pt-2 backdrop-blur-[3px]"
      style={{
        backgroundColor: `color-mix(in srgb, ${threadProfile.background || "#f7f2f6"} 68%, transparent)`,
      }}
    >
      <div className="relative -mx-4 -mt-2 bg-white px-4 pt-2">
        <ConversationNavBar
          title={floatingDate || threadProfile.name}
          subtitle={floatingDate ? "SELECT DATE" : threadProfile.handle}
          onBack={onBack}
          backLabel="返回对话列表"
          onTitleClick={onOpenDatePicker}
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
        <div className="pointer-events-none absolute inset-x-0 -bottom-4 h-4 bg-gradient-to-b from-white to-transparent" />
      </div>

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
          <div className="relative mt-1 min-h-[16px] truncate text-[12px] font-semibold tracking-[0.05em] text-black/[0.32]">
            <AnimatePresence initial={false}>
              <motion.span
                key={isTyping ? "typing" : "handle"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: chatStatusEnterTransition }}
                exit={{ opacity: 0, transition: chatStatusExitTransition }}
                className="absolute inset-0 block truncate"
              >
                {isTyping ? "正在输入…" : `${threadProfile.handle} >`}
              </motion.span>
            </AnimatePresence>
          </div>
        </button>
      </div>
      <p className="mt-3 truncate px-4 text-left font-sans text-[11px] font-semibold text-black/20">
        /*{threadProfile.signature}*/
      </p>
      <div
        className="pointer-events-none absolute inset-x-0 -bottom-5 h-5"
        style={{
          background: `linear-gradient(to bottom, color-mix(in srgb, ${threadProfile.background || "#f7f2f6"} 68%, transparent), transparent)`,
        }}
      />
    </header>
  );
}
