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

  const update = (changes: Record<string, string>) =>
    setDraft((current) => ({ ...current, ...changes }));

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/25 px-3 py-4 sm:items-center">
      <button className="absolute inset-0" type="button" onClick={onClose} aria-label="关闭" />
      <section className="relative z-10 w-full max-w-[420px] rounded-[22px] bg-white px-5 pb-5 pt-4 font-sans shadow-2xl">
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
          <button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-2 text-[12px] font-semibold text-black/48">
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
          ].map(([key, label]) => (
            <label key={key} className="block text-[11px] font-semibold text-black/38">
              {label}
              <input
                className="mt-1 w-full rounded-[8px] border border-black/10 bg-[#f7f7f6] px-3 py-2.5 text-[13px] font-normal text-black/72 outline-none focus:border-black/25"
                value={String(draft[key as keyof typeof draft] || "")}
                onChange={(event) => update({ [key]: event.target.value })}
              />
            </label>
          ))}
        </div>

        {isThread && (
          <div className="mt-4 border-t border-black/[0.06] pt-4">
            <div className="text-[11px] font-semibold text-black/38">当前聊天背景</div>
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
                  onClick={() => update({ background, backgroundImage: "" })}
                  aria-label={`选择背景 ${background}`}
                />
              ))}
              <button
                type="button"
                onClick={() => backgroundInputRef.current?.click()}
                className="flex h-9 min-w-9 items-center justify-center rounded-full border border-dashed border-black/20 px-2 text-[10px] text-black/45"
              >
                图片
              </button>
              <input
                ref={backgroundInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) readImage(file, (backgroundImage) => update({ backgroundImage }));
                }}
              />
            </div>
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
            } catch {
              setSaveError("保存失败，请确认当前设备已配置编辑权限。");
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
