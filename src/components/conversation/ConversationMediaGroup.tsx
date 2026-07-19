import { useState } from "react";
import { getConversationMediaSrc } from "../../lib/conversation";
import { getConversationMediaDisplayGroups } from "../../lib/conversationMediaDisplay";
import type { ConversationMediaItem } from "../../types/conversation";
import { TinyIcon } from "../common/TinyIcon";
import { ConversationPhotoGallery } from "./PhotoStack";

type MediaGroupPage = {
  color?: string;
  line?: string;
};

function getMediaKey(item: ConversationMediaItem, index: number) {
  return String(
    item.path
      || item.relativePath
      || item.url
      || item.mediaKey
      || item.fileName
      || item.stickerId
      || `media-${index}`,
  );
}

function getMediaLabel(item: ConversationMediaItem, fallback: string) {
  return String(
    item.label
      || item.fileName
      || item.stickerId
      || item.relativePath
      || fallback,
  );
}

function StickerMedia({
  item,
  mediaKey,
}: {
  item: ConversationMediaItem;
  mediaKey: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = getConversationMediaSrc(item);
  const label = getMediaLabel(item, "表情包");

  return (
    <span
      className="flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-xl bg-transparent"
      title={label}
      data-conversation-media="sticker"
      data-media-key={mediaKey}
    >
      {src && !failed ? (
        <img
          className="block h-full w-full rounded-xl object-contain"
          src={src}
          alt={label}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <TinyIcon color="rgba(0,0,0,.38)" />
      )}
    </span>
  );
}

export function ConversationMediaGroup({
  items,
  page,
  align,
}: {
  items: ConversationMediaItem[];
  page?: MediaGroupPage;
  align: "left" | "right";
}) {
  const groups = getConversationMediaDisplayGroups(items);

  return (
    <div
      className={`flex max-w-[min(92vw,360px)] flex-col gap-1.5 ${align === "right" ? "items-end" : "items-start"}`}
      data-conversation-media-group="true"
    >
      {groups.stickers.map((item, index) => {
        const mediaKey = getMediaKey(item, index);
        return <StickerMedia key={mediaKey} item={item} mediaKey={mediaKey} />;
      })}

      {groups.images.length ? (
        <div
          className={`max-w-[min(92vw,360px)] ${align === "right" ? "mr-8 sm:mr-12" : "ml-4 sm:ml-6"}`}
          data-conversation-media="images"
          data-media-count={groups.images.length}
        >
          <ConversationPhotoGallery
            items={groups.images}
            page={page}
            controlSide={align === "right" ? "left" : "right"}
          />
        </div>
      ) : null}

      {groups.files.map((item, index) => (
        <div
          key={getMediaKey(item, index)}
          className="max-w-[220px] rounded-[5px] bg-white/55 px-2.5 py-2 text-[11px] text-black/55"
          data-conversation-media="file"
        >
          {getMediaLabel(item, "附件")}
        </div>
      ))}
    </div>
  );
}
