import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { formatConversationTime } from "../../lib/conversationPageData";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationNavBar } from "./ConversationNavBar";
import { useModalDialog } from "../common/useModalDialog";

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

function GroupNameDialog({ value, onChange, onSave, onClose }) {
  const dialogProps = useModalDialog<HTMLFormElement>(onClose);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center overscroll-contain bg-black/25 px-3 py-[calc(16px+env(safe-area-inset-top))]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="取消修改分组"
        onClick={onClose}
      />
      <form
        {...dialogProps}
        aria-labelledby="group-name-dialog-title"
        className="relative z-10 w-full max-w-[390px] rounded-[16px] bg-white p-4 shadow-[0_4px_8px_rgba(0,0,0,.16)]"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <h2 id="group-name-dialog-title" className="text-[14px] font-semibold text-black/[0.72]">
          修改分组名称
        </h2>
        <label className="mt-3 block text-[11px] font-semibold text-black/[0.48]">
          分组名称
          <input
            value={value}
            name="group-name"
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
          className="mt-1 h-11 w-full rounded-[10px] border border-black/10 bg-[#f4f5f7] px-3 text-[16px] outline-none"
            maxLength={40}
          />
        </label>
          <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-9 rounded-full px-4 py-1.5 text-[11px] text-black/[0.55]">
            取消
          </button>
          <button type="submit" className="min-h-9 rounded-full bg-[#53677e] px-4 py-1.5 text-[11px] font-semibold text-white">
            保存
          </button>
        </div>
      </form>
    </div>
  );
}

