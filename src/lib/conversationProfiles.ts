import { useEffect, useMemo, useState } from "react";
import {
  fetchConversationProfiles,
  saveConversationThreadProfile,
  saveConversationUserProfile,
} from "../data/api";

export type ConversationIdentity = {
  name: string;
  handle: string;
  signature: string;
  avatar: string;
};

export type ConversationThreadProfile = ConversationIdentity & {
  background: string;
  backgroundImage: string;
};

const USER_PROFILE_KEY = "murmurlane.conversation.user-profile.v1";
const THREAD_PROFILES_KEY = "murmurlane.conversation.thread-profiles.v1";

export const defaultUserProfile: ConversationIdentity = {
  name: "user_213",
  handle: "@user_213",
  signature: "你是下雨时的屋檐，方大同",
  avatar: "",
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
  };
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

function readStoredThreadProfiles() {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(THREAD_PROFILES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function useConversationProfiles(threadIds: string[]) {
  const [userProfile, setUserProfile] = useState<ConversationIdentity>(() =>
    readStoredValue(USER_PROFILE_KEY, defaultUserProfile),
  );
  const [storedThreadProfiles, setStoredThreadProfiles] = useState<
    Record<string, Partial<ConversationThreadProfile>>
  >(readStoredThreadProfiles);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchConversationProfiles()
      .then((result) => {
        if (cancelled) return;
        if (result.user) {
          setUserProfile((current) => ({ ...current, ...result.user }));
        }
        setStoredThreadProfiles((current) => ({
          ...current,
          ...(result.threads ?? {}),
        }));
        setProfileError("");
      })
      .catch((error) => {
        if (!cancelled) setProfileError(String(error?.message || error));
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const saveUserProfile = async (profile: ConversationIdentity) => {
    setUserProfile(profile);
    try {
      const saved = await saveConversationUserProfile(profile);
      setUserProfile((current) => ({ ...current, ...saved }));
      setProfileError("");
      return saved;
    } catch (error) {
      setProfileError(String(error?.message || error));
      throw error;
    }
  };

  const updateThreadProfile = async (
    threadId: string,
    changes: Partial<ConversationThreadProfile>,
  ) => {
    setStoredThreadProfiles((current) => ({
      ...current,
      [threadId]: { ...(current[threadId] ?? {}), ...changes },
    }));
    try {
      const saved = await saveConversationThreadProfile(
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
      setProfileError(String(error?.message || error));
      throw error;
    }
  };

  return {
    userProfile,
    setUserProfile: saveUserProfile,
    threadProfiles,
    updateThreadProfile,
    profileError,
  };
}
