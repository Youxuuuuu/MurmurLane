import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ConversationAvatar } from "./ConversationAvatar";

type MessageNotification = {
  threadId: string;
  name: string;
  avatar?: string;
  message: string;
  count: number;
  version: number;
};

type MessageNotificationBannerProps = {
  notification: MessageNotification | null;
  onOpen: (notification: MessageNotification) => void;
  onDismiss: () => void;
};

export function MessageNotificationBanner({
  notification,
  onOpen,
  onDismiss,
}: MessageNotificationBannerProps) {
  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [notification, onDismiss]);

  return (
    <AnimatePresence mode="wait">
      {notification ? (
        <motion.button
          key={notification.threadId}
          type="button"
          aria-live="polite"
          className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+10px)] z-[210] mx-auto flex min-h-11 max-w-[420px] items-center gap-3 rounded-[16px] border border-black/[0.07] bg-white/95 px-3 py-2.5 text-left font-sans shadow-[0_4px_8px_rgba(40,48,58,.14)] backdrop-blur"
          initial={{ opacity: 0, y: -22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.985 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => onOpen(notification)}
        >
          <ConversationAvatar
            src={notification.avatar}
            name={notification.name}
            size="sm"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-black/[0.76]">
              <span className="truncate">{notification.name}</span>
              {notification.count > 1 ? (
                <span className="shrink-0 text-[10px] font-medium text-black/[0.36]">
                  {notification.count} 条新消息
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-black/[0.48]">
              {notification.message}
            </span>
          </span>
          <span className="shrink-0 text-[15px] text-black/[0.24]" aria-hidden="true">
            ›
          </span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