function formatThreadDate(summary) {
  const canonicalDateText = String(summary.latestDate || "").replace(/-/g, ".");
  const [year, month, day] = canonicalDateText.split(".").map(Number);
  const today = new Date();
  const date = year && month && day ? new Date(year, month - 1, day) : null;

  if (date && !Number.isNaN(date.getTime())) {
    const timestamp = summary.latestRecord?.timestamp;
    const timestampDate = timestamp ? new Date(timestamp) : null;
    if (
      date.toDateString() === today.toDateString() &&
      timestampDate &&
      !Number.isNaN(timestampDate.getTime()) &&
      timestampDate.toDateString() === date.toDateString()
    ) {
      return formatConversationTime(timestamp);
    }
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
    }).format(date);
  }

  const timestamp = summary.latestRecord?.timestamp;
  const fallback = timestamp ? new Date(timestamp) : null;
  return fallback && !Number.isNaN(fallback.getTime())
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
      }).format(fallback)
    : "";
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
  onCreateThread,
  onSelectThread,
  onUpdateThreadProfile,
  onUpdateUserProfile,
  unreadCounts = {},
}) {
  const totalMessages = threadSummaries.reduce(
    (total, summary) => total + summary.messageCount,
    0,
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [draggingThreadId, setDraggingThreadId] = useState("");
  const [dragTargetGroup, setDragTargetGroup] = useState("");
  const [draggingGroup, setDraggingGroup] = useState("");
  const [groupDragTarget, setGroupDragTarget] = useState("");
  const [editingGroup, setEditingGroup] = useState("");
  const [groupDraft, setGroupDraft] = useState("");
  const longPressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);
  const suppressGroupClickRef = useRef(false);
  const draggingThreadRef = useRef("");
  const dragTargetGroupRef = useRef("");
  const draggingGroupRef = useRef("");
  const groupDragTargetRef = useRef("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const groupedThreads = useMemo(() => {
    const groups = new Map<string, typeof threadSummaries>();
    const registeredGroups = Array.from(
      new Set([
        ...(userProfile.groups || []),
        ...Object.values(
          threadProfiles as Record<string, ConversationThreadProfile>,
        ).map((profile) => profile.group?.trim()).filter(Boolean),
      ]),
    );
    registeredGroups.forEach((group) => groups.set(group, []));
    groups.set("最近聊天", []);
    threadSummaries.forEach((summary) => {
      const profile = threadProfiles[summary.threadId];
      const group = profile?.group?.trim() || "最近聊天";
      const items = groups.get(group) || [];
      items.push(summary);
      groups.set(group, items);
    });

    groups.forEach((items) => {
      items.sort((left, right) => {
        const leftPinned = threadProfiles[left.threadId]?.pinned ? 1 : 0;
        const rightPinned = threadProfiles[right.threadId]?.pinned ? 1 : 0;
        if (leftPinned !== rightPinned) return rightPinned - leftPinned;
        const leftDate = String(left.latestDate || "").replace(/-/g, ".");
        const rightDate = String(right.latestDate || "").replace(/-/g, ".");
        if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
        const leftTime = new Date(left.latestRecord?.timestamp || left.latestDate || 0).getTime();
        const rightTime = new Date(right.latestRecord?.timestamp || right.latestDate || 0).getTime();
        return rightTime - leftTime;
      });
    });

    return [
      ...registeredGroups.map((group) => [group, groups.get(group) || []] as const),
      ["最近聊天", groups.get("最近聊天") || []] as const,
    ];
  }, [threadProfiles, threadSummaries, userProfile.groups]);

  useEffect(() => {
    draggingThreadRef.current = draggingThreadId;
    dragTargetGroupRef.current = dragTargetGroup;
    draggingGroupRef.current = draggingGroup;
    groupDragTargetRef.current = groupDragTarget;
  }, [dragTargetGroup, draggingGroup, draggingThreadId, groupDragTarget]);

  useEffect(() => {
    const registered = userProfile.groups || [];
    const discovered = Object.values(
      threadProfiles as Record<string, ConversationThreadProfile>,
    )
      .map((profile) => profile.group?.trim())
      .filter(Boolean);
    const missing = discovered.filter((group) => !registered.includes(group));
    if (missing.length) {
      void onUpdateUserProfile?.({
        ...userProfile,
        groups: Array.from(new Set([...registered, ...missing])),
      });
    }
  }, [onUpdateUserProfile, threadProfiles, userProfile]);

  useEffect(
    () => () => {
      clearLongPress();
      document.body.style.userSelect = "";
    },
    [],
  );

  useEffect(() => {
    const scrollBox = scrollAreaRef.current;
    if (!scrollBox) return;

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (!draggingThreadRef.current) {
        const distance = Math.hypot(
          touch.clientX - pressStartRef.current.x,
          touch.clientY - pressStartRef.current.y,
        );
        if (distance > 8) clearLongPress();
        return;
      }
      event.preventDefault();
      updateDropTarget(touch.clientX, touch.clientY);
    };

    scrollBox.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => scrollBox.removeEventListener("touchmove", handleTouchMove);
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const finishDrag = async () => {
    clearLongPress();
    const threadId = draggingThreadRef.current;
    const targetGroup = dragTargetGroupRef.current;
    draggingThreadRef.current = "";
    dragTargetGroupRef.current = "";
    document.body.style.userSelect = "";
    setDraggingThreadId("");
    setDragTargetGroup("");
    if (threadId && targetGroup) {
      await onUpdateThreadProfile?.(threadId, {
        group: targetGroup === "最近聊天" ? "" : targetGroup,
      });
    }
  };

  const updateDropTarget = (clientX: number, clientY: number) => {
    const target = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-thread-group]")
      ?.dataset.threadGroup;
    if (target) {
      dragTargetGroupRef.current = target;
      setDragTargetGroup(target);
    }

    const scrollBox = scrollAreaRef.current;
    if (!scrollBox) return;
    const rect = scrollBox.getBoundingClientRect();
    if (clientY < rect.top + 72) scrollBox.scrollBy({ top: -18, behavior: "auto" });
    else if (clientY > rect.bottom - 72) scrollBox.scrollBy({ top: 18, behavior: "auto" });
  };

  const saveGroupName = async () => {
    const nextName = groupDraft.trim();
    if (!editingGroup || !nextName || nextName === "最近聊天") return;
    const registeredGroups = userProfile.groups || [];
    const nextGroups = registeredGroups.includes(editingGroup)
      ? registeredGroups.map((group) =>
          group === editingGroup ? nextName : group,
        )
      : [...registeredGroups, nextName];
    await Promise.all(
      Object.entries(
        threadProfiles as Record<string, ConversationThreadProfile>,
      )
        .filter(([, profile]) => profile.group === editingGroup)
        .map(([threadId]) => onUpdateThreadProfile?.(threadId, { group: nextName })),
    );
    await onUpdateUserProfile?.({ ...userProfile, groups: Array.from(new Set(nextGroups)) });
    setEditingGroup("");
    setGroupDraft("");
  };

  const finishGroupDrag = async () => {
    clearLongPress();
    const sourceGroup = draggingGroupRef.current;
    const targetGroup = groupDragTargetRef.current;
    draggingGroupRef.current = "";
    groupDragTargetRef.current = "";
    document.body.style.userSelect = "";
    setDraggingGroup("");
    setGroupDragTarget("");
    if (sourceGroup && targetGroup && sourceGroup !== targetGroup) {
      const groups = [...(userProfile.groups || [])];
      const from = groups.indexOf(sourceGroup);
      const to = groups.indexOf(targetGroup);
      if (from >= 0 && to >= 0) {
        groups.splice(from, 1);
        groups.splice(to, 0, draggingGroup);
        await onUpdateUserProfile?.({ ...userProfile, groups });
      }
    }
  };

  const moveDraggingThreadToGroup = async (group: string) => {
    const threadId = draggingThreadRef.current || draggingThreadId;
    if (!threadId) return false;
    draggingThreadRef.current = "";
    dragTargetGroupRef.current = "";
    document.body.style.userSelect = "";
    setDraggingThreadId("");
    setDragTargetGroup("");
    await onUpdateThreadProfile?.(threadId, {
      group: group === "最近聊天" ? "" : group,
    });
    return true;
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white font-sans text-black">
      <header className="shrink-0 px-4 pb-3 pt-2">
        <ConversationNavBar
          title={userProfile.handle}
          onBack={onBack}
          backLabel="返回时间轴"
          trailing={
            <button type="button" onClick={onOpenMenu} className="flex h-11 w-11 items-center justify-end" aria-label="打开菜单">
              <MenuIcon />
            </button>
          }
        />

        <div className="mt-3 grid grid-cols-[108px_1fr] items-center gap-5">
          <button type="button" onClick={onEditProfile} className="justify-self-center" aria-label="编辑个人头像和资料">
            <ConversationAvatar src={userProfile.avatar} name={userProfile.name} size="xl" />
          </button>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><b className="block text-[18px] font-bold tabular-nums">{threadSummaries.length}</b><span className="text-[11px] font-semibold">则对话</span></div>
            <div><b className="block text-[18px] font-bold tabular-nums">{totalMessages}</b><span className="text-[11px] font-semibold">条讯息</span></div>
            <div><b className="block text-[18px] font-bold tabular-nums">{Math.max(1, threadSummaries.length)}</b><span className="text-[11px] font-semibold">粉丝</span></div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onEditProfile} className="max-w-[78%] truncate rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-semibold">
            ▷ {userProfile.signature}
          </button>
          <button type="button" onClick={onEditProfile} className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-semibold text-black/[0.48]">＋ 新增</button>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_1fr_44px] gap-2">
          <button type="button" onClick={onEditProfile} className="rounded-[7px] bg-[#f2f3f5] py-2.5 text-[12px] font-semibold">编辑个人档案</button>
          <button type="button" onClick={onOpenSearch} className="rounded-[7px] bg-[#f2f3f5] py-2.5 text-[12px] font-semibold">搜索聊天</button>
          <button type="button" onClick={onCreateThread} className="flex min-h-11 items-center justify-center rounded-[7px] bg-[#f2f3f5] text-black/75" aria-label="新建聊天" title="新建聊天"><SettingsIcon /></button>
        </div>
      </header>

      <div className="shrink-0 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-3">
          <button type="button" onClick={onAddMoment} className="flex w-[72px] flex-col items-center gap-1.5">
            <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full border-2 border-black/10 text-[38px] font-light">＋</span>
            <span className="text-[10px] font-medium text-black/45">新瞬间</span>
          </button>
          {moments.map((moment) => (
            <button key={moment.id} type="button" onClick={() => onOpenMoment(moment)} className="flex w-[72px] flex-col items-center gap-1.5">
              <span className="h-[66px] w-[66px] overflow-hidden rounded-full border-[3px] border-white shadow-[0_0_0_2px_#dedfe1]">
                <img className="h-full w-full object-cover" src={moment.src} alt={moment.fileName} width="66" height="66" loading="lazy" />
              </span>
              <span className="max-w-full truncate text-[10px] font-medium text-black/45">{moment.date.slice(5)}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        className="diary-scroll min-h-0 flex-1 select-none overflow-y-auto bg-[#f4f5f7] px-3 pb-6 pt-3"
        onContextMenu={(event) => event.preventDefault()}
      >
        {groupedThreads.map(([group, summaries]) => {
          const collapsed = collapsedGroups.has(group);
          const activeDropTarget = draggingThreadId && dragTargetGroup === group;
          return (
            <section key={group} className="mb-3">
              <div
                data-thread-group={group}
                onPointerMove={(event) => {
                  if (!draggingGroupRef.current) return;
                  event.preventDefault();
                  const target = document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>("[data-thread-group]")
                    ?.dataset.threadGroup;
                  if (target && target !== "最近聊天") {
                    groupDragTargetRef.current = target;
                    setGroupDragTarget(target);
                  }
                  const scrollBox = scrollAreaRef.current;
                  if (!scrollBox) return;
                  const rect = scrollBox.getBoundingClientRect();
                  if (event.clientY < rect.top + 72) scrollBox.scrollBy({ top: -18 });
                  else if (event.clientY > rect.bottom - 72) scrollBox.scrollBy({ top: 18 });
                }}
                onPointerUp={() => void finishGroupDrag()}
                className={`relative mb-1 flex min-h-9 w-full items-center justify-between rounded-[10px] px-2 py-0.5 ${
                  activeDropTarget || groupDragTarget === group ? "bg-[#dfe7f0]" : "bg-transparent"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  aria-label={`${collapsed ? "展开" : "收起"}${group}分组，共 ${summaries.length} 个对话`}
                  className="absolute inset-0 z-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a8064]/55"
                  onClick={() => {
                    if (draggingThreadRef.current) {
                      void moveDraggingThreadToGroup(group);
                      return;
                    }
                    setCollapsedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(group)) next.delete(group);
                      else next.add(group);
                      return next;
                    });
                  }}
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (suppressGroupClickRef.current) {
                      suppressGroupClickRef.current = false;
                      return;
                    }
                    if (draggingThreadId) {
                      void moveDraggingThreadToGroup(group);
                      return;
                    }
                    if (group !== "最近聊天") {
                      setEditingGroup(group);
                      setGroupDraft(group);
                    }
                  }}
                  onPointerDown={(event) => {
                    if (group === "最近聊天") return;
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    clearLongPress();
                    longPressTimerRef.current = window.setTimeout(() => {
                      document.body.style.userSelect = "none";
                      suppressGroupClickRef.current = true;
                      draggingGroupRef.current = group;
                      groupDragTargetRef.current = group;
                      setDraggingGroup(group);
                      setGroupDragTarget(group);
                    }, 460);
                  }}
                  className="relative z-10 max-w-[70%] truncate px-1 py-1 text-left text-[12px] font-semibold text-black/[0.48] [touch-action:none]"
                >
                  {group}
                </button>
                <span className="relative z-10 pointer-events-none ml-auto mr-1 text-[10px] font-semibold text-black/[0.32]">
                  {summaries.length}
                </span>
              </div>
              {!collapsed && (
                <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_8px_24px_rgba(60,70,80,.05)]">
                  {summaries.map((summary) => {
                    const profile: ConversationThreadProfile = threadProfiles[summary.threadId];
                    const dragging = draggingThreadId === summary.threadId;
                    const unreadCount = Number(unreadCounts[summary.threadId] || 0);
                    return (
                      <button
                        key={summary.threadId}
                        type="button"
                        onClick={() => {
                          if (suppressClickRef.current) {
                            suppressClickRef.current = false;
                            return;
                          }
                          onSelectThread(summary);
                        }}
                        onPointerDown={(event) => {
                          if (event.pointerType === "touch") return;
                          event.currentTarget.setPointerCapture?.(event.pointerId);
                          pressStartRef.current = { x: event.clientX, y: event.clientY };
                          suppressClickRef.current = false;
                          clearLongPress();
                          longPressTimerRef.current = window.setTimeout(() => {
                            document.body.style.userSelect = "none";
                            suppressClickRef.current = true;
                            draggingThreadRef.current = summary.threadId;
                            dragTargetGroupRef.current = group;
                            setDraggingThreadId(summary.threadId);
                            setDragTargetGroup(group);
                          }, 460);
                        }}
                        onPointerMove={(event) => {
                          if (event.pointerType === "touch") return;
                          if (!draggingThreadId) {
                            const distance = Math.hypot(
                              event.clientX - pressStartRef.current.x,
                              event.clientY - pressStartRef.current.y,
                            );
                            if (distance > 8) clearLongPress();
                            return;
                          }
                          event.preventDefault();
                          updateDropTarget(event.clientX, event.clientY);
                        }}
                        onPointerUp={(event) => {
                          if (event.pointerType !== "touch") void finishDrag();
                        }}
                        onPointerCancel={(event) => {
                          if (event.pointerType === "touch" && draggingThreadRef.current) return;
                          clearLongPress();
                          setDraggingThreadId("");
                          setDragTargetGroup("");
                        }}
                        onTouchStart={(event) => {
                          const touch = event.touches[0];
                          if (!touch) return;
                          pressStartRef.current = { x: touch.clientX, y: touch.clientY };
                          suppressClickRef.current = false;
                          clearLongPress();
                          longPressTimerRef.current = window.setTimeout(() => {
                            document.body.style.userSelect = "none";
                            suppressClickRef.current = true;
                            draggingThreadRef.current = summary.threadId;
                            dragTargetGroupRef.current = group;
                            setDraggingThreadId(summary.threadId);
                            setDragTargetGroup(group);
                          }, 420);
                        }}
                        onTouchEnd={() => void finishDrag()}
                        onTouchCancel={() => void finishDrag()}
                        className={`grid w-full grid-cols-[52px_minmax(0,1fr)_54px] items-center gap-3 border-b border-black/[0.055] px-4 py-4 text-left last:border-b-0 ${
                          dragging ? "scale-[0.99] bg-[#eef2f6] opacity-70" : ""
                        }`}
                      >
                        <ConversationAvatar src={profile.avatar} name={profile.name} size="md" />
                        <span className="min-w-0">
                          <b className="flex items-center gap-1 truncate text-[16px] font-bold text-black/[0.68]">
                            {profile.pinned ? <span className="text-[10px] text-[#75879b]">置顶</span> : null}
                            <span className="truncate">{profile.name}</span>
                          </b>
                          <span className="mt-1 block truncate text-[12px] font-normal text-black/[0.38]">{summary.snippet || "[新对话]"}</span>
                        </span>
                        <span className="flex min-h-[42px] flex-col items-end justify-between self-stretch py-0.5 text-right">
                          <span className="text-[11px] font-semibold text-[#a9afba]">
                            {formatThreadDate(summary)}
                          </span>
                          {unreadCount > 0 ? (
                            <span
                              className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#d27679] px-1.5 text-[10px] font-bold leading-none text-white"
                              aria-label={`${unreadCount} 条未读消息`}
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {draggingThreadId ? (
          <div className="sticky bottom-3 rounded-full bg-[#53677e] px-4 py-2 text-center text-[11px] font-semibold text-white shadow-lg">
            拖到或轻点分组标题
          </div>
        ) : null}
        {!threadSummaries.length && (
          <div className="px-6 py-16 text-center text-[12px] text-black/30">还没有对话记录</div>
        )}
      </div>
      {editingGroup ? (
        <GroupNameDialog
          value={groupDraft}
          onChange={setGroupDraft}
          onSave={saveGroupName}
          onClose={() => setEditingGroup("")}
        />
      ) : null}
    </section>
  );
}
