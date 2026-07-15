import { useRef, useState } from "react";
import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { ConversationAvatar } from "./ConversationAvatar";

const backgrounds = ["#fbfbfa", "#f7f3ee", "#eef2f3", "#f4eef2", "#eef1e9"];

function readImage(file: File, onLoad: (value: string) => void) {
  if (file.size > 2 * 1024 * 1024) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result || ""));
  reader.readAsDataURL(file);
}

export function ConversationSettingsModal({
  mode,
  profile,
  onSave,
  onClose,
}: {
  mode: "user" | "thread";
  profile: ConversationIdentity | ConversationThreadProfile;
  onSave: (profile: ConversationIdentity | ConversationThreadProfile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const isThread = mode === "thread";
  const selectedBackgroundImage = isThread
    ? (draft as ConversationThreadProfile).backgroundImage
    : "";
  const backgroundPositionX = isThread
    ? Number((draft as ConversationThreadProfile).backgroundPositionX ?? 50)
    : 50;
  const backgroundPositionY = isThread
    ? Number((draft as ConversationThreadProfile).backgroundPositionY ?? 50)
    : 50;

  const update = (changes: Record<string, string | number | boolean>) =>
    setDraft((current) => ({ ...current, ...changes }));

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/25 px-3 py-4 sm:items-center">
      <button className="absolute inset-0" type="button" onClick={onClose} aria-label="关闭" />
      <section className="diary-scroll relative z-10 max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-[22px] bg-white px-5 pb-5 pt-4 font-sans shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-black/80">
            {isThread ? "聊天设置" : "编辑个人档案"}
          </h2>
          <button type="button" onClick={onClose} className="text-[24px] text-black/35" aria-label="关闭">×</button>
        </div>

        <div className="mt-4 flex flex-col items-center">
          <button type="button" onClick={() => avatarInputRef.current?.click()}>
            <ConversationAvatar src={draft.avatar} name={draft.name} size="xl" />
          </button>
          <button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-2 text-[12px] font-semibold text-black/[0.48]">
            更换头像
          </button>
          <input
            ref={avatarInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readImage(file, (avatar) => update({ avatar }));
            }}
          />
        </div>

        <div className="mt-4 space-y-3">
          {[
            ["name", isThread ? "聊天备注" : "昵称"],
            ["handle", "账号"],
            ["signature", "个性签名"],
            ...(isThread ? [["thinkingFace", "Thinking 颜文字"]] : []),
          ].map(([key, label]) => (
            <label key={key} className="block text-[11px] font-semibold text-black/[0.38]">
              {label}
              <input
                className="mt-1 w-full rounded-[8px] border border-black/10 bg-[#f7f7f6] px-3 py-2.5 text-[13px] font-normal text-black/[0.72] outline-none focus:border-black/[0.25]"
                value={String(draft[key as keyof typeof draft] || "")}
                onChange={(event) => update({ [key]: event.target.value })}
              />
            </label>
          ))}
          {isThread && (
            <>
              <label className="block text-[11px] font-semibold text-black/[0.38]">
                聊天分组
                <input
                  className="mt-1 w-full rounded-[8px] border border-black/10 bg-[#f7f7f6] px-3 py-2.5 text-[13px] font-normal text-black/[0.72] outline-none focus:border-black/[0.25]"
                  value={(draft as ConversationThreadProfile).group || ""}
                  placeholder="留空时归入最近聊天"
                  onChange={(event) => update({ group: event.target.value })}
                />
              </label>
              <label className="flex items-center justify-between rounded-[10px] border border-black/[0.06] bg-[#f7f7f6] px-3 py-2.5 text-[12px] text-black/[0.62]">
                <span>
                  <b className="block font-semibold">置顶聊天</b>
                  <span className="mt-0.5 block text-[9px] text-black/[0.35]">置顶后显示在聊天列表最上方</span>
                </span>
                <input
                  type="checkbox"
                  checked={(draft as ConversationThreadProfile).pinned === true}
                  onChange={(event) => update({ pinned: event.target.checked })}
                  className="h-5 w-5 accent-[#657b94]"
                />
              </label>
            </>
          )}
        </div>

        {isThread && (
          <div className="mt-4 border-t border-black/[0.06] pt-4">
            <div className="text-[11px] font-semibold text-black/[0.38]">当前聊天背景</div>
            <div className="mt-2 flex items-center gap-2">
              {backgrounds.map((background) => (
                <button
                  key={background}
                  type="button"
                  className="h-9 w-9 rounded-full border-2"
                  style={{
                    background,
                    borderColor:
                      (draft as ConversationThreadProfile).background === background
                        ? "rgba(0,0,0,.52)"
                        : "rgba(0,0,0,.08)",
                  }}
                  onClick={() => update({ background })}
                  aria-label={`选择背景 ${background}`}
                />
              ))}
              <label
                className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2"
                style={{
                  background: (draft as ConversationThreadProfile).background,
                  borderColor:
                    !backgrounds.includes(
                      (draft as ConversationThreadProfile).background,
                    ) && !selectedBackgroundImage
                      ? "rgba(0,0,0,.52)"
                      : "rgba(0,0,0,.08)",
                }}
                title="选择自定义背景颜色"
              >
                <span className="pointer-events-none rounded-full bg-white/80 px-1 text-[13px] leading-5 text-black/55">
                  +
                </span>
                <input
                  type="color"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  value={(draft as ConversationThreadProfile).background || "#fbfbfa"}
                  aria-label="选择自定义背景颜色"
                  onChange={(event) =>
                    update({
                      background: event.target.value,
                    })
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => backgroundInputRef.current?.click()}
                className="flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-[10px] text-black/55"
                style={{
                  borderColor: selectedBackgroundImage
                    ? "rgba(0,0,0,.52)"
                    : "rgba(0,0,0,.2)",
                  borderStyle: selectedBackgroundImage ? "solid" : "dashed",
                  backgroundImage: selectedBackgroundImage
                    ? `linear-gradient(rgba(255,255,255,.58), rgba(255,255,255,.58)), url(${selectedBackgroundImage})`
                    : "none",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                {selectedBackgroundImage ? "已选" : "图片"}
              </button>
              {selectedBackgroundImage && (
                <button
                  type="button"
                  className="h-9 rounded-full border border-black/10 bg-black/[0.04] px-3 text-[10px] text-black/55"
                  onClick={() => {
                    update({ backgroundImage: "" });
                    if (backgroundInputRef.current) {
                      backgroundInputRef.current.value = "";
                    }
                  }}
                >
                  清除图片
                </button>
              )}
              <input
                ref={backgroundInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    readImage(file, (backgroundImage) =>
                      update({
                        backgroundImage,
                        backgroundPositionX: 50,
                        backgroundPositionY: 50,
                      }),
                    );
                  }
                  event.target.value = "";
                }}
              />
            </div>
            {selectedBackgroundImage && (
              <div className="mt-3 rounded-[10px] border border-black/10 bg-black/[0.03] p-3">
                <div
                  className="h-40 w-full overflow-hidden rounded-[7px] border border-black/10 bg-white"
                  style={{
                    backgroundImage: `url(${selectedBackgroundImage})`,
                    backgroundPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "cover",
                  }}
                  role="img"
                  aria-label="聊天背景显示范围预览"
                />
                <div className="mt-3 space-y-2.5">
                  <label className="grid grid-cols-[44px_minmax(0,1fr)_32px] items-center gap-2 text-[10px] text-black/50">
                    <span>左右</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={backgroundPositionX}
                      onChange={(event) =>
                        update({ backgroundPositionX: Number(event.target.value) })
                      }
                      className="w-full accent-black"
                    />
                    <span className="text-right font-mono">{backgroundPositionX}</span>
                  </label>
                  <label className="grid grid-cols-[44px_minmax(0,1fr)_32px] items-center gap-2 text-[10px] text-black/50">
                    <span>上下</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={backgroundPositionY}
                      onChange={(event) =>
                        update({ backgroundPositionY: Number(event.target.value) })
                      }
                      className="w-full accent-black"
                    />
                    <span className="text-right font-mono">{backgroundPositionY}</span>
                  </label>
                </div>
                <p className="mt-2 text-[9px] leading-4 text-black/35">
                  背景会铺满聊天窗口；拖动滑杆选择希望保留的画面范围。
                </p>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="mt-5 w-full rounded-[9px] bg-black py-3 text-[13px] font-semibold text-white"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setSaveError("");
            try {
              await onSave(draft);
              onClose();
            } catch (error) {
              setSaveError(
                error?.status === 404
                  ? "资料接口尚未加载，请重启 MurmurLane 后端后再保存。"
                  : error instanceof TypeError
                    ? "无法连接资料服务，请确认 MurmurLane 后端正在运行。"
                  : "保存失败，请确认前后端编辑 Token 已配置且一致。",
              );
              setSaving(false);
            }
          }}
        >
          {saving ? "保存中…" : "保存"}
        </button>
        {saveError && <p className="mt-2 text-center text-[10px] text-red-500/75">{saveError}</p>}
        <p className="mt-2 text-center text-[9px] text-black/25">图片不超过 2 MB，资料保存在 MurmurLane 本地数据目录</p>
      </section>
    </div>
  );
}
