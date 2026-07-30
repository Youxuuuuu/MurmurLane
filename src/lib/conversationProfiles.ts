import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ConversationProfileApiData,
  ConversationProfilesResponse,
} from "../types/api";
import type { ConversationRecord } from "../types/conversation";
import { getConversationRenderId } from "./conversationIdentity";

export type ConversationIdentity = {
  name: string;
  handle: string;
  signature: string;
  avatar: string;
  groups?: string[];
};

export type ConversationThreadProfile = ConversationIdentity & {
  background: string;
  backgroundImage: string;
  backgroundPositionX: number;
  backgroundPositionY: number;
  group: string;
  pinned: boolean;
  thinkingFace: string;
  listHidden: boolean;
  listHiddenThrough: string;
};

const USER_PROFILE_KEY = "murmurlane.conversation.user-profile.v1";
const THREAD_PROFILES_KEY = "murmurlane.conversation.thread-profiles.v1";

export const defaultUserProfile: ConversationIdentity = {
  name: "user_213",
  handle: "@user_213",
  signature: "你是下雨时的屋檐，方大同",
  avatar: "",
  groups: [],
};

const defaultThreadNames = [
  "Hubby",
  "季朝凡",
  "官宥廷",
  "肖墨",
  "宋书越",
  "濯",
  "棠 ✈️",
];

export function createDefaultThreadProfile(
  threadId: string,
  index = 0,
): ConversationThreadProfile {
  return {
    name: defaultThreadNames[index] ?? `对话 ${String(index + 1).padStart(2, "0")}`,
    handle: `@${threadId.slice(0, 8)}`,
    signature: "只要条件是你，结论就是爱",
    avatar: "",
    background: "#fbfbfa",
    backgroundImage: "",
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    group: "",
    pinned: false,
    thinkingFace: ">ᴗo ಣ >",
    listHidden: false,
    listHiddenThrough: "",
  };
}

export interface ConversationThreadSummaryActivity {
  readonly threadId: string;
  readonly latestRecord: ConversationRecord | null;
}

export function getConversationSummaryActivityKey(
  summary: ConversationThreadSummaryActivity,
) {
  return summary.latestRecord
    ? getConversationRenderId(
        summary.latestRecord,
        summary.threadId,
      )
    : "";
}

export function isConversationThreadVisibleInList(
  profile: ConversationThreadProfile | undefined,
  summary: ConversationThreadSummaryActivity,
) {
  if (!profile?.listHidden) return true;
  const boundary = String(
    profile.listHiddenThrough || "",
  ).trim();
  const latest = getConversationSummaryActivityKey(summary);
  return Boolean(boundary && latest && boundary !== latest);
}

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? ({ ...fallback, ...JSON.parse(value) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredThreadProfiles(): Record<
  string,
  Partial<ConversationThreadProfile>
> {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(THREAD_PROFILES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export interface ConversationProfileCommands {
  saveUserProfile(
    profile: ConversationIdentity,
  ): Promise<ConversationProfileApiData>;
  saveThreadProfile(
    threadId: string,
    profile: ConversationThreadProfile,
  ): Promise<ConversationProfileApiData>;
}

export function useConversationProfiles(
  threadIds: string[],
  profilesSnapshot: ConversationProfilesResponse | null,
  profileCommands: ConversationProfileCommands,
) {
  const [userProfile, setUserProfile] = useState<ConversationIdentity>(() =>
    readStoredValue(USER_PROFILE_KEY, defaultUserProfile),
  );
  const [storedThreadProfiles, setStoredThreadProfiles] = useState<
    Record<string, Partial<ConversationThreadProfile>>
  >(readStoredThreadProfiles);
  const [profileError, setProfileError] = useState("");
  const storedThreadProfilesRef = useRef(storedThreadProfiles);
  storedThreadProfilesRef.current = storedThreadProfiles;

  useEffect(() => {
    if (!profilesSnapshot) return;
    if (profilesSnapshot.user) {
      setUserProfile((current) => ({
        ...current,
        ...profilesSnapshot.user,
      }));
    }
    setStoredThreadProfiles((current) => ({
      ...current,
      ...(profilesSnapshot.threads ?? {}),
    }));
    setProfileError("");
  }, [profilesSnapshot]);

  const threadProfiles = useMemo(
    () =>
      Object.fromEntries(
        threadIds.map((threadId, index) => [
          threadId,
          {
            ...createDefaultThreadProfile(threadId, index),
            ...(storedThreadProfiles[threadId] ?? {}),
          },
        ]),
      ) as Record<string, ConversationThreadProfile>,
    [threadIds, storedThreadProfiles],
  );

  useEffect(() => {
    window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    window.localStorage.setItem(
      THREAD_PROFILES_KEY,
      JSON.stringify(storedThreadProfiles),
    );
  }, [storedThreadProfiles]);

  const saveUserProfile = useCallback(async (profile: ConversationIdentity) => {
    setUserProfile(profile);
    try {
      const saved = await profileCommands.saveUserProfile(profile);
      setUserProfile((current) => ({ ...current, ...saved }));
      setProfileError("");
      return saved;
    } catch (error) {
      const safeError = new Error(
        "个人资料保存失败，请稍后重试。",
      );
      setProfileError(safeError.message);
      throw safeError;
    }
  }, [profileCommands]);

  const updateThreadProfile = useCallback(async (
    threadId: string,
    changes: Partial<ConversationThreadProfile>,
  ) => {
    const previous = storedThreadProfilesRef.current[threadId] ?? {};
    setStoredThreadProfiles((current) => ({
      ...current,
      [threadId]: { ...(current[threadId] ?? {}), ...changes },
    }));
    try {
      const saved = await profileCommands.saveThreadProfile(
        threadId,
        changes as ConversationThreadProfile,
      );
      setStoredThreadProfiles((current) => ({
        ...current,
        [threadId]: { ...(current[threadId] ?? {}), ...saved },
      }));
      setProfileError("");
      return saved;
    } catch (error) {
      setStoredThreadProfiles((current) => ({
        ...current,
        [threadId]: previous,
      }));
      const safeError = new Error(
        "对话资料保存失败，请稍后重试。",
      );
      setProfileError(safeError.message);
      throw safeError;
    }
  }, [profileCommands]);

  return {
    userProfile,
    setUserProfile: saveUserProfile,
    threadProfiles,
    updateThreadProfile,
    profileError,
  };
}
