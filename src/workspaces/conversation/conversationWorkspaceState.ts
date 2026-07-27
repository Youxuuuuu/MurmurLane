import type { ConversationThreadProfile } from "../../lib/conversationProfiles";

export type ConversationPageMode =
  | "list"
  | "chat"
  | "search"
  | "global-search";

export interface ConversationNotification {
  readonly threadId: string;
  readonly date: string;
  readonly name: string;
  readonly avatar: string;
  readonly message: string;
  readonly count: number;
  readonly version: number;
}

export interface ConversationPlaceholder {
  readonly title: string;
  readonly description: string;
}

export interface ConversationWorkspaceState {
  readonly selectedThreadId: string;
  readonly calendarDate: string;
  readonly view: ConversationPageMode;
  readonly settingsMode: string | null;
  readonly profilePreview: {
    readonly threadId: string;
    readonly profile: ConversationThreadProfile;
  } | null;
  readonly placeholder: ConversationPlaceholder | null;
  readonly jumpDate: string | null;
  readonly threadSelectionTouched: boolean;
  readonly webThreadIds: readonly string[];
  readonly webThreadProfileOverrides: Readonly<
    Record<string, Partial<ConversationThreadProfile>>
  >;
  readonly unreadCounts: Readonly<Record<string, number>>;
  readonly notificationQueue: readonly ConversationNotification[];
}

export type ConversationWorkspaceAction =
  | {
      readonly type: "select-thread";
      readonly threadId: string;
    }
  | {
      readonly type: "open-date";
      readonly date: string;
      readonly jump: boolean;
    }
  | {
      readonly type: "set-view";
      readonly view: ConversationPageMode;
    }
  | {
      readonly type: "set-settings-mode";
      readonly mode: string | null;
    }
  | {
      readonly type: "set-profile-preview";
      readonly preview: {
        readonly threadId: string;
        readonly profile: ConversationThreadProfile;
      } | null;
    }
  | {
      readonly type: "set-placeholder";
      readonly placeholder: ConversationPlaceholder | null;
    }
  | {
      readonly type: "set-jump-date";
      readonly date: string | null;
    }
  | {
      readonly type: "create-draft";
      readonly threadId: string;
      readonly date: string;
      readonly profile: ConversationThreadProfile;
    }
  | {
      readonly type: "settle-draft";
      readonly draftThreadId: string;
      readonly threadId: string;
      readonly date: string;
      readonly profile: ConversationThreadProfile;
    }
  | {
      readonly type: "replace-selected-thread";
      readonly threadId: string;
    }
  | {
      readonly type: "receive-notification";
      readonly notification: ConversationNotification;
      readonly enqueue: boolean;
    }
  | {
      readonly type: "dismiss-notification";
    }
  | {
      readonly type: "clear-notifications";
    };

export function createConversationWorkspaceState({
  threadId,
  date,
}: {
  readonly threadId: string;
  readonly date: string;
}): ConversationWorkspaceState {
  return {
    selectedThreadId: threadId,
    calendarDate: date,
    view: "list",
    settingsMode: null,
    profilePreview: null,
    placeholder: null,
    jumpDate: null,
    threadSelectionTouched: false,
    webThreadIds: [],
    webThreadProfileOverrides: {},
    unreadCounts: {},
    notificationQueue: [],
  };
}

export function reduceConversationWorkspaceState(
  state: ConversationWorkspaceState,
  action: ConversationWorkspaceAction,
): ConversationWorkspaceState {
  if (action.type === "select-thread") {
    return {
      ...state,
      selectedThreadId: action.threadId,
      threadSelectionTouched: true,
      unreadCounts: {
        ...state.unreadCounts,
        [action.threadId]: 0,
      },
      notificationQueue: state.notificationQueue.filter(
        (notification) => notification.threadId !== action.threadId,
      ),
    };
  }
  if (action.type === "open-date") {
    return {
      ...state,
      calendarDate: action.date,
      jumpDate: action.jump ? action.date : null,
    };
  }
  if (action.type === "set-view") {
    return { ...state, view: action.view };
  }
  if (action.type === "set-settings-mode") {
    return { ...state, settingsMode: action.mode };
  }
  if (action.type === "set-profile-preview") {
    return { ...state, profilePreview: action.preview };
  }
  if (action.type === "set-placeholder") {
    return { ...state, placeholder: action.placeholder };
  }
  if (action.type === "set-jump-date") {
    return { ...state, jumpDate: action.date };
  }
  if (action.type === "replace-selected-thread") {
    return { ...state, selectedThreadId: action.threadId };
  }
  if (action.type === "create-draft") {
    return {
      ...state,
      selectedThreadId: action.threadId,
      calendarDate: action.date,
      view: "chat",
      placeholder: null,
      jumpDate: null,
      threadSelectionTouched: true,
      webThreadIds: Array.from(
        new Set([...state.webThreadIds, action.threadId]),
      ),
      webThreadProfileOverrides: {
        ...state.webThreadProfileOverrides,
        [action.threadId]: action.profile,
      },
    };
  }
  if (action.type === "settle-draft") {
    const nextProfiles = {
      ...state.webThreadProfileOverrides,
      [action.threadId]: action.profile,
    };
    if (
      action.draftThreadId &&
      action.draftThreadId !== action.threadId
    ) {
      delete nextProfiles[action.draftThreadId];
    }
    return {
      ...state,
      selectedThreadId: action.threadId,
      calendarDate: action.date,
      view: "chat",
      jumpDate: null,
      threadSelectionTouched: true,
      webThreadIds: Array.from(
        new Set([
          ...state.webThreadIds.filter(
            (threadId) => threadId !== action.draftThreadId,
          ),
          action.threadId,
        ]),
      ),
      webThreadProfileOverrides: nextProfiles,
    };
  }
  if (action.type === "receive-notification") {
    const existing = state.notificationQueue.find(
      (notification) =>
        notification.threadId === action.notification.threadId,
    );
    return {
      ...state,
      unreadCounts: {
        ...state.unreadCounts,
        [action.notification.threadId]:
          Number(state.unreadCounts[action.notification.threadId] || 0) +
          action.notification.count,
      },
      notificationQueue: !action.enqueue
        ? state.notificationQueue
        : existing
        ? state.notificationQueue.map((notification) =>
            notification.threadId === action.notification.threadId
              ? {
                  ...notification,
                  ...action.notification,
                  count:
                    notification.count + action.notification.count,
                  version: notification.version + 1,
                }
              : notification,
          )
        : [...state.notificationQueue, action.notification],
    };
  }
  if (action.type === "dismiss-notification") {
    return {
      ...state,
      notificationQueue: state.notificationQueue.slice(1),
    };
  }
  if (action.type === "clear-notifications") {
    return { ...state, notificationQueue: [] };
  }
  return state;
}
