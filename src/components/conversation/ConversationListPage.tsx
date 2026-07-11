import type { ConversationMoment } from "../../types/api";
import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { formatConversationTime } from "../../lib/conversationPageData";
import { ConversationAvatar } from "./ConversationAvatar";

function BackIcon() {
  return <span className="text-[35px] font-light leading-none">‹</span>;
}

function MenuIcon() {
  return (
    <span className="flex w-6 flex-col gap-[5px]" aria-hidden="true">
      <span className="h-[2px] w-full bg-current" />
      <span className="h-[2px] w-full bg-current" />
      <span className="h-[2px] w-full bg-current" />
    </span>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 2.8v3M14 22.2v3M2.8 14h3M22.2 14h3M6.1 6.1l2.1 2.1M19.8 19.8l2.1 2.1M21.9 6.1l-2.1 2.1M8.2 19.8l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function formatThreadDate(summary) {
  const timestamp = summary.latestRecord?.timestamp;
  const today = new Date();
  const date = timestamp ? new Date(timestamp) : null;

  if (date && !Number.isNaN(date.getTime())) {
    if (date.toDateString() === today.toDateString()) {
      return formatConversationTime(timestamp);
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  const match = String(summary.latestDate || "").match(/\.(\d{2})\.(\d{2})$/);
  return match ? `${Number(match[1])}/${Number(match[2])}` : "";
}

export function ConversationListPage({
  userProfile,
  threadProfiles,
  threadSummaries,
  moments,
  onBack,
  onEditProfile,
  onOpenSearch,
  onOpenMenu,
  onOpenMoment,
  onAddMoment,
  onSelectThread,
}) {
  const totalMessages = threadSummaries.reduce(
    (total, summary) => total + summary.messageCount,
    0,
  );

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white font-sans text-black">
      <header className="shrink-0 px-4 pb-3 pt-2">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1">
          <button type="button" onClick={onBack} className="flex h-11 items-center justify-start" aria-label="返回时间轴">
            <BackIcon />
          </button>
          <div className="truncate text-center text-[21px] font-bold tracking-[-0.03em]">
            {userProfile.handle}
          </div>
          <button type="button" onClick={onOpenMenu} className="flex h-11 items-center justify-end" aria-label="打开菜单">
            <MenuIcon />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-[108px_1fr] items-center gap-5">
          <button type="button" onClick={onEditProfile} className="justify-self-center">
            <ConversationAvatar src={userProfile.avatar} name={userProfile.name} size="xl" />
          </button>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><b className="block text-[18px]">{threadSummaries.length}</b><span className="text-[11px]">则对话</span></div>
            <div><b className="block text-[18px]">{totalMessages}</b><span className="text-[11px]">条讯息</span></div>
            <div><b className="block text-[18px]">{Math.max(1, threadSummaries.length)}</b><span className="text-[11px]">聊天中</span></div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onEditProfile} className="max-w-[78%] truncate rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-semibold">
            ▷ {userProfile.signature}
          </button>
          <button type="button" onClick={onEditProfile} className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] text-black/48">＋ 新增</button>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_1fr_44px] gap-2">
          <button type="button" onClick={onEditProfile} className="rounded-[7px] bg-[#f2f3f5] py-2.5 text-[12px] font-semibold">编辑个人档案</button>
          <button type="button" onClick={onOpenSearch} className="rounded-[7px] bg-[#f2f3f5] py-2.5 text-[12px] font-semibold">搜索聊天</button>
          <button type="button" onClick={onOpenMenu} className="flex items-center justify-center rounded-[7px] bg-[#f2f3f5] text-black/75"><SettingsIcon /></button>
        </div>
      </header>

      <div className="shrink-0 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-3">
          <button type="button" onClick={onAddMoment} className="flex w-[72px] flex-col items-center gap-1.5">
            <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full border-2 border-black/10 text-[38px] font-light">＋</span>
            <span className="text-[10px] text-black/45">新瞬间</span>
          </button>
          {moments.map((moment) => (
            <button key={moment.id} type="button" onClick={() => onOpenMoment(moment)} className="flex w-[72px] flex-col items-center gap-1.5">
              <span className="h-[66px] w-[66px] overflow-hidden rounded-full border-[3px] border-white shadow-[0_0_0_2px_#dedfe1]">
                <img className="h-full w-full object-cover" src={moment.src} alt={moment.fileName} />
              </span>
              <span className="max-w-full truncate text-[10px] text-black/45">{moment.date.slice(5)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-black/[0.04]">
        {threadSummaries.map((summary) => {
          const profile: ConversationThreadProfile = threadProfiles[summary.threadId];
          return (
            <button
              key={summary.threadId}
              type="button"
              onClick={() => onSelectThread(summary)}
              className="grid w-full grid-cols-[52px_minmax(0,1fr)_50px] items-center gap-3 border-b border-black/[0.055] px-4 py-4 text-left"
            >
              <ConversationAvatar src={profile.avatar} name={profile.name} size="md" />
              <span className="min-w-0">
                <b className="block truncate text-[16px] font-semibold text-black/68">{profile.name}</b>
                <span className="mt-1 block truncate text-[12px] text-black/38">{summary.snippet || "[新对话]"}</span>
              </span>
              <span className="self-start pt-1 text-right text-[12px] font-medium text-[#a9afba]">{formatThreadDate(summary)}</span>
            </button>
          );
        })}
        {!threadSummaries.length && (
          <div className="px-6 py-16 text-center text-[12px] text-black/30">还没有对话记录</div>
        )}
      </div>
    </section>
  );
}
